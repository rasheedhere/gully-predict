from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.database import get_db
from backend.models import Announcement, User
from backend.dependencies import get_current_user
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/api/announcements", tags=["announcements"])

# --- Schemas ---

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    action_label: Optional[str] = None
    action_url: Optional[str] = None
    is_active: bool = True

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    action_label: Optional[str] = None
    action_url: Optional[str] = None
    is_active: Optional[bool] = None

class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    action_label: Optional[str] = None
    action_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# --- User Endpoints ---

@router.get("", response_model=List[AnnouncementOut])
async def get_active_announcements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all active announcements."""
    result = await db.execute(
        select(Announcement)
        .where(Announcement.is_active == True)
        .order_by(desc(Announcement.created_at))
    )
    return result.scalars().all()

@router.post("/mark-read")
async def mark_announcements_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the user's last_read_announcements_at timestamp."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.last_read_announcements_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Announcements marked as read"}

# --- Admin Endpoints ---

@router.get("/admin", response_model=List[AnnouncementOut])
async def admin_list_announcements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all announcements (active and inactive) for admin management."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(Announcement).order_by(desc(Announcement.created_at)))
    return result.scalars().all()

@router.post("/admin", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def admin_create_announcement(
    payload: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new announcement."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    announcement = Announcement(
        title=payload.title,
        content=payload.content,
        action_label=payload.action_label,
        action_url=payload.action_url,
        is_active=payload.is_active,
        created_by=current_user.id
    )
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    return announcement

@router.put("/admin/{announcement_id}", response_model=AnnouncementOut)
async def admin_update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing announcement."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
    announcement = result.scalars().first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(announcement, key, value)
        
    await db.commit()
    await db.refresh(announcement)
    return announcement

@router.delete("/admin/{announcement_id}")
async def admin_delete_announcement(
    announcement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an announcement."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
    announcement = result.scalars().first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    await db.delete(announcement)
    await db.commit()
    return {"message": "Announcement deleted"}
