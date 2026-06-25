import os
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import Match, Tournament
from .gemini_client import gemini_client

class MatchStatusCheckerAgent:
    @staticmethod
    async def check_match_completed(match_id: str, db: AsyncSession) -> bool:
        """
        Lightweight agent to determine if a match has completed,
        was abandoned/cancelled, or is still live/upcoming.
        """
        # Get match details
        result = await db.execute(select(Match).where(Match.id == match_id))
        match = result.scalars().first()
        if not match:
            print(f"[MatchStatusCheckerAgent] Match {match_id} not found.")
            return False

        # Fetch tournament details to remain tournament agnostic
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

        print(f"[MatchStatusCheckerAgent] Checking completion status for Match {match.id} ({match.team1} vs {match.team2})...")
        status_prompt = f"""
        Determine if the following {gender_str}{tournament_name} match has completed, was abandoned/cancelled, or is still live/upcoming:
        Teams: {match.team1} vs {match.team2}
        Venue: {match.venue}
        Date: {match.start_time.strftime('%Y-%m-%d')}

        Use the Google Search tool to verify if this match has finished.
        
        You MUST respond ONLY with a raw JSON object matching the template below.
        Do NOT write any introduction, explanation, markdown fences, or conversational text.
        Your response must start with '{{' and end with '}}'.

        JSON Template:
        {{
            "completed": true
        }}
        Set "completed" to true if the match has finished (or was cancelled/abandoned), and false if it is still live, upcoming, or has not started.
        """
        
        status_data = await gemini_client.generate_structured_json(status_prompt)
        if status_data and status_data.get("completed"):
            print(f"[MatchStatusCheckerAgent] Match {match_id} completed check: TRUE")
            return True
        
        print(f"[MatchStatusCheckerAgent] Match {match_id} completed check: FALSE")
        return False

match_status_checker_agent = MatchStatusCheckerAgent()
