import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup file paths for caching storage state
const authDir = path.resolve(__dirname, '../.auth');
const adminFile = path.join(authDir, 'admin.json');
const userFile = path.join(authDir, 'user.json');

setup('authenticate as admin', async ({ page }) => {
  setup.setTimeout(90000);
  // Listen to console and network
  page.on('console', msg => console.log(`[Admin Setup Console] ${msg.type()}: ${msg.text()}`));
  page.on('request', req => console.log(`[Admin Setup Req] ${req.method()} ${req.url()}`));
  page.on('response', res => console.log(`[Admin Setup Res] ${res.status()} ${res.url()}`));

  // Navigate to login page
  await page.goto('/login');

  // Verify the bypass container and dev login button is visible
  const adminBypassBtn = page.getByRole('button', { name: 'admin', exact: true });
  await expect(adminBypassBtn).toBeVisible();

  // Click the bypass button
  await adminBypassBtn.click();

  // Wait for navigation and verify the user lands on the dashboard/matchcenter page
  await page.waitForURL('**/matchcenter');
  await expect(page.getByRole('heading', { name: 'MATCH CENTER' }).or(page.getByRole('button', { name: /Matches/i }).first()).first()).toBeVisible({ timeout: 20000 });

  // Save the full storage state (which captures the Zustand 'ipl-fantasy-auth' localStorage item)
  await page.context().storageState({ path: adminFile });
});

setup('authenticate as standard user', async ({ page }) => {
  setup.setTimeout(90000);
  // Listen to console and network
  page.on('console', msg => console.log(`[User Setup Console] ${msg.type()}: ${msg.text()}`));
  page.on('request', req => console.log(`[User Setup Req] ${req.method()} ${req.url()}`));
  page.on('response', res => console.log(`[User Setup Res] ${res.status()} ${res.url()}`));

  await page.goto('/login');

  const userBypassBtn = page.getByRole('button', { name: 'user', exact: true });
  await expect(userBypassBtn).toBeVisible();
  await userBypassBtn.click();

  await page.waitForURL('**/matchcenter');
  await expect(page.getByRole('heading', { name: 'MATCH CENTER' }).or(page.getByRole('button', { name: /Matches/i }).first()).first()).toBeVisible({ timeout: 20000 });

  await page.context().storageState({ path: userFile });
});
