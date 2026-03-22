import { test, expect, Page } from '@playwright/test';

// Dismiss the press-start screen by pressing a key, then wait for title screen.
async function passPressStart(page: Page) {
  await page.goto('/');
  await page.keyboard.press('Enter');
}

// Navigate through press-start → title → game.
async function startGame(page: Page) {
  await passPressStart(page);
  await page.click('#btn-start');
  await page.locator('#game-screen').waitFor({ state: 'visible', timeout: 8_000 });
}

// ── Press Start Screen ─────────────────────────────────────

test.describe('Press Start Screen', () => {
  test('loads and shows press-any-key text', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('PRESS ANY KEY')).toBeVisible();
  });

  test('navigates to title screen on keypress', async ({ page }) => {
    await passPressStart(page);
    await expect(page.locator('#title-screen')).toBeVisible({ timeout: 4_000 });
  });

  test('navigates to title screen on click', async ({ page }) => {
    await page.goto('/');
    await page.locator('body').click();
    await expect(page.locator('#title-screen')).toBeVisible({ timeout: 4_000 });
  });
});

// ── Title Screen ──────────────────────────────────────────

test.describe('Title Screen', () => {
  test('loads and shows main elements', async ({ page }) => {
    await passPressStart(page);
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect(page.locator('.game-title')).toContainText('ECHOES OF');
    await expect(page.locator('#btn-start')).toBeVisible();
  });

  test('coin display is present', async ({ page }) => {
    await passPressStart(page);
    await expect(page.locator('#title-coin-display')).toBeVisible();
  });

  test('navigation buttons are present', async ({ page }) => {
    await passPressStart(page);
    await expect(page.locator('#btn-shop')).toBeVisible();
    await expect(page.locator('#btn-collection')).toBeVisible();
    await expect(page.locator('#btn-deckbuilder')).toBeVisible();
  });
});

// ── Game Screen ───────────────────────────────────────────

test.describe('Game Screen', () => {
  test('btn-start shows game screen', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-start');
    await expect(page.locator('#game-screen')).toBeVisible({ timeout: 8_000 });
  });

  test('renders field and UI panels', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#field')).toBeVisible();
    await expect(page.locator('#hand-area')).toBeVisible();
    await expect(page.locator('#action-bar')).toBeVisible();
    await expect(page.locator('#battle-log')).toBeVisible();
  });

  test('player starts at 8000 LP', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#player-lp')).toHaveText('8000');
  });

  test('opponent starts at 8000 LP', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#opp-lp')).toHaveText('8000');
  });

  test('phase display shows main phase on start', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#phase-name')).toContainText('Hauptphase');
  });

  test('player hand contains cards', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#player-hand .card').first()).toBeVisible({ timeout: 5_000 });
  });
});
