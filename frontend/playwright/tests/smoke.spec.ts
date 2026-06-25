import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const userFile = path.resolve(__dirname, '../.auth/user.json');

test.describe('Gully Predict Smoke & Network Diagnostic Test', () => {
  test('should load the login page successfully', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Gully Predict/i);
  });

  test('should log network traffic on Match Center', async ({ page, browser }) => {
    // Open fresh context with standard user credentials
    const userContext = await browser.newContext({ storageState: userFile });
    const userPage = await userContext.newPage();

    // Listen to console logs
    userPage.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });

    // Listen to network requests
    userPage.on('request', request => {
      console.log(`[Request] ${request.method()} ${request.url()}`);
    });

    // Listen to network responses
    userPage.on('response', response => {
      console.log(`[Response] ${response.status()} ${response.url()}`);
    });

    console.log("Navigating to /matchcenter...");
    await userPage.goto('/matchcenter');

    console.log("Waiting 10 seconds for page to load and network requests to complete...");
    await userPage.waitForTimeout(10000);
    
    const pageContent = await userPage.locator('body').innerText();
    console.log(`Page content snippet: ${pageContent.substring(0, 500)}`);
    
    await userContext.close();
  });
});
