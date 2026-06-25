---
id: "001"
title: "Test Environment Configuration & Port Orchestration"
status: "closed"
labels: ["ready-for-agent"]
blocked_by: []
---

## What to build

Set up the testing environment, port configurations, and server lifespans for Playwright tests:
- Install `@playwright/test` and `dotenv` in the `frontend` folder as development dependencies.
- Create a `.env.test` file in the project root containing environment variables for the test branch database (`postgresql://neondb_owner:npg_CY9N3QDHRGwt@ep-late-sky-aq3co4nu-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`) and dev-bypass settings (`VITE_DEV_LOGIN=true`).
- Create `frontend/playwright.config.ts` configured with viewports for Desktop, iPad (`webkit-tablet`), and iPhone mobile (`webkit-mobile`).
- Configure automated startup array (`webServer`) in `playwright.config.ts` to spin up the backend (FastAPI, port `8001`) and frontend (Vite, port `5001`) on isolated ports, preventing conflicts with running dev instances.

## Acceptance criteria

- [x] `@playwright/test` and `dotenv` installed inside `frontend/package.json`.
- [x] `.env.test` created at project root with isolated database branch credentials and test ports.
- [x] `playwright.config.ts` successfully matches the spec, loading viewports for mobile (`393x852`), tablet (`834x1194`), and desktop (`1280x800`).
- [x] Running `npx playwright test` automatically launches backend and frontend servers on ports 8001 and 5001 before test suite execution.

## Blocked by

- None - can start immediately
