---
id: "002"
title: "Shared Authentication Setup (storageState Bypass)"
status: "closed"
labels: ["ready-for-agent"]
blocked_by: ["001"]
---

## Parent

Blocked by [docs/issues/001_test_environment_config.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/001_test_environment_config.md)

## What to build

Implement the programmatical login flow using Playwright's setup projects:
- Create `frontend/playwright/tests/auth.setup.ts` containing setup tests for `admin` and `user` roles.
- Use the Dev Login bypass buttons on the login page (visible when `VITE_DEV_LOGIN=true` is set in the test environment).
- Save the authenticated browser states (cookie and localStorage tokens under the Zustand key `ipl-fantasy-auth`) to JSON paths: `playwright/.auth/admin.json` and `playwright/.auth/user.json`.
- Set up normal test suites to consume these JSON states to skip authentication sequences.

## Acceptance criteria

- [x] `auth.setup.ts` successfully navigates to `/login`, selects dev bypass roles, and waits for routing to `/matchcenter`.
- [x] Saves authentication states as JSON files in the `playwright/.auth/` folder.
- [x] Regular tests can bypass the login viewport completely when using the `storageState` configuration.

## Blocked by

- [docs/issues/001_test_environment_config.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/001_test_environment_config.md)
