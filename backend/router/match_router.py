import uuid
import random
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.dependencies import get_current_user, get_current_user_optional
from backend.models import (
    User, Match, MatchStatus, Tournament,
    Campaign, CampaignQuestion, CampaignResponse,
    LeagueUserMapping, League, CampaignMatchResult,
    TournamentUserMapping, CampaignTargetMatch,
    SystemEventType, TournamentMatchAnswer, LeaderboardEntry,
)
from backend.utils.cache import backend_cache
from backend.utils.events import dispatch_event

router = APIRouter(prefix="/api/matches", tags=["matches"])


class PredictionInput(BaseModel):
    use_powerup: Optional[bool] = False
    # Flat dict: question_id -> value (master) or "league_{campaign_id}_{question_id}" -> value (league)
    extra_answers: Optional[Dict[str, Any]] = {}


class MatchCreate(BaseModel):
    id: str
    team1: str
    team2: str
    venue: str
    start_time: datetime
    tournament_id: str


class MatchUpdate(BaseModel):
    team1: Optional[str] = None
    team2: Optional[str] = None
    venue: Optional[str] = None
    start_time: Optional[datetime] = None
    status: Optional[MatchStatus] = None


def _replace_placeholders(text: str, match: Match) -> str:
    if not text:
        return text
    return (text
            .replace("{{Team1}}", match.team1).replace("{{team1}}", match.team1).replace("{{TEAM1}}", match.team1)
            .replace("{{Team2}}", match.team2).replace("{{team2}}", match.team2).replace("{{TEAM2}}", match.team2))


def _is_locked(match: Match) -> bool:
    start_time = match.start_time
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=UTC)
    return datetime.now(UTC) >= (start_time - timedelta(minutes=30))


# ── List Matches ──────────────────────────────────────────────────────────────

@router.get("")
async def list_matches(tournament_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today_start + timedelta(days=3)

    query = select(Match).options(selectinload(Match.reporter))

    if tournament_id:
        query = query.where(Match.tournament_id == tournament_id)
    else:
        query = query.where(
            ((Match.start_time >= today_start) & (Match.start_time <= cutoff)) &
            ((Match.status == MatchStatus.upcoming) | (Match.status == MatchStatus.completed))
        )

    result = await db.execute(query.order_by(Match.start_time.asc()))
    matches = []
    for m in result.scalars().all():
        matches.append({
            "id": m.id,
            "team1": m.team1,
            "team2": m.team2,
            "venue": m.venue,
            "tossTime": m.start_time.isoformat() if m.start_time else None,
            "start_time": m.start_time,
            "status": m.status,
            "report_method": m.report_method,
            "reported_by_name": m.reporter.name if m.reporter else None,
            "reported_by_email": m.reporter.email if m.reporter else None,
            "winner": m.raw_result_json.get("winner") if m.raw_result_json else None,
            "raw_result_json": m.raw_result_json,
        })
    return matches


# ── Match Detail ──────────────────────────────────────────────────────────────

async def _get_tournament_user_mapping(db: AsyncSession, tournament_id: str, user_id: str) -> TournamentUserMapping:
    res = await db.execute(
        select(TournamentUserMapping).where(
            TournamentUserMapping.tournament_id == tournament_id,
            TournamentUserMapping.user_id == user_id
        )
    )
    mapping = res.scalars().first()
    if not mapping:
        from backend.models import Campaign
        # Look up master campaign's max_powerups for the default
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
        # We don't commit here, let the caller commit if needed
    return mapping


@router.get("/{match_id}")
async def get_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Match).options(selectinload(Match.reporter)).where(Match.id == match_id)
    )
    m = result.scalars().first()
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")

    # Scoped Stats
    mapping = await _get_tournament_user_mapping(db, m.tournament_id, current_user.id)

    # 1. Master campaign questions
    master_result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.questions), selectinload(Campaign.target_matches))
        .where(
            Campaign.tournament_id == m.tournament_id,
            Campaign.is_master == True,
            Campaign.type == "match",
        )
    )
    all_masters = master_result.scalars().all()
    
    master_campaign = None
    fallback_master = None
    for mc in all_masters:
        if mc.target_matches:
            if any(tm.id == m.id for tm in mc.target_matches):
                master_campaign = mc
                break
        else:
            fallback_master = mc

    if not master_campaign:
        master_campaign = fallback_master

    # 2. League-specific campaign questions
    league_campaigns = []
    if not current_user.is_guest:
        league_result = await db.execute(
            select(Campaign, League.name)
            .join(League, League.id == Campaign.league_id)
            .join(LeagueUserMapping, LeagueUserMapping.league_id == League.id)
            .options(selectinload(Campaign.questions))
            .where(
                League.tournament_id == m.tournament_id,
                Campaign.type == "match",
                Campaign.is_master == False,
                LeagueUserMapping.user_id == current_user.id,
                Campaign.status.in_(["active", "closed"]),
                or_(
                    Campaign.target_matches.any(Match.id == m.id),
                    ~Campaign.target_matches.any()
                ),
            )
        )
        league_campaigns = league_result.all()

    # 3. Build results map
    # Initialize from master CampaignMatchResult (for legacy / standalone compatibility)
    cmr_res = await db.execute(
        select(CampaignMatchResult)
        .join(Campaign, CampaignMatchResult.campaign_id == Campaign.id)
        .where(CampaignMatchResult.match_id == match_id, Campaign.is_master == True)
    )
    cmr = cmr_res.scalars().first()
    results_map = dict(cmr.correct_answers) if (cmr and cmr.correct_answers) else {}

    # Query TournamentMatchAnswer for the tournament and match (single source of truth for tournament matches)
    tma_res = await db.execute(
        select(TournamentMatchAnswer).where(
            TournamentMatchAnswer.tournament_id == m.tournament_id,
            TournamentMatchAnswer.match_id == m.id
        )
    )
    tma = tma_res.scalars().first()
    tma_answers = tma.correct_answers if (tma and tma.correct_answers) else {}

    # Map TournamentMatchAnswer to master campaign question IDs
    if master_campaign:
        for q in master_campaign.questions:
            if q.key and q.key in tma_answers:
                results_map[q.id] = tma_answers[q.key]

    # Map TournamentMatchAnswer to league campaign question IDs
    for c, league_name in league_campaigns:
        for q in c.questions:
            if q.key and q.key in tma_answers:
                results_map[f"league_{c.id}_{q.id}"] = tma_answers[q.key]

    match_dict = {
        "id": m.id,
        "team1": m.team1,
        "team2": m.team2,
        "venue": m.venue,
        "tossTime": m.start_time.isoformat() if m.start_time else None,
        "start_time": m.start_time,
        "status": m.status,
        "results": results_map,
        "report_method": m.report_method,
        "reported_by_name": m.reporter.name if m.reporter else None,
        "reported_by_email": m.reporter.email if m.reporter else None,
    }

    # 4. Powerup details
    if master_campaign and master_campaign.max_powerups is not None:
        total_powerups = master_campaign.max_powerups
        powerups_res = await db.execute(
            select(CampaignResponse)
            .where(
                CampaignResponse.user_id == current_user.id,
                CampaignResponse.use_powerup == True,
                CampaignResponse.campaign_id == master_campaign.id
            )
        )
        powerups_used = len(powerups_res.scalars().all())
    else:
        total_powerups = mapping.base_powerups
        powerups_res = await db.execute(
            select(CampaignResponse)
            .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
            .where(
                CampaignResponse.user_id == current_user.id,
                CampaignResponse.use_powerup == True,
                Campaign.tournament_id == m.tournament_id,
                Campaign.max_powerups == None
            )
        )
        powerups_used = len(powerups_res.scalars().all())

    # 5. Build final_questions list
    final_questions = []
    if master_campaign:
        for q in master_campaign.questions:
            text = _replace_placeholders(q.question_text, m)
            opts = [_replace_placeholders(o, m) for o in q.options] if q.options else None
            final_questions.append({
                "key": q.id,             # used as form field key and in answers dict
                "question_id": q.id,
                "slug": q.key,           # stable slug (match_winner, pp_team1, etc.)
                "campaign_id": master_campaign.id,
                "question_text": text,
                "answer_type": q.question_type.value if hasattr(q.question_type, "value") else q.question_type,
                "options": opts,
                "scoring_rules": q.scoring_rules,
                "category": "Global",
                "source_name": "IPL Global",
            })

    for c, league_name in league_campaigns:
        for q in c.questions:
            text = _replace_placeholders(q.question_text, m)
            opts = [_replace_placeholders(o, m) for o in q.options] if q.options else None
            final_questions.append({
                "key": f"league_{c.id}_{q.id}",
                "question_id": q.id,
                "slug": q.key,
                "campaign_id": c.id,
                "question_text": text,
                "answer_type": q.question_type.value if hasattr(q.question_type, "value") else q.question_type,
                "options": opts,
                "scoring_rules": q.scoring_rules,
                "category": "League Specific",
                "source_name": league_name,
                "league_id": c.league_id,
            })

    # Powerup question is always last
    final_questions.append({
        "key": "use_powerup",
        "question_text": "Use 2x Powerup for this match?",
        "answer_type": "toggle",
        "category": "Global",
        "source_name": "IPL Global",
    })

    return {
        "match": match_dict,
        "questions": final_questions,
        "powerups_used": powerups_used,
        "total_powerups": total_powerups,
    }


# ── Auto-Predict ──────────────────────────────────────────────────────────────

@router.post("/{match_id}/autopredict")
async def post_autopredict(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guests cannot submit predictions")

    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if _is_locked(match):
        raise HTTPException(status_code=403, detail="Predictions are locked for this match")

    # Guard: only allow once per user per match
    existing = await db.execute(
        select(CampaignResponse).where(
            CampaignResponse.user_id == current_user.id,
            CampaignResponse.match_id == match_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Prediction already exists for this match")

    # Determine winner via random weighted on simple team strength
    winner = match.team1 if random.random() > 0.5 else match.team2

    # Get stats from past raw_result_json on completed matches
    async def get_team_stats(team_name: str) -> dict:
        res = await db.execute(
            select(Match.raw_result_json, Match.team1, Match.team2).where(
                or_(Match.team1 == team_name, Match.team2 == team_name),
                Match.status == MatchStatus.completed,
                Match.raw_result_json != None,
            )
        )
        scores, potm_players = [], []
        for raw_json, t1, t2 in res.all():
            if not raw_json:
                continue
            pp = raw_json.get("team1_powerplay_score") if t1 == team_name else raw_json.get("team2_powerplay_score")
            if pp is not None:
                try:
                    scores.append(int(pp))
                except (ValueError, TypeError):
                    pass
            if raw_json.get("winner") == team_name and raw_json.get("player_of_the_match"):
                potm_players.append(raw_json["player_of_the_match"])

        avg_pp = int(sum(scores) / len(scores)) if scores else random.randint(50, 70)
        return {"avg_pp": avg_pp, "potm": potm_players}

    t1_stats = await get_team_stats(match.team1)
    t2_stats = await get_team_stats(match.team2)
    team1_pp = t1_stats["avg_pp"] + random.randint(-5, 5)
    team2_pp = t2_stats["avg_pp"] + random.randint(-5, 5)
    winner_players = (t1_stats if winner == match.team1 else t2_stats)["potm"]
    potm = random.choice(winner_players) if winner_players else f"Star Player ({winner})"

    match_number = 0
    try:
        match_number = int(match_id.split("-")[-1])
    except (ValueError, IndexError):
        pass
    more_sixes = (match.team1 if random.random() > 0.5 else match.team2) if match_number >= 39 else None
    more_fours = (match.team1 if random.random() > 0.5 else match.team2) if match_number >= 39 else None

    # Fetch master campaign questions
    from backend.models import CampaignTargetMatch
    cam_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions), selectinload(Campaign.target_matches))
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    all_masters = cam_res.scalars().all()
    master_campaign = None
    fallback_master = None
    for mc in all_masters:
        if mc.target_matches:
            if any(tm.id == match_id for tm in mc.target_matches):
                master_campaign = mc
                break
        else:
            fallback_master = mc

    if not master_campaign:
        master_campaign = fallback_master

    if not master_campaign:
        raise HTTPException(status_code=404, detail="Master campaign not found for this tournament")

    def generate_answers(campaign: Campaign) -> dict:
        ans = {}
        t1, t2 = match.team1, match.team2
        for q in campaign.questions:
            opts = [_replace_placeholders(o, match) for o in q.options] if q.options else []
            qtype = q.question_type
            text = _replace_placeholders(q.question_text, match).lower()
            val = None

            if set(opts) == {t1, t2}:
                if qtype == "toggle" and "dot ball" in text:
                    val = random.choice([t1, t2])
                elif qtype == "dropdown":
                    if "six" in text:
                        val = random.choice([t1, t2])
                    elif "four" in text:
                        val = random.choice([t1, t2])
                    else:
                        val = random.choice([t1, t2])
                else:
                    if "win" in text:
                        val = winner
                    else:
                        val = random.choice([t1, t2])
            elif qtype == "free_number" and ("powerplay" in text or "power play" in text):
                if t1.lower() in text or "team1" in text:
                    val = str(team1_pp)
                elif t2.lower() in text or "team2" in text:
                    val = str(team2_pp)
            elif qtype == "free_text" and ("player" in text or "potm" in text or "man of" in text):
                val = potm

            if val is not None:
                ans[q.id] = val
        return ans

    # 1. Generate master campaign answers
    master_answers = generate_answers(master_campaign)
    combined_frontend_answers = {**master_answers}

    async def upsert_response(cid: str, ans: dict):
        resp_res = await db.execute(
            select(CampaignResponse).where(
                CampaignResponse.campaign_id == cid,
                CampaignResponse.user_id == current_user.id,
                CampaignResponse.match_id == match_id,
            )
        )
        c_resp = resp_res.scalars().first()
        if c_resp:
            c_resp.answers = ans
            c_resp.is_auto_predicted = True
        else:
            db.add(CampaignResponse(
                id=str(uuid.uuid4()),
                campaign_id=cid,
                user_id=current_user.id,
                match_id=match_id,
                answers=ans,
                use_powerup=False,
                is_auto_predicted=True,
            ))

    await upsert_response(master_campaign.id, master_answers)

    # 2. Generate league-specific campaign answers
    league_result = await db.execute(
        select(Campaign)
        .join(League, League.id == Campaign.league_id)
        .join(LeagueUserMapping, LeagueUserMapping.league_id == League.id)
        .options(selectinload(Campaign.questions))
        .where(
            League.tournament_id == match.tournament_id,
            Campaign.type == "match",
            Campaign.is_master == False,
            LeagueUserMapping.user_id == current_user.id,
            Campaign.status == "active",
            or_(
                Campaign.target_matches.any(Match.id == match.id),
                ~Campaign.target_matches.any()
            ),
        )
    )
    for c in league_result.scalars().all():
        c_answers = generate_answers(c)
        if c_answers:
            # Format answers specifically for frontend MatchPage dynamic rendering
            for q_id, val in c_answers.items():
                combined_frontend_answers[f"league_{c.id}_{q_id}"] = val
            await upsert_response(c.id, c_answers)

    await db.commit()
    backend_cache.invalidate(f"user_pred_status:{current_user.id}")
    backend_cache.invalidate("leaderboard_*")
    backend_cache.invalidate("analysis_*")

    return {**combined_frontend_answers, "use_powerup": "No"}


# ── Submit Prediction ─────────────────────────────────────────────────────────

@router.post("/{match_id}/predictions")
async def submit_prediction(
    match_id: str,
    payload: PredictionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guests cannot submit predictions")

    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if _is_locked(match):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Predictions are locked for this match")

    # Check powerup limit
    use_powerup = payload.use_powerup or False
    if use_powerup:
        from backend.models import CampaignTargetMatch
        master_result = await db.execute(
            select(Campaign)
            .options(selectinload(Campaign.target_matches))
            .where(
                Campaign.tournament_id == match.tournament_id,
                Campaign.is_master == True,
                Campaign.type == "match",
            )
        )
        all_masters = master_result.scalars().all()
        master_campaign = None
        fallback_master = None
        for mc in all_masters:
            if mc.target_matches:
                if any(tm.id == match_id for tm in mc.target_matches):
                    master_campaign = mc
                    break
            else:
                fallback_master = mc

        if not master_campaign:
            master_campaign = fallback_master

        if master_campaign and master_campaign.max_powerups is not None:
            existing_powerup_res = await db.execute(
                select(CampaignResponse)
                .where(
                    CampaignResponse.user_id == current_user.id,
                    CampaignResponse.use_powerup == True,
                    CampaignResponse.match_id != match_id,
                    CampaignResponse.campaign_id == master_campaign.id,
                )
            )
            powerups_used = len(existing_powerup_res.scalars().all())
            if powerups_used >= master_campaign.max_powerups:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="powerup_limit_reached",
                )
        else:
            # Get tournament mapping for the match's tournament
            mapping = await _get_tournament_user_mapping(db, match.tournament_id, current_user.id)
            
            # Count existing responses where powerup is True (excluding current match) in this tournament
            existing_powerup_res = await db.execute(
                select(CampaignResponse)
                .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
                .where(
                    CampaignResponse.user_id == current_user.id,
                    CampaignResponse.use_powerup == True,
                    CampaignResponse.match_id != match_id,
                    Campaign.tournament_id == match.tournament_id,
                    Campaign.max_powerups == None
                )
            )
            powerups_used = len(existing_powerup_res.scalars().all())
            if powerups_used >= mapping.base_powerups:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="powerup_limit_reached",
                )

    # Parse answers into {campaign_id: {question_id: value}}
    campaign_answers_map: Dict[str, Dict[str, Any]] = {}
    for key, value in (payload.extra_answers or {}).items():
        if key.startswith("league_"):
            parts = key.split("_", 2)  # ["league", campaign_id, question_id]
            if len(parts) == 3:
                c_id, q_id = parts[1], parts[2]
                campaign_answers_map.setdefault(c_id, {})[q_id] = value
        else:
            # Raw question_id — look up its campaign
            q_res = await db.execute(
                select(CampaignQuestion).where(CampaignQuestion.id == key)
            )
            q_obj = q_res.scalars().first()
            if q_obj:
                campaign_answers_map.setdefault(q_obj.campaign_id, {})[key] = value

    # Upsert one CampaignResponse per campaign
    for c_id, q_answers in campaign_answers_map.items():
        resp_res = await db.execute(
            select(CampaignResponse).where(
                CampaignResponse.campaign_id == c_id,
                CampaignResponse.user_id == current_user.id,
                CampaignResponse.match_id == match_id,
            )
        )
        c_resp = resp_res.scalars().first()

        # Determine if this is the master campaign (for use_powerup)
        is_master_resp = False
        if c_resp:
            # Already know if master from existing
            cam_check = await db.execute(select(Campaign.is_master).where(Campaign.id == c_id))
            is_master_resp = bool(cam_check.scalars().first())
        else:
            cam_check = await db.execute(select(Campaign.is_master).where(Campaign.id == c_id))
            is_master_resp = bool(cam_check.scalars().first())

        if c_resp:
            # Merge new answers into existing
            existing_answers = dict(c_resp.answers or {})
            existing_answers.update(q_answers)
            c_resp.answers = existing_answers
            if is_master_resp:
                c_resp.use_powerup = use_powerup
            c_resp.is_auto_predicted = False
        else:
            c_resp = CampaignResponse(
                id=str(uuid.uuid4()),
                campaign_id=c_id,
                user_id=current_user.id,
                match_id=match_id,
                answers=q_answers,
                use_powerup=use_powerup if is_master_resp else False,
                is_auto_predicted=False,
            )
            db.add(c_resp)

    await db.commit()

    # Log event
    await dispatch_event(
        db,
        event_type=SystemEventType.prediction_submitted,
        user_id=current_user.id,
        match_id=match_id,
        message=f"{current_user.name} submitted prediction for {match.team1} vs {match.team2}"
    )
    await db.commit()

    backend_cache.invalidate(f"user_pred_status:{current_user.id}")
    backend_cache.invalidate("leaderboard_*")
    backend_cache.invalidate("analysis_*")
    return {"message": "Predictions submitted successfully"}


# ── My Predictions ────────────────────────────────────────────────────────────

@router.get("/{match_id}/predictions/mine")
async def get_my_predictions(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.campaign))
        .where(CampaignResponse.user_id == current_user.id, CampaignResponse.match_id == match_id)
    )
    campaign_responses = cr_result.scalars().all()

    if not campaign_responses:
        return {}

    # Merge all answers into a flat dict
    answers: Dict[str, Any] = {}
    use_powerup = False
    is_auto_predicted = False

    for cr in campaign_responses:
        is_master = cr.campaign and cr.campaign.is_master
        for q_id, val in (cr.answers or {}).items():
            if is_master:
                answers[q_id] = val
            else:
                answers[f"league_{cr.campaign_id}_{q_id}"] = val
        if is_master:
            use_powerup = cr.use_powerup
            is_auto_predicted = cr.is_auto_predicted

    answers["use_powerup"] = "Yes" if use_powerup else "No"
    answers["is_auto_predicted"] = is_auto_predicted
    return answers


# ── Community Reveal ──────────────────────────────────────────────────────────

@router.get("/{match_id}/predictions/all")
async def get_all_community_predictions(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    locked = _is_locked(match)

    # Load all CampaignResponses for this match
    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.campaign))
        .where(CampaignResponse.match_id == match_id)
    )
    all_crs = cr_result.scalars().all()

    # Build {user_id: {flat_answer_key: value}} and metadata
    user_answers: Dict[str, Dict] = {}
    user_meta: Dict[str, Dict] = {}  # use_powerup, is_auto_predicted, points_awarded, points_breakdown

    for cr in all_crs:
        uid = cr.user_id
        user_answers.setdefault(uid, {})
        is_master = cr.campaign and cr.campaign.is_master

        for q_id, val in (cr.answers or {}).items():
            if is_master:
                user_answers[uid][q_id] = val
            else:
                user_answers[uid][f"league_{cr.campaign_id}_{q_id}"] = val

        if is_master:
            user_meta[uid] = {
                "use_powerup": cr.use_powerup,
                "is_auto_predicted": cr.is_auto_predicted,
                "points_awarded": cr.total_points,
                "points_breakdown": cr.points_breakdown,
                "response_id": cr.id,
            }

    # Load user profiles for all users who responded
    all_user_ids = list(user_meta.keys())
    users_res = await db.execute(
        select(User).where(User.id.in_(all_user_ids), User.is_guest == False)
    )
    users_map = {u.id: u for u in users_res.scalars().all()}

    # Load LeaderboardEntry rows to retrieve correct points/breakdowns per user per league for this match
    lb_result = await db.execute(
        select(LeaderboardEntry).where(LeaderboardEntry.match_id == match_id)
    )
    lb_entries = lb_result.scalars().all()
    
    # Map (user_id, league_id) -> {"points": points, "points_breakdown": points_breakdown}
    leaderboard_map = {}
    for entry in lb_entries:
        leaderboard_map[(entry.user_id, entry.league_id)] = {
            "points": entry.points,
            "points_breakdown": entry.points_breakdown
        }

    def format_prediction(uid: str, league_id: Optional[str] = None) -> Optional[dict]:
        user = users_map.get(uid)
        if not user:
            return None
        meta = user_meta.get(uid, {})
        answers = user_answers.get(uid, {})
        answers_copy = dict(answers)
        answers_copy["use_powerup"] = "Yes" if meta.get("use_powerup", False) else "No"

        if not locked:
            answers_copy = {k: "🔒" for k in answers_copy}

        display_name = user.alias if user.use_alias and user.alias else user.name

        # Resolve global scores and breakdown
        global_score = leaderboard_map.get((uid, None))
        global_points = global_score["points"] if (global_score and global_score["points"] is not None) else 0
        global_rules = global_score["points_breakdown"].get("rules", []) if (global_score and global_score["points_breakdown"] and "rules" in global_score["points_breakdown"]) else []

        league_points = 0
        league_rules = []
        has_league_score = False

        if league_id is not None:
            league_score = leaderboard_map.get((uid, league_id))
            if league_score:
                has_league_score = True
                league_points = league_score["points"] if league_score["points"] is not None else 0
                league_rules = league_score["points_breakdown"].get("rules", []) if (league_score and league_score["points_breakdown"] and "rules" in league_score["points_breakdown"]) else []

        if league_id is not None:
            # We want both global and league scores / breakdown combined
            if global_score is None and not has_league_score:
                points_awarded = None
                points_breakdown = None
            else:
                points_awarded = global_points + league_points
                combined_rules = []
                combined_rules.extend(global_rules)
                combined_rules.extend(league_rules)
                global_powerup = global_score["points_breakdown"].get("powerup", {}) if (global_score and global_score["points_breakdown"]) else {}
                points_breakdown = {
                    "rules": combined_rules,
                    "powerup": global_powerup
                }
        else:
            # Global/fallback tab
            if global_score:
                points_awarded = global_score["points"]
                points_breakdown = global_score["points_breakdown"]
            else:
                points_awarded = meta.get("points_awarded")
                points_breakdown = meta.get("points_breakdown")

        return {
            "prediction_id": meta.get("response_id"),
            "user": {"id": user.id, "name": display_name, "avatar_url": user.avatar_url},
            "answers": answers_copy,
            "is_auto_predicted": meta.get("is_auto_predicted", False),
            "points_awarded": points_awarded,
            "points_breakdown": points_breakdown,
        }

    # Segment by leagues the current user belongs to for this tournament
    user_leagues_res = await db.execute(
        select(League).join(LeagueUserMapping)
        .where(
            LeagueUserMapping.user_id == current_user.id,
            League.tournament_id == match.tournament_id
        )
    )
    user_leagues = user_leagues_res.scalars().all()

    response_data = []

    if user_leagues:
        for league in user_leagues:
            members_res = await db.execute(
                select(User.id).join(LeagueUserMapping)
                .where(LeagueUserMapping.league_id == league.id)
            )
            member_ids = set(members_res.scalars().all())
            preds = [p for uid in member_ids if (p := format_prediction(uid, league_id=league.id)) is not None]
            response_data.append({
                "league": {"id": league.id, "name": league.name},
                "predictions": preds,
            })
    else:
        # Fallback to global
        preds = [p for uid in all_user_ids if (p := format_prediction(uid, league_id=None)) is not None]
        response_data.append({
            "league": {"id": "global", "name": "IPL Global"},
            "predictions": preds,
        })

    # Build predictor list (unique users who submitted predictions)
    predictor_list = []
    for uid in all_user_ids:
        user = users_map.get(uid)
        if user:
            predictor_list.append({
                "id": user.id,
                "name": user.alias if getattr(user, 'use_alias', False) and user.alias else user.name,
                "avatar_url": getattr(user, 'avatar_url', None),
            })

    return {"leagues": response_data, "predictors": predictor_list}


# ── Prediction Status ─────────────────────────────────────────────────────────

@router.get("/my/prediction-status")
async def get_my_prediction_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a dict mapping match_ids to points won for the logged in user."""
    if current_user.is_guest:
        return {}

    cache_key = f"user_pred_status:{current_user.id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    res = await db.execute(
        select(CampaignResponse.match_id, CampaignResponse.total_points)
        .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
        .where(
            CampaignResponse.user_id == current_user.id,
            CampaignResponse.match_id != None,
            Campaign.is_master == True,
        )
    )
    rows = res.all()
    match_status = {row[0]: row[1] for row in rows if row[0] is not None}
    backend_cache.set(cache_key, match_status)
    return match_status


# ── Create Match (Admin) ──────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_match(
    req: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    t_res = await db.execute(select(Tournament).where(Tournament.id == req.tournament_id))
    if not t_res.scalars().first():
        raise HTTPException(status_code=400, detail="Tournament not found")

    new_match = Match(
        id=req.id,
        external_id=req.id,
        team1=req.team1,
        team2=req.team2,
        venue=req.venue,
        start_time=req.start_time,
        tournament_id=req.tournament_id,
        status=MatchStatus.upcoming,
    )
    db.add(new_match)
    await db.commit()

    # Log event
    await dispatch_event(
        db,
        event_type=SystemEventType.match_results_updated,
        user_id=current_user.id,
        match_id=new_match.id,
        message=f"Admin {current_user.name} created match {new_match.team1} vs {new_match.team2}"
    )
    await db.commit()
    await db.commit()

    return {"message": "Prediction saved successfully", "id": new_match.id}


@router.put("/{match_id}")
async def update_match(
    match_id: str,
    req: MatchUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if req.team1 is not None:
        match.team1 = req.team1
    if req.team2 is not None:
        match.team2 = req.team2
    if req.venue is not None:
        match.venue = req.venue
    if req.start_time is not None:
        match.start_time = req.start_time
    if req.status is not None:
        match.status = req.status

    await db.commit()

    # Log event
    await dispatch_event(
        db,
        event_type=SystemEventType.admin_action,
        user_id=current_user.id,
        match_id=match.id,
        message=f"Admin {current_user.name} updated match {match.team1} vs {match.team2}"
    )
    await db.commit()

    return {"message": "Match updated successfully"}
