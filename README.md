# Gully Predict 2026 — Premium Prediction Platform

A sophisticated, private Gully Predict Cricket prediction platform for competitive friend groups. Features a robust FastAPI backend, a high-performance React frontend, multi-league architecture, dynamic AI-powered campaigns, and automated match result processing.

---

## 🌟 Key Features

### 🏆 Multi-League & Campaign System
- **Tournament-Based Architecture**: Matches belong to a Tournament (e.g., IPL 2026). Multiple private Leagues exist within each Tournament.
- **Time-Bound Scoring**: League points only count from matches/campaigns that locked after the user's `joined_at` timestamp in that league.
- **Dynamic Campaigns**: Admins create "Master" (global) or league-specific campaigns with flexible question types:
  - *Match Campaigns*: Scored per match, support 2× powerup boosters, and render directly on the match prediction form.
  - *General Campaigns*: Tournament-wide or league-scoped questions (e.g., overall winner, orange cap) locked by `ends_at` timestamps. They do not support powerup multipliers (always evaluated at 1×), and correct answers are stored in `CampaignResult`.
  Campaigns must be explicitly marked as `Active` to appear on user prediction forms and to be scored.
- **Rich Question Types**: Multiple choice, toggle, dropdown, free text, numeric inputs with configurable scoring tiers.
- **Advanced Scoring**: Per-question scoring rules (exact match, numeric difference, multi-choice tiers).
- **League-Scoped Reveal**: Community predictions are segmented by league — users only see predictions from members of their shared leagues.

### 🎮 Gamification & AI
- **AI Assassin**: Autonomous competitor (`ai_assassin@ipl.fantasy`) that makes heuristic predictions. Non-participation penalty starts from Match 25 onwards.
- **Powerups**: 2× score multiplier applicable to Winner, Player of the Match, and Powerplay predictions. Sixes/Fours categories are excluded from the multiplier.
- **Match Center**: Unified dashboard with today's matches, upcoming fixtures, and a live indicator.
- **Hall of Fame**: "Sixster" and "Fourster" badges awarded to users with high accuracy on team prediction categories.

### 📊 Performance Analytics
- **Visual Insights**: Stacked bar charts showing match vs. base points progression.
- **Elite Performance Split**: Comparison against experts and top performers.
- **Dynamic Community Reveal**: All predictions are revealed once lock time passes, grouped into "Team 1 Supporters" vs "Team 2 Supporters" columns on desktop.
- **Match Scores in Reveal**: Post-match, each user's points awarded (with breakdown tooltip) are shown directly on the prediction card.

### 🤖 Automation & AI Agents
- **Match Stats Agent**: Fetches nightly head-to-head stats, team form, and "players to watch" using Gemini 2.0 Flash with Google Search grounding.
- **Match Result Agent**: Auto-fetches ground truth (winner, POM, scores) when a match status changes to `completed`.
- **n8n + Telegram**: Secure webhook for automated match result ingestion and scoring triggers.

### 🛠 Admin Tools
- **Bulk Match Import**: Upload a CSV to import multiple matches at once. Format: `id,team1,team2,venue,start_time` (sequential IDs 1, 2, 3 are auto-formatted to `tournament-year-number`).
- **Campaign Builder**: Create campaigns with drag-and-drop question ordering, alphabetical option sorting, and configurable selection caps.
- **League Management**: Create leagues, assign admins, manage members, and generate join codes.
- **Global Announcements**: Broadcast important updates (e.g., "New Campaign Added") directly to all users. Users see these announcements as a blocking screen upon login until they mark them as read. Supports optional call-to-action buttons.
- **Manual Results Override**: Set correct answers per question and trigger scoring from the admin panel.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12 · FastAPI (Async) · Uvicorn |
| **Database** | SQLite (dev) / PostgreSQL Neon (prod) · SQLAlchemy 2.0 Async · Alembic |
| **Caching** | Dual-Cache System (In-Memory `SimpleCache` / Aiven Valkey) |
| **Frontend** | React 18 · Vite · TypeScript |
| **Styling** | Tailwind CSS v4 · Custom IPL theme |
| **State Management** | Zustand (Auth) · TanStack Query v5 (Server State) |
| **Auth** | Google OAuth 2.0 · JWT |
| **AI** | Gemini 2.0 Flash with Search Grounding |
| **Automation** | n8n · APScheduler |
| **Infrastructure** | Docker Compose (backend) · Vite dev server (frontend) |

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for frontend dev server)
- Google Cloud Project (OAuth credentials)

### 1. Clone & Configure
```bash
git clone <repo>
cd ipl-fantasy
cp .env.example .env
# Fill in: GOOGLE_CLIENT_ID, DATABASE_URL, GEMINI_API_KEY

# Optional Cache Settings:
# CACHE_TYPE=memory (default) or CACHE_TYPE=valkey
# VALKEY_URL=redis://... (if using valkey)
```

**Caching Strategy:**
By default, the application runs an in-memory `SimpleCache` for fast local development without needing a Redis server. 
For production deployments, set `CACHE_TYPE=valkey` and provide your Aiven for Valkey connection string via `VALKEY_URL`. This allows the API to seamlessly scale across multiple workers.

### 2. Start Everything
```bash
./start_all.sh
# Backend:  http://localhost:8000
# Frontend: http://localhost:5000
```

The script:
1. Builds and starts the backend in Docker (with hot-reload via watchfiles)
2. Runs `npm run build` to verify TypeScript, then starts the Vite dev server

### 3. Seed Initial Data
```bash
# Seed the first admin user
docker compose exec backend python seed_admin.py your-email@gmail.com

# (Optional) Seed the AI Assassin competitor
docker compose exec backend python seed_ai.py

# (Optional) Seed match schedule
docker compose exec backend python seed_matches.py
```

### 4. Database Migrations
```bash
# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Generate a new migration after model changes
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

---

## 📁 Project Structure

```text
gully-predict/
├── automation/
│   └── n8n_telegram_parser.js      # JS Telegram message parsing helper for n8n
├── backend/
│   ├── router/
│   │   ├── auth_router.py          # Google OAuth, JWT token issuance
│   │   ├── match_router.py         # Match details, predictions, and community reveals
│   │   ├── admin_router.py         # Admin panel backend endpoints
│   │   ├── campaigns_router.py     # Campaign creation, status, and questions CRUD
│   │   ├── leaderboard_router.py   # Leaderboard queries, analytics, and progression lists
│   │   ├── tournament_router.py    # Tournament creation and bulk match schedule imports
│   │   ├── league_router.py        # League management, user mapping, and join codes
│   │   └── external_router.py      # Webhook integration for incoming Telegram results
│   ├── agents/
│   │   ├── match_stats_agent.py    # Gemini stats agent: fetches match analytics nightly
│   │   └── match_result_agent.py   # Gemini result agent: parses match outcomes post-game
│   ├── utils/
│   │   ├── alias.py                # User alias generators for leaderboards
│   │   ├── cache.py                # Memory/filesystem cache handlers for key paths
│   │   ├── email.py                # Email notifications and verification rules
│   │   ├── events.py               # Application-wide system audit events logging
│   │   └── permissions.py          # Role-Based Access Control (RBAC) check utilities
│   ├── auth.py                     # Password, hashing, and token validation utilities
│   ├── database.py                 # SQLAlchemy engine and async session creation setup
│   ├── dependencies.py             # FastAPI dependencies (auth validation, db session)
│   ├── main.py                     # Main application entry point and CORS setup
│   ├── models.py                   # Consolidated SQLAlchemy models (declarative tables)
│   ├── scoring.py                  # Core match prediction scoring and cache updates
│   ├── campaigns_scoring.py        # Scoring rules engine for global/league campaigns
│   ├── scheduler.py                # APScheduler jobs for AI predictions and stats
│   └── MIGRATIONS.md               # Backend database migrations documentation
├── docs/
│   ├── GEMINI.md                   # AI Assistant context and system business rules
│   ├── TODO.md                     # Project tracker and pending features checklist
│   └── db_migration_summary.md     # Historical database changes and migrations recap
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts           # Central Axios HTTP client with auth interceptors
│   │   │   └── hooks/              # tanstack/react-query server-state hooks
│   │   ├── components/
│   │   │   ├── Layout.tsx          # Main layout shell, sidebar, and navbar header
│   │   │   ├── MatchCard.tsx       # Live and upcoming matches card component
│   │   │   ├── LeaderboardSection.tsx # Desktop & mobile standings lists & podiums
│   │   │   ├── CountdownTimer.tsx  # Dynamic lock-in timer for prediction locks
│   │   │   ├── CampaignCountdown.tsx # Countdown timer specifically for campaign locks
│   │   │   ├── PWAInstallBanner.tsx # Native mobile installer installation prompt banner
│   │   │   ├── ProfileModal.tsx    # User profile setting editor modal (avatar/alias)
│   │   │   └── SocialFeed.tsx      # Activity feed widget (leagues joined, matches scored)
│   │   ├── pages/
│   │   │   ├── MatchCenter.tsx     # Today's fixtures and recently completed matches
│   │   │   ├── MatchPage.tsx       # Predictions lock form and post-lock reveals
│   │   │   ├── Leaderboard.tsx     # Standings dashboard (global and league scope)
│   │   │   ├── Campaigns.tsx       # Active campaigns listings
│   │   │   ├── CampaignPage.tsx    # Single campaign questions submission forms
│   │   │   ├── CampaignBuilder.tsx # Admin drag-and-drop campaign constructor
│   │   │   ├── Leagues.tsx         # User's leagues list and creation workspace
│   │   │   ├── Admin.tsx           # Global developer admin panel (matches, users, stats)
│   │   │   ├── Login.tsx           # Google OAuth sign-in screen
│   │   │   ├── Activity.tsx        # Global social activity feed logs
│   │   │   ├── Analysis.tsx        # Advanced analytics and charts comparisons
│   │   │   ├── AuthCallback.tsx    # Google OAuth callback redirection landing page
│   │   │   ├── Hub.tsx             # Entry dashboard handling Global Announcements inbox
│   │   │   ├── LeagueAdmin.tsx     # League-specific admin dashboard
│   │   │   ├── LeagueDetails.tsx   # Private league stats, standings, and campaigns
│   │   │   └── More.tsx            # Desktop/mobile navigation settings and options list
│   │   ├── store/
│   │   │   └── auth.ts             # Zustand client auth store (JWT & user status)
│   │   └── utils/
│   │       └── teamColors.ts       # Color mappings and name shorteners for IPL teams
│   ├── package.json                # Frontend dependencies and configuration scripts
│   └── vite.config.ts              # Vite configuration with proxy configurations
├── migrations/
│   └── versions/                   # Alembic database migration files
├── seed_admin.py                   # Seed first admin user
├── seed_ai.py                      # Seed AI Assassin competitor
├── seed_matches.py                 # Seed match schedule
├── start_all.sh                    # One-command dev startup
├── start_frontend.sh               # Local script to start frontend dev server
├── docker-compose.yml              # Docker services configuration
├── Dockerfile                      # Docker container environment definition
├── requirements.txt                # Python backend dependencies
└── GEMINI.md                       # AI context file (for AI assistants)
```

---

## ⚖️ Scoring Rules (2026 Season)
Defined in `scoring_rules` JSON per `CampaignQuestion`:
### Group Stage Matches
| Category | Correct | Incorrect / Range |
|---|---|---|
| Match Winner | +10 | −5 |
| Player of the Match | +10 | 0 |
| Powerplay Score (exact) | +15 | — |
| Powerplay Score (±5 range) | — | +5 |
| More Sixes / More Fours | +10 | 0 |
| Non-participation (Match 2+) | — | −5 |
| AI Assassin penalty starts | — | Match 25 |

### Playoff Matches (Matches 71–74)
| Category | Correct | Incorrect / Range |
|---|---|---|
| Match Winner | +20 | −10 |
| Player of the Match | +50 | 0 |
| Powerplay Score (exact) | +30 | — |
| Powerplay Score (±10 range) | — | +10 |
| More Sixes | +6 | 0 |
| More Fours | +10 | 0 |
| Most Dot Balls | +10 | 0 |
| Non-participation | — | −5 |
| AI Assassin penalty starts | — | Match 25 |

**Powerup (2× Booster)**: Tracked globally (`User.base_powerups`). Multiplies points dynamically for any question where `allow_powerup=True` is configured in the database (including negative points/penalties). Specific questions can be excluded from the booster by setting `allow_powerup=False`.

**Powerup Limits & Remaining Balances**:
- **Global Powerups**: Max limit is defined by `TournamentUserMapping.base_powerups` (defaults to `10`). Remaining balance is computed as `base_powerups - global_powerups_used`.
- **Campaign-Scoped Powerups**: Master campaigns with specific limits (like Playoffs) can define their own limits in `Campaign.max_powerups`. Remaining balance is computed as `max_powerups - campaign_powerups_used`.
- **UI Visibility**: These balances are displayed dynamically in both desktop and mobile views of the leaderboard (e.g. `GLB` for global, or campaign-specific abbreviations).

**Points Breakdown UI Design & Powerups**:
- To maintain mathematical clarity in the UI, the `points_breakdown` JSON stores **unmultiplied base values** (e.g. `10` or `-10`) for each individual question in the rules list.
- The frontend displays the base values alongside a dedicated `Powerup Applied (2x)` indicator if a powerup was used. The total score is computed in the backend as:
  $$\text{Total Score} = \sum (\text{Base Question Points} \times \text{Question Multiplier})$$
  where:
  * $\text{Question Multiplier} = 2$ if a powerup is active and the question has `allow_powerup=True`.
  * $\text{Question Multiplier} = 1$ if the question has `allow_powerup=False` or no powerup is active.
  The `total_points` field in the database and response correctly reflects this final multiplied sum.

**Late Entrants**: Protected from retroactive penalties for matches before signup. Can receive a `User.base_points` catch-up handicap applied globally and in private leagues.

---

## 🔑 Key Business Rules

- **Prediction Lock**: 30 minutes before `start_time`. Enforced server-side.
- **Community Reveal**: `GET /matches/{id}/predictions/all` returns HTTP 403 until predictions are locked. Results are segmented by the leagues the requesting user shares with others.
- **Dynamic Match Questions (Master vs. League)**: The prediction form retrieves tournament-wide Master questions (keyed by database UUID `q.id`) and league-specific campaigns (keyed by composite `league_{campaign_id}_{question_id}` to prevent key collisions). The frontend groups them dynamically by campaign source (`source_name`) using the `groupedQuestions` useMemo hook in [MatchPage.tsx](file:///Users/rasheed/Documents/git/gully-predict/frontend/src/pages/MatchPage.tsx). On submission, the backend splits composite keys back into their respective campaign responses.
- **Leaderboard Calculations (Global vs. League)**: Standings are pre-aggregated in `LeaderboardCache`.
  - *Global leaderboard* sums all Master match and global general campaigns points plus base handicap points.
  - *League leaderboards* apply temporal filtering: users only score points for matches starting (`Match.start_time >= LeagueUserMapping.joined_at` in [scoring.py](file:///Users/rasheed/Documents/git/gully-predict/backend/scoring.py)) and general campaigns ending (`ends_at >= joined_at` in [scoring.py](file:///Users/rasheed/Documents/git/gully-predict/backend/scoring.py)) *on or after* they joined the league. The dynamic match count (`matches_played`) and progression list are filtered identically in [leaderboard_router.py](file:///Users/rasheed/Documents/git/gully-predict/backend/router/leaderboard_router.py).
- **Match Grading & Standings Lifecycle**: When a match is completed, the system syncs the ground truth results from `raw_result_json` into `CampaignMatchResult`, scores all user prediction responses (handling powerup multipliers and non-participation penalties), persists points breakdowns inside `LeaderboardEntry` per user, and triggers a full rebuild of the `LeaderboardCache` across all global and league scopes.
- **Match ID Format**: `tournament-year-number` (e.g., `ipl-2026-42`). Admin bulk import accepts sequential numbers (1, 2, 3) and auto-formats them.

---

## 🔒 Security & Access Control

- **Allowlist Gate**: Only pre-approved emails can log in (Google OAuth).
- **Role Hierarchy**: Super Admin → League Admin → Member → Guest.
- **Guest Mode**: `is_guest=True` users can view but cannot submit predictions. Excluded from the main leaderboard.
- **Telegram Admins**: Users with `is_telegram_admin=True` can submit results via the n8n webhook.

---

## 🧰 Maintenance Scripts

| Script | Purpose |
|---|---|
| `seed_admin.py` | Promote an email to super admin |
| `seed_ai.py` | Create the AI Assassin competitor |
| `seed_matches.py` | Populate match schedule |
| `reset_and_seed.py` | **WIPES** database, then re-seeds everything |
| `backfill_ai_assassin.py` | Retroactively add AI Assassin predictions |
| `recalculate_all_breakdowns.py` | Recompute point breakdowns for all entries |
| `backend/scripts/recalculate_leaderboards.py` | Rebuild the `LeaderboardCache` table |

---

Developed with ❤️ for Cricket Fans
