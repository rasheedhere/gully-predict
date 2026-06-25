---
id: "004"
title: "Leaderboard Scoping & Private Leagues Tests"
status: "open"
labels: ["ready-for-agent"]
blocked_by: ["002"]
---

## Parent

Blocked by [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)

## What to build

Write E2E test cases to validate private league creation, join flows, and URL-based leaderboard queries:
- Create `frontend/playwright/tests/leagues.spec.ts` and `frontend/playwright/tests/leaderboard.spec.ts`.
- Verify league creation. To prevent data duplication collisions on the persistent database, append a timestamp suffix (e.g. `const uniqueName = 'Test League ' + Date.now()`) to any created league.
- Validate joining a league via invite code.
- Verify changing tournament selectors correctly sets URL query variables (e.g., `?tournament=T123`) and updates shown data.
- Assert that point aggregation matches the joined-date temporal filter: users should not receive points for matches that locked before their `joined_at` timestamp in that league.

## Acceptance criteria

- [ ] Private leagues can be created with unique dynamic names without database collisions.
- [ ] Users can join leagues via invite code, and show up in the member listing.
- [ ] Changing tournament parameter query string updates displayed user stats.
- [ ] Leaderboard calculations respect user joined dates.

## Blocked by

- [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)
