import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminFile = path.resolve(__dirname, '../.auth/admin.json');

test.describe('Admin SQL Assistant Chat E2E Tests', () => {
  // Use pre-saved admin authentication state
  test.use({ storageState: adminFile });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    page.on('request', req => console.log(`[Browser Req] ${req.method()} ${req.url()}`));
    page.on('response', res => console.log(`[Browser Res] ${res.status()} ${res.url()}`));

    // Abort service worker registration to prevent it from bypassing Playwright page.route on Webkit
    await page.route('**/registerSW.js', route => route.abort());
    await page.route('**/dev-sw.js**', route => route.abort());
    await page.route('**/sw.js', route => route.abort());

    let sessions = [] as any[];

    const handler = async (route: any, request: any) => {
      const url = request.url();
      const method = request.method();

      if (url.endsWith('/chat')) {
        const payload = request.postDataJSON();
        const query = payload?.query || '';

        if (query.toLowerCase().includes('user') || query.toLowerCase().includes('update')) {
          // Return 400 Bad Request to simulate safety boundary violation
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              detail: "SQL safety violation: Access to users table or write actions are restricted.",
            }),
          });
        } else {
          // Add session to sessions list mock state
          sessions = [{ id: 42, title: query.slice(0, 50) }];
          // Return successful database query result mock response
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 100,
              session_id: 42,
              role: "model",
              content: "There are currently 3 active tournaments.",
              sql_query: "SELECT COUNT(*) FROM tournaments WHERE status = 'active';",
              query_results: [{ count: 3 }],
              chart_config: {
                chart_type: "bar",
                x_key: "count",
                y_key: "count",
              },
            }),
          });
        }
      } else if (url.endsWith('/42')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 99,
              role: "user",
              content: "How many tournaments are active?",
              sql_query: null,
              query_results: null,
              chart_config: null,
            },
            {
              id: 100,
              role: "model",
              content: "There are currently 3 active tournaments.",
              sql_query: "SELECT COUNT(*) FROM tournaments WHERE status = 'active';",
              query_results: [{ count: 3 }],
              chart_config: {
                chart_type: "bar",
                x_key: "count",
                y_key: "count",
              },
            },
          ]),
        });
      } else {
        // Fallback for sessions list GET / delete requests
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(sessions),
        });
      }
    };

    await page.route('**/admin/sql-assistant/sessions', handler);
    await page.route('**/admin/sql-assistant/sessions/**', handler);
  });

  test('should navigate to admin dashboard, open SQL assistant, and perform normal chat + safety checks', async ({ page }) => {
    // 1. Navigate to `/admin`
    await page.goto('/admin');

    // 2. Find and click the floating SQL Assistant chat bubble button
    const chatBubble = page.getByTitle('AI SQL Assistant');
    await expect(chatBubble).toBeVisible({ timeout: 15000 });
    await chatBubble.dispatchEvent('click');

    // 3. Verify the sliding chat drawer opens and shows the "New AI Assistant" / "AI SQL Assistant" title
    const drawerHeader = page.locator('span:has-text("AI Assistant"), span:has-text("AI SQL Assistant")');
    await expect(drawerHeader).toBeVisible();

    // 4. Click the "New Chat" button to ensure a clean session starts
    const newChatBtn = page.getByTitle('New Session');
    await expect(newChatBtn).toBeVisible();
    await newChatBtn.click();

    // 5. Type a mock query and submit
    const chatInput = page.getByPlaceholder('Ask the database...');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('How many tournaments are active?');
    await chatInput.press('Enter');

    // Wait for the response to load (which displays the tab bar) and switch back to the "Chat History" tab
    const chatHistoryTab = page.getByRole('button', { name: 'Chat History' });
    await expect(chatHistoryTab).toBeVisible({ timeout: 20000 });
    await chatHistoryTab.click();

    // 6. Verify that the chat log populates, showing:
    //    - The user query
    await expect(page.getByText('How many tournaments are active?').first()).toBeVisible();
    //    - The assistant response text summary
    await expect(page.getByText('There are currently 3 active tournaments.')).toBeVisible();
    //    - Collapsible SQL block ("GENERATED SQL")
    await expect(page.getByText('GENERATED SQL')).toBeVisible();
    await expect(page.getByText("SELECT COUNT(*) FROM tournaments WHERE status = 'active';")).toBeVisible();
    //    - Data grid / table (in this UI represented by the "Show Raw Data" toggle button and JSON output)
    const showRawDataBtn = page.getByText(/Show Raw Data/i);
    await expect(showRawDataBtn).toBeVisible();
    await showRawDataBtn.click();
    await expect(page.locator('pre:has-text("count")')).toBeVisible();

    // 7. Test security boundaries: Send a query asking to list `users` or update values
    await chatInput.fill('Please list all users or update their points');
    await chatInput.press('Enter');

    // Verify UI handles the backend HTTP 400 validation error cleanly without crashing
    await expect(page.getByText('DATABASE ERROR')).toBeVisible();
    await expect(page.getByText(/SQL safety violation/i)).toBeVisible();
  });
});
