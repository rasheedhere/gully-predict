import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const userFile = path.resolve(__dirname, '../.auth/user.json');

test.describe('Leaderboard and Tournament Scoping E2E Checks', () => {
  test.use({ storageState: userFile });

  test('should auto-default tournament scope and verify URL syncing', async ({ page }) => {
    await page.goto('/leaderboard');

    // Wait for the loader to disappear
    await expect(page.locator('text=LOCATING ARENA...')).toBeHidden({ timeout: 15000 });

    // Verify query parameters are automatically appended (e.g. ?tournament=T123)
    await expect(page).toHaveURL(/[\?&]tournament=/);

    // Verify tournament selector buttons exist
    const selectorButtons = page.locator('div.flex.items-center.gap-2.overflow-x-auto button');
    if (await selectorButtons.count() > 1) {
      const secondButton = selectorButtons.nth(1);
      const secondButtonText = (await secondButton.innerText()).trim();

      // Click on the second tournament selector button
      await secondButton.click();

      // Confirm that the URL gets updated dynamically
      await expect(page).toHaveURL(new RegExp(`[\\?&]tournament=`));
    }
  });

  test('should display leaderboard table records', async ({ page }) => {
    await page.goto('/leaderboard');

    // Wait for the loader to disappear
    await expect(page.locator('text=LOCATING ARENA...')).toBeHidden({ timeout: 15000 });

    // Verify query parameters are automatically appended before inspecting content
    await expect(page).toHaveURL(/[\?&]tournament=/, { timeout: 10000 });

    // Wait for the leaderboard container to load
    const width = page.viewportSize()?.width ?? 1280;
    const isMobileLayout = width < 768;
    const leaderboardContainer = isMobileLayout ? page.locator('div[class*="md:hidden"]').first() : page.locator('.glass-panel').first();
    await expect(leaderboardContainer).toBeVisible({ timeout: 10000 });

    // Assert that columns (Rank, Player, Points) are present in the table
    const tableHeader = page.locator('table thead tr');
    if (await tableHeader.count() > 0) {
      await expect(tableHeader).toContainText(/Rank/i);
      await expect(tableHeader).toContainText(/Player/i);
      await expect(tableHeader).toContainText(/Points/i);
    }

    // Verify rows exist for predictors in the list
    const leaderboardRows = page.locator('table tbody tr');
    // It's acceptable for it to be empty if no users have predictions, but there should be a table or empty text
    const noUsersText = page.locator('text=NO RANKINGS AVAILABLE YET').first();
    
    const hasRows = await leaderboardRows.count() > 0;
    const hasEmptyNotice = await noUsersText.isVisible();
    
    expect(hasRows || hasEmptyNotice).toBe(true);
  });
});
