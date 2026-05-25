# Project TODOs & Backlog

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
