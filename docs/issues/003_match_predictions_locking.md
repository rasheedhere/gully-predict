---
id: "003"
title: "Match Predictions & Toss Locking Tests"
status: "open"
labels: ["ready-for-agent"]
blocked_by: ["002"]
---

## Parent

Blocked by [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)

## What to build

Write E2E test cases to validate the match prediction lifecycle, input validity, and time-based lock thresholds:
- Create `frontend/playwright/tests/match-predictions.spec.ts`.
- Test form inputs for matching outcomes, powerplay scores, and player of the match.
- Verify 2x Booster Powerup selection checkbox.
- Mock the browser's system clock using Playwright's Clock API (`page.clock.setFixedTime()`) to test:
  - 31 minutes before toss: Fields are editable, save button is active, and submissions succeed.
  - 29 minutes before toss: All controls are disabled/read-only, status reads locked, and edits fail.
- Assert that community predictions (`GET /matches/{id}/predictions/all`) returns a locked page or error before the lock, and successfully reveals other users' predictions after the lock.

## Acceptance criteria

- [ ] Predictions can be saved and verified in the database when the match is active.
- [ ] Playwright clock mocks lock status precisely at the 30-minute threshold relative to `match.tossTime`.
- [ ] Inputs are disabled post-lock.
- [ ] Community predictions are hidden until the match locks, then correctly exposed.

## Blocked by

- [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)
