import json
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from backend.models import Match, MatchStatus, Campaign, Tournament, TournamentQuestion, TournamentMatchAnswer
from .gemini_client import gemini_client

class MatchResultAgent:
    @staticmethod
    async def fetch_match_results(match_id: str, db: AsyncSession):
        """
        Fetches match results using Gemini after a match is completed.
        Checks for cancellation, ties, and updates/grades the match automatically.
        The prompt is dynamically generated based on tournament match questions, tournament-agnostic, and accounts for gender.
        """
        # Get match details
        result = await db.execute(select(Match).where(Match.id == match_id))
        match = result.scalars().first()
        if not match:
            print(f"[MatchResultAgent] Match {match_id} not found.")
            return None

        # Fetch tournament details to remain tournament agnostic and handle gender
        tournament = None
        if match.tournament_id:
            t_res = await db.execute(select(Tournament).where(Tournament.id == match.tournament_id))
            tournament = t_res.scalars().first()
        
        tournament_name = tournament.name if tournament else "sports tournament"
        tournament_gender = tournament.gender if tournament and tournament.gender else ""
        
        gender_str = ""
        if tournament_gender.lower() == "mens":
            gender_str = "Men's "
        elif tournament_gender.lower() == "womens":
            gender_str = "Women's "

        # 1. Fetch tournament questions (master bank) for the tournament
        questions_to_use = []
        if match.tournament_id:
            tq_res = await db.execute(
                select(TournamentQuestion).where(TournamentQuestion.tournament_id == match.tournament_id)
            )
            questions_to_use = list(tq_res.scalars().all())

        # 2. Fall back to master campaign questions if no tournament question bank is found
        if not questions_to_use:
            cam_res = await db.execute(
                select(Campaign).options(selectinload(Campaign.questions), selectinload(Campaign.target_matches))
                .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
            )
            all_masters = cam_res.scalars().all()
            master_cam = None
            fallback_master = None
            for mc in all_masters:
                if mc.target_matches:
                    if any(tm.id == match_id for tm in mc.target_matches):
                        master_cam = mc
                        break
                else:
                    fallback_master = mc

            if not master_cam:
                master_cam = fallback_master
            
            if master_cam:
                questions_to_use = master_cam.questions

        if not questions_to_use:
            print(f"[MatchResultAgent] No campaign or tournament questions found for match {match_id}. Skipping grading.")
            return None

        questions_prompt = ""
        json_template = {
            "match_status": "completed"
        }

        for q in questions_to_use:
            key_name = q.key if q.key else q.id
            questions_prompt += f"- {key_name}: {q.question_text} (Type: {q.question_type.value}, Options: {q.options or 'N/A'})\n"
            json_template[key_name] = "..."

        print(f"[MatchResultAgent] Querying Gemini for Match {match.id} results ({match.team1} vs {match.team2}) in {gender_str}{tournament_name}...")

        prompt = f"""
        Fetch the final results for the following {gender_str}{tournament_name} match using the provided Google Search tool:
        Teams: {match.team1} vs {match.team2}
        Venue: {match.venue}
        Date: {match.start_time.strftime('%Y-%m-%d')}

        IMPORTANT: Use the Google Search tool to verify the ACTUAL results for this match in {match.start_time.year}.
        Verify if the match was abandoned, washed out, cancelled, or finished.

        IMPORTANT: For any question where the 'Type' is 'toggle', 'multiple_choice', or 'dropdown', the correct answer MUST be chosen exactly from the provided 'Options' list. Do not paraphrase or alter the option spelling. If the 'Type' is 'free_number', the answer MUST be numeric, and if the 'Type' is 'free_text', the answer MUST be a string.

        Please determine the correct answers for the following match questions:
        1. match_status: 'completed', 'cancelled', 'abandoned', or 'live'
        {questions_prompt}

        You MUST respond ONLY with a raw JSON object matching the template below. 
        Do NOT write any introduction, explanation, markdown fences, or conversational text.
        Your response must start with '{{' and end with '}}'.

        JSON Template:
        {json.dumps(json_template, indent=4)}
        """

        result_data = await gemini_client.generate_structured_json(prompt)
        
        if not result_data:
            print(f"[MatchResultAgent] Failed to fetch results for match {match_id}")
            return None

        status_val = result_data.get("match_status", "completed").lower()

        # Fetch the grading agent user by email
        from backend.models import User
        agent_res = await db.execute(select(User).where(User.email == "gradingagent@gully-predict.com"))
        agent_user = agent_res.scalars().first()
        
        # Fallback to general AI user if the grading agent email is not found
        if not agent_user:
            ai_user_res = await db.execute(select(User).where(User.is_ai == True))
            agent_user = ai_user_res.scalars().first()

        agent_user_id = agent_user.id if agent_user else None

        if status_val in ("cancelled", "abandoned", "washed out") or result_data.get("winner") == "No Result":
            print(f"[MatchResultAgent] WARNING: Match {match_id} was identified as {status_val}. Skipping scoring.")
            match.status = MatchStatus.cancelled
            match.report_method = "agent"
            match.reported_by = agent_user_id
            match.raw_result_json = result_data
            await db.commit()
            return result_data

        # Update the match record
        match.raw_result_json = result_data
        match.status = MatchStatus.completed
        match.report_method = "agent"
        match.reported_by = agent_user_id
        
        # 3. Upsert TournamentMatchAnswer
        if match.tournament_id:
            tma_res = await db.execute(
                select(TournamentMatchAnswer).where(
                    TournamentMatchAnswer.tournament_id == match.tournament_id,
                    TournamentMatchAnswer.match_id == match.id
                )
            )
            tma = tma_res.scalars().first()
            
            correct_answers = {
                q.key if q.key else q.id: result_data[q.key if q.key else q.id]
                for q in questions_to_use
                if (q.key if q.key else q.id) in result_data
            }
            
            if tma:
                tma.correct_answers = correct_answers
            else:
                tma = TournamentMatchAnswer(
                    tournament_id=match.tournament_id,
                    match_id=match.id,
                    correct_answers=correct_answers
                )
                db.add(tma)
        
        await db.commit()
        await db.refresh(match)
        
        print(f"[MatchResultAgent] Match {match.id} marked completed. Triggering campaign scoring...")
        
        # 4. Trigger Campaign-wide scoring
        if match.tournament_id:
            from backend.models import CampaignStatus as CS, CampaignType
            from backend.campaigns_scoring import calculate_campaign_scores
            
            try:
                campaigns_res = await db.execute(
                    select(Campaign).options(selectinload(Campaign.questions), selectinload(Campaign.target_matches)).where(
                        Campaign.tournament_id == match.tournament_id,
                        Campaign.type == CampaignType.match,
                        Campaign.status == CS.active,
                        or_(
                            Campaign.target_matches.any(Match.id == match.id),
                            ~Campaign.target_matches.any()
                        )
                    )
                )
                campaigns = campaigns_res.scalars().all()
                for campaign in campaigns:
                    try:
                        await calculate_campaign_scores(campaign.id, match.id, db)
                        print(f"[MatchResultAgent] Successfully scored campaign {campaign.id} for match {match.id}")
                    except Exception as e:
                        print(f"[MatchResultAgent] Error scoring campaign {campaign.id}: {str(e)}")
            except Exception as e:
                print(f"[MatchResultAgent] Error querying/scoring campaigns: {str(e)}")
                
        # Also run legacy / compatibility match scoring
        from backend.scoring import calculate_match_scores
        try:
            await calculate_match_scores(match.id, db)
            print(f"[MatchResultAgent] Legacy scoring completed successfully for match {match.id}.")
        except Exception as e:
            print(f"[MatchResultAgent] Error during legacy scoring for match {match.id}: {str(e)}")

        return result_data

match_result_agent = MatchResultAgent()
