# Product Requirements Document (PRD): E2E & Visual Testing Suite (Playwright)

## Problem Statement

As Gully Predict grows and adds features (such as dynamic campaign questions, custom leagues, and playoffs-specific powerup balances), developers lack a mechanism to verify that backend grading processes, authentication logic, and frontend layouts remain correct. 

Without automated testing, changing code in the React frontend or FastAPI backend can introduce regressions like:
- Breaking prediction locking times (which must occur 30 minutes before toss).
- Breaking private league standings calculation rules (joined-date filters).
- Causing the navigation menu or panels to overlap, clip, or become unreachable on specific screen viewports (mobile, tablet, or desktop).

## Solution

Implement an automated End-to-End (E2E) and visual regression testing suite using **Playwright**. The tests will run against isolated frontend and backend test ports linked to a dedicated, persistent Neon PostgreSQL test database branch. The testing suite will programmatically validate user authentication states, time-based business rules, visual alignment across multiple viewports, and database scoring events.

---

## User Stories

### Authentication & Redirection
1. As an unauthenticated visitor, I want to be redirected to the login page when accessing protected routes, so that my account credentials and predictions remain private.
2. As a user, I want the system to remember my original destination page before redirecting me to log in, so that I land back on the page I intended to view immediately after authentication.
3. As a developer, I want a Dev Login bypass UI (when enabled) to log in immediately as an admin, league admin, standard user, or guest, so that I can run automated E2E tests quickly without triggering real Google OAuth popups.
4. As a guest user, I want to receive a clear warning banner when accessing the app with a denied error, so that I understand why my Google account is restricted.

### Match Predictions & Locks
5. As a predictor, I want to view upcoming matches grouped by their parent tournaments, so that I can easily navigate and find matches to predict.
6. As a predictor, I want to submit predictions for match winners, powerplay scores, and player-of-the-match awards, so that I can compete in active fantasy campaigns.
7. As a predictor, I want to activate a 2x Booster Powerup on allowed questions, so that I can double my points when I am confident.
8. As a predictor, I want prediction inputs to lock strictly 30 minutes before the official match start time, so that no player can predict after the match toss has begun.
9. As a predictor, I want to view other community members' predictions only after the match locks, so that the game remains fair.

### Standings & Leaderboards
10. As a league member, I want to see my rank and scores updated in the leaderboard caches after an admin grades a match, so that I can see how I stack up against others.
11. As a late entrant, I want my points in a private league to start calculating only from matches locking *after* my league join timestamp, so that I don't inherit negative non-participation penalties for matches played before I joined.
12. As a competitor, I want to see both my global tournament powerup balance and campaign-specific powerup balances on the leaderboard, so that I know my remaining booster limits.

### Private Leagues & Admin Controls
13. As a user, I want to create a private league with custom starting parameters, so that I can play with a closed group of friends.
14. As an invitee, I want to join a private league using an invite link or code, so that I am added to its dedicated standings table.
15. As an administrator, I want to define match campaigns and questions with specific scoring structures (exact matches, range deltas, wrong answers), so that I can configure points dynamically.
16. As an administrator, I want to enter correct match outcomes and trigger calculations, so that standings caches rebuild automatically.

### Layout & Responsiveness
17. As an iPad/Tablet user, I want the desktop navigation menu to shrink to a compact icon-only representation and hide text labels, so that the header menu fits my screen and does not overflow or wrap into a second row.
18. As a desktop user, I want to see full text labels alongside menu icons, so that navigating the application is clear and easy.
19. As an iOS PWA user, I want headers, buttons, and footers to respect my phone's safe area insets (notches and home indicator), so that elements do not overlap with system controls.
20. As a mobile predictor, I want all buttons and touch targets to be at least `44x44px`, so that I don't accidentally tap the wrong button.

---

## Implementation Decisions

### Seam & Testing Point
We will test the application at the **User Interface (DOM) layer** using browser automation. Existing APIs, databases, and frontends will be run end-to-end to replicate user behavior. We do not mock network traffic; instead, we hit an active FastAPI container and a dedicated Neon test branch, verifying the full cycle of user input, API request processing, DB persistence, and cache updates.

### Environment & Server Orchestration
- **Test Variables (`.env.test`)**: A dedicated environment file containing test configurations (e.g. custom ports, JWT secrets, and the Neon test database URL).
- **Port Isolation**: 
  - Backend runs on port `8001` (with `VITE_API_URL` pointing to `http://localhost:8001/api`).
  - Frontend runs on port `5001` (`FRONTEND_URL` set to `http://localhost:5001`).
- **Web Server Lifespans**: Playwright's config orchestrates the launch and shutdown of both the Docker FastAPI backend and the Vite dev server.

### Viewport Targets
Tests will execute across three viewport shapes:
- **Chromium Desktop** (`1280x800`): Full desktop navigation panel.
- **iPad WebKit Tablet** (`834x1194`): Tablet layout, testing responsive icon-only top menu collapses.
- **iPhone WebKit Mobile** (`393x852`): iOS PWA form factors testing safe-area offsets and bottom tab bars.

### Authentication State Seeding
- **Dev Login Bypass**: Instead of logging in with Google OAuth in every test, Playwright's global setup performs standard dev bypass logins (`admin` and `user`) once.
- **Zustand Persistence Injection**: The bypass sets the `ipl-fantasy-auth` localStorage item, and the browser context is exported to `playwright/.auth/admin.json` and `playwright/.auth/user.json` to skip login on subsequent tests.

### Data Collision Prevention
- **Dynamic Naming**: Since tests run against a persistent Neon test branch without resets, any write operations (such as league creations or new campaigns) must use dynamic strings appended with timestamps:
  ```typescript
  const leagueName = `Test League ${Date.now()}`;
  ```

---

## Testing Decisions

### What Makes a Good Test
- **Focus on User-Visible Behavior**: Tests must interact with the application using ARIA roles and labels (e.g., `getByRole('button', { name: 'Save' })`) instead of relying on implementation details (like CSS classes, internal React state values, or specific database column IDs).
- **Temporal Testing**: When testing lock times, the system clock is mocked using Playwright's Clock API rather than modifying database match times directly.

### Modules to Test
- `frontend/src/components/Layout.tsx` (Menu visibility, layout, safe area margins).
- `frontend/src/pages/Login.tsx` & `AuthCallback.tsx` (Bypasses, query params redirections).
- `frontend/src/pages/MatchPage.tsx` (Form inputs, lock states, reveal listings).
- `frontend/src/pages/Leaderboard.tsx` (Standings filters, powerup indicators).
- `frontend/src/pages/Admin.tsx` & `CampaignBuilder.tsx` (Campaign/question creations, grading).

### Prior Art
Currently, there are no E2E or visual regression tests implemented in the codebase. This setup will establish the foundational test runner and directories.

---

## Out of Scope

- **Real Google Sign-In verification**: Google's login interface is an external third-party frame that blocks automated headless testing; we only test the bypass logins and auth states.
- **Live Telegram API Integration**: Actual messages sent by Telegram bots are not verified; webhooks hitting the `external_router` are simulated using direct HTTP POST requests.
- **Zero-downtime database upgrades**: Testing schema migration pipelines (e.g. rollback safety on live production data) is out of scope.

---

## Further Notes

- **Baseline Snapshots**: Baseline images are saved to Git. When styling, themes, or layouts change, visual baselines must be updated using:
  ```bash
  npx playwright test --update-snapshots
  ```
- **Neon Test Database Maintenance**: Since database states are persistent, admins must occasionally review the test database branch to trim orphan leagues or predictions manually.
