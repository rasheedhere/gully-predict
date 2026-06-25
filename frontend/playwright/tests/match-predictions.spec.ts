import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const userFile = path.resolve(__dirname, '../.auth/user.json');

// Helper to discover the first upcoming match dynamically
async function getUpcomingMatchId(request: any): Promise<string> {
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:8001/api';
  const response = await request.get(`${apiUrl}/matches`);
  expect(response.ok()).toBeTruthy();
  const matches = await response.json();
  const now = new Date();
  const upcomingMatch = matches.find((m: any) => m.status === 'upcoming' && new Date(m.start_time) > now);
  if (!upcomingMatch) {
    throw new Error('No upcoming future matches found in the test database.');
  }
  return upcomingMatch.id;
}

test.describe('Match Predictions E2E Lifecycle', () => {
  // Use pre-authenticated standard user state
  test.use({ storageState: userFile });

  test('should submit predictions successfully for an active match', async ({ page, request }) => {
    const matchId = await getUpcomingMatchId(request);
    console.log(`[E2E] Testing prediction submission on match: ${matchId}`);
    
    await page.goto(`/match/${matchId}`);
    await page.waitForURL(new RegExp(`/match/${matchId}`));
    
    // Check if the form is already locked or matches are completed
    const submitBtn = page.getByRole('button', { name: /Submit Lock|Update Lock|Update Prediction|LOCK PERIOD CLOSED/i });
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    
    const isLockedText = await submitBtn.innerText();
    if (isLockedText.includes('CLOSED')) {
      console.log('Skipping prediction submission test case: Match is already locked in persistent database.');
      return;
    }
    
    // Select an option for multiple choice questions (dropdown selects)
    const selects = page.locator('select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      if (await select.isVisible()) {
        await select.selectOption({ index: 1 });
      }
    }
    
    // Fill in any numeric/number questions dynamically
    const numberInputs = page.locator('input[type="number"]');
    const numberInputsCount = await numberInputs.count();
    for (let i = 0; i < numberInputsCount; i++) {
      const input = numberInputs.nth(i);
      if (await input.isEnabled()) {
        await input.fill('45');
      }
    }

    // Fill in any text/free answers dynamically (e.g. player name)
    const textInputs = page.locator('input[placeholder="Type your answer"]');
    const textInputsCount = await textInputs.count();
    for (let i = 0; i < textInputsCount; i++) {
      const input = textInputs.nth(i);
      if (await input.isVisible()) {
        await input.fill('Virat Kohli');
      }
    }

    // Select the first radio option for each question card dynamically (except powerup)
    const radioInputs = page.locator('input[type="radio"]:not([value="Yes"]):not([value="No"]):not([value="YES (Booster 2x)"]):not([value="NO"])');
    const radioCount = await radioInputs.count();
    const checkedNames = new Set<string>();
    for (let i = 0; i < radioCount; i++) {
      const radio = radioInputs.nth(i);
      const name = await radio.getAttribute('name');
      if (name && !checkedNames.has(name)) {
        await radio.check({ force: true });
        checkedNames.add(name);
      }
    }
    
    // Select 'No' for 2x Powerup booster to keep test repeatable without reaching limits
    const noPowerupRadio = page.locator('input[type="radio"][value="No"], input[type="radio"][value="NO"]');
    await expect(noPowerupRadio.first()).toBeVisible();
    await noPowerupRadio.first().check({ force: true });
    
    // Submit the prediction
    await submitBtn.click();
    
    // Expect success toast message (or saved indication on screen)
    await expect(page.locator('text=Prediction Locked!').or(page.locator('text=Saved'))).toBeVisible({ timeout: 10000 });
  });

  test('should enforce strict prediction locking rules using Clock API', async ({ page, request }) => {
    const matchId = await getUpcomingMatchId(request);
    console.log(`[E2E] Testing lock rules on match: ${matchId}`);

    await page.goto(`/match/${matchId}`);
    await page.waitForURL(new RegExp(`/match/${matchId}`));
    
    // Get the start time or check if it is locked
    const submitBtn = page.getByRole('button', { name: /Submit Lock|Update Lock|Update Prediction|LOCK PERIOD CLOSED/i });
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    const isLockedText = await submitBtn.innerText();
    
    if (isLockedText.includes('CLOSED')) {
      // If already closed, it's locked by default
      const noPowerupRadio = page.locator('input[type="radio"][value="No"]');
      await expect(noPowerupRadio).toBeDisabled();
      return;
    }

    // Mock clock to be 2 hours in the future (locks it)
    const mockFutureTime = Date.now() + (2 * 60 * 60 * 1000); 
    await page.addInitScript((time) => {
      const OriginalDate = Date;
      // @ts-ignore
      globalThis.Date = class extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(time);
          } else {
            // @ts-ignore
            super(...args);
          }
        }
      };
      globalThis.Date.now = () => time;
      globalThis.Date.UTC = OriginalDate.UTC;
      globalThis.Date.parse = OriginalDate.parse;
    }, mockFutureTime);
    await page.reload();
    
    // After reload in future, inputs should be disabled
    const radioInputs = page.locator('input[type="radio"]');
    if (await radioInputs.count() > 0) {
      await expect(radioInputs.first()).toBeDisabled();
    }
  });
});
