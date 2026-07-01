import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.database import get_db
from backend.models import User, AllowlistedEmail, Match, LeagueAdminMapping, TournamentUserMapping, AdminChatSession, AdminChatMessage
from datetime import datetime, timezone
from backend.dependencies import get_current_admin, get_current_user
from backend.scoring import calculate_match_scores
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/api/admin", tags=["admin"])

class MatchResultUpdate(BaseModel):
    answers: dict

class AllowlistEmailsRequest(BaseModel):
    emails: List[str]
    is_guest: bool = False

@router.get("/allowlist")
async def get_allowlist(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    cache_key = "allowlist"
    cached = await backend_cache.get(cache_key)
    if cached:
        return cached

    result = await db.execute(select(AllowlistedEmail).order_by(AllowlistedEmail.added_at.desc()))
    entries = result.scalars().all()
    await backend_cache.set(cache_key, entries)
    return entries

@router.post("/allowlist")
async def add_to_allowlist(data: AllowlistEmailsRequest, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    added = []
    for email in data.emails:
        clean_email = email.strip().lower()
        if not clean_email:
            continue
        
        # Check if exists
        result = await db.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == clean_email))
        if not result.scalars().first():
            new_entry = AllowlistedEmail(email=clean_email, is_guest=data.is_guest)
            db.add(new_entry)
            added.append(clean_email)
            
    await db.commit()
    await backend_cache.invalidate("allowlist")
    return {"message": f"Added {len(added)} emails", "added": added}

@router.delete("/allowlist/{email}")
async def remove_from_allowlist(email: str, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == email))
    entry = result.scalars().first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Email not found in allowlist")
        
    await db.delete(entry)
    await db.commit()
    await backend_cache.invalidate("allowlist")
    return {"message": f"Removed {email} from allowlist"}

@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        res = await db.execute(select(LeagueAdminMapping).where(LeagueAdminMapping.user_id == current_user.id))
        if not res.scalars().first():
            raise HTTPException(status_code=403, detail="Not authorized")
            
    result = await db.execute(select(User).where(User.is_guest == False).order_by(User.created_at.desc()))
    return result.scalars().all()

@router.put("/scoring-rules")
async def update_scoring_rules(config: dict, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    rule = ScoringRule(id=str(uuid.uuid4()), config_json=config)
    db.add(rule)
    await db.commit()
    return {"message": "Scoring rules updated"}

@router.put("/matches/{match_id}/results")
async def trigger_match_scoring(match_id: str, payload: MatchResultUpdate, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    # answers is a dict of:
    # { "winner": "...", "team1_powerplay_score": 50, "team2_powerplay_score": 45, "player_of_the_match": "..." }
    answers = payload.answers
    
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Save the entire raw blob for audit/future use
    match.raw_result_json = answers

    # Mark as completed and save reporter
    from backend.models import MatchStatus
    match.status = MatchStatus.completed
    match.reported_by = current_admin.id
    match.report_method = "manual"
    await db.commit()
    await db.refresh(match)

    print(f"Match {match_id} results saved: {answers.get('winner') or 'Dynamic Results'}")

    # Trigger scoring engine

    await calculate_match_scores(match_id, db)
    
    # Invalidate Leaderboards after scoring update
    await backend_cache.invalidate("leaderboard_*")
    await backend_cache.invalidate("analysis_*")
    await backend_cache.invalidate("match_podiums")
    await backend_cache.invalidate(f"match_leaderboard_{match_id}")
    
    return {"message": "Results saved and scoring triggered successfully"}


@router.put("/users/{user_id}/base-stats")
async def update_user_base_stats(user_id: str, payload: dict, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # User-level attributes
    if "is_telegram_admin" in payload:
        user.is_telegram_admin = bool(payload["is_telegram_admin"])
    if "telegram_username" in payload:
        user.telegram_username = payload["telegram_username"]
    
    # Tournament-scoped attributes
    tournament_id = payload.get("tournament_id")
    if tournament_id and ("base_points" in payload or "base_powerups" in payload):
        res = await db.execute(
            select(TournamentUserMapping).where(
                TournamentUserMapping.tournament_id == tournament_id,
                TournamentUserMapping.user_id == user_id
            )
        )
        mapping = res.scalars().first()
        if not mapping:
            from backend.models import Campaign
            cam_res = await db.execute(
                select(Campaign.max_powerups).where(
                    Campaign.tournament_id == tournament_id,
                    Campaign.is_master == True
                ).limit(1)
            )
            default_powerups = cam_res.scalar_one_or_none() or 10
            mapping = TournamentUserMapping(
                tournament_id=tournament_id,
                user_id=user_id,
                base_points=0,
                base_powerups=default_powerups,
                powerups_used=0
            )
            db.add(mapping)
        
        if "base_points" in payload:
            mapping.base_points = int(payload["base_points"])
        if "base_powerups" in payload:
            mapping.base_powerups = int(payload["base_powerups"])

    await db.commit()
    
    # Invalidate Leaderboards
    await backend_cache.invalidate("leaderboard_*")
    await backend_cache.invalidate("analysis_*")
    
    return {
        "message": "User stats updated", 
        "user_id": user_id, 
        "is_telegram_admin": user.is_telegram_admin,
        "telegram_username": user.telegram_username
    }



@router.put("/predictions/{response_id}")
async def update_prediction(
    response_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.models import CampaignResponse, Campaign, LeagueAdminMapping
    res = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.campaign))
        .where(CampaignResponse.id == response_id)
    )
    c_resp = res.scalars().first()
    if not c_resp:
        raise HTTPException(status_code=404, detail="Prediction not found")

    # Authorize: global admin OR league admin for this campaign's league
    is_authorized = current_user.is_admin
    if not is_authorized and c_resp.campaign and c_resp.campaign.league_id:
        admin_res = await db.execute(
            select(LeagueAdminMapping).where(
                LeagueAdminMapping.league_id == c_resp.campaign.league_id,
                LeagueAdminMapping.user_id == current_user.id
            )
        )
        if admin_res.scalars().first():
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to edit this prediction")

    # Merge answers
    answers = dict(c_resp.answers or {})
    answers.update(payload)
    c_resp.answers = answers

    # Ensure it gets re-scored
    if c_resp.match_id:
        from backend.scoring import calculate_match_scores
        await calculate_match_scores(c_resp.match_id, db)
    else:
        from backend.campaigns_scoring import calculate_campaign_scores
        await calculate_campaign_scores(db, c_resp.campaign_id)

    # Invalidate cache
    await backend_cache.invalidate("leaderboard_*")
    await backend_cache.invalidate("analysis_*")
    await backend_cache.invalidate(f"user_pred_status:{c_resp.user_id}")

    await db.commit()
    return {"message": "Prediction updated"}

@router.post("/trigger-ai-predictions")
async def trigger_ai_predictions(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    from backend.scheduler import auto_predict_daily_job
    import asyncio
    
    # Run the background job synchronously for the API response
    asyncio.create_task(auto_predict_daily_job())
    return {"message": "AI prediction job triggered in the background"}

class TournamentStatusUpdate(BaseModel):
    status: str

@router.put("/tournaments/{tournament_id}/status")
async def update_tournament_status(
    tournament_id: str,
    payload: TournamentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    from backend.models import Tournament, TournamentStatus
    try:
        new_status = TournamentStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tournament status")

    res = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = res.scalars().first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    tournament.status = new_status
    await db.commit()
    
    # Invalidate cache
    await backend_cache.invalidate("matches_*")
    await backend_cache.invalidate("tournaments_*")
    
    return {"message": f"Tournament status updated to {new_status.value}"}


@router.post("/trigger-ai-grading")
async def trigger_ai_grading(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    from backend.scheduler import auto_grade_completed_matches_job
    import asyncio
    
    asyncio.create_task(auto_grade_completed_matches_job())
    return {"message": "AI grading job triggered in the background for all pending matches"}


@router.post("/matches/{match_id}/trigger-ai-grading")
async def trigger_single_match_ai_grading(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    from backend.agents.match_result_agent import match_result_agent
    
    result = await match_result_agent.fetch_match_results(match_id, db)
    if not result:
        raise HTTPException(
            status_code=500,
            detail=f"AI Agent failed to grade match {match_id}. Check server logs for details."
        )
    return {"message": f"Match {match_id} graded successfully via AI.", "result": result}


# ── SQL Assistant Endpoints ──────────────────────────────────────────────────

from datetime import date
from decimal import Decimal
from uuid import UUID

def make_serializable(val):
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    elif isinstance(val, Decimal):
        return float(val)
    elif isinstance(val, UUID):
        return str(val)
    elif isinstance(val, bytes):
        return val.decode('utf-8', errors='replace')
    elif isinstance(val, dict):
        return {k: make_serializable(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [make_serializable(v) for v in val]
    return val

class SQLAssistantRequest(BaseModel):
    query: str

class SQLAssistantResponse(BaseModel):
    sql: str
    results: List[dict]
    summary: str
    error: Optional[str] = None

@router.post("/sql-assistant/chat", response_model=SQLAssistantResponse)
async def sql_assistant_chat(
    payload: SQLAssistantRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    from backend.utils.llm_client import GeminiLLMClient
    from sqlalchemy import text
    
    llm = GeminiLLMClient()
    
    from backend.utils.sql_assistant_registry import get_db_schema_context
    schema_desc = (
        "You are an expert system that translates natural language questions into PostgreSQL-compatible SQL queries for the Gully Predict database.\n"
        + await get_db_schema_context(db)
        + "\n\nReturn ONLY the raw SQL query. Do not wrap the SQL query in markdown blocks, formatting, explanation, or commentary. Do not write anything other than the SQL query."
    )
    
    prompt = f"Convert this question into a single PostgreSQL-compatible read-only SQL query: {payload.query}"
    
    try:
        raw_llm_response = await llm.generate_text(prompt=prompt, system_instruction=schema_desc)
        sql = raw_llm_response.strip()
        # Clean markdown fences
        if sql.startswith("```"):
            lines = sql.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            sql = "\n".join(lines).strip()
        if sql.lower().startswith("sql"):
            sql = sql[3:].strip()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate SQL query: {str(e)}"
        )
        
    from backend.utils.sql_validator import validate_and_sanitize_sql
    try:
        sql = validate_and_sanitize_sql(sql)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"SQL safety violation: {str(e)}"
        )

    results = []
    error_msg = None
    
    try:
        async with db.begin_nested() if db.in_transaction() else db.begin():
            if "sqlite" not in str(db.bind.url):
                await db.execute(text("SET TRANSACTION READ ONLY"))
                await db.execute(text("SET local statement_timeout = 3000"))
            
            db_res = await db.execute(text(sql))
            if db_res.returns_rows:
                for row in db_res.all():
                    results.append(make_serializable(dict(row._mapping)))
    except Exception as e:
        error_msg = str(e)
        
    summary_prompt = f"User query: {payload.query}\nGenerated SQL: {sql}\n"
    if error_msg:
        summary_prompt += f"Execution Error: {error_msg}\nExplain the error and suggest fixes."
    else:
        summary_prompt += f"Execution Results (up to first 100 rows shown): {results[:100]}\nSummarize the findings clearly."
        
    summary_instruction = """
    You are an intelligent assistant for the Gully Predict admin dashboard.
    Analyze the user's natural language question, the generated SQL, and the execution results (or error), then write a concise, clear summary explaining the results.
    If there is an error, explain the issue. Keep your tone professional, concise, and helpful.
    """
    
    try:
        summary = await llm.generate_text(prompt=summary_prompt, system_instruction=summary_instruction)
    except Exception as e:
        summary = f"Results retrieved but failed to generate text summary: {str(e)}"
        
    return SQLAssistantResponse(
        sql=sql,
        results=results,
        summary=summary,
        error=error_msg
    )


@router.get("/sql-assistant/sessions")
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(
        select(AdminChatSession)
        .where(AdminChatSession.user_id == current_admin.id)
        .order_by(AdminChatSession.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/sql-assistant/sessions/{session_id}")
async def get_session_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    sess_res = await db.execute(
        select(AdminChatSession).where(
            AdminChatSession.id == session_id,
            AdminChatSession.user_id == current_admin.id
        )
    )
    if not sess_res.scalars().first():
        raise HTTPException(status_code=404, detail="Chat session not found")

    result = await db.execute(
        select(AdminChatMessage)
        .where(AdminChatMessage.session_id == session_id)
        .order_by(AdminChatMessage.created_at.asc())
    )
    return result.scalars().all()


@router.post("/sql-assistant/sessions/{session_id}/chat")
async def sql_assistant_session_chat(
    session_id: str,
    payload: SQLAssistantRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    from backend.utils.llm_client import GeminiLLMClient
    from sqlalchemy import text
    import hashlib
    import json

    # 1. Resolve Session (or create fallback if "new")
    if session_id == "new":
        session = AdminChatSession(
            user_id=current_admin.id,
            title=payload.query[:50]
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        session_id_val = session.id
    else:
        try:
            session_id_val = int(session_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session ID format")

        res = await db.execute(
            select(AdminChatSession).where(
                AdminChatSession.id == session_id_val,
                AdminChatSession.user_id == current_admin.id
            )
        )
        session = res.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

    # Update session updated_at
    session.updated_at = datetime.now(timezone.utc)

    # 2. Persist User Message
    user_msg = AdminChatMessage(
        session_id=session_id_val,
        role="user",
        content=payload.query
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    # 3. Fetch all messages in session for history
    hist_res = await db.execute(
        select(AdminChatMessage)
        .where(AdminChatMessage.session_id == session_id_val)
        .order_by(AdminChatMessage.created_at.asc())
    )
    db_messages = hist_res.scalars().all()

    # If first message (besides the one we just added), update session title
    if len(db_messages) <= 2:
        session.title = payload.query[:50]
        await db.commit()

    # Format history as flat list
    history = []
    for msg in db_messages:
        history.append({
            "role": msg.role,
            "content": msg.content
        })

    llm = GeminiLLMClient()

    # 4. Generate SQL
    from backend.utils.sql_assistant_registry import get_db_schema_context
    schema_desc = (
        "You are an expert system that translates natural language questions into PostgreSQL-compatible SQL queries for the Gully Predict database.\n"
        + await get_db_schema_context(db)
        + "\n\nReturn ONLY the raw SQL query. Do not wrap the SQL query in markdown blocks, formatting, explanation, or commentary. Do not write anything other than the SQL query."
    )

    try:
        raw_llm_response = await llm.generate_chat_response(history=history, system_instruction=schema_desc)
        sql = raw_llm_response.strip()
        if sql.startswith("```"):
            lines = sql.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            sql = "\n".join(lines).strip()
        if sql.lower().startswith("sql"):
            sql = sql[3:].strip()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate SQL query: {str(e)}"
        )

    from backend.utils.sql_validator import validate_and_sanitize_sql
    try:
        sql = validate_and_sanitize_sql(sql)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"SQL safety violation: {str(e)}"
        )

    results = []
    error_msg = None

    sql_hash = hashlib.md5(sql.encode('utf-8')).hexdigest()
    cache_key = f"sql_cache_{sql_hash}"
    cached_results = await backend_cache.get(cache_key)

    if cached_results is not None:
        results = cached_results
    else:
        try:
            async with db.begin_nested() if db.in_transaction() else db.begin():
                if "sqlite" not in str(db.bind.url):
                    await db.execute(text("SET TRANSACTION READ ONLY"))
                    await db.execute(text("SET local statement_timeout = 3000"))
                
                db_res = await db.execute(text(sql))
                if db_res.returns_rows:
                    for row in db_res.all():
                        results.append(make_serializable(dict(row._mapping)))
            await backend_cache.set(cache_key, results, ttl=300)
        except Exception as e:
            error_msg = str(e)

    # 5. Generate Text Summary
    summary_prompt = f"User query: {payload.query}\nGenerated SQL: {sql}\n"
    if error_msg:
        summary_prompt += f"Execution Error: {error_msg}\nExplain the error and suggest fixes."
    else:
        summary_prompt += f"Execution Results (up to first 100 rows shown): {results[:100]}\nSummarize the findings clearly."
        
    summary_instruction = """
    You are an intelligent assistant for the Gully Predict admin dashboard.
    Analyze the user's natural language question, the generated SQL, and the execution results (or error), then write a concise, clear summary explaining the results.
    If there is an error, explain the issue. Keep your tone professional, concise, and helpful.
    """
    
    try:
        summary = await llm.generate_text(prompt=summary_prompt, system_instruction=summary_instruction)
    except Exception as e:
        summary = f"Results retrieved but failed to generate text summary: {str(e)}"

    # 6. Optional: Generate Chart Config
    chart_config = { "chart_type": "none", "x_key": None, "y_key": None }
    if not error_msg and len(results) > 0:
        chart_prompt = (
            f"Data sample: {results[:5]}\n"
            f"Query: {payload.query}\n"
            "Recommend a chart visualization suggestion. "
            "Return a JSON object containing keys: "
            "'chart_type' ('bar' | 'line' | 'pie' | 'none'), "
            "'x_key' (string name of the field for x-axis or category/labels, or null if chart_type is none), "
            "'y_key' (string name of the numeric field for y-axis/values, or null if chart_type is none). "
            "Return ONLY the raw JSON object. Do not include markdown formatting, markdown code block backticks, or extra text."
        )
        try:
            chart_res = await llm.generate_text(prompt=chart_prompt)
            chart_res_clean = chart_res.strip()
            if chart_res_clean.startswith("```"):
                chart_res_clean = chart_res_clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            if chart_res_clean.lower().startswith("json"):
                chart_res_clean = chart_res_clean[4:].strip()
            parsed_cfg = json.loads(chart_res_clean)
            if "chart_type" in parsed_cfg:
                chart_config = {
                    "chart_type": parsed_cfg.get("chart_type", "none"),
                    "x_key": parsed_cfg.get("x_key"),
                    "y_key": parsed_cfg.get("y_key")
                }
        except Exception as e:
            print(f"Error parsing chart config: {str(e)}")
            chart_config = { "chart_type": "none", "x_key": None, "y_key": None }

    # 7. Persist Assistant message
    assistant_msg = AdminChatMessage(
        session_id=session_id_val,
        role="model",
        content=summary,
        sql_query=sql,
        query_results=results,
        chart_config=chart_config
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return assistant_msg


@router.delete("/sql-assistant/sessions/{session_id}")
async def delete_chat_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    res = await db.execute(
        select(AdminChatSession).where(
            AdminChatSession.id == session_id,
            AdminChatSession.user_id == current_admin.id
        )
    )
    session = res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.delete(session)
    await db.commit()
    return {"message": "Session deleted successfully"}


