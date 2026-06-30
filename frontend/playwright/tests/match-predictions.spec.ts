import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminFile = path.resolve(__dirname, '../.auth/admin.json');
const userFile = path.resolve(__dirname, '../.auth/user.json');

// Helper to discover the first upcoming match dynamically
async function getUpcomingMatch(request: any): Promise<any> {
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:8001/api';
  const response = await request.get(`${apiUrl}/matches`);
  expect(response.ok()).toBeTruthy();
  const matches = await response.json();
  const now = new Date();
  const upcomingMatch = matches.find((m: any) => m.status === 'upcoming' && new Date(m.start_time) > now);
  if (!upcomingMatch) {
    throw new Error('No upcoming future matches found in the test database.');
  }
  return upcomingMatch;
}

test.describe('Match Predictions E2E Lifecycle', () => {
  // Use pre-authenticated standard user state
  test.use({ storageState: userFile });

  test('should submit predictions successfully for an active match', async ({ page, request }) => {
    const upcomingMatch = await getUpcomingMatch(request);
    const matchId = upcomingMatch.id;
    console.log(`[E2E] Testing prediction submission on match: ${matchId}`);
    
    await page.goto(`/match/${matchId}`);
    await page.waitForURL(new RegExp(`/match/${matchId}`));
    
    // Check if the form is already locked or matches are completed
    const headerStatus = page.locator('text=Predictions Closed')
      .or(page.locator('text=Predictions Open'))
      .or(page.locator('text=CLOSED'))
      .or(page.locator('text=OPEN'))
      .filter({ visible: true });
    await expect(headerStatus.first()).toBeVisible({ timeout: 15000 });
    
    const isLocked = await page.locator('text=Predictions Closed').or(page.locator('text=CLOSED')).filter({ visible: true }).first().isVisible();
    if (isLocked) {
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
    const submitBtn = page.getByRole('button', { name: /Submit Lock|Update Lock|Update Prediction/i }).filter({ visible: true });
    await submitBtn.first().click();
    
    // Expect success toast message (or saved indication on screen)
    await expect(page.locator('text=Prediction Locked!').or(page.locator('text=Saved'))).toBeVisible({ timeout: 10000 });
  });

  test('should enforce strict prediction locking rules using Clock API', async ({ page, request }) => {
    test.setTimeout(120000); // 120 seconds timeout to cover database calls and page mocks

    const upcomingMatch = await getUpcomingMatch(request);
    const matchId = upcomingMatch.id;
    const tossTimeMs = new Date(upcomingMatch.tossTime).getTime();
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:8001/api';

    // Parse tokens
    const adminState = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
    const adminAuthStr = adminState.origins[0]?.localStorage?.find((x: any) => x.name === 'ipl-fantasy-auth')?.value;
    const adminToken = JSON.parse(adminAuthStr).state.token;

    const userState = JSON.parse(fs.readFileSync(userFile, 'utf-8'));
    const userAuthStr = userState.origins[0]?.localStorage?.find((x: any) => x.name === 'ipl-fantasy-auth')?.value;
    const userToken = JSON.parse(userAuthStr).state.token;

    console.log(`[E2E] Testing lock rules on match: ${matchId}`);

    // Store original start time
    const originalStartTime = upcomingMatch.start_time;

    try {
      // ── 1. Test 31 minutes before toss: Editable and hidden community predictions ──
      const time31MinBeforeToss = tossTimeMs - (31 * 60 * 1000);
      
      const userContext31 = await page.context().browser()!.newContext({ storageState: userFile });
      const page31 = await userContext31.newPage();

      // Mock date in browser context
      await page31.addInitScript((time) => {
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
      }, time31MinBeforeToss);

      await page31.goto(`/match/${matchId}`);
      await page31.waitForURL(new RegExp(`/match/${matchId}`));

      // Verify header status is "Predictions Open" / "OPEN" (only target the visible one)
      const statusOpen31 = page31.locator('text=Predictions Open').or(page31.locator('text=OPEN')).filter({ visible: true }).first();
      await expect(statusOpen31).toBeVisible({ timeout: 15000 });

      // Verify submit button is active/enabled
      const submitBtn31 = page31.getByRole('button', { name: /Submit Lock|Update Lock|Update Prediction/i }).filter({ visible: true });
      await expect(submitBtn31.first()).toBeVisible();
      await expect(submitBtn31.first()).toBeEnabled();

      // Verify inputs are enabled
      const noPowerupRadio31 = page31.locator('input[type="radio"][value="No"], input[type="radio"][value="NO"]').first();
      await expect(noPowerupRadio31).toBeVisible();
      await expect(noPowerupRadio31).toBeEnabled();

      // Verify locked placeholder for community predictions
      const lockedPlaceholder31 = page31.locator('text=Predictions Locked').first();
      await expect(lockedPlaceholder31).toBeVisible();

      // Verify GET /api/matches/{id}/predictions/all returns padlocks before the lock
      const beforeResponse = await request.get(`${apiUrl}/matches/${matchId}/predictions/all`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      expect(beforeResponse.ok()).toBeTruthy();
      const beforeData = await beforeResponse.json();
      const leaguesBefore = beforeData.leagues || [];
      for (const league of leaguesBefore) {
        for (const pred of league.predictions) {
          for (const [key, val] of Object.entries(pred.answers)) {
            if (key !== 'use_powerup' && key !== 'is_auto_predicted') {
              expect(val).toBe('🔒');
            }
          }
        }
      }

      await userContext31.close();

      // ── 2. Test 29 minutes before toss (LOCKED state on frontend & backend) ──
      // Update match start time in the DB to make the backend also believe it is locked (e.g. start time 20 minutes ago)
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const updateResponse = await request.put(`${apiUrl}/matches/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          start_time: twentyMinAgo
        }
      });
      expect(updateResponse.ok()).toBeTruthy();

      const time29MinBeforeToss = tossTimeMs - (29 * 60 * 1000);
      const userContext29 = await page.context().browser()!.newContext({ storageState: userFile });
      const page29 = await userContext29.newPage();

      // Mock date in browser context
      await page29.addInitScript((time) => {
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
      }, time29MinBeforeToss);

      await page29.goto(`/match/${matchId}`);
      await page29.waitForURL(new RegExp(`/match/${matchId}`));

      // Verify header status is "Predictions Closed" / "CLOSED" (only target the visible one)
      const statusClosed29 = page29.locator('text=Predictions Closed').or(page29.locator('text=CLOSED')).filter({ visible: true }).first();
      await expect(statusClosed29).toBeVisible({ timeout: 15000 });

      // Verify form/predictions section is NOT rendered (since form is hidden when isLocked is true)
      const predictionsHeader29 = page29.locator('text=YOUR PREDICTIONS').first();
      await expect(predictionsHeader29).toBeHidden();

      // Verify community predictions is NOT showing locked placeholder (revealed)
      const lockedPlaceholder29 = page29.locator('text=Predictions Locked').first();
      await expect(lockedPlaceholder29).toBeHidden();

      // Verify GET /api/matches/{id}/predictions/all returns actual answers (not "🔒") after the lock
      const afterResponse = await request.get(`${apiUrl}/matches/${matchId}/predictions/all`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      expect(afterResponse.ok()).toBeTruthy();
      const afterData = await afterResponse.json();
      const leaguesAfter = afterData.leagues || [];
      for (const league of leaguesAfter) {
        for (const pred of league.predictions) {
          for (const [key, val] of Object.entries(pred.answers)) {
            if (key !== 'use_powerup' && key !== 'is_auto_predicted') {
              expect(val).not.toBe('🔒');
            }
          }
        }
      }

      await userContext29.close();

    } finally {
      // ── Restore original match start time to leave database clean ──
      const restoreResponse = await request.put(`${apiUrl}/matches/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          start_time: originalStartTime
        }
      });
      expect(restoreResponse.ok()).toBeTruthy();
      console.log(`[E2E] Restored match ${matchId} start_time to original: ${originalStartTime}`);
    }
  });
});
