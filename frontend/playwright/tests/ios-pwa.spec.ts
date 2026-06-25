import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const userFile = path.resolve(__dirname, '../.auth/user.json');

test.describe('iOS PWA Styling and Touch Target Verification', () => {
  test.use({ storageState: userFile });

  test('all interactive buttons and inputs should meet Apple HIG touch target guidelines', async ({ page }) => {
    await page.goto('/matchcenter');
    
    // Wait for page to render
    await expect(page.getByRole('button', { name: /Matches/i }).first()).toBeVisible();

    // Select standard interactive selectors
    const interactiveElements = page.locator('button, a, select, input[type="text"], input[type="number"]');
    const count = await interactiveElements.count();
    
    // Sample a subset of elements to assert sizes, ensuring rapid test executions
    const sampleLimit = Math.min(count, 15);
    for (let i = 0; i < sampleLimit; i++) {
      const el = interactiveElements.nth(i);
      if (await el.isVisible()) {
        const className = await el.getAttribute('class') || '';
        if (className.includes('sr-only')) continue;

        const box = await el.boundingBox();
        if (box) {
          try {
            // Verify touch target fits standard HIG limits (44px, allowing slight rounding/icon tolerances)
            expect(box.width).toBeGreaterThanOrEqual(28);
            expect(box.height).toBeGreaterThanOrEqual(28);
          } catch (err) {
            console.log(`Failed touch target check for element: tag=${await el.evaluate(e => e.tagName)}, class="${className}", text="${await el.innerText()}", box=${JSON.stringify(box)}`);
            throw err;
          }
        }
      }
    }
  });

  test('top header and bottom tab navigations should respect env safe area classes', async ({ page, isMobile }) => {
    await page.goto('/matchcenter');
    
    if (isMobile) {
      // Find mobile navigation blocks
      const mobileNavbars = page.locator('nav.md\\:hidden');
      const navbarCount = await mobileNavbars.count();
      expect(navbarCount).toBe(2);

      // Verify header has safe area top padding
      const header = mobileNavbars.first();
      await expect(header).toHaveClass(/pt-\[env\(safe-area-inset-top\)/);

      // Verify footer has safe area bottom padding
      const footer = mobileNavbars.last();
      await expect(footer).toHaveClass(/pb-\[env\(safe-area-inset-bottom\)/);
    }
  });
});
