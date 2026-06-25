---
id: "006"
title: "Admin Dashboard Campaigns & Grading Tests"
status: "open"
labels: ["ready-for-agent"]
blocked_by: ["002"]
---

## Parent

Blocked by [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)

## What to build

Write E2E test cases validating admin workflows, campaigns setup, match grading, and calculation integrations:
- Create `frontend/playwright/tests/admin.spec.ts`.
- Authenticate using the saved admin credentials (`storageState: 'playwright/.auth/admin.json'`).
- Navigate to the Admin panel to create standard match questions, defining unique keys and custom scoring rules.
- Test grading interface by filling in winning team, player-of-the-match, and powerplay score parameters.
- Trigger the grading calculations and verify that individual scores (`LeaderboardEntry` entries) update and the `LeaderboardCache` values rebuild correctly.

## Acceptance criteria

- [ ] Admin panel pages accessible and render without authorization crashes.
- [ ] Questions can be created with distinct keys.
- [ ] Graded match values successfully trigger backend calculations.
- [ ] Users' rankings on the leaderboard update immediately to reflect the new match scores.

## Blocked by

- [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)
