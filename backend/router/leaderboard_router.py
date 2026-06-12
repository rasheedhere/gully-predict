from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, case, text, literal

from backend.database import get_db
from backend.models import User, LeaderboardEntry, AllowlistedEmail, Match, CampaignResponse, TournamentUserMapping, Campaign, League, LeaderboardCache, LeagueUserMapping, Tournament
from backend.dependencies import get_current_user
# pyrefly: ignore [missing-import]
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])
START_MATCH_NO = 1

def match_filter_clause():
    """Returns a SQL expression to filter matches by the numeric suffix of match_id."""
    # SQLite/Postgres specific: Extract suffix after last '-'
    # For simplicity and cross-DB compatibility, we'll use a Python-side filter for now 
    # where possible, or a string comparison if the IDs are zero-padded.
    # Since they are not zero-padded (e.g. ipl-2026-7), we'll fetch matches first or use Python logic.
    pass

async def get_valid_match_ids(db: AsyncSession):
    res = await db.execute(select(Match.id))
    all_ids = res.scalars().all()
    return [mid for mid in all_ids if "-" in mid and mid.split("-")[-1].isdigit() and int(mid.split("-")[-1]) >= START_MATCH_NO]

@router.get("")
async def get_league_leaderboard(league_id: str = "ipl-2026-global", db: AsyncSession = Depends(get_db)):
    return await fetch_leaderboard_data(db, league_id)

async def fetch_leaderboard_data(db: AsyncSession, league_id: str):
    cache_key = f"leaderboard_{league_id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    valid_match_ids = await get_valid_match_ids(db)


    # Determine if this is a global leaderboard request
    is_global = league_id.endswith("-global")
    tournament_id = league_id.replace("-global", "") if is_global else None
    
    if not tournament_id:
        # Fetch tournament_id from league if not global
        league_res = await db.execute(select(League.tournament_id).where(League.id == league_id))
        tournament_id = league_res.scalar_one_or_none()

    # Fetch master campaign's max_powerups as the default
    master_cam_res = await db.execute(
        select(Campaign.max_powerups).where(
            Campaign.tournament_id == tournament_id,
            Campaign.is_master == True
        ).limit(1)
    )
    default_max_powerups = master_cam_res.scalar_one_or_none() or 10

    # Get leaderboard entries reading directly from LeaderboardCache
    query = select(
        User.id,
        User.name,
        User.alias,
        User.use_alias,
        User.avatar_url,
        func.coalesce(LeaderboardCache.total_points, 0).label("total_points"),
        func.coalesce(TournamentUserMapping.base_points, 0).label("base_points"),
        func.coalesce(TournamentUserMapping.base_powerups, default_max_powerups).label("base_powerups"),
    )
    
    if is_global:
        query = query.add_columns(
            literal(None).label("joined_at")
        ).join(LeaderboardCache, (User.id == LeaderboardCache.user_id) & (LeaderboardCache.tournament_id == tournament_id) & (LeaderboardCache.league_id.is_(None))) \
         .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))
    else:
        query = query.add_columns(
            LeagueUserMapping.joined_at
        ).join(LeagueUserMapping, (User.id == LeagueUserMapping.user_id) & (LeagueUserMapping.league_id == league_id)) \
         .outerjoin(LeaderboardCache, (User.id == LeaderboardCache.user_id) & (LeaderboardCache.league_id == league_id) & (LeaderboardCache.tournament_id == tournament_id)) \
         .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))

    result = await db.execute(
        query
        .where(User.is_guest == False, User.is_dev == False)
        .order_by(func.coalesce(LeaderboardCache.total_points, 0).desc())
    )
    
    users_raw_data = result.all()
    
    # Pre-fetch powerups used per user and campaign in this tournament
    powerups_used_res = await db.execute(
        select(
            CampaignResponse.user_id,
            CampaignResponse.campaign_id,
            Campaign.title,
            Campaign.max_powerups,
            func.count(CampaignResponse.id)
        )
        .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
        .where(Campaign.tournament_id == tournament_id)
        .where(CampaignResponse.use_powerup == True)
        .group_by(CampaignResponse.user_id, CampaignResponse.campaign_id, Campaign.title, Campaign.max_powerups)
    )
    
    user_global_used = {}
    user_campaign_used = {}
    
    for uid, cid, title, max_pw, count in powerups_used_res.all():
        if max_pw is None:
            user_global_used[uid] = user_global_used.get(uid, 0) + count
        else:
            user_campaign_used.setdefault(uid, {})[cid] = count

    # Fetch all campaigns in this tournament that have a max_powerups limit and are not drafts
    scoped_campaigns_res = await db.execute(
        select(Campaign.id, Campaign.title, Campaign.max_powerups)
        .where(Campaign.tournament_id == tournament_id)
        .where(Campaign.max_powerups.is_not(None))
        .where(Campaign.status != "draft")
    )
    scoped_campaigns = scoped_campaigns_res.all()

    # Map raw data to final user list
    users_data = []
    for row in users_raw_data:
        global_used = user_global_used.get(row.id, 0)
        global_max = row.base_powerups if row.base_powerups is not None else default_max_powerups
        global_remaining = max(0, global_max - global_used)
        
        balances = [
            {
                "type": "global",
                "name": "Global",
                "remaining": global_remaining,
                "max": global_max
            }
        ]
        
        for camp_id, camp_title, camp_max in scoped_campaigns:
            camp_used = user_campaign_used.get(row.id, {}).get(camp_id, 0)
            camp_remaining = max(0, camp_max - camp_used)
            balances.append({
                "type": "campaign",
                "campaign_id": camp_id,
                "name": camp_title,
                "remaining": camp_remaining,
                "max": camp_max
            })
            
        users_data.append({
            "id": row.id,
            "name": row.name,
            "alias": row.alias,
            "use_alias": row.use_alias,
            "avatar_url": row.avatar_url,
            "total_points": row.total_points,
            "base_points": row.base_points,
            "remaining_powerups": global_remaining,
            "powerup_balances": balances,
            "joined_at": row.joined_at
        })
    
    # We will compute matches_played dynamically based on joined_at
    # by fetching match counts per user
    user_match_counts = {}
    user_progression = {}
    
    # Pre-fetch all match progressions for the valid matches for these users
    user_ids = [u["id"] for u in users_data]
    if user_ids:
        # 1. Aggregate points per match (Master + League Specific if applicable)
        subq = select(
            LeaderboardEntry.user_id,
            LeaderboardEntry.match_id,
            func.sum(LeaderboardEntry.points).label("match_points")
        ).where(LeaderboardEntry.user_id.in_(user_ids)) \
         .where(LeaderboardEntry.match_id.in_(valid_match_ids))

        if is_global:
            subq = subq.where(LeaderboardEntry.league_id == None)
        else:
            subq = subq.where(or_(LeaderboardEntry.league_id == None, LeaderboardEntry.league_id == league_id))
        
        subq = subq.group_by(LeaderboardEntry.user_id, LeaderboardEntry.match_id).subquery()

        # Join back to get match details and global points breakdown
        from sqlalchemy.orm import aliased
        GlobalLE = aliased(LeaderboardEntry)
        prog_query = select(
            subq.c.user_id,
            subq.c.match_points,
            Match.team1, Match.team2, Match.id, Match.start_time,
            GlobalLE.points_breakdown.label("global_breakdown")
        ).join(Match, subq.c.match_id == Match.id) \
         .outerjoin(GlobalLE, (subq.c.user_id == GlobalLE.user_id) & (subq.c.match_id == GlobalLE.match_id) & (GlobalLE.league_id.is_(None)))

        prog_res = await db.execute(prog_query.order_by(Match.start_time.desc()))
        
        # 2. Fetch League-specific Campaign Breakdowns from CampaignResponse.points_breakdown
        league_breakdowns = {}
        if not is_global:
            ca_res = await db.execute(
                select(
                    CampaignResponse.user_id,
                    CampaignResponse.match_id,
                    CampaignResponse.points_breakdown,
                )
                .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
                .where(CampaignResponse.user_id.in_(user_ids))
                .where(CampaignResponse.match_id.in_(valid_match_ids))
                .where(Campaign.is_master == False)
                .where(Campaign.league_id == league_id)
            )
            for uid, mid, breakdown in ca_res.all():
                if breakdown and "rules" in breakdown:
                    league_breakdowns.setdefault(uid, {}).setdefault(mid, []).extend(
                        [{**r, "category": f"[League] {r.get(chr(99)+chr(97)+chr(116)+chr(101)+chr(103)+chr(111)+chr(114)+chr(121), chr(63))}"}
                         for r in breakdown["rules"]]
                    )

        for uid, p, t1, t2, mid, start_time, global_breakdown in prog_res.all():
            if uid not in user_progression:
                user_progression[uid] = []
            m_no = mid.split("-")[2] if "-" in mid else mid
            
            # Initialize final_breakdown with global rules if they exist
            if global_breakdown and "rules" in global_breakdown:
                final_breakdown = {
                    "rules": list(global_breakdown["rules"]),
                    "total": p or 0,
                    "powerup": global_breakdown.get("powerup", {"used": False, "multiplier": 1})
                }
            else:
                final_breakdown = {
                    "rules": [],
                    "total": p or 0,
                    "powerup": {"used": False, "multiplier": 1}
                }
            
            # Merge league breakdown if available
            if uid in league_breakdowns and mid in league_breakdowns[uid]:
                final_breakdown["rules"].extend(league_breakdowns[uid][mid])
                final_breakdown["total"] = p or 0

            user_progression[uid].append({
                "match_number": m_no,
                "teams": f"{t1} vs {t2}",
                "points": p or 0,
                "breakdown": final_breakdown,
                "start_time": start_time
            })
    user_campaigns = {}
    if user_ids:
        # Fetch LeaderboardEntry where match_id is None (General Campaigns)
        camp_query = select(
            LeaderboardEntry.user_id,
            LeaderboardEntry.points,
            LeaderboardEntry.points_breakdown,
            Campaign.title,
            Campaign.updated_at
        ).join(Campaign, LeaderboardEntry.campaign_id == Campaign.id) \
         .where(LeaderboardEntry.user_id.in_(user_ids)) \
         .where(LeaderboardEntry.match_id == None) \
         .where(Campaign.tournament_id == tournament_id)
         
        if not is_global:
            # For league-specific leaderboards, we show global general campaigns + league's general campaigns
            camp_query = camp_query.where(or_(LeaderboardEntry.league_id == None, LeaderboardEntry.league_id == league_id))
        else:
            camp_query = camp_query.where(LeaderboardEntry.league_id == None)
            
        camp_res = await db.execute(camp_query)
        for uid, c_points, c_breakdown, c_title, c_date in camp_res.all():
            if uid not in user_campaigns:
                user_campaigns[uid] = []
            
            # Format breakdown similarly
            final_breakdown = {
                "rules": list(c_breakdown["rules"]) if c_breakdown and "rules" in c_breakdown else [],
                "total": c_points or 0,
                "powerup": c_breakdown.get("powerup", {"used": False, "multiplier": 1}) if c_breakdown else {"used": False, "multiplier": 1}
            }
                
            user_campaigns[uid].append({
                "campaign_title": c_title,
                "points": c_points or 0,
                "breakdown": final_breakdown,
                "date": c_date.isoformat() if c_date else None
            })

    entries = []
    for rank, u in enumerate(users_data, start=1):
        uid = u["id"]
        name = u["name"]
        alias = u["alias"]
        use_alias = u["use_alias"]
        avatar = u["avatar_url"]
        points = u["total_points"]
        remaining_powerups = u["remaining_powerups"]
        joined_at = u["joined_at"]
        # Use pre-fetched progression data; filter to matches after joined_at
        raw_progression = user_progression.get(uid, [])
        # Filter to matches after the user joined the league
        if joined_at:
            raw_progression = [p for p in raw_progression if p["start_time"] >= joined_at]
        # Filter to start match number, take last 10
        progression = [
            {"match_number": p["match_number"], "teams": p["teams"], "points": p["points"], "breakdown": p["breakdown"]}
            for p in raw_progression if p["match_number"].isdigit() and int(p["match_number"]) >= START_MATCH_NO
        ][:10]

        matches_played = len(raw_progression)
        
        campaign_scores = user_campaigns.get(uid, [])
        campaign_scores.sort(key=lambda x: x["date"] or "", reverse=True)

        entries.append({
            "rank": rank,
            "id": uid,
            "username": name,
            "alias": alias,
            "use_alias": use_alias,
            "avatar_url": avatar,
            "total_points": points,
            "base_points": u["base_points"],
            "matches_played": matches_played,
            "remaining_powerups": remaining_powerups or 0,
            "powerup_balances": u.get("powerup_balances", []),
            "progression": progression,
            "campaign_scores": campaign_scores,
            "accuracy_pct": 0
        })
    
    backend_cache.set(cache_key, entries)
    return entries

@router.get("/match/{match_id}")
async def get_match_leaderboard(match_id: str, db: AsyncSession = Depends(get_db)):
    cache_key = f"match_leaderboard_{match_id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(User.id, User.name, User.alias, User.use_alias, User.avatar_url, LeaderboardEntry.points)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .where(LeaderboardEntry.match_id == match_id)
        .where(LeaderboardEntry.league_id == None)
        .where(User.is_guest == False, User.is_dev == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .order_by(LeaderboardEntry.points.desc())
    )
    
    entries = []
    for rank, (uid, name, alias, use_alias, avatar, points) in enumerate(result.all(), start=1):
        entries.append({
            "rank": rank,
            "id": uid,
            "username": name,
            "alias": alias,
            "use_alias": use_alias,
            "avatar_url": avatar,
            "match_points": points
        })
    
    backend_cache.set(cache_key, entries)
    return entries

@router.get("/match-podiums")
async def get_match_podiums(db: AsyncSession = Depends(get_db)):
    cache_key = "match_podiums"
    # cached = backend_cache.get(cache_key)
    # if cached: return cached

    matches_res = await db.execute(
        select(Match)
        .where(Match.status == "completed")
        .order_by(Match.start_time.desc())
    )
    matches = matches_res.scalars().all()
    
    podiums = []
    for m in matches:
        lb_res = await db.execute(
            select(User.id, User.name, User.alias, User.use_alias, User.avatar_url, LeaderboardEntry.points, CampaignResponse.use_powerup)
            .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
            .outerjoin(CampaignResponse, (User.id == CampaignResponse.user_id) & (LeaderboardEntry.match_id == CampaignResponse.match_id) & (CampaignResponse.use_powerup == True))
            .where(LeaderboardEntry.match_id == m.id)
            .where(User.is_guest == False, User.is_dev == False)
            .where(LeaderboardEntry.league_id.is_(None))
            .order_by(LeaderboardEntry.points.desc())
        )
        
        all_players = lb_res.all()
        top_players = []
        current_rank = 0
        last_points = None
        
        for i, (uid, name, alias, use_alias, avatar, pts, used_pw) in enumerate(all_players):
            if pts != last_points:
                current_rank = i + 1
            
            if current_rank > 3:
                break
                
            top_players.append({
                "id": uid,
                "username": name,
                "alias": alias,
                "use_alias": use_alias,
                "avatar_url": avatar,
                "points": pts,
                "rank": current_rank,
                "used_powerup": used_pw == "Yes"
            })
            last_points = pts
        
        mid = m.id
        m_no = mid.split("-")[2] if "-" in mid else mid
        podiums.append({
            "match_id": m.id,
            "match_number": m_no,
            "match_name": f"{m.team1} vs {m.team2}",
            "match_date": m.start_time,
            "top_players": top_players
        })
    
    backend_cache.set(cache_key, podiums)
    return podiums

@router.get("/analysis")
async def get_analysis_data(tournament_id: str = "ipl-2026", db: AsyncSession = Depends(get_db)):
    cache_key = f"analysis_{tournament_id}"
    cached = backend_cache.get(cache_key)
    if cached: 
        return cached

    from datetime import UTC, datetime, timedelta
    now = datetime.now(UTC)
    last_week = now - timedelta(days=7)
    
    from backend.models import Match
    
    valid_match_ids = await get_valid_match_ids(db)
    
    # 1. Weekly Performance
    weekly_res = await db.execute(
        select(
            User.id,
            User.name,
            User.alias,
            User.use_alias,
            User.avatar_url,
            func.sum(LeaderboardEntry.points).label("weekly_points"),
            func.count(LeaderboardEntry.match_id).label("matches_played")
        )
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.start_time >= last_week)
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False, User.is_dev == False)
        .where(LeaderboardEntry.league_id.is_(None))
        .group_by(User.id)
        .order_by(func.sum(LeaderboardEntry.points).desc())
    )
    
    weekly_stats = []
    for uid, name, alias, use_alias, avatar, pts, count in weekly_res.all():
        weekly_stats.append({
            "id": uid,
            "username": name,
            "alias": alias,
            "use_alias": use_alias,
            "avatar_url": avatar,
            "points": pts,
            "matches": count
        })

    # 2. Today's Performance (Last 24h)
    today_start = now - timedelta(days=1)
    today_res = await db.execute(
        select(
            User.id,
            User.name,
            User.alias,
            User.use_alias,
            User.avatar_url,
            func.sum(LeaderboardEntry.points).label("today_points"),
            func.count(LeaderboardEntry.match_id).label("matches_played")
        )
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.start_time >= today_start)
        .where(User.is_guest == False, User.is_dev == False)
        .where(LeaderboardEntry.league_id.is_(None))
        .group_by(User.id, User.name, User.avatar_url)
        .order_by(func.sum(LeaderboardEntry.points).desc())
    )
    
    today_stats = []
    for uid, name, alias, use_alias, avatar, pts, count in today_res.all():
        today_stats.append({
            "id": uid,
            "username": name,
            "alias": alias,
            "use_alias": use_alias,
            "avatar_url": avatar,
            "points": pts,
            "matches": count
        })

    # 3. Powerups Analytics
    powerup_usage_res = await db.execute(
        select(
            User.id,
            User.name,
            User.alias,
            User.use_alias,
            User.avatar_url,
            TournamentUserMapping.base_powerups,
            Match.team1,
            Match.team2,
            Match.id.label("match_id"),
            Match.start_time,
            CampaignResponse.total_points,
            Match.status,
            Campaign.max_powerups
        )
        .join(CampaignResponse, User.id == CampaignResponse.user_id)
        .join(Match, CampaignResponse.match_id == Match.id)
        .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
        .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))
        .where(CampaignResponse.use_powerup == True)
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False, User.is_dev == False)
        .order_by(User.name, Match.start_time.desc())
    )

    
    powerup_stats_map = {}
    for uid, name, alias, use_alias, avatar, base, t1, t2, mid, start_time, points, status, camp_max in powerup_usage_res.all():
        if uid not in powerup_stats_map:
            powerup_stats_map[uid] = {
                "id": uid,
                "username": name,
                "alias": alias,
                "use_alias": use_alias,
                "avatar_url": avatar,
                "base_powerups": base if base is not None else default_max_powerups,
                "used_matches": [],
                "total_powerup_points": 0,
                "avg_points_per_powerup": 0
            }
        
        m_no = mid.split("-")[2] if "-" in mid else mid
        powerup_stats_map[uid]["used_matches"].append({
            "match_id": mid,
            "match_number": m_no,
            "teams": f"{t1} vs {t2}",
            "date": start_time,
            "points": points or 0,
            "match_status": status,
            "is_campaign_scoped": camp_max is not None
        })
        
        if status == "completed":
            powerup_stats_map[uid]["total_powerup_points"] += (points or 0)

    for stats in powerup_stats_map.values():
        completed_count = len([m for m in stats["used_matches"] if m["match_status"] == "completed"])
        if completed_count > 0:
            stats["avg_points_per_powerup"] = round(stats["total_powerup_points"] / completed_count, 1)
    
    # Include all relevant users even if they haven't used powerups
    all_users_res = await db.execute(
        select(User.id, User.name, User.alias, User.use_alias, User.avatar_url, TournamentUserMapping.base_powerups)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))
        .where(User.is_guest == False, User.is_dev == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
    )
    all_users_list = all_users_res.all()
    for uid, name, alias, use_alias, avatar, base in all_users_list:
        if uid not in powerup_stats_map:
            powerup_stats_map[uid] = {
                "id": uid,
                "username": name,
                "alias": alias,
                "use_alias": use_alias,
                "avatar_url": avatar,
                "base_powerups": base if base is not None else default_max_powerups,
                "used_matches": []
            }

    # 4. Global Accuracy Stats (Max 55 points per match)
    accuracy_res = await db.execute(
        select(
            User.id,
            User.name,
            func.sum(
                case(
                    (CampaignResponse.use_powerup == True, CampaignResponse.total_points / 2),
                    else_=func.coalesce(CampaignResponse.total_points, 0)
                )
            ).label("base_match_points"),
            func.count(Match.id).label("completed_matches")
        )
        .join(CampaignResponse, User.id == CampaignResponse.user_id)
        .join(Match, CampaignResponse.match_id == Match.id)
        .where(Match.status == "completed")
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False, User.is_dev == False)
        .group_by(User.id, User.name)
    )

    
    accuracy_map = {}
    for uid, name, base_pts, count in accuracy_res.all():
        if count > 0:
            accuracy_map[uid] = round((base_pts / (count * 55)) * 100, 1)

    # 5. Match Wins Stats (Who won the most matches)
    match_wins_res = await db.execute(
        select(Match.id, User.name, LeaderboardEntry.points)
        .join(LeaderboardEntry, Match.id == LeaderboardEntry.match_id)
        .join(User, LeaderboardEntry.user_id == User.id)
        .where(Match.status == "completed")
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False, User.is_dev == False)
        .where(LeaderboardEntry.league_id.is_(None))
    )

    
    match_scores = {} # match_id -> List of (uid, points)
    for mid, uid, points in (await db.execute(
        select(Match.id, User.id, LeaderboardEntry.points)
        .join(LeaderboardEntry, Match.id == LeaderboardEntry.match_id)
        .join(User, LeaderboardEntry.user_id == User.id)
        .where(Match.status == "completed")
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False, User.is_dev == False)
        .where(LeaderboardEntry.league_id.is_(None))
    )).all():
        if mid not in match_scores:
            match_scores[mid] = []
        match_scores[mid].append((uid, points))
        
    user_wins_map = {} # uid -> List of match_numbers
    for mid, players in match_scores.items():
        if not players: continue
        max_pts = max(p[1] for p in players)
        # Rule: Any player with the max score is a winner
        winners = [p[0] for p in players if p[1] == max_pts]
        m_no = mid.split("-")[2] if "-" in mid else mid
        for winner_uid in winners:
            if winner_uid not in user_wins_map:
                user_wins_map[winner_uid] = []
            user_wins_map[winner_uid].append(m_no)

    # 6. Standing & Percentile Calculation (Based on LeaderboardCache for Global League)
    lb_result = await db.execute(
        select(
            User.id,
            User.name,
            func.coalesce(LeaderboardCache.total_points, 0).label("total_points")
        )
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(User.is_guest == False, User.is_dev == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .outerjoin(LeaderboardCache, (User.id == LeaderboardCache.user_id) & (LeaderboardCache.league_id.is_(None)) & (LeaderboardCache.tournament_id == tournament_id))
        .order_by(func.coalesce(LeaderboardCache.total_points, 0).desc())
    )
    
    lb_data_rows = lb_result.all()
    total_players = len(lb_data_rows)
    percentile_map = {}
    points_map = {}
    for rank, (uid, name, pts) in enumerate(lb_data_rows, start=1):
        if total_players > 0:
            percentile = round(((total_players - rank + 1) / total_players) * 100, 1)
            percentile_map[uid] = percentile
            points_map[uid] = pts

    # 7. Badges & Special Achievements (Simplified by fetching LeaderboardEntry points_breakdown)
    all_le_res = await db.execute(
        select(User.id, User.name, LeaderboardEntry.points, LeaderboardEntry.points_breakdown, Match.id.label("match_id"), Match.start_time, Match.status)
        .join(User, LeaderboardEntry.user_id == User.id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False, User.is_dev == False)
        .where(LeaderboardEntry.league_id.is_(None))
        .order_by(Match.start_time)
    )
    all_les = all_le_res.all()

    user_entries = {}
    
    bravo_map = {}
    bumrah_map = {}
    streak_map = {}
    wall_map = {}
    ht_map = {}
    dhoni_map = {}
    impact_map = {}
    boss_map = {}
    mystery_map = {}
    cb_map = {}
    hw_map = {}
    direct_map = {}
    sixster_map = {}
    fourster_map = {}
    doosra_map = {}
    army_map = {}
    maxwell_map = {}
    switch_map = {}

    # Pre-collect match winner predictions for One Man Army
    match_winner_preds = {} # {match_id: {predicted_team: [uid]}}
    for uid, name, pts, breakdown, mid, m_start_time, m_status in all_les:
        if m_status != "completed": continue
        if not breakdown or "rules" not in breakdown: continue
        for rule in breakdown["rules"]:
            cat = str(rule.get("category", "")).lower()
            key = str(rule.get("key", "")).lower()
            if "winner" in cat or key == "match_winner":
                pred_val = rule.get("predicted")
                if pred_val:
                    pred_team = str(pred_val).strip()
                    match_winner_preds.setdefault(mid, {}).setdefault(pred_team, []).append(uid)

    for mid, teams_map in match_winner_preds.items():
        for team, uids in teams_map.items():
            if len(uids) == 1:
                loner_uid = uids[0]
                army_map[loner_uid] = army_map.get(loner_uid, 0) + 1

    for uid, name, pts, breakdown, mid, m_start_time, m_status in all_les:
        if m_status != "completed": continue
        if uid not in user_entries: user_entries[uid] = []
        user_entries[uid].append(pts)

        # Check universe boss (max single score)
        boss_map[uid] = max(boss_map.get(uid, 0), pts)
        
        if not breakdown or "rules" not in breakdown: continue
        
        # Analyze breakdown
        match_impact = 0
        bingo_pp_count = 0
        
        # Check powerup usage directly in the breakdown dictionary
        used_powerup = breakdown.get("powerup", {}).get("used", False)
        if used_powerup:
            if pts < 0:
                hw_map[uid] = hw_map.get(uid, 0) + 1
            elif pts > 0:
                maxwell_map[uid] = max(maxwell_map.get(uid, 0), pts)
        
        for rule in breakdown["rules"]:
            cat = str(rule.get("category", "")).lower()
            r_pts = rule.get("points", 0)
            r_status = str(rule.get("status", "")).lower()
            
            if "powerplay" in cat:
                if r_pts == 15 or r_pts == 30: # 15 base or 30 with powerup
                    bumrah_map[uid] = bumrah_map.get(uid, 0) + 1
                if r_pts == 5 or r_pts == 10:
                    direct_map[uid] = direct_map.get(uid, 0) + 1
                if r_pts >= 10:
                    match_impact += r_pts
                
                # Switch Hit (exact match on powerplay)
                if r_status == "bingo":
                    bingo_pp_count += 1
                
                # Dwayne Bravo logic (extreme prediction: score < 35 or > 100)
                pred_val = rule.get("predicted")
                if pred_val is not None:
                    try:
                        pred_num = int(float(pred_val))
                        if pred_num < 35 or pred_num > 100:
                            bravo_map[uid] = bravo_map.get(uid, 0) + 1
                    except (ValueError, TypeError):
                        pass
            
            if "sixes" in cat and r_pts >= 5:
                sixster_map[uid] = sixster_map.get(uid, 0) + 1
            
            if "fours" in cat and r_pts >= 5:
                fourster_map[uid] = fourster_map.get(uid, 0) + 1
            
            if "winner" in cat:
                if r_pts < 0:
                    doosra_map[uid] = doosra_map.get(uid, 0) + 1
                    
        if bingo_pp_count >= 2:
            switch_map[uid] = switch_map.get(uid, 0) + 1
                    
        impact_map[uid] = impact_map.get(uid, 0) + match_impact
        if pts >= 30:
            cb_map[uid] = cb_map.get(uid, 0) + 1

    for uid, scores in user_entries.items():
        # Streaks
        max_streak = 0
        current_streak = 0
        max_ht = 0
        current_ht = 0
        for s in scores:
            if s > 0:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0
                
            if s >= 30:
                current_ht += 1
                max_ht = max(max_ht, current_ht)
            else:
                current_ht = 0
                
        streak_map[uid] = max_streak
        ht_map[uid] = max_ht
        
        last_10 = scores[-10:]
        wall_map[uid] = len([s for s in last_10 if s >= 20])
        
        final_5 = scores[-5:]
        if len(final_5) >= 3:
            dhoni_map[uid] = sum(final_5) / len(final_5)

    chase_map = {}
    chase_date_map = {}
    
    # Calculate Chase Master rank jump over 7-day windows
    from datetime import datetime, timedelta
    
    def parse_dt(val):
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        except Exception:
            return None

    # Group completed matches in chronological order
    matches_ordered = []
    match_id_to_start_time = {}
    for uid, name, pts, breakdown, mid, m_start_time, m_status in all_les:
        if m_status != "completed": continue
        if mid not in match_id_to_start_time:
            matches_ordered.append(mid)
            match_id_to_start_time[mid] = m_start_time

    if matches_ordered:
        # cumulative_scores: uid -> total_points
        cumulative_scores = {u.id: 0 for u in all_users_list}
        # rank_history: uid -> {match_id: rank}
        rank_history = {u.id: {} for u in all_users_list}
        
        for mid in matches_ordered:
            # Add points from this match
            match_entries = [le for le in all_les if le.match_id == mid]
            for le in match_entries:
                if le.id in cumulative_scores:
                    cumulative_scores[le.id] += le.points
            
            # Sort users to determine rankings
            sorted_users = sorted(cumulative_scores.keys(), key=lambda k: cumulative_scores[k], reverse=True)
            current_rank = 1
            prev_score = None
            for rank_idx, u_id in enumerate(sorted_users, start=1):
                score = cumulative_scores[u_id]
                if prev_score is not None and score < prev_score:
                    current_rank = rank_idx
                prev_score = score
                rank_history[u_id][mid] = current_rank
        
        # Calculate rank jumps for each user over 7-day rolling windows
        for u in all_users_list:
            u_id = u.id
            max_jump = 0
            best_date = None
            for k_idx, mid_k in enumerate(matches_ordered):
                rank_k = rank_history.get(u_id, {}).get(mid_k)
                if rank_k is None: continue
                time_k = match_id_to_start_time[mid_k]
                if not time_k: continue
                
                for mid_j in matches_ordered[:k_idx]:
                    rank_j = rank_history.get(u_id, {}).get(mid_j)
                    if rank_j is None: continue
                    time_j = match_id_to_start_time[mid_j]
                    if not time_j: continue
                    
                    t_k = parse_dt(time_k)
                    t_j = parse_dt(time_j)
                    
                    if t_k and t_j and t_k - t_j <= timedelta(days=7):
                        jump = rank_j - rank_k  # Positive indicates rank improved
                        if jump > max_jump:
                            max_jump = jump
                            best_date = t_k
            if max_jump > 0:
                chase_map[u_id] = max_jump
                chase_date_map[u_id] = best_date

    def get_winners(data_map):
        if not data_map: return []
        max_val = max(data_map.values())
        if max_val <= 0: return []
        winners = []
        for uid, val in data_map.items():
            if val == max_val:
                row = next((u for u in all_users_list if u.id == uid), None)
                if row:
                    winners.append({
                        "id": uid,
                        "username": row.name,
                        "alias": row.alias,
                        "use_alias": row.use_alias,
                        "avatar_url": row.avatar_url,
                        "value": val
                    })
        return winners

    def get_chase_winners(data_map, date_map):
        return get_winners(data_map)

    hall_of_fame = {
        "heath_streak": get_winners(streak_map),
        "dwayne_bravo": get_winners(bravo_map),
        "yorker_king": get_winners(bumrah_map),
        "universe_boss": get_winners(boss_map),
        "the_wall": get_winners(wall_map),
        "hat_trick": get_winners(ht_map),
        "the_big_show": get_winners(maxwell_map),
        "captain_cool": get_winners(dhoni_map),
        "chase_master": get_chase_winners(chase_map, chase_date_map),
        "impact_player": get_winners(impact_map),
        "switch_hit": get_winners(switch_map),
        "caught_bowled": get_winners(cb_map),
        "hit_wicket": get_winners(hw_map),
        "direct_hit": get_winners(direct_map),
        "doosra_spinner": get_winners(doosra_map),
        "one_man_army": get_winners(army_map),
        "sixster": get_winners(sixster_map),
        "fourster": get_winners(fourster_map),
    }

    # 9. Final Response Structure
    accuracy_stats = []
    for uid, name, alias, use_alias, avatar, base in all_users_list:
        accuracy_stats.append({
            "id": uid,
            "username": name,
            "alias": alias,
            "use_alias": use_alias,
            "avatar_url": avatar,
            "accuracy": accuracy_map.get(uid, 0),
            "percentile": percentile_map.get(uid, 0),
            "total_points": points_map.get(uid, 0),
            "badges": [b for b in [
                {"type": "streak", "name": "Heath Streak", "value": streak_map.get(uid, 0)} if streak_map.get(uid, 0) >= 2 else None,
                {"type": "brave", "name": "Bravo Award", "value": bravo_map.get(uid, 0)} if bravo_map.get(uid, 0) >= 1 else None,
                {"type": "bumrah", "name": "Yorker King", "value": bumrah_map.get(uid, 0)} if bumrah_map.get(uid, 0) >= 1 else None,
                {"type": "wall", "name": "The Wall", "value": "Consistent"} if wall_map.get(uid, 0) >= 7 else None,
                {"type": "malinga", "name": "Hat-Trick", "value": "Triple Threat"} if ht_map.get(uid, 0) >= 3 else None,
                {"type": "sachin", "name": "Master Blaster", "value": "Milestone"} if points_map.get(uid, 0) >= 500 else None,
                {"type": "maxwell", "name": "The Big Show", "value": f"{maxwell_map.get(uid, 0)} Pts"} if maxwell_map.get(uid, 0) >= 40 else None,
                {"type": "kohli", "name": "Chase Master", "value": f"Up {chase_map.get(uid, 0)} ({chase_date_map.get(uid).strftime('%b %d') if chase_date_map.get(uid) else ''})"} if chase_map.get(uid, 0) >= 3 else None,
                {"type": "russell", "name": "Impact Player", "value": "Powerplay King"} if impact_map.get(uid, 0) >= 100 else None,
                {"type": "sixster", "name": "Sixster", "value": f"{sixster_map.get(uid, 0)} Sixes"} if sixster_map.get(uid, 0) >= 1 else None,
                {"type": "fourster", "name": "Fourster", "value": f"{fourster_map.get(uid, 0)} Fours"} if fourster_map.get(uid, 0) >= 1 else None,
            ] if b is not None]
        })

    analysis_data = {
        "weekly_podium": weekly_stats[:5],
        "today_podium": today_stats[:5],
        "recent_podiums": await get_match_podiums(db),
        "hall_of_fame": hall_of_fame,
        "powerups_stats": [
            {
                **v, 
                "match_wins": len(user_wins_map.get(k, [])),
                "won_matches": sorted(user_wins_map.get(k, []), key=lambda x: int(x) if x.isdigit() else 0),
                "accuracy": accuracy_map.get(k, 0) # Keep for UI styling consistency
            } 
            for k, v in powerup_stats_map.items()
        ],
        "accuracy_stats": accuracy_stats
    }
    
    # Filter out None badges
    for stat in analysis_data["accuracy_stats"]:
        stat["badges"] = [b for b in stat["badges"] if b is not None]
    
    backend_cache.set(cache_key, analysis_data)
    return analysis_data


@router.get("/my-leagues")
async def get_my_leagues(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all leagues the current user belongs to with their current cached points."""

    result = await db.execute(
        select(
            League.id,
            League.name,
            League.join_code,
            Tournament.id.label("tournament_id"),
            Tournament.name.label("tournament_name"),
            LeagueUserMapping.joined_at,
            func.coalesce(LeaderboardCache.total_points, 0).label("my_points")
        )
        .join(LeagueUserMapping, (League.id == LeagueUserMapping.league_id) & (LeagueUserMapping.user_id == current_user.id))
        .join(Tournament, League.tournament_id == Tournament.id)
        .outerjoin(LeaderboardCache, (LeaderboardCache.league_id == League.id) & (LeaderboardCache.user_id == current_user.id))
        .order_by(League.created_at)
    )

    leagues = []
    for lid, lname, jcode, tid, tname, joined_at, my_pts in result.all():
        count_res = await db.execute(
            select(func.count(LeagueUserMapping.user_id)).where(LeagueUserMapping.league_id == lid)
        )
        member_count = count_res.scalar() or 0
        
        # Calculate remaining powerups for the tournament this league belongs to
        league_obj = await db.get(League, lid)
        t_id = league_obj.tournament_id
        
        mapping_res = await db.execute(select(TournamentUserMapping).where(TournamentUserMapping.user_id == current_user.id, TournamentUserMapping.tournament_id == t_id))
        mapping = mapping_res.scalars().first()
        base_pu = mapping.base_powerups if mapping and mapping.base_powerups is not None else 10
        
        used_res = await db.execute(
            select(func.count(CampaignResponse.id))
            .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
            .where(CampaignResponse.user_id == current_user.id, CampaignResponse.use_powerup == True, Campaign.tournament_id == t_id)
        )
        used_pu = used_res.scalars().first() or 0
        
        leagues.append({
            "id": lid,
            "name": lname,
            "join_code": jcode,
            "tournament_id": tid,
            "tournament_name": tname,
            "joined_at": joined_at,
            "remaining_powerups": max(0, base_pu - used_pu),
            "my_points": my_pts,
            "member_count": member_count
        })

    # Add Global Leaderboard entry for each tournament the user is in
    tournaments_stmt = select(Tournament).join(League).join(LeagueUserMapping).where(LeagueUserMapping.user_id == current_user.id).distinct()
    tournaments = (await db.execute(tournaments_stmt)).scalars().all()
    
    for t in tournaments:
        mapping_res = await db.execute(select(TournamentUserMapping).where(TournamentUserMapping.user_id == current_user.id, TournamentUserMapping.tournament_id == t.id))
        mapping = mapping_res.scalars().first()
        base_pu = mapping.base_powerups if mapping and mapping.base_powerups is not None else 10
        
        used_res = await db.execute(
            select(func.count(CampaignResponse.id))
            .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
            .where(CampaignResponse.user_id == current_user.id, CampaignResponse.use_powerup == True, Campaign.tournament_id == t.id)
        )
        used_pu = used_res.scalars().first() or 0

        leagues.insert(0, {
            "id": f"{t.id}-global",
            "name": "Global Leaderboard",
            "join_code": None,
            "tournament_name": t.name,
            "joined_at": None,
            "remaining_powerups": max(0, base_pu - used_pu),
            "my_points": 0, # Could fetch this from cache if needed
            "member_count": 0, # Not applicable for global in this context
            "is_global": True
        })

    return leagues
