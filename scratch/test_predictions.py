import asyncio
import json
from backend.database import async_session
from backend.models import Match, User, CampaignResponse
from backend.scheduler import generate_ai_prediction
from sqlalchemy import select

async def run_tests():
    async with async_session() as db:
        # Find or create an AI user
        res = await db.execute(select(User).where(User.is_ai == True))
        ai_user = res.scalars().first()
        if not ai_user:
            ai_user = User(
                id="ai-test-user",
                email="ai-test@example.com",
                display_name="AI Predictor",
                is_ai=True,
                is_admin=False
            )
            db.add(ai_user)
            await db.commit()
            print("Created AI user.")
        else:
            print(f"Found AI user: {ai_user.id}")

        # 1. Test WT20 Match (Cricket + Womens)
        match_id_cricket = "WT20-2026-06"
        m_cricket = await db.get(Match, match_id_cricket)
        if m_cricket:
            print(f"\n--- Testing Cricket ({m_cricket.tournament_id}): {m_cricket.team1} vs {m_cricket.team2} ---")
            await generate_ai_prediction(db, m_cricket, ai_user)
            await db.commit()
            
            # Fetch response
            resp_res = await db.execute(
                select(CampaignResponse).where(
                    CampaignResponse.match_id == match_id_cricket,
                    CampaignResponse.user_id == ai_user.id
                )
            )
            resp = resp_res.scalars().first()
            if resp:
                print(f"Prediction Generated: {json.dumps(resp.answers, indent=2)}")
            else:
                print("No prediction generated!")

        # 2. Test FIFA Match (Football + Mens)
        match_id_football = "fifa-2026-03"
        m_football = await db.get(Match, match_id_football)
        if m_football:
            print(f"\n--- Testing Football ({m_football.tournament_id}): {m_football.team1} vs {m_football.team2} ---")
            await generate_ai_prediction(db, m_football, ai_user)
            await db.commit()
            
            # Fetch response
            resp_res = await db.execute(
                select(CampaignResponse).where(
                    CampaignResponse.match_id == match_id_football,
                    CampaignResponse.user_id == ai_user.id
                )
            )
            resp = resp_res.scalars().first()
            if resp:
                print(f"Prediction Generated: {json.dumps(resp.answers, indent=2)}")
            else:
                print("No prediction generated!")

asyncio.run(run_tests())
