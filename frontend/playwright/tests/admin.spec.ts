import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminFile = path.resolve(__dirname, '../.auth/admin.json');

test.describe('Admin Control and Match Grading Lifecycle', () => {
  // Use pre-saved admin authentication state
  test.use({ storageState: adminFile });

  test('should navigate to admin dashboard and check tournaments list', async ({ page }) => {
    await page.goto('/admin?tab=tournaments');

    // Confirm that the admin console and header titles load
    const activeHeader = page.locator('text=Tournament Registry');
    await expect(activeHeader).toBeVisible({ timeout: 10000 });
  });

  test('should open tournament manager, match grading, and perform scoring', async ({ page }) => {
    await page.goto('/admin?tab=tournaments');

    // Locate the first tournament's manage action link/button
    // Tournament rows render inside a table or card list with a "Manage" button/action
    const manageBtn = page.getByRole('button', { name: /Manage/i }).first();
    await expect(manageBtn).toBeVisible({ timeout: 15000 });

    // Click on the manage button for the first tournament
    await manageBtn.click();
    
    // Verify that the URL updates with tournamentId
    await expect(page).toHaveURL(/[\?&]tournamentId=/);

    // Switch to the 'Grading' subtab in the match manager
    const gradingTab = page.getByRole('button', { name: 'Grading', exact: true });
    await expect(gradingTab).toBeVisible();
    await gradingTab.click();

    // Verify list of matches for grading is visible
    const matchesList = page.locator('div.grid.gap-4.mt-6');
    
    // Find the first match card button to open the grading form modal
    const gradeMatchBtn = page.locator('button').filter({ hasText: /Grade/i }).first();
    await expect(gradeMatchBtn).toBeVisible({ timeout: 15000 });

    // Open grading modal
    await gradeMatchBtn.click();

    // Verify grading modal opens (the Release Scores button should render)
    const releaseScoresBtn = page.getByRole('button', { name: /Release Scores|Propagating/i });
    await expect(releaseScoresBtn).toBeVisible({ timeout: 10000 });

    // Seed mock answers dynamically
    // Choice questions: select the first option button for each list
    // Note: We escape the '.' in the gap-2.5 class name.
    const optionButtons = page.locator('div.flex.flex-wrap.gap-2\\.5 button');
    const optionsCount = await optionButtons.count();
    
    // Tap up to 2 choice answers to seed them
    const limit = Math.min(optionsCount, 2);
    for (let i = 0; i < limit; i++) {
      await optionButtons.nth(i).click();
    }

    // Free number inputs: fill in a generic value
    const numInputs = page.locator('input[type="number"]');
    const numCount = await numInputs.count();
    for (let i = 0; i < numCount; i++) {
      const input = numInputs.nth(i);
      await input.fill('50');
    }

    // Submit the grades
    await releaseScoresBtn.click({ force: true });
    
    // Expect the modal to close (release scores button should be unmounted)
    await expect(releaseScoresBtn).toHaveCount(0, { timeout: 15000 });
  });
});
