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
- **Scoring Engine**: `backend/scoring.py` (match scoring) + `backend/campaigns_scoring.py` (campaign-specific scoring).
- **Permissions**: `backend/utils/permissions.py` — RBAC helpers for league admin checks.
- **Event Bus**: `backend/utils/events.py` — `dispatch_event` utility for audit logging.

### Frontend (React/TS)
- **Tailwind CSS**: "Bold & sporty" IPL theme with custom tokens (`ipl-navy`, `ipl-gold`, `ipl-live`).
- **State & Routing**: Zustand for auth (`src/store/auth.ts`); TanStack Query v5 for server state. **URL Search Params** (`react-router-dom`'s `useSearchParams`) are used for complex UI state (like Admin tabs) to enable deep-linking and bookmarking.
- **Team Colors**: `frontend/src/utils/teamColors.ts`. `getTeamColor(val)` and `getTeamShortName(val)` accept `any` type (safe against numbers/undefined).
- **Layout & Mobile-First**: `Layout.tsx` main wrapper uses `max-w-[1280px]`. We aggressively employ `env(safe-area-inset-*)` padding to avoid iOS notches and home indicators. Forms inside complex lists are wrapped in full-screen modal overlays (`AdminModal`) to preserve scroll context and improve mobile usability.
- **Dynamic Rendering**: `renderPredictionCard` in `MatchPage.tsx` iterates over `pred.answers` keys — **never hardcode question IDs**.
- **tossTime for Locking**: Frontend uses `match.tossTime` (ISO string returned by API) to compute the 30-min lock threshold.

---

## 📊 Database Models (Key Entities)

| Model | Description |
|---|---|
| **User** | Core user identity, permissions (`is_admin`, `is_league_admin`), and base stats. |
| **Tournament** | Top-level entity. Matches and global campaigns are scoped here. |
| **League** | Friend groups. Includes Global League (auto-joined) and Private Leagues (invite-only). |
| **LeagueUserMapping** | M2M tracking when users join specific leagues. |
| **Match** | Includes `start_time` (used for locks), `status`, and teams. |
| **Campaign** | Groups questions. `is_master=True` acts as the single source of truth for matches. |
| **CampaignQuestion** | Dynamic questions with `scoring_rules` JSON (e.g. `exact_match`, `difference`). |
| **CampaignResponse** | User's submitted predictions (JSON map of answers). |
| **CampaignMatchResult** | The correct answers for a Campaign + Match pair. Drives the scoring engine. |
| **LeaderboardCache** | Pre-aggregated scores. `league_id=None` = global; specific `league_id` = league total. |

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

### 3. Scoring System (2026 Rules)
Defined in `scoring_rules` JSON per `CampaignQuestion`:
- **Match Winner**: +10 correct, −5 incorrect.
- **Player of the Match**: +25 correct, 0 incorrect.
- **Powerplay Scores**: Exact = +15, Within ±5 = +5.
- **Sixes / Fours**: +5 correct.
- **Powerup (2× Booster)**: Multiplies Winner, POM, and Powerplay. **Does NOT multiply Sixes/Fours**. Questions can be exempted via `allow_powerup=False`.
- **Non-participation penalty**: −5 from **Match 12 onwards**.
- **AI Assassin penalty**: Starts from **Match 25 onwards**.

### 4. Late Entrants & Handicaps
- **Tournament Scoping**: Stats (`base_points`, `base_powerups`) are stored in `TournamentUserMapping`.
- **Campaign Scoping**: Master campaigns can specify their own `max_powerups` (e.g. for Playoffs).
- **Handicaps**: Late entrants get base_powerups and can be given a catch-up handicap (`base_points`). They are immune to non-participation penalties for matches starting before their `created_at` timestamp.

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
- **Dynamic Frontend**: Prediction cards and match results are fully driven by backend JSON models, supporting arbitrary new campaign questions.
- **Admin Tools & UX**: Bulk match import via CSV, dynamic campaign building, and AI-powered match result fetching. The Admin console features URL deep-linking and animated, mobile-optimized modal overlays for form handling.

*This document was consolidated from legacy architectural plans and is actively maintained via the `avid-documentor` skill.*
