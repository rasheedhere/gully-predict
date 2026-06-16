import argparse
import asyncio
from sqlalchemy import select
from backend.database import async_session
from backend.models import Tournament, TournamentTeamRanking

async def sync_rankings(tournament_id: str, gender: str, sport: str):
    print(f"Syncing rankings for tournament {tournament_id} (Gender: {gender}, Sport: {sport})...")
    
    # Mock data for demonstration, normally this would use requests/BeautifulSoup
    # to scrape ICC or FIFA rankings based on gender and sport.
    mock_data = {
        "cricket": {
            "mens": [
                ("India", 1, 267.0),
                ("Australia", 2, 256.0),
                ("England", 3, 254.0),
                ("South Africa", 4, 251.0),
            ],
            "womens": [
                ("Australia", 1, 290.0),
                ("England", 2, 281.0),
                ("India", 3, 265.0),
                ("New Zealand", 4, 252.0),
            ]
        },
        "football": {
            "mens": [
                ("Argentina", 1, 1858.0),
                ("France", 2, 1840.0),
                ("Spain", 3, 1813.0),
                ("England", 4, 1795.0),
                ("Brazil", 5, 1791.0),
                ("Belgium", 6, 1788.0),
                ("Netherlands", 7, 1742.0),
                ("Portugal", 8, 1740.0),
                ("Colombia", 9, 1727.0),
                ("Italy", 10, 1724.0),
                ("Uruguay", 11, 1713.0),
                ("Croatia", 12, 1701.0),
                ("Germany", 13, 1690.0),
                ("Morocco", 14, 1669.0),
                ("USA", 15, 1640.0),
                ("Senegal", 16, 1620.0),
                ("Switzerland", 17, 1618.0),
                ("Japan", 18, 1614.0),
                ("Iran", 19, 1611.0),
                ("Denmark", 20, 1608.0),
                ("South Korea", 21, 1589.0),
                ("Australia", 22, 1571.0),
                ("Sweden", 23, 1545.0),
                ("Ukraine", 24, 1540.0),
                ("Austria", 25, 1538.0),
                ("Ecuador", 26, 1535.0),
                ("Turkey", 27, 1528.0),
                ("Egypt", 28, 1515.0),
                ("Poland", 29, 1510.0),
                ("Norway", 30, 1502.0),
                ("Hungary", 31, 1500.0),
                ("Czech Republic", 32, 1495.0),
                ("Algeria", 33, 1485.0),
                ("Panama", 34, 1479.0),
                ("Ivory Coast", 35, 1475.0),
                ("Canada", 36, 1471.0),
                ("Tunisia", 37, 1450.0),
                ("Nigeria", 38, 1445.0),
                ("Scotland", 39, 1435.0),
                ("Cape Verde", 40, 1420.0),
                ("Iraq", 41, 1400.0),
                ("Saudi Arabia", 42, 1395.0),
                ("Uzbekistan", 43, 1385.0),
                ("DR Congo", 44, 1380.0),
                ("South Africa", 45, 1375.0),
                ("Curaçao", 46, 1350.0),
                ("Bosnia & Herzegovina", 47, 1345.0),
                ("Haiti", 48, 1335.0),
                ("Jordan", 49, 1320.0),
            ]
        }
    }

    sport_data = mock_data.get(sport.lower(), {}).get(gender.lower(), [])
    if not sport_data:
        print(f"No mock data found for sport={sport}, gender={gender}")
        return

    async with async_session() as db:
        tournament = await db.get(Tournament, tournament_id)
        if not tournament:
            print(f"Error: Tournament {tournament_id} not found in database.")
            return

        imported_count = 0
        for team_name, rank, rating in sport_data:
            existing_res = await db.execute(
                select(TournamentTeamRanking).where(
                    TournamentTeamRanking.tournament_id == tournament_id,
                    TournamentTeamRanking.team_name == team_name
                )
            )
            existing = existing_res.scalars().first()

            if existing:
                existing.rank = rank
                existing.rating = rating
                print(f"Updated {team_name} to rank {rank}")
            else:
                new_ranking = TournamentTeamRanking(
                    tournament_id=tournament_id,
                    team_name=team_name,
                    rank=rank,
                    rating=rating
                )
                db.add(new_ranking)
                print(f"Inserted {team_name} at rank {rank}")
            imported_count += 1

        await db.commit()
        print(f"Successfully synced {imported_count} team rankings.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync team rankings for a tournament.")
    parser.add_argument("--tournament-id", required=True, help="ID of the tournament")
    parser.add_argument("--gender", required=True, choices=["mens", "womens"], help="Gender of the tournament")
    parser.add_argument("--sport", required=True, choices=["cricket", "football"], help="Sport type")
    
    args = parser.parse_args()
    
    asyncio.run(sync_rankings(args.tournament_id, args.gender, args.sport))
