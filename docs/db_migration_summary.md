# Session Summary: DB Migration from `ipl-fantasy` (Postgres) to `gully-predict` (SQLite)

This document provides a detailed summary of the DB migration process executed during the migration session. The migration successfully transitioned the production database for `ipl-fantasy` to the new database schema utilized by `gully-predict`.

---

## 1. Planning & Strategy
We conducted a deep analysis of the Postgres production database (`ipl-fantasy`) and the target SQLite development database (`gully-predict`). The findings, schema differences, and insert schedules were documented in [migration_strategy.md](file:///Users/rasheedullakhan/.gemini/antigravity-ide/brain/be0542bb-b30f-4507-837c-49dec777fb8b/migration_strategy.md).

## 2. Migration Script Design
The automated migration was implemented in the single-shot async Python script [migrate.py](file:///Users/rasheedullakhan/Documents/git-personal/gully-predict/migrate.py):
- **Source**: Postgres prod database (read-only) via `asyncpg`.
- **Target**: SQLite dev database located at [database_dev.db](file:///Users/rasheedullakhan/Documents/git-personal/gully-predict/backend/database_dev.db) via `aiosqlite`.
- **Execution Mode**: Supported a `--dry-run` flag which rolls back all transactions to verify structure and mappings before doing any modifications.
- **Safety**: Writes were wrapped in a single SQLite transaction with `foreign_keys = OFF` during insert sequences, followed by full verification and `foreign_keys = ON` activation.

## 3. Data Mappings & Transformations
The migration successfully converted data between different database structures, resolving several critical issues:
- **Match ID Normalization**: Adjusted match suffixes to ensure uniform zero-padding (e.g., `ipl-2026-1` to `ipl-2026-01` through `ipl-2026-09`).
- **Predictions → Campaign Responses**: Transformed flat columns of `Prediction` into a dictionary structure stored inside `campaign_responses.answers` as JSON (e.g., mapping prediction fields to campaign question UUIDs). The `use_powerup` field was cast from `"Yes"`/`"No"` strings to `boolean`.
- **General Campaign Answers**: Collapsed `112` individual rows from the source `campaign_answers` table into `8` campaign responses, storing answers as JSON blobs.
- **Match Result Mappings**: Correct match results were written to key-based answers (`tournament_match_answers`) and UUID-based campaign answers (`campaign_match_results`).
- **Playoff Campaign Initialization**: Generated a new Playoff Campaign (`fb043ce5-508a-4b86-badb-168e545e752f`) matching the 7 playoff questions. Implemented custom 2× scoring rules (double points) and broader powerup scopes.
- **Match Stats Consolidation**: Combined flat columns of `match_stats` in the source DB into a single consolidated `stats_json` column.
- **User & League Registration**: Removed dev-environment user accounts, imported all 15 production users (retaining their UUIDs), mapped them to the existing OG league (`league-e1a64b35...`), and assigned correct ownership contexts to the league and campaign tables.
- **Leaderboard Cache Rebuild**: Wiped old dummy leaderboard cache entries. Aggregated points from the newly migrated `leaderboard_entries` and built a clean cache of 22 entries (global and league-specific records per user).

## 4. Verification Check Results
Both the dry-run and final commit run executed successfully. The migrated row counts matched the expectations exactly:

| Target Table | Expected Rows | Actual Rows | Status |
| :--- | :---: | :---: | :---: |
| `users` | 15 | 15 | ✅ Verified |
| `allowlisted_emails` | 11 | 11 | ✅ Verified |
| `matches` | 74 | 74 | ✅ Verified |
| `campaigns` | 3 | 3 | ✅ Verified |
| `campaign_questions` | 28 | 28 | ✅ Verified |
| `campaign_responses` | 457 | 457 | ✅ Verified |
| `league_user_mappings` | 15 | 15 | ✅ Verified |
| `league_admin_mappings` | 2 | 2 | ✅ Verified |
| `league_campaign_mappings` | 3 | 3 | ✅ Verified |
| `tournament_user_mappings` | 15 | 15 | ✅ Verified |
| `leaderboard_entries` | 737 | 737 | ✅ Verified |
| `leaderboard_cache` | 22 | 22 | ✅ Verified |
| `tournament_match_answers` | 66 | 66 | ✅ Verified |
| `campaign_match_results` | 66 | 66 | ✅ Verified |
| `match_stats` | 2 | 2 | ✅ Verified |

> [!NOTE]
> Match `ipl-2026-12` was marked completed in the source but did not have result facts (e.g. winner was NULL). The migration script detected this and correctly skipped insertion for this match into `tournament_match_answers` and `campaign_match_results`, leaving the remaining 66 matches.

## 5. Post-Migration Feature Additions (Playoff Logic)
Following the migration, several systemic improvements were implemented to support the Playoffs phase seamlessly:
- **Master Campaign Overrides**: Added `CampaignTargetMatch` support to `is_master` campaigns. A master campaign can now explicitly target a set of matches (e.g., Playoffs), completely overriding the default tournament master campaign (league phase) for those matches.
- **Auto-Predict Randomization & Overrides**: 
  - Updated the `/autopredict` API to fetch the correct Master Campaign override based on the `match_id`.
  - Added full dynamic template replacement (e.g., `{{Team1}}` to team name) before evaluating heuristic matching.
  - Upgraded the heuristic engine to randomize choices for team-based questions (Most Sixes, Fours, Dot Balls) rather than using a single pre-determined "winning team", ensuring a realistic spread of predictions.
  - Fixed substring matching logic for "powerplay" vs "power play".
- **Campaign-Level Powerup Quotas**: 
  - Added `max_powerups` column to the `Campaign` schema via Alembic.
  - Powerup counts are now scoped intelligently: if a master campaign defines a `max_powerups` limit (e.g., 2 for the Playoffs), `get_match_predictions_data` and `submit_prediction` track powerup usage strictly within the matches targeted by that campaign.
  - Added full frontend support for setting `max_powerups` dynamically in the Campaign Builder UI.
