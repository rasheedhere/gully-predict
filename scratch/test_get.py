import asyncio
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from backend.models import CampaignResult, Campaign
from sqlalchemy import select

engine = create_async_engine("sqlite+aiosqlite:///backend/database_dev.db")
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Campaign).where(Campaign.id == "89e73bb4-0435-4543-bd0f-8df2a2bf2e2c"))
        c = res.scalars().first()
        if c:
            print("Campaign found")
            cr_res = await db.execute(select(CampaignResult).where(CampaignResult.campaign_id == c.id))
            cr = cr_res.scalars().first()
            if cr:
                print("CampaignResult found:", cr.correct_answers)
            else:
                print("No CampaignResult")
        else:
            print("No campaign")

if __name__ == "__main__":
    asyncio.run(test())
