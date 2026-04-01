import { test, expect, Page } from '@playwright/test';

// Dismiss the press-start screen by pressing a key, then wait for title screen.
async function passPressStart(page: Page) {
  await page.goto('/');
  await expect(page.getByText('PRESS ANY KEY')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#title-screen')).toBeVisible();
}

// ── Press Start Screen ─────────────────────────────────────

test.describe('Press Start Screen', () => {
  test('loads and shows press-any-key text', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('PRESS ANY KEY')).toBeVisible();
  });

  test('navigates to title screen on keypress', async ({ page }) => {
    await passPressStart(page);
    await expect(page.locator('#title-screen')).toBeVisible();
  });

  test('navigates to title screen on click', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('PRESS ANY KEY')).toBeVisible();
    await page.locator('body').click();
    await expect(page.locator('#title-screen')).toBeVisible();
  });
});

// ── Title Screen ──────────────────────────────────────────

test.describe('Title Screen', () => {
  test('loads and shows game title', async ({ page }) => {
    await passPressStart(page);
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect(page.getByText('ECHOES OF SANGUO')).toBeVisible();
  });

  test('new game button is present', async ({ page }) => {
    await passPressStart(page);
    await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
  });

  test('options button is present', async ({ page }) => {
    await passPressStart(page);
    await expect(page.getByRole('button', { name: 'Options' })).toBeVisible();
  });
});
