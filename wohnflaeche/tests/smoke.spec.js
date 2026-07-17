import { test, expect } from '@playwright/test';
import { setupApp } from './helpers.js';

test('Kern-Werkzeuge funktionieren ohne Runtime-Fehler', async ({ page }) => {
  const errors = await setupApp(page);
  const box = await page.locator('#c').boundingBox();
  const P = async (x, y) => { await page.mouse.click(box.x + x, box.y + y); await page.waitForTimeout(100); };

  await page.click('#btn-distance'); await P(200, 250); await P(800, 250);
  await page.click('#btn-area'); await P(200, 320); await P(500, 320); await P(500, 450);
  await page.mouse.dblclick(box.x + 200, box.y + 450); await page.waitForTimeout(150);
  await page.click('#btn-circle'); await P(700, 350); await P(760, 350);
  await page.click('#btn-select'); await page.click('#btn-undo'); await page.click('#btn-redo');

  const n = await page.evaluate(async () => (await import('/src/state.js')).state.measurements.length);
  expect(n).toBeGreaterThanOrEqual(3);
  expect(errors, errors.join('\n')).toEqual([]);
});
