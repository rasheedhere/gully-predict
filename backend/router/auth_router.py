import os
import uuid
from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import httpx

from backend.database import get_db
from backend.models import User, AllowlistedEmail, League, LeagueAdminMapping, LeagueUserMapping, SystemEventType
from backend.auth import oauth, create_access_token
from backend.dependencies import get_current_user
from backend.utils.cache import backend_cache
from backend.utils.events import dispatch_event
from backend.utils.alias import generate_random_alias

router = APIRouter(prefix="/api", tags=["auth"])

@router.get("/auth/google")
async def login_via_google(request: Request):
    # Clear any old piled-up session states so we don't blow past the 4096 Byte Browser Cookie Limit.
    request.session.clear()
    
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback")
    print("--- LOGIN VIA GOOGLE ---")
    print("Pre-Session:", request.session)
    response = await oauth.google.authorize_redirect(request, redirect_uri)
    print("Post-Session:", request.session)
    return response

@router.get("/auth/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    print("--- AUTH CALLBACK ---")
    print("Cookies:", request.cookies)
    print("Session:", request.session)
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(status_code=400, detail="Missing user info in token")
            
        email = user_info.get("email")
        
        # 1. Check Allowlist or Existing User
        allowlisted_entry = None
        cached_allowlist = backend_cache.get("allowlist")
        if cached_allowlist:
            for entry in cached_allowlist:
                if entry.email == email:
                    allowlisted_entry = entry
                    break
        else:
            result = await db.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == email))
            allowlisted_entry = result.scalars().first()
            
        # Check if user already exists in the database (Implicit Whitelist)
        user_result = await db.execute(select(User).where(User.email == email))
        existing_user = user_result.scalars().first()

        if not allowlisted_entry and not existing_user:
            # If email is not on allowlist AND user does not exist
            return RedirectResponse(url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5000')}/login?error=not_invited")
            
        is_guest_allowed = allowlisted_entry.is_guest if allowlisted_entry else (existing_user.is_guest if existing_user else False)
            
        # 2. Upsert User using google_id
        google_id = user_info.get("sub")
        name = user_info.get("name")
        avatar_url = user_info.get("picture")
        
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            # Create user on first login
            # Generate unique alias
            alias = generate_random_alias()
            # Basic collision check (loop until unique)
            while (await db.execute(select(User).where(User.alias == alias))).scalars().first():
                alias = generate_random_alias()

            user = User(
                id=str(uuid.uuid4()),
                google_id=google_id,
                email=email,
                name=name,
                alias=alias,
                use_alias=False, # Default to original name
                avatar_url=avatar_url,
                is_guest=is_guest_allowed
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            if user.is_guest != is_guest_allowed:
                user.is_guest = is_guest_allowed
                await db.commit()
                await db.refresh(user)
            
        # 3. Issue JWT Session Token
        jwt_token = create_access_token(data={"sub": user.id})
        
        # Log event
        await dispatch_event(
            db,
            event_type=SystemEventType.login,
            user_id=user.id,
            message=f"{user.name} logged in via Google."
        )
        await db.commit()
        
        # Redirect back to frontend with Token (frontend handles parsing)
        # Assuming frontend grabs ?token=... and saves it to Zustand
        return RedirectResponse(url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5000')}/auth/callback?token={jwt_token}")
        
    except Exception as e:
        import traceback
        print(f"--- AUTH ERROR ---")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Detail: {str(e)}")
        traceback.print_exc()
        return RedirectResponse(url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5000')}/login?error=auth_failed")

class VerifyTokenRequest(BaseModel):
    access_token: str | None = None
    credential: str | None = None

@router.post("/auth/google/verify")
async def verify_google_token(payload: VerifyTokenRequest, db: AsyncSession = Depends(get_db)):
    """Verifies a token sent from the frontend (@react-oauth/google)"""
    async with httpx.AsyncClient() as client:
        if payload.credential:
            # Verify ID Token (used by <GoogleLogin> iframe button)
            response = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.credential}")
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google credential")
            user_info = response.json()
        elif payload.access_token:
            # Verify Access Token (used by useGoogleLogin popup)
            response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.access_token}"}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google access token")
            user_info = response.json()
        else:
            raise HTTPException(status_code=400, detail="Must provide credential or access_token")
        
    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Missing email in token")
        
    # 1. Check Allowlist or Existing User
    allowlisted_entry = None
    cached_allowlist = backend_cache.get("allowlist")
    if cached_allowlist:
        for entry in cached_allowlist:
            if entry.email == email:
                allowlisted_entry = entry
                break
    else:
        result = await db.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == email))
        allowlisted_entry = result.scalars().first()
        
    user_result = await db.execute(select(User).where(User.email == email))
    existing_user = user_result.scalars().first()

    if not allowlisted_entry and not existing_user:
        raise HTTPException(status_code=403, detail="ACCESS DENIED: Not on the guest list")
        
    is_guest_allowed = allowlisted_entry.is_guest if allowlisted_entry else (existing_user.is_guest if existing_user else False)
        
    # 2. Upsert User
    google_id = user_info.get("sub")
    name = user_info.get("name")
    avatar_url = user_info.get("picture")
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        alias = generate_random_alias()
        while (await db.execute(select(User).where(User.alias == alias))).scalars().first():
            alias = generate_random_alias()

        user = User(
            id=str(uuid.uuid4()),
            google_id=google_id,
            email=email,
            name=name,
            alias=alias,
            use_alias=False,
            avatar_url=avatar_url,
            is_guest=is_guest_allowed
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if user.is_guest != is_guest_allowed:
            user.is_guest = is_guest_allowed
            await db.commit()
            await db.refresh(user)
            
    # 3. Issue JWT Session Token
    jwt_token = create_access_token(data={"sub": user.id})
    
    await dispatch_event(
        db,
        event_type=SystemEventType.login,
        user_id=user.id,
        message=f"{user.name} logged in via Google (PWA flow)."
    )
    await db.commit()
    
    is_league_admin = False
    if not user.is_admin:
        res = await db.execute(select(LeagueAdminMapping).where(LeagueAdminMapping.user_id == user.id))
        is_league_admin = res.scalars().first() is not None
        
    return {
        "token": jwt_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "alias": user.alias,
            "use_alias": user.use_alias,
            "avatar": user.avatar_url,
            "is_admin": user.is_admin,
            "is_guest": user.is_guest,
            "is_telegram_admin": user.is_telegram_admin,
            "is_league_admin": is_league_admin or user.is_admin,
            "last_read_announcements_at": user.last_read_announcements_at.isoformat() if user.last_read_announcements_at else None,
        }
    }

@router.get("/auth/dev-login")
@router.post("/auth/dev-login")
async def dev_login(request: Request, role: str = "user", db: AsyncSession = Depends(get_db)):
    """Dev-only login bypass. Enable with DEV_LOGIN_ENABLED=true.

    Creates or reuses a local test user and returns a JWT, skipping OAuth + allowlist checks.
    """
    if os.environ.get("DEV_LOGIN_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found")

    if role not in ("admin", "user", "guest", "league-admin"):
        raise HTTPException(status_code=400, detail="role must be admin, user, guest, or league-admin")

    email = f"dev-{role}@local.test"
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        alias = generate_random_alias()
        user = User(
            id=str(uuid.uuid4()),
            google_id=f"dev-{role}",
            email=email,
            name=f"Dev {role.capitalize()}",
            alias=alias,
            use_alias=False,
            avatar_url=None,
            is_admin=(role == "admin"),
            is_guest=(role == "guest"),
        )
        db.add(user)
        
        if role == "league-admin":
            league = League(
                id=str(uuid.uuid4()),
                name="Test Dev League",
                invite_code="DEV123",
                created_by=user.id,
            )
            db.add(league)
            db.add(LeagueAdminMapping(user_id=user.id, league_id=league.id))
            db.add(LeagueUserMapping(user_id=user.id, league_id=league.id))
            
        await db.commit()
        await db.refresh(user)

    jwt_token = create_access_token(data={"sub": user.id})
    
    # If GET (browser URL), redirect to frontend
    if request.method == "GET":
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5000')
        return RedirectResponse(url=f"{frontend_url}/auth/callback?token={jwt_token}")
    
    # If POST (frontend AJAX), return JSON
    is_league_admin = False
    if not user.is_admin:
        res = await db.execute(select(LeagueAdminMapping).where(LeagueAdminMapping.user_id == user.id))
        is_league_admin = res.scalars().first() is not None

    return {
        "token": jwt_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "alias": user.alias,
            "use_alias": user.use_alias,
            "avatar": user.avatar_url,
            "is_admin": user.is_admin,
            "is_guest": user.is_guest,
            "is_telegram_admin": user.is_telegram_admin,
            "is_league_admin": is_league_admin or user.is_admin,
            "last_read_announcements_at": user.last_read_announcements_at.isoformat() if user.last_read_announcements_at else None,
        },
    }


@router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    is_league_admin = False
    if not user.is_admin:
        res = await db.execute(select(LeagueAdminMapping).where(LeagueAdminMapping.user_id == user.id))
        is_league_admin = res.scalars().first() is not None

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "alias": user.alias,
        "use_alias": user.use_alias,
        "avatar": user.avatar_url,
        "is_admin": user.is_admin,
        "is_guest": user.is_guest,
        "is_telegram_admin": user.is_telegram_admin,
        "is_league_admin": is_league_admin or user.is_admin,
        "last_read_announcements_at": user.last_read_announcements_at.isoformat() if user.last_read_announcements_at else None,
    }

@router.put("/user/profile")
async def update_profile(
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    alias = payload.get("alias")
    use_alias = payload.get("use_alias")

    # Re-fetch user in this session to avoid "not persistent" error
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalars().first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if alias is not None:
        # Check uniqueness
        if alias != db_user.alias:
            result = await db.execute(select(User).where(User.alias == alias))
            existing = result.scalars().first()
            if existing:
                raise HTTPException(status_code=400, detail="Alias already taken")
            db_user.alias = alias

    if use_alias is not None:
        db_user.use_alias = use_alias

    await db.commit()
    await db.refresh(db_user)
    
    return {"status": "success", "user": {
        "id": db_user.id,
        "name": db_user.name,
        "alias": db_user.alias,
        "use_alias": db_user.use_alias
    }}
