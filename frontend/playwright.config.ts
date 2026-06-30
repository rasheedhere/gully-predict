import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load variables from test environment config, ensuring they override any pre-existing environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

const FRONTEND_PORT = 5001;
const BACKEND_PORT = 8001;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './playwright/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // iPad / Tablet Viewports (Visual Layout & Navigation Checks)
    {
      name: 'webkit-tablet',
      dependencies: ['setup'],
      use: {
        ...devices['iPad Pro 11'],
        viewport: { width: 834, height: 1194 },
        hasTouch: true,
      },
    },

    // iOS PWA Mobile Viewports (Crucial for Mobile-First & Safe Areas verification)
    {
      name: 'webkit-mobile',
      dependencies: ['setup'],
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
      command: './.venv/bin/uvicorn backend.main:app --port 8001 --env-file .env.test --loop asyncio',
      port: BACKEND_PORT,
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || '',
        TESTING: 'true',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --mode test`,
      port: FRONTEND_PORT,
      cwd: __dirname,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    }
  ]
});
