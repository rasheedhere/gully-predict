# Project TODOs & Backlog

## Leaderboard Powerups Display
**Status**: Completed
**Context**:
Currently, the leaderboard only returns the global tournament powerup balance for users (`TournamentUserMapping.base_powerups - used`). However, Master Campaigns (like a "Playoffs" phase) can now define their own isolated `max_powerups` limit. We need a way to communicate these campaign-specific powerup balances to users viewing the leaderboard.

**Proposed Brainstorming Directions**:
1. **Split View (Dual Indicators)**: Return both balances in the API and render two separate `Zap` badges on user avatars (e.g., Gold for global, Purple for playoffs).
2. **Dynamic Override**: If the next upcoming match belongs to a campaign with scoped powerups, dynamically swap the leaderboard's powerup count to reflect the campaign balance, accompanied by a prominent banner explaining the swap.
3. **Expanded Stats Modal**: Return a nested `powerup_breakdown` object in the API and open a sleek "Stats Profile" modal when a user row is clicked, detailing their balances across all phases cleanly.

---

## Auto-Predict Architecture Refactor
**Status**: Backlog / Parked
**Context**: 
Currently, the `generate_answers` function (used by both the frontend "Auto Predict" button and the background `AI Assassin`) relies on hardcoded string-matching against the question text to figure out how to predict an answer. 

Examples of current fragile logic:
- `if "win" in text: return match_winner`
- `if "dot ball" in text: return random_team`
- `if "potm" in text: return man_of_the_match`

**The Problem**:
This is entirely unscalable. If a League Admin creates a custom question like "Will RCB win?", the string matcher breaks. The AI might hallucinate or crash if it can't definitively match a string to an expected pattern.

**Proposed Solution (Schema-Driven Classification)**:
Move the auto-predict logic out of Python string-matching and into explicit database configuration.

1. **Database Schema Update**: Add a new column `auto_predict_strategy` (Enum) to the `CampaignQuestion` and `TournamentQuestion` tables.
2. **Enum Options**: 
   - `MATCH_WINNER` (Picks the winning team)
   - `POTM` (Picks the Player of the Match)
   - `TEAM1_SCORE` (Picks team 1's powerplay/score)
   - `TEAM2_SCORE` (Picks team 2's powerplay/score)
   - `RANDOM_TEAM` (Picks randomly between T1 and T2)
   - `RANDOM_OPTION` (Picks randomly from `q.options`)
   - `RANDOM_NUMBER` (Picks a random number)
   - `NONE` (Skip auto-predict)
3. **Admin UI Update**: Add a dropdown when creating/editing questions to select this strategy.
4. **Backend Refactor**: Update `generate_answers` in `backend/router/match_router.py` and `backend/scheduler.py` to simply switch on `q.auto_predict_strategy`. 

This guarantees 100% deterministic AI behavior and fully supports custom league questions.

---

## General Campaign Scoring Integration
**Status**: Completed
**Context**:
Currently, when a `CampaignType.general` is scored, the points are correctly saved to `CampaignResponse.total_points`. However, these points are ignored by the leaderboard aggregation engine (`update_leaderboard_cache`), meaning users' total scores and ranks do not reflect their performance in general campaigns.

**The Problem**:
`LeaderboardEntry` (which feeds the cache) strictly requires a `match_id`. Since general campaigns span the entire tournament, they do not have a match ID. `update_leaderboard_cache` sums `LeaderboardEntry.points` and `TournamentUserMapping.base_points`, entirely skipping `CampaignResponse.total_points`.

**Proposed Approaches**:
1. **Approach 1: Update LeaderboardCache Aggregator (Query-based)**
   - Modify `update_leaderboard_cache` in `scoring.py` to run a subquery summing `CampaignResponse.total_points` for `CampaignType.general`.
   - *Pros*: No schema changes required. Keeps `LeaderboardEntry` strictly for match-level history.
   - *Cons*: Might slightly slow down cache rebuilding; progression charts won't naturally show general campaign points since those rely on `LeaderboardEntry`.

2. **Approach 2: Make LeaderboardEntry.match_id Nullable**
   - Run an Alembic migration to make `match_id` nullable on `LeaderboardEntry`.
   - Add a `campaign_id` column to `LeaderboardEntry` to track the source.
   - Update `calculate_campaign_scores` to insert a `LeaderboardEntry` row for general campaigns with `match_id=None`.
   - *Pros*: Keeps aggregation logic simple and unified (everything is a `LeaderboardEntry`). Allows general campaign points to show up in progression charts easily.
   - *Cons*: Requires a database migration; changes the semantic meaning of `LeaderboardEntry` slightly (no longer strictly per-match).
