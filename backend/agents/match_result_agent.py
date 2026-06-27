import json
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from backend.models import Match, MatchStatus, Campaign, Tournament
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

        # Fetch the master campaign and its questions to make the prompt dynamic
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

        if not master_cam or not master_cam.questions:
            print(f"[MatchResultAgent] No campaign questions found for match {match_id} in tournament {match.tournament_id}. Skipping grading.")
            return None

        questions_prompt = ""
        json_template = {
            "match_status": "completed"
        }

        for q in master_cam.questions:
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
        
        await db.commit()
        await db.refresh(match)
        
        print(f"[MatchResultAgent] Match {match.id} marked completed. Triggering scoring engine...")
        
        # Trigger the scoring engine
        from backend.scoring import calculate_match_scores
        try:
            await calculate_match_scores(match.id, db)
            print(f"[MatchResultAgent] Scoring completed successfully for match {match.id}.")
        except Exception as e:
            print(f"[MatchResultAgent] Error during scoring for match {match.id}: {str(e)}")

        return result_data

match_result_agent = MatchResultAgent()
