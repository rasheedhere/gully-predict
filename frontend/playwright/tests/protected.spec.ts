import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const userFile = path.resolve(__dirname, '../.auth/user.json');

test.describe('Protected Routes Access', () => {
  // Use the pre-saved user authentication storageState
  test.use({ storageState: userFile });

  test('should load the Match Center directly as an authenticated user', async ({ page }) => {
    // Navigate directly to the protected matchcenter path
    await page.goto('/matchcenter');

    // Wait for the loader to disappear
    await expect(page.locator('text=LOADING ARENA...')).toBeHidden({ timeout: 15000 });

    // Verify that the title and navbar confirm we are inside the main dashboard
    await expect(page.getByRole('heading', { name: 'MATCH CENTER' }).or(page.getByRole('button', { name: /Matches/i }).first()).first()).toBeVisible();
    
    // Verify that we are not redirected to the login page URL
    await expect(page.url()).toContain('/matchcenter');
  });
});
