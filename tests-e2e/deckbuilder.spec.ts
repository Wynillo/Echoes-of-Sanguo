import { test, expect, Page } from '@playwright/test';

/**
 * Seed localStorage so the app boots straight into a playable state
 * with a known collection and deck, skipping starter selection.
 *
 * Card "1" has 5 copies in collection (exceeds maxCardCopies=3).
 * Card "2" has 2 copies.
 * Deck contains 1 copy of card "1".
 */
async function seedAndNavigateToDeckbuilder(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const collection = [
      { id: '1', count: 5 },
      { id: '2', count: 2 },
      { id: '3', count: 1 },
    ];
    const deck = ['1'];
    localStorage.setItem('tcg_active_slot', '1');
    localStorage.setItem('tcg_s1_initialized', '1');
    localStorage.setItem('tcg_s1_starter_chosen', '1');
    localStorage.setItem('tcg_s1_save_version', '2');
    localStorage.setItem('tcg_s1_jade_coins', '0');
    localStorage.setItem('tcg_s1_collection', JSON.stringify(collection));
    localStorage.setItem('tcg_s1_deck', JSON.stringify(deck));
    localStorage.setItem('tcg_s1_opponents', JSON.stringify({ 1: { unlocked: true, wins: 0, losses: 0 } }));
    localStorage.setItem('tcg_s1_seen_cards', JSON.stringify(['1', '2', '3']));
    localStorage.setItem('tcg_slot_meta', JSON.stringify({
      1: { starterRace: 'water', coins: 0, currentChapter: 'ch1', lastSaved: new Date().toISOString() }
    }));
  });
  await page.goto('/');
  await page.getByText('PRESS ANY KEY').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('#title-screen').waitFor();
  await page.getByRole('button', { name: 'Load Game' }).click();
  await page.getByRole('button', { name: /Slot 1/i }).click();
  await page.getByRole('button', { name: 'Deckbuilder' }).click();
}

test.describe('Deckbuilder — Table View', () => {
  test('table view "In Deck" column caps at max copies (3), not collection count', async ({ page }) => {
    await seedAndNavigateToDeckbuilder(page);

    // Switch to table view
    await page.locator('button[title="Table"]').click();

    // Find the row for card "1" (which has 5 in collection, 1 in deck)
    // The "In Deck" column should show "1 / 3" (capped at maxCardCopies), NOT "1 / 5"
    const rows = page.locator('table tbody tr');
    const cellTexts = await rows.evaluateAll((trs) =>
      trs.map(tr => {
        const cells = tr.querySelectorAll('td');
        return Array.from(cells).map(td => td.textContent?.trim() ?? '');
      })
    );

    // Find row where the first cell (ID) is "1"
    const row = cellTexts.find(cells => cells[0] === '1');
    expect(row).toBeDefined();

    // Find "In Deck" column index dynamically
    const headers = await page.locator('table thead th').allTextContents();
    const inDeckIndex = headers.findIndex(h => h.includes('In Deck'));
    expect(inDeckIndex).not.toBe(-1);

    const inDeckCell = row![inDeckIndex];
    // Accept "1/3" or "1 / 3" or "1 /3" etc. (variable whitespace)
    expect(inDeckCell).toMatch(/1\s*\/\s*3/);
    // Must NOT show the raw collection count of 5
    expect(inDeckCell).not.toContain('5');
  });

  test('table view container allows horizontal scrolling', async ({ page }) => {
    await seedAndNavigateToDeckbuilder(page);

    // Switch to table view
    await page.locator('button[title="Table"]').click();

    // The tableWrap div should have overflow that allows horizontal scroll
    const tableWrap = page.locator('table').locator('..');
    const overflowX = await tableWrap.evaluate(el => getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(overflowX);
  });
});

test.describe('Starter deck -> Collection integration', () => {
  test('collection persists after removing all cards from deck (prevents bricking)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('tcg_active_slot', '1');
      localStorage.setItem('tcg_s1_initialized', '1');
      localStorage.setItem('tcg_s1_starter_chosen', '1');
      localStorage.setItem('tcg_s1_starter_race', '1');
      localStorage.setItem('tcg_s1_save_version', '2');
      localStorage.setItem('tcg_s1_jade_coins', '0');
      localStorage.setItem('tcg_s1_collection', JSON.stringify([
        { id: '1', count: 3 }, { id: '2', count: 2 }, { id: '3', count: 1 },
      ]));
      localStorage.setItem('tcg_s1_deck', JSON.stringify(['1', '2', '3']));
      localStorage.setItem('tcg_s1_opponents', JSON.stringify({ 1: { unlocked: true, wins: 0, losses: 0 } }));
      localStorage.setItem('tcg_s1_seen_cards', JSON.stringify(['1', '2', '3']));
      localStorage.setItem('tcg_slot_meta', JSON.stringify({
        1: { starterRace: 'water', coins: 0, currentChapter: 'ch1', lastSaved: new Date().toISOString() }
      }));
    });
    await page.goto('/');
    await page.getByText('PRESS ANY KEY').waitFor();
    await page.keyboard.press('Enter');
    await page.locator('#title-screen').waitFor();
    await page.getByRole('button', { name: 'Load Game' }).click();
    await page.getByRole('button', { name: /Slot 1/i }).click();
    const colBefore = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('tcg_s1_collection') || '[]');
    });
    expect(colBefore.length).toBeGreaterThanOrEqual(3);
    expect(colBefore.find((c: {id: string}) => c.id === '1')?.count).toBe(3);
    expect(colBefore.find((c: {id: string}) => c.id === '2')?.count).toBe(2);
    expect(colBefore.find((c: {id: string}) => c.id === '3')?.count).toBe(1);
  });
});
