"""
APScheduler background jobs.
- Daily AI auto-prediction job using heuristic team strengths
- Uses CampaignResponse.answers (JSON) — no Prediction table
"""
import uuid
import random
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from .database import async_session
from .models import Match, MatchStatus, User, Campaign, CampaignResponse, CampaignQuestion, TournamentUserMapping

scheduler = AsyncIOScheduler()

async def generate_ai_prediction(db, match: Match, ai_user: User):
    """
    Generates a heuristic AI prediction for a match and saves it as a CampaignResponse.
    All answers are stored in CampaignResponse.answers as a flat JSON dict.
    """
    # Fetch rankings
    from backend.models import TournamentTeamRanking
    rankings_res = await db.execute(
        select(TournamentTeamRanking).where(
            TournamentTeamRanking.tournament_id == match.tournament_id,
            TournamentTeamRanking.team_name.in_([match.team1, match.team2])
        )
    )
    rankings = {r.team_name: r.rank for r in rankings_res.scalars().all()}
    
    r1 = rankings.get(match.team1, 100)
    r2 = rankings.get(match.team2, 100)
    
    # Calculate win probability for team1
    if r1 == r2:
        p_team1_wins = 0.5
    else:
        # e.g. rank 1 vs rank 10 -> diff 9. Base 0.5 + diff * 0.03
        p_team1_wins = 0.5 + (r2 - r1) * 0.03
        p_team1_wins = max(0.1, min(0.9, p_team1_wins))

    winner = match.team1 if random.random() < p_team1_wins else match.team2
    
    # Fetch tournament directly
    from backend.models import Tournament
    tournament_res = await db.execute(
        select(Tournament).where(Tournament.id == match.tournament_id)
    )
    tournament = tournament_res.scalars().first()

    # Delegate to sport prediction strategy engine
    from backend.utils.prediction_engine import prediction_engine_registry
    sport = tournament.sport if (tournament and tournament.sport) else "cricket"
    engine = prediction_engine_registry.get_engine(sport)

    # Draw check for football (e.g. 22% chance of draw if ranks are close)
    if sport.lower() in ("football", "soccer") and abs(r1 - r2) <= 15 and random.random() < 0.22:
        actual_winner_or_draw = "Draw"
    else:
        actual_winner_or_draw = winner

    base_winner = match.team1 if r1 <= r2 else match.team2  # default higher ranked
    favored_team = base_winner if actual_winner_or_draw == "Draw" else actual_winner_or_draw
    loser = match.team2 if favored_team == match.team1 else match.team1

    prediction_context = engine.simulate_match_context(
        match=match,
        r1=r1,
        r2=r2,
        winner=winner,
        actual_winner_or_draw=actual_winner_or_draw,
        favored_team=favored_team,
        loser=loser
    )

    # Find the master campaign for this tournament (handles multiple targeted campaigns)
    cam_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions), selectinload(Campaign.target_matches))
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    all_masters = cam_res.scalars().all()
    master_cam = None
    fallback_master = None
    for mc in all_masters:
        if mc.target_matches:
            if any(tm.id == match.id for tm in mc.target_matches):
                master_cam = mc
                break
        else:
            fallback_master = mc

    if not master_cam:
        master_cam = fallback_master

    if not master_cam:
        return  # No campaign to predict against

    # Always fetch scoped mapping to track powerups properly
    mapping_res = await db.execute(
        select(TournamentUserMapping).where(
            TournamentUserMapping.tournament_id == match.tournament_id,
            TournamentUserMapping.user_id == ai_user.id
        )
    )
    mapping = mapping_res.scalars().first()
    if not mapping:
        default_powerups = master_cam.max_powerups if master_cam.max_powerups is not None else 10
        mapping = TournamentUserMapping(
            tournament_id=match.tournament_id,
            user_id=ai_user.id,
            base_powerups=default_powerups,
            powerups_used=0
        )
        db.add(mapping)

    is_heavy_favorite = abs(r1 - r2) >= 15
    use_powerup = False
    if is_heavy_favorite and random.random() < 0.3:
        if master_cam.max_powerups is not None:
            # Check scoped powerup limit for this specific campaign
            pu_res = await db.execute(
                select(CampaignResponse)
                .where(
                    CampaignResponse.user_id == ai_user.id,
                    CampaignResponse.use_powerup == True,
                    CampaignResponse.campaign_id == master_cam.id
                )
            )
            used = len(pu_res.scalars().all())
            if used < master_cam.max_powerups:
                use_powerup = True
        else:
            # Check global tournament limit
            pu_res = await db.execute(
                select(CampaignResponse)
                .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
                .where(
                    CampaignResponse.user_id == ai_user.id,
                    CampaignResponse.use_powerup == True,
                    Campaign.tournament_id == match.tournament_id,
                    Campaign.max_powerups == None
                )
            )
            used = len(pu_res.scalars().all())
            if used < mapping.base_powerups:
                use_powerup = True

    BIAS_MAP = {
        "match_winner": 1.0,
        "most_sixes": 0.70,
        "highest_powerplay": 0.60,
        "highest_score": 0.80,
        "first_goal_scorer": 0.80,
        "first_team_to_score": 0.80,
        "clean_sheet": 0.60,
        "potm": 1.0,
        "toss_winner": 0.50
    }

    def generate_answers(campaign: Campaign) -> dict:
        ans = {}
        for q in campaign.questions:
            bias_prob = BIAS_MAP.get(q.key or "", 0.5)
            val = engine.predict_question(q, prediction_context, bias_prob)
            if val is not None:
                ans[q.id] = val
        return ans

    master_answers = generate_answers(master_cam)

    async def upsert_response(cid: str, ans: dict, pu: bool):
        resp_res = await db.execute(
            select(CampaignResponse).where(
                CampaignResponse.user_id == ai_user.id,
                CampaignResponse.campaign_id == cid,
                CampaignResponse.match_id == match.id,
            )
        )
        response = resp_res.scalars().first()
        already_used = response.use_powerup if response else False
        if response:
            response.answers = ans
            response.use_powerup = pu
            response.is_auto_predicted = True
        else:
            response = CampaignResponse(
                id=str(uuid.uuid4()),
                user_id=ai_user.id,
                campaign_id=cid,
                match_id=match.id,
                answers=ans,
                use_powerup=pu,
                is_auto_predicted=True,
            )
            db.add(response)
        return response, already_used

    master_response, already_used_powerup = await upsert_response(master_cam.id, master_answers, use_powerup)

    # Deduct powerup if used (incrementing mapped usage)
    if use_powerup and not already_used_powerup:
        mapping.powerups_used += 1

    # 2. Generate league-specific campaign answers
    from backend.models import League, LeagueUserMapping
    league_result = await db.execute(
        select(Campaign)
        .join(League, League.id == Campaign.league_id)
        .join(LeagueUserMapping, LeagueUserMapping.league_id == League.id)
        .options(selectinload(Campaign.questions))
        .where(
            League.tournament_id == match.tournament_id,
            Campaign.type == "match",
            Campaign.is_master == False,
            LeagueUserMapping.user_id == ai_user.id,
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
            await upsert_response(c.id, c_answers, False)


async def auto_predict_daily_job():
    """Daily cron job — runs at 00:00 UTC. Generates AI predictions for upcoming 24h matches."""
    print(f"[{datetime.now(timezone.utc)}] Running auto_predict_daily_job...")
    async with async_session() as db:
        async with db.begin():
            ai_users_res = await db.execute(select(User).where(User.is_ai == True))
            ai_users = ai_users_res.scalars().all()

            if not ai_users:
                print("No AI users found. Skipping.")
                return

            now = datetime.now(timezone.utc)
            future = now + timedelta(days=2)

            matches_res = await db.execute(
                select(Match).where(
                    Match.status == MatchStatus.upcoming,
                    Match.start_time >= now,
                    Match.start_time <= future,
                )
            )
            upcoming = matches_res.scalars().all()

            if not upcoming:
                print("No upcoming matches in the next 24 hours.")
                return

            for ai_user in ai_users:
                for match in upcoming:
                    await generate_ai_prediction(db, match, ai_user)

    print("Auto-predict completed.")


async def auto_grade_completed_matches_job():
    """Periodic job to auto-grade matches that started > 5 hours ago and are not yet completed/cancelled."""
    print(f"[{datetime.now(timezone.utc)}] Running auto_grade_completed_matches_job...")
    
    async with async_session() as db:
        now = datetime.now(timezone.utc)
        five_hours_ago = now - timedelta(hours=5)
        
        matches_res = await db.execute(
            select(Match).where(
                Match.status != MatchStatus.completed,
                Match.status != MatchStatus.cancelled,
                Match.start_time <= five_hours_ago
            )
        )
        matches_to_grade = matches_res.scalars().all()
        
        if not matches_to_grade:
            print("[auto_grade_completed_matches_job] No matches require auto-grading at this time.")
            return
            
        from backend.agents.match_status_checker_agent import match_status_checker_agent
        from backend.agents.match_result_agent import match_result_agent
        
        for match in matches_to_grade:
            try:
                # 1. Cheap lightweight completion check first
                is_completed = await match_status_checker_agent.check_match_completed(match.id, db)
                if not is_completed:
                    continue
                
                # 2. Match is completed, fetch detailed results and score
                await match_result_agent.fetch_match_results(match.id, db)
            except Exception as e:
                print(f"[auto_grade_completed_matches_job] Error grading match {match.id}: {str(e)}")


def start_scheduler():
    scheduler.add_job(auto_predict_daily_job, trigger='cron', hour=0, minute=0, timezone='UTC')
    scheduler.add_job(
        auto_grade_completed_matches_job,
        trigger='interval',
        minutes=15,
        next_run_time=datetime.now(timezone.utc)
    )
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown()

