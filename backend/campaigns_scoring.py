"""
Campaign-specific scoring engine.
Scores CampaignResponse.answers (JSON) against CampaignMatchResult.correct_answers.
Updates total_points and persists LeaderboardEntry rows for league-scoped campaigns.
"""
import uuid as _uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.models import (
    Campaign, CampaignQuestion, CampaignResponse, CampaignType,
    QuestionType, User, CampaignMatchResult, CampaignResult,
    TournamentMatchAnswer, LeagueUserMapping, LeaderboardEntry,
    MatchStatus
)


def score_answer(question: CampaignQuestion, answer_value, correct_answer_override=None) -> tuple[int, str]:
    """
    Score a single answer against a question's scoring rules.
    correct_answer_override comes from CampaignMatchResult.correct_answers.
    """
    rules = question.scoring_rules or {}
    correct = correct_answer_override if correct_answer_override is not None else None
    q_type = question.question_type

    if correct is None:
        return 0, "skip"

    exact_points = rules.get("exact_match_points", 0)
    wrong_points = rules.get("wrong_answer_points", 0)

    if q_type == QuestionType.free_number:
        within_range_points = rules.get("within_range_points", 0)
        try:
            user_val = float(answer_value)
            correct_val = float(correct)
        except (TypeError, ValueError):
            return wrong_points, "miss"
        diff = abs(user_val - correct_val)
        if diff == 0:
            return exact_points, "bingo"
        if diff <= rules.get("range_delta", 5):
            return within_range_points, "range"
        return wrong_points, "miss"

    if q_type == QuestionType.multiple_choice:
        try:
            user_set = set(answer_value) if isinstance(answer_value, list) else {answer_value}
            correct_set = set(correct) if isinstance(correct, list) else {correct}
        except TypeError:
            return wrong_points, "incorrect"

        tiers = rules.get("multiple_choice_tiers", {})
        if tiers:
            correct_count = len(user_set.intersection(correct_set))
            pts = tiers.get(str(correct_count), wrong_points)
            if user_set == correct_set:
                return pts, "correct"
            elif pts > wrong_points:
                return pts, "range"
            else:
                return pts, "incorrect"

        return (exact_points, "correct") if user_set == correct_set else (wrong_points, "incorrect")

    # toggle, dropdown, free_text: string comparison
    user_str = str(answer_value).strip().strip('"').strip("'").lower() if answer_value is not None else ""
    correct_str = str(correct).strip().strip('"').strip("'").lower() if correct is not None else ""

    return (exact_points, "correct") if user_str == correct_str else (wrong_points, "incorrect")


async def calculate_campaign_scores(campaign_id: str, db: AsyncSession, match_id: str = None) -> None:
    """
    Score all CampaignResponses for a campaign.
    - Reads answers from CampaignResponse.answers (JSON dict)
    - Reads correct answers from CampaignMatchResult.correct_answers
    - Writes total_points back to CampaignResponse
    - Upserts LeaderboardEntry for league-scoped campaigns
    - Applies non_participation_penalty for missing respondents
    """
    campaign_result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.questions))
        .where(Campaign.id == campaign_id)
    )
    campaign = campaign_result.scalars().first()
    if not campaign:
        return

    if campaign.type == CampaignType.match and match_id:
        from backend.models import Match
        match_res = await db.execute(select(Match).where(Match.id == match_id))
        match_obj = match_res.scalars().first()
        if match_obj and match_obj.status != MatchStatus.completed:
            return  # Don't calculate scores for matches that are not completed

    # Load correct answer overrides — source depends on campaign type and context
    if campaign.type == CampaignType.general:
        # General campaigns: one result row per campaign
        cr_res = await db.execute(
            select(CampaignResult).where(CampaignResult.campaign_id == campaign_id)
        )
        campaign_result_row = cr_res.scalars().first()
        general_overrides = campaign_result_row.correct_answers if campaign_result_row else {}
        overrides_by_match: dict = {}
        use_key_lookup = False
    elif campaign.tournament_id:
        # Tournament match campaigns (master + league): answers come from TournamentMatchAnswer,
        # looked up by question.key. One answer set per (tournament, match) set by admin.
        tma_res = await db.execute(
            select(TournamentMatchAnswer)
            .where(TournamentMatchAnswer.tournament_id == campaign.tournament_id)
        )
        tma_rows = tma_res.scalars().all()
        # Build: {match_id: {question_key: value}}
        overrides_by_match = {row.match_id: (row.correct_answers or {}) for row in tma_rows}
        general_overrides = {}
        use_key_lookup = True  # score using question.key instead of question.id
    else:
        # Standalone match campaigns (no tournament): legacy CampaignMatchResult
        cmr_res = await db.execute(
            select(CampaignMatchResult).where(CampaignMatchResult.campaign_id == campaign_id)
        )
        match_results = cmr_res.scalars().all()
        overrides_by_match = {mr.match_id: (mr.correct_answers or {}) for mr in match_results}
        general_overrides = {}
        use_key_lookup = False

    # Build question map for fast lookup
    question_map = {q.id: q for q in campaign.questions}

    # Load all responses
    resp_result = await db.execute(
        select(CampaignResponse).where(CampaignResponse.campaign_id == campaign_id)
    )
    responses = resp_result.scalars().all()

    responded_user_ids = set()

    # Load all matches to replace team placeholders in question texts
    match_map = {}
    if campaign.type == CampaignType.match:
        from backend.models import Match
        match_ids = {r.match_id for r in responses if r.match_id}
        if match_id:
            match_ids.add(match_id)
        if match_ids:
            matches_res = await db.execute(select(Match).where(Match.id.in_(list(match_ids))))
            match_map = {m.id: m for m in matches_res.scalars().all()}

    for response in responses:
        answers = response.answers or {}  # {question_id: answer_value}
        m_id = response.match_id or match_id
        if campaign.type == CampaignType.match:
            match_obj = match_map.get(m_id)
            if match_obj and match_obj.status != MatchStatus.completed:
                continue
        overrides = overrides_by_match.get(m_id, general_overrides)

        total = 0
        breakdown_rules = []
        multiplier = 1
        if campaign.type == CampaignType.match:
            if campaign.is_master:
                multiplier = 2 if response.use_powerup else 1
            else:
                # Check if user used a powerup on the master campaign for this match
                master_res = await db.execute(
                    select(CampaignResponse.use_powerup)
                    .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
                    .where(
                        CampaignResponse.user_id == response.user_id,
                        CampaignResponse.match_id == m_id,
                        Campaign.is_master == True
                    )
                )
                use_pu = master_res.scalars().first()
                multiplier = 2 if use_pu else 1

        for q_id, q in question_map.items():
            answer_value = answers.get(q_id)
            if answer_value is None and q.key:
                answer_value = answers.get(q.key)
            # For tournament campaigns: look up by question.key; otherwise by question.id
            if use_key_lookup:
                override = overrides.get(q.key) if q.key else None
            else:
                override = overrides.get(q_id)
            if override is None:
                continue  # No correct answer set yet for this question

            pts_base, status = score_answer(q, answer_value, correct_answer_override=override)

            current_multiplier = multiplier if q.allow_powerup else 1
            pts = pts_base * current_multiplier

            total += pts

            # Replace team placeholders in category name
            category = q.question_text
            match_obj = match_map.get(m_id)
            if match_obj:
                category = category.replace("{{Team1}}", match_obj.team1).replace("{{Team2}}", match_obj.team2)
                category = category.replace("{{team1}}", match_obj.team1).replace("{{team2}}", match_obj.team2)
                category = category.replace("{{TEAM1}}", match_obj.team1).replace("{{TEAM2}}", match_obj.team2)

            breakdown_rules.append({
                "question_id": q.id,
                "category": category,
                "key": q.key,
                "status": status,
                "points": pts_base,
                "predicted": answer_value,
                "actual": override,
                "was_boosted": current_multiplier > 1,
            })

        response.total_points = total
        if campaign.type == CampaignType.match:
            response.points_breakdown = {
                "rules": breakdown_rules,
                "powerup": {"used": multiplier > 1, "multiplier": multiplier},
                "total": total,
            }
        else:
            response.points_breakdown = {"rules": breakdown_rules, "total": total}
        responded_user_ids.add(response.user_id)

        # Persist to LeaderboardEntry for league-scoped match campaigns OR any general campaigns
        if (response.match_id and campaign.league_id) or campaign.type == CampaignType.general:
            where_clauses = [LeaderboardEntry.user_id == response.user_id]
            if campaign.type == CampaignType.general:
                where_clauses.extend([
                    LeaderboardEntry.match_id == None,
                    LeaderboardEntry.campaign_id == campaign.id,
                    LeaderboardEntry.league_id == campaign.league_id,
                ])
            else:
                where_clauses.extend([
                    LeaderboardEntry.match_id == response.match_id,
                    LeaderboardEntry.league_id == campaign.league_id,
                ])

            lb_res = await db.execute(select(LeaderboardEntry).where(*where_clauses))
            lb_entry = lb_res.scalars().first()
            if lb_entry:
                lb_entry.points = total
                lb_entry.points_breakdown = response.points_breakdown
            else:
                db.add(LeaderboardEntry(
                    id=str(_uuid.uuid4()),
                    user_id=response.user_id,
                    match_id=response.match_id if campaign.type != CampaignType.general else None,
                    campaign_id=campaign.id if campaign.type == CampaignType.general else None,
                    league_id=campaign.league_id,
                    points=total,
                    points_breakdown=response.points_breakdown,
                ))

    # ── Non-participation penalty ─────────────────────────────────────────────
    if campaign.non_participation_penalty != 0:
        if campaign.league_id:
            all_users_res = await db.execute(
                select(User.id).join(LeagueUserMapping, User.id == LeagueUserMapping.user_id)
                .where(LeagueUserMapping.league_id == campaign.league_id, User.is_guest == False)
            )
        else:
            all_users_res = await db.execute(select(User.id).where(User.is_guest == False))

        all_user_ids = [u_id for (u_id,) in all_users_res.all()]
        missing_user_ids = [uid for uid in all_user_ids if uid not in responded_user_ids]

        for uid in missing_user_ids:
            if (match_id and campaign.league_id) or campaign.type == CampaignType.general:
                where_clauses = [LeaderboardEntry.user_id == uid]
                if campaign.type == CampaignType.general:
                    where_clauses.extend([
                        LeaderboardEntry.match_id == None,
                        LeaderboardEntry.campaign_id == campaign.id,
                        LeaderboardEntry.league_id == campaign.league_id,
                    ])
                else:
                    where_clauses.extend([
                        LeaderboardEntry.match_id == match_id,
                        LeaderboardEntry.league_id == campaign.league_id,
                    ])

                lb_res = await db.execute(select(LeaderboardEntry).where(*where_clauses))
                lb_entry = lb_res.scalars().first()
                if lb_entry:
                    lb_entry.points = campaign.non_participation_penalty
                else:
                    db.add(LeaderboardEntry(
                        id=str(_uuid.uuid4()),
                        user_id=uid,
                        match_id=match_id if campaign.type != CampaignType.general else None,
                        campaign_id=campaign.id if campaign.type == CampaignType.general else None,
                        league_id=campaign.league_id,
                        points=campaign.non_participation_penalty,
                        points_breakdown=None,
                    ))

    await db.flush()
    
    # Rebuild the DB leaderboard cache so the general campaigns appear in LeaderboardCache
    if campaign.tournament_id:
        from backend.scoring import update_leaderboard_cache
        await update_leaderboard_cache(db, campaign.tournament_id)

    from backend.utils.cache import backend_cache
    await backend_cache.invalidate("leaderboard_*")
    await backend_cache.invalidate("analysis_*")
    await backend_cache.invalidate("user_pred_status:*")
