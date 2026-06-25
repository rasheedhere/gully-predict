# Playwright Test Plan for Gully Predict

This plan outlines the architecture, configuration, and implementation strategy for adding End-to-End (E2E) and integration tests to **Gully Predict** using **Playwright**, incorporating all architectural choices resolved during our design review.

---

## 📋 Architectural Overview & Test Strategy

Playwright runs E2E tests against the frontend (Vite/React) and hits the backend (FastAPI) configured to run in test mode. 

### Core Review Decisions
1. **Database Strategy**: Dedicated test branch on Neon PostgreSQL.
2. **Data Resetting/Seeding**: Persistent test branch database state, manually seeded once.
3. **Collision Avoidance**: Tests use unique dynamic suffixing (e.g. `Date.now()`) for created entities (like private leagues) to ensure independent and repeatable test runs.
4. **Local Server Orchestration**: Playwright runs frontend/backend on separate isolated test ports (`5001` and `8001`) via a dedicated `.env.test` file.
5. **CI/CD Secrets**: The Neon test database URL is stored in a secure GitHub repository secret and injected dynamically during workflows.

```mermaid
graph TD
    A[Playwright Runner] --> B(Global Setup / Auth State)
    B -->|Bypasses Login| C[Store Auth States: user.json / admin.json]
    A --> D[Test Execution Suites]
    D -->|Injects Auth State| E[Protected Routes /matchcenter, /admin]
    D -->|Simulates Time| F[Prediction Locking Checks]
    D -->|Verifies Layout| G[iOS PWA & Tablet viewports]
    D -->|Triggers grading| H[Admin Scoring & Leaderboard Rebuilds]
```

---

## 🛠️ 1. Setup & Configuration

### Package Dependencies
Install Playwright as a dev dependency inside the `frontend` folder:
```bash
npm install -D @playwright/test dotenv
npx playwright install
```

### Dedicated Test Environment File (`.env.test`)
Create this file in the project root. **Do not commit this file to Git.**
```ini
GOOGLE_CLIENT_ID=mock-client-id
GOOGLE_CLIENT_SECRET=mock-client-secret
JWT_SECRET=be908df81e29b000a2ca3e2af2c2b74486b59f2fe2c9f638c81af77cc15bb541
DATABASE_URL=postgresql://neondb_owner:npg_CY9N3QDHRGwt@ep-late-sky-aq3co4nu-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
FRONTEND_URL=http://localhost:5001
VITE_API_URL=http://localhost:8001/api
DEV_LOGIN_ENABLED=true
VITE_DEV_LOGIN=true
```

### Config File: `frontend/playwright.config.ts`
Setup Playwright to run the servers on custom ports using `.env.test` and declare standard viewport projects (Desktop, Tablet, and Mobile).

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load variables from test environment config
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const FRONTEND_PORT = 5001;
const BACKEND_PORT = 8001;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './playwright/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Setup project for shared auth states
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Desktop Viewports
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
      },
    },

    // iPad / Tablet Viewports (Visual Layout & Navigation Checks)
    {
      name: 'webkit-tablet',
      use: {
        ...devices['iPad Pro 11'],
        viewport: { width: 834, height: 1194 },
        hasTouch: true,
      },
    },

    // iOS PWA Mobile Viewports (Crucial for Mobile-First & Safe Areas verification)
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 3,
        hasTouch: true,
      },
    },
  ],

  // Automatically start both backend (FastAPI) and frontend (Vite) on test ports
  webServer: [
    {
      command: 'docker-compose down && docker-compose up --build -d backend && export PORT=8001 && uvicorn backend.main:app --port 8001',
      port: BACKEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT}`,
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    }
  ]
});
```

---

## 🔑 2. Authentication State Management (`storageState`)

Instead of logging in before every single test run, we authenticate as an administrator and a user inside a setup project, saving context states to JSON.

### Shared Auth Setup (`playwright/tests/auth.setup.ts`)
```typescript
import { test as setup, expect } from '@playwright/test';

setup('Authenticate as Admin', async ({ page }) => {
  await page.goto('/login');
  const adminBypassBtn = page.getByRole('button', { name: 'admin', exact: true });
  await expect(adminBypassBtn).toBeVisible();
  await adminBypassBtn.click();
  await page.waitForURL('**/matchcenter');
  
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});

setup('Authenticate as Standard User', async ({ page }) => {
  await page.goto('/login');
  const userBypassBtn = page.getByRole('button', { name: 'user', exact: true });
  await userBypassBtn.click();
  await page.waitForURL('**/matchcenter');
  
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

---

## 🧪 3. Core Test Suites & Scenarios

### Suite 1: Authentication & Public Routes (`auth.spec.ts`)
- **Test cases**:
  - Unauthenticated user gets redirected to `/login` with preservation of location redirect state.
  - Verifying `/login?error=not_invited` renders the access restriction banner.

### Suite 2: Match Predictions & Toss Locks (`match-predictions.spec.ts`)
- **Test cases**:
  - **Dynamic Answer Cards**: Submitting a prediction card and verifying numeric ranges.
  - **Booster Powerups**: Verifying that active 2x multipliers apply correctly to predictions.
  - **Lock Verification**:
    - Uses Playwright's Clock API (`page.clock.setFixedTime()`) to mock a time of `29 minutes` before toss.
    - Asserts that prediction inputs and choice buttons are disabled, status reads locked, and submission fails.
  - **Community Reveal**: Navigating to `GET /matches/{id}/predictions/all` returns `403 Forbidden` prior to lock, and results are correctly grouped and visible post-lock.

### Suite 3: Leaderboard & Scoping (`leaderboard.spec.ts`)
- **Test cases**:
  - Toggling selector dropdowns updates query parameter `?tournament=T123` and updates layout stats.
  - Verifying the dual indicators for global powerups vs campaign-specific powerup balances display correctly.
  - **Private League Joined-Date Rules**:
    - Asserts that a user who joined a league after a match started does not have points for that match reflected in their league standings.

### Suite 4: Private Leagues (`leagues.spec.ts`)
- **Collision Avoidance Rule**: The test must create leagues with random names to avoid duplicate constraints:
  ```typescript
  const uniqueLeagueName = `Test League ${Date.now()}`;
  ```
- **Test cases**:
  - Creating a private league with unique naming.
  - Joining a private league using invite codes.

### Suite 5: iOS/PWA UX Verification (`ios-pwa.spec.ts`)
- **Test cases**:
  - **Safe Area Insets**: Verifying that elements like headers and bottom tabs respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` styles in WebKit mobile project.
  - **Touch Targets**: Verifying interactive elements occupy at least `44x44px` layout bounding boxes.

### Suite 6: Multi-Device Visual Regression Suite (`visual-regression.spec.ts`)
Validates that layout spacing, color theme continuity, navigation patterns, and component sizing remain correct and consistent across Desktop, iPad, and Mobile screens.
- **Visual Targets**:
  - **Match Center Dashboard**: Verifying grid structures adapt smoothly (Desktop 3-column match lists vs iPad 2-column list vs Mobile 1-column list).
  - **Responsive Navbar Text-Hiding**: Checks that navigation links (like `MATCH CENTER`, `LEADERBOARD`) and user name header hide their text labels (`display: none` / `hidden` class assertion) on tablet viewports (768px - 1023px) while their icons remain fully visible and interactive, and are fully visible on desktop viewports.
  - **PWA Form Factor Overlay Check**: Evaluates full-page modal popups (e.g. `AdminModal`) on tablet/desktop sizes to verify they align properly in the center of the screen as glassmorphism panels, compared to mobile screen views where they occupy full-screen takeovers.
  - **Snapshot Assertions**:
    ```typescript
    test('Match Center visual dashboard matches baseline snapshot', async ({ page }) => {
      await page.goto('/matchcenter');
      await page.waitForSelector('.glass-panel');
      await expect(page).toHaveScreenshot('match-center-dashboard.png', {
        maxDiffPixelRatio: 0.02,
        mask: [page.locator('.user-avatar')],
      });
    });
    ```

---

## 🏃 4. Proposed Execution Scripts

Add these npm scripts in the `frontend/package.json` file:
- `npm run test:e2e` - Run Playwright tests in headless mode.
- `npm run test:e2e:ui` - Launch Playwright's interactive UI runner.
- `npm run test:e2e:update-snapshots` - Update reference visual baseline screenshots across all viewports (Desktop, iPad, Mobile).
- `npm run test:e2e:debug` - Launch tests in inspector mode for debugging.

---

## ⚙️ 5. CI/CD Pipeline Setup (`.github/workflows/playwright.yml`)

Configure GitHub Actions to run E2E tests against the Neon database test branch securely:

```yaml
name: Playwright Tests
on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main, dev ]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.12'
        
    - name: Install Python Dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 23
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json

    - name: Install Node Dependencies
      run: |
        cd frontend
        npm ci

    - name: Install Playwright Browsers
      run: |
        cd frontend
        npx playwright install --with-deps

    - name: Build and Configure Test Environment
      env:
        NEON_TEST_DATABASE_URL: ${{ secrets.NEON_TEST_DATABASE_URL }}
      run: |
        echo "DATABASE_URL=$NEON_TEST_DATABASE_URL" >> .env.test
        echo "FRONTEND_URL=http://localhost:5001" >> .env.test
        echo "VITE_API_URL=http://localhost:8001/api" >> .env.test
        echo "DEV_LOGIN_ENABLED=true" >> .env.test
        echo "VITE_DEV_LOGIN=true" >> .env.test
        echo "JWT_SECRET=be908df81e29b000a2ca3e2af2c2b74486b59f2fe2c9f638c81af77cc15bb541" >> .env.test

    - name: Run E2E Tests
      run: |
        cd frontend
        npx playwright test

    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: frontend/playwright-report/
        retries: 0
```

---

## 📝 6. Next Steps

1. **Install Dependencies**: Execute `npm install` for Playwright packages.
2. **Create config files**: Save `playwright.config.ts` in the `frontend` folder and create `.env.test` in the project root.
3. **Capture Initial Snapshot Baselines**: Run `npm run test:e2e:update-snapshots` locally to generate baseline visual comparisons for Desktop, iPad, and Mobile.
