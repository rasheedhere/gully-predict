# Gully Predict Cricket — AI Context & Project Specification (GEMINI.md)

This document provides essential context, architectural specifications, and business rules for AI assistants working on the Gully Predict codebase. It consolidates previous architectural plans, project specs, and league management designs into a single source of truth.

## 🚀 Project Overview
A private Gully Predict prediction platform for a group of friends. Users sign in via Google, predict match outcomes, and compete on global and league-specific leaderboards.

**Tech Stack:**
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Python 3.12 + FastAPI (Async) + SQLAlchemy 2.0 + Alembic
- **Database**: SQLite (dev) / PostgreSQL Neon (prod)
- **Auth**: Google OAuth 2.0 + JWT (python-jose)
- **AI**: Gemini 2.0 Flash with Google Search Grounding (stats + result agents)
- **Automation**: APScheduler + n8n + Telegram for match result reporting

---

## 🏛️ Architecture & Patterns

### Backend (Python/FastAPI)
- **Async Throughout**: Use `async def` and `await` for all DB and external I/O.
- **Models**: `backend/models.py` — all SQLAlchemy models in one file.
- **Routers**: Organized by domain (`auth`, `match`, `admin`, `campaigns`, `leaderboard`, `tournament`, `league`, `external`, `events`).
- **Caching**: Dual-cache architecture via `backend/utils/cache.py`. Supports in-memory `SimpleCache` for local dev (`CACHE_TYPE=memory`) and Aiven `ValkeyCache` for production scaling (`CACHE_TYPE=valkey`).
- **Scoring Engine**: `backend/scoring.py` (match scoring) + `backend/campaigns_scoring.py` (campaign-specific scoring).
- **Permissions**: `backend/utils/permissions.py` — RBAC helpers for league admin checks.
- **Event Bus**: `backend/utils/events.py` — `dispatch_event` utility for audit logging.

### Frontend (React/TS)
- **Tailwind CSS**: "Bold & sporty" IPL theme with custom tokens (`ipl-navy`, `ipl-gold`, `ipl-live`).
- **State & Routing**: Zustand for auth (`src/store/auth.ts`); TanStack Query v5 for server state. **URL Search Params** (`react-router-dom`'s `useSearchParams`) are heavily used for UI state (like Admin tabs) and **Tournament Scoping** (`?tournament=id`) to enable deep-linking and bookmarking.
- **API Client (`apiClient`)**: The central axios client (`src/api/client.ts`) uses a `baseURL` that already points to `/api` (e.g. `http://localhost:8000/api`). **Do NOT prepend `/api/`** when making requests via `apiClient` (e.g. use `apiClient.get('/announcements')`, NOT `apiClient.get('/api/announcements')`) to avoid duplicate `/api/api/...` routing errors.
- **Tournament Scoping & UI**: The app supports multiple concurrent tournaments. There is **no global tournament state** (e.g. no Zustand tournament store). 
  - **Unified Views**: `MatchCenter` and `Leagues` pages display aggregate views of all non-completed tournaments at once. Matches and leagues display a badge of their parent tournament.
  - **Scoped Views**: Pages requiring specific tournament contexts (`Leaderboard`, `Campaigns`, `Analysis`) use the `LocalTournamentSelector` component which syncs with the `?tournament=` URL param. If missing, it auto-defaults to the most recently active tournament.
- **Team Colors**: `frontend/src/utils/teamColors.ts`. `getTeamColor(val)` and `getTeamShortName(val)` accept `any` type (safe against numbers/undefined).
- **Layout & Mobile-First**: `Layout.tsx` main wrapper uses `max-w-[1280px]`. We aggressively employ `env(safe-area-inset-*)` padding to avoid iOS notches and home indicators. Forms inside complex lists are wrapped in full-screen modal overlays (`AdminModal`) to preserve scroll context and improve mobile usability.
- **Dynamic Rendering**: `renderPredictionCard` in `MatchPage.tsx` iterates over `pred.answers` keys — **never hardcode question IDs**.
- **tossTime for Locking**: Frontend uses `match.tossTime` (ISO string returned by API) to compute the 30-min lock threshold.
- **Global Announcements**: The landing page (`Hub.tsx`) acts as an Announcements inbox. Users must mark active global announcements as read before proceeding to the main app, utilizing the `User.last_read_announcements_at` timestamp.

---

## 📊 Database Models (Key Entities)

| Model | Description |
|---|---|
| **User** | Core user identity, permissions (`is_admin`, `is_league_admin`), and base stats. |
| **Tournament** | Top-level entity. Matches and global campaigns are scoped here. |
| **League** | Friend groups. Includes Global League (auto-joined) and Private Leagues (invite-only). |
| **LeagueUserMapping** | M2M tracking when users join specific leagues. Stores user join timestamps (`joined_at`). |
| **TournamentUserMapping** | Stores tournament-specific user statistics, such as starting global handicap (`base_points`) and total powerup counts (`base_powerups`). |
| **Match** | Includes `start_time` (used for locks), `status`, and teams. |
| **Campaign** | Groups questions. `is_master=True` acts as the single source of truth for matches. |
| **CampaignQuestion** | Dynamic questions with `scoring_rules` JSON (e.g. `exact_match`, `difference`). |
| **CampaignResponse** | User's submitted predictions (JSON map of answers). |
| **CampaignMatchResult** | The correct answers for a Campaign + Match pair. Drives the scoring engine. |
| **TournamentMatchAnswer** | Single source of truth for match outcomes. Automatically copied to CampaignMatchResult mappings. |
| **LeaderboardCache** | Pre-aggregated scores. `league_id=None` = global; specific `league_id` = league total. |
| **SystemEvent** | Unified application-wide audit log for events (The 'Pulse' stream) such as logins, joins, predictions, and grading. |

---

## ⚖️ Critical Business Rules

### 1. Match Prediction Locking
- Predictions **lock 30 minutes before `start_time`** (UTC).
- Server-side enforcement applies to all submission and reveal endpoints.
- **Community Reveal**: `GET /matches/{id}/predictions/all` returns HTTP 403 until the match is locked.

### 2. Multi-League & Community Reveal
- **Tournament → League Architecture**: Every tournament auto-generates a Global League. Users can also join Private Leagues.
- **Leaderboard Scoping**: Points are only counted for matches/campaigns that lock *after* the user's `joined_at` timestamp for a given league.
- **Reveal Segmentation**: Community reveal is grouped by shared leagues. Users only see predictions from leagues they share with other predictors.

#### 📊 Global vs. League Standings & Scoring Calculations
Standings are pre-aggregated in the `LeaderboardCache` table and computed differently depending on the league context:

*   **Global Standings (`league_id = None`)**:
    *   **Scope**: Aggregates all points won by a user in the tournament across all Master match campaigns and global general campaigns, plus the user's global catch-up handicap (`TournamentUserMapping.base_points`).
    *   **Inclusions**: Includes all matches and campaign questions in the tournament.
*   **League Standings (`league_id` matches a Private League)**:
    *   **Scope**: Aggregates points for members of a specific private league.
    *   **Temporal/Joined-Date Filtering**: To ensure fairness for users who join private leagues mid-season, the system restricts points calculation to a user's active membership timeframe:
        *   **Matches**: Points are only included for matches starting *on or after* the user joined the league: `Match.start_time >= LeagueUserMapping.joined_at` in [scoring.py:L440](file:///Users/rasheed/Documents/git/gully-predict/backend/scoring.py#L440).
        *   **General Campaigns**: Points are only included for campaigns ending (or created) *on or after* the user joined the league: `coalesce(Campaign.ends_at, Campaign.created_at) >= LeagueUserMapping.joined_at` in [scoring.py:L455](file:///Users/rasheed/Documents/git/gully-predict/backend/scoring.py#L455).
        *   **League-Scoped Campaigns**: General or match campaigns created specifically for the league are fully included.
        *   **Handicaps**: The user's catch-up handicap (`TournamentUserMapping.base_points`) is added to the total.
    *   **Dynamic Match Count & Progression**: When fetching the leaderboard, the `matches_played` count and the user's recent match progression are dynamically filtered in the API using the same `joined_at` timestamp (see [leaderboard_router.py:L292-L305](file:///Users/rasheed/Documents/git/gully-predict/backend/router/leaderboard_router.py#L292-L305)).

### 3. Scoring System (2026 Rules)
Defined in `scoring_rules` JSON per `CampaignQuestion`:
**Group Stage Matches:**
- **Match Winner**: +10 correct, −5 incorrect.
- **Player of the Match**: +10 correct, 0 incorrect.
- **Powerplay Scores**: Exact = +15, Within ±5 = +5.
- **Sixes / Fours**: +10 correct, 0 incorrect.
- **Powerup (2× Booster)**: Multiplies points dynamically for any question with `allow_powerup=True` (including negative points/penalties). Questions can be exempted via `allow_powerup=False`.
- **Non-participation penalty**: −5 from **Match 2 onwards**.
- **AI Assassin penalty**: Starts from **Match 25 onwards**.

**Playoff Matches:**
- **Match Winner**: +20 correct, −10 incorrect.
- **Player of the Match**: +50 correct, 0 incorrect.
- **Powerplay Scores**: Exact = +30, Within ±10 = +10.
- **Sixes**: +6 correct.
- **Fours**: +10 correct.
- **Most Dot Balls**: +10 correct.
- **Powerup (2× Booster)**: Multiplies points dynamically for any question with `allow_powerup=True`.
- **Non-participation penalty**: −5.
- **AI Assassin penalty**: Starts from **Match 25 onwards**.

**Example JSON for a Match Winner Question (Dropdown/String match):**
```json
{
  "id": "q-winner-id",
  "key": "match_winner",
  "question_text": "Who will win the match?",
  "question_type": "dropdown",
  "options": ["{{Team1}}", "{{Team2}}"],
  "allow_powerup": true,
  "scoring_rules": {
    "exact_match_points": 10,
    "wrong_answer_points": -5
  }
}
```

**Example JSON for a Powerplay Score Question (Numeric Range):**
```json
{
  "id": "q-ppscore-id",
  "key": "ppscore_team1",
  "question_text": "{{Team1}} power play score?",
  "question_type": "free_number",
  "allow_powerup": true,
  "scoring_rules": {
    "exact_match_points": 15,
    "within_range_points": 5,
    "range_delta": 5,
    "wrong_answer_points": 0
  }
}
```

#### ⚙️ Match Grading & Scoring Lifecycle
When a match is completed and graded (scored), the system follows this multi-step backend process to calculate points and update standings:

1.  **Triggering Context**:
    *   Once a match status transitions to `completed`, an admin or automation workflow (such as Telegram webhook processing in [external_router.py](file:///Users/rasheed/Documents/git/gully-predict/backend/router/external_router.py)) triggers the scoring process by calling `calculate_match_scores(match_id, db)` in [scoring.py:L169](file:///Users/rasheed/Documents/git/gully-predict/backend/scoring.py#L169).
2.  **Sync Ground Truth**:
    *   The backend calls `sync_match_results_to_campaign_questions` to load the match's `raw_result_json` (containing winner, POM, powerplay scores, etc.) and copy those values into a `CampaignMatchResult` database record, mapping each field to its corresponding master campaign question UUID.
3.  **Evaluate Predictions**:
    *   The scoring engine iterates over all non-guest users in the system and retrieves their `CampaignResponse` for the match's master campaign:
        *   **No Prediction (Non-participation)**: If the user did not submit predictions, they receive the non-participation penalty (unless immune because they joined the tournament after the match start time, or if they are the AI Assassin before Match 25).
        *   **Submitted Prediction**: The system scores each question response using the rule engine (`_apply_rules`). If a user activated a powerup (`use_powerup=True`) for this match and the question allows it (`allow_powerup=True`), a 2× multiplier is applied to the points (including any negative penalty points).
        *   **Record Details**: The backend writes the final total score to `CampaignResponse.total_points` and stores a detailed question-by-question breakdown (showing user guess, correct answer, rule-level points, and whether it was boosted) in `CampaignResponse.points_breakdown`.
4.  **Save Standings & Rebuild Leaderboard Caches**:
    *   Individual scores are saved into the `LeaderboardEntry` table.
    *   The engine calls `update_leaderboard_cache(db, match.tournament_id)` to re-calculate all users' overall tournament standings across both global and league-specific scopes. This rebuilds the `LeaderboardCache` rows by summing all points won after a user's `joined_at` timestamp.
5.  **Audit Event & Cache Invalidation**:
    *   The backend dispatches a `SystemEventType.match_scored` system event for audit tracking.
    *   Leaderboard caches are invalidated so that users see updated rankings immediately on the frontend.

### 4. Late Entrants & Handicaps
- **Tournament Scoping**: Stats (`base_points`, `base_powerups`) are stored in `TournamentUserMapping`. This is an optional per-user override.
- **Campaign Scoping**: Master campaigns can specify their own `max_powerups` (e.g. for Playoffs, or as the default for the entire tournament like FIFA 2026).
- **Powerup Balances Configuration**: 
  - The **Master Campaign's `max_powerups`** acts as the single source of truth and default limit for the tournament.
  - The system dynamically counts powerup usage by querying `CampaignResponse` where `use_powerup=True`. It does not rely on a static `powerups_used` counter.
  - If a user lacks a `TournamentUserMapping` row, the leaderboard and logic gracefully fall back to the Master Campaign's limit, ensuring new users automatically receive the correct default powerups (e.g., instead of a hardcoded 10).
  - Admins can still grant custom powerup limits to specific users by explicitly updating their `TournamentUserMapping.base_powerups`.
  Both balances are displayed dynamically in all desktop and mobile leaderboard interfaces.
- **Handicaps**: Late entrants get base_powerups and can be given a catch-up handicap (`base_points`). They are immune to non-participation penalties for matches starting before their `created_at` timestamp.

### 5. `match_winner` Slug & Question Identification
The system relies on identifying the primary "Match Winner" question to drive several critical UI and UX behaviors. The question's `key` (exposed as `slug` in the frontend) should ideally be set to `"match_winner"`.

**What the `match_winner` slug drives:**
1. **Visual Presentation (`isMatchWinner`)**: In `MatchPage.tsx`, the question identified as the match winner is rendered with large, prominently-sized, team-colored selection buttons, whereas other binary choices use smaller standard buttons.
2. **Community Reveal Sorting**: In the community predictions list, users are grouped and sorted by their match winner selection (Team 1 supporters first, then Team 2 supporters). This powers the "Supporters" count UI after the lock period.
3. **Fallback Logic**: If the `match_winner` slug is missing, the frontend attempts to fallback by finding the first question whose options exactly contain both match team names.

### 6. Match Questions Display & Submission Mapping
The system dynamically displays both global (Master) and league-specific questions on a single Match prediction form and handles collisions seamlessly:

*   **API Retrieval & Key Collision Prevention**:
    *   The `GET /api/matches/{match_id}` endpoint (defined in [match_router.py:L126](file:///Users/rasheed/Documents/git/gully-predict/backend/router/match_router.py#L126)) fetches all relevant campaigns for the match.
    *   **Master Match Campaign** questions (linked to the main tournament campaign where `is_master=True`) are assigned their database UUID `q.id` as their form submission key `key` (see [match_router.py:L268](file:///Users/rasheed/Documents/git/gully-predict/backend/router/match_router.py#L268)).
    *   **League Match Campaign** questions (linked to active campaigns in leagues the user has joined) are assigned a custom composite key format: `league_{campaign_id}_{question_id}` (see [match_router.py:L285](file:///Users/rasheed/Documents/git/gully-predict/backend/router/match_router.py#L285)).
    *   This composite key structure prevents collision when multiple campaigns define questions for the same match.
*   **UI Question Grouping (`MatchPage.tsx`)**:
    *   The frontend uses a `useMemo` block called `groupedQuestions` in [MatchPage.tsx:L108-L116](file:///Users/rasheed/Documents/git/gully-predict/frontend/src/pages/MatchPage.tsx#L108-L116) to categorize questions by their `source_name` attribute (e.g. `"IPL Global"` vs. League names).
    *   It renders separate form sections dynamically. Binary questions (e.g., Match Winner, where key matches `winnerQId`) render as team-colored large selection buttons, whereas others render as standard inputs/dropdowns.
    *   All inputs map under the `extra_answers` form field via React Hook Form as `extra_answers.{q.key}` (see [MatchPage.tsx:L126](file:///Users/rasheed/Documents/git/gully-predict/frontend/src/pages/MatchPage.tsx#L126)).
*   **Form Submission & Answers Parsing**:
    *   When predictions are submitted to `POST /api/matches/{match_id}/predictions` (defined in [match_router.py:L511](file:///Users/rasheed/Documents/git/gully-predict/backend/router/match_router.py#L511)):
        *   The backend iterates through the `extra_answers` dictionary.
        *   Keys starting with `"league_"` are parsed as `league_{campaign_id}_{question_id}`. The backend splits them to extract the respective campaign and question IDs.
        *   For keys matching a raw UUID, the backend queries `CampaignQuestion` to find the corresponding `campaign_id`.
        *   Answers are grouped by `campaign_id`, and a `CampaignResponse` is upserted for each campaign. The `use_powerup` value is set only on the Master campaign response.

### 6. General Campaigns (Tournament-Wide Predictions)
Unlike match-specific campaigns, General campaigns are designed for tournament-wide or league-scoped predictions (e.g., predicting the Tournament Winner or Orange Cap winner):

*   **Campaign Definition & Scope**:
    *   `Campaign.type` is set to `"general"`.
    *   They are not associated with a specific match, so `match_id` remains `None` on all responses.
    *   They can be scoped **Globally** (`league_id = None`) or to a **Specific League** (`league_id` is set to a league).
*   **Active Submission Window**:
    *   They define an active window using `starts_at` and `ends_at` timestamps. Submissions lock automatically once the current time passes `ends_at` (see [campaigns_router.py:L886](file:///Users/rasheed/Documents/git/gully-predict/backend/router/campaigns_router.py#L886)).
    *   Users submit predictions via the dedicated campaign respondent form (tanstack hook `useSubmitCampaignResponse` posting to `POST /api/campaigns/{campaign_id}/respond`).
*   **Grading & Scoring Process**:
    *   Admins submit correct answers via the admin panel, which are persisted as a single `CampaignResult` record (where `CampaignResult.campaign_id == campaign.id`).
    *   When the admin triggers grading (`POST /api/campaigns/{campaign_id}/calculate-scores`), `calculate_campaign_scores` evaluates all user responses against the `CampaignResult` correct answers using the standard ruleset (see [campaigns_scoring.py:L101](file:///Users/rasheed/Documents/git/gully-predict/backend/campaigns_scoring.py#L101)).
    *   **Powerups**: Powerups (2× boosters) are **not** applicable to General campaigns; predictions are evaluated with a static `1` multiplier (see [campaigns_scoring.py:L165](file:///Users/rasheed/Documents/git/gully-predict/backend/campaigns_scoring.py#L165)).
    *   Scoring records user totals in `CampaignResponse.total_points` and updates `LeaderboardEntry` for the campaign.
*   **Leaderboard Aggregation & Temporal Filtering**:
    *   Once campaign scoring completes, the leaderboard caches are updated.
    *   **Global Standings**: All points from global general campaigns are fully summed.
    *   **League Standings**: Points are only included if the campaign lock time (`coalesce(Campaign.ends_at, Campaign.created_at)`) is greater than or equal to the member's league `joined_at` timestamp (see [scoring.py:L455](file:///Users/rasheed/Documents/git/gully-predict/backend/scoring.py#L455)).

---

## 🤖 Special Users, Agents & Automation

### System Users
- **AI Assassin**: `ai_assassin@ipl.fantasy` (`is_ai=True`). Evaluates heuristically or randomly.
- **Experts**: High-performing users mapped for analytics.
- **Guests**: `is_guest=True` (view-only).
- **Admins**: `is_admin`, `is_league_admin`, `is_telegram_admin`.

### AI Agents & Workflows
- **Match Stats Agent**: Nightly APScheduler job fetches head-to-head, form, and player watchlists via Gemini 2.0. Stored in `MatchStats.stats_json`.
- **Match Result Agent**: Triggered post-match to auto-fetch correct answers (Winner, POM, Powerplays, etc.). Admin validates before saving.
- **n8n + Telegram**: Admins send results to Telegram → n8n webhook → `PUT /external/match-results` to process matches automatically.
- **AI SQL Assistant**: Helps admins query the database using natural language. It has access to safe tables including `tournament_questions` and `tournament_match_answers` to retrieve match-specific questions and graded results. It leverages explicit PostgreSQL JSON/JSONB querying guidelines (e.g. `->>` operator and casting to `jsonb`) to extract correct answers from nested fields.

---


## 🛠️ Development & Deployment

- **Match IDs**: Format `{tournament}-{year}-{number}` (e.g., `ipl-2026-42`). Bulk import accepts sequential integers.
- **Environment**: `.env` requires `GOOGLE_CLIENT_ID`, `DATABASE_URL`, `GEMINI_API_KEY`.
- **Migrations**: Always use `alembic revision --autogenerate -m "description"`. See `backend/MIGRATIONS.md` for troubleshooting.
- **SQLite Note**: Dev database is at `backend/database_dev.db`. Column renames require SQLite 3.25+.
- **Startup**: `./start_all.sh` builds Docker backend and starts Vite frontend.

---

## 📝 Current Implementation Status
- **Platform Activity Feed**: Fully implemented with role-based visibility.
- **Multi-League & Tournaments**: Migrated to support multiple tournaments, distinct base stats, and campaign-level powerup isolation.
- **Global Announcements**: Centralized announcement feed for users upon login, blocking app access until updates are acknowledged, complete with admin management interface.
- **Dynamic Frontend**: Prediction cards and match results are fully driven by backend JSON models, supporting arbitrary new campaign questions.
- **Admin Tools & UX**: Bulk match import via CSV, dynamic campaign building, and AI-powered match result fetching. The Admin console features URL deep-linking and animated, mobile-optimized modal overlays for form handling.

*This document was consolidated from legacy architectural plans and is actively maintained via the `avid-documentor` skill.*
