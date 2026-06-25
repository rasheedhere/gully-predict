import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminFile = path.resolve(__dirname, '../.auth/admin.json');
const userFile = path.resolve(__dirname, '../.auth/user.json');

test.describe('Private Leagues Lifecycle', () => {
  const uniqueLeagueName = `Test League ${Date.now()}`;

  test('admin should create a private league and standard user should join it', async ({ browser, viewport }) => {
    // Open a fresh context with admin credentials
    const adminContext = await browser.newContext({ storageState: adminFile, viewport });
    const page = await adminContext.newPage();

    // Navigate directly to the leagues administration tab
    await page.goto('/admin?tab=leagues');

    // Fill in the league name input
    const leagueNameInput = page.locator('input[placeholder="e.g. Corporate Challenge"]');
    await expect(leagueNameInput).toBeVisible({ timeout: 15000 });
    await leagueNameInput.fill(uniqueLeagueName);

    // Select the first available tournament in the dropdown selection
    const tournamentSelect = page.locator('select');
    await expect(tournamentSelect).toBeVisible();
    // Wait for the tournament options to load from the API
    await expect(page.locator('select option').nth(1)).toBeAttached({ timeout: 10000 });
    await tournamentSelect.selectOption({ index: 1 });

    // Click Provision button
    const provisionBtn = page.getByRole('button', { name: /PROVISION LEAGUE|PROVISIONING/i });
    await expect(provisionBtn).toBeVisible();
    await provisionBtn.click();

    // Verify success view is displayed and extract the join code
    const successHeader = page.locator('text=League Created Successfully!').first();
    await expect(successHeader).toBeVisible({ timeout: 10000 });

    // The code is displayed in a styled span block with a large text class
    const codeSpan = page.locator('span.font-display.text-white').first();
    await expect(codeSpan).toBeVisible();
    
    const joinCode = (await codeSpan.innerText()).trim();
    expect(joinCode.length).toBeGreaterThan(3);

    console.log(`Successfully provisioned "${uniqueLeagueName}" with join code: ${joinCode}`);

    await adminContext.close();

    // Open a fresh context with standard user credentials, inheriting the same viewport
    const userContext = await browser.newContext({ storageState: userFile, viewport });
    const userPage = await userContext.newPage();

    // Navigate to the leagues screen — wait for data to load before checking layout
    await userPage.goto('/leagues');
    // Wait for loading spinner to disappear (data load)
    await userPage.waitForTimeout(1500);

    // On mobile viewports (< 1024px), the join form is in a bottom sheet triggered by ?join=true URL.
    // On desktop (>= 1024px, `lg:block`), the join form sidebar is always visible.
    const currentViewportWidth = viewport?.width ?? 1280;
    const isMobileViewport = currentViewportWidth < 1024;

    if (isMobileViewport) {
      // Navigate with ?join=true to trigger the bottom sheet on mobile
      await userPage.goto('/leagues?join=true');
    }

    // Fill the join code — on mobile it's now in the bottom sheet, on desktop in the sidebar
    const inviteInput = userPage.locator('input[placeholder="e.g. C9920984"]');
    await expect(inviteInput).toBeVisible({ timeout: 10000 });
    await inviteInput.fill(joinCode);

    // Click the join button
    const joinSubmitBtn = userPage.getByRole('button', { name: /JOIN BATTLEGROUND/i });
    await expect(joinSubmitBtn).toBeVisible();
    await joinSubmitBtn.click();

    // Assert that the success toast appears
    const toastMessage = userPage.locator('text=Welcome to the Battleground!');
    await expect(toastMessage).toBeVisible({ timeout: 10000 });

    // Verify the new league is listed on the active leagues dashboard
    await userPage.goto('/leagues');
    const newlyCreatedLeagueRow = userPage.locator(`text=${uniqueLeagueName}`);
    await expect(newlyCreatedLeagueRow).toBeVisible({ timeout: 10000 });

    await userContext.close();
  });
});
