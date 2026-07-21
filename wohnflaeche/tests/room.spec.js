import { test, expect } from '@playwright/test';
import { setupApp } from './helpers.js';

test('Raum zeichnen → state.rooms + korrektes Label', async ({ page }) => {
  await setupApp(page);
  const box = await page.locator('#c').boundingBox();
  await page.click('#btn-room');
  // 90°-Snap default: leicht schiefe Klicks müssen orthogonal einrasten
  await page.mouse.click(box.x + 300, box.y + 200); await page.waitForTimeout(100);
  await page.mouse.click(box.x + 600, box.y + 205); await page.waitForTimeout(100);
  await page.mouse.click(box.x + 597, box.y + 400); await page.waitForTimeout(100);
  await page.mouse.dblclick(box.x + 300, box.y + 398); await page.waitForTimeout(200);
  // Modal: Name eintragen, bestätigen
  await page.fill('#room-name', 'Wohnzimmer');
  await page.click('#modal-ok');
  const r = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { roomCalc } = await import('/src/woflv/calc.js');
    const room = state.rooms[0];
    return { n: state.rooms.length, name: room?.name, pts: room?.polygon.length,
             ortho: room ? room.polygon[0].y === room.polygon[1].y : false,
             m2: room ? roomCalc(room, state.scale).anrechenbar : 0 };
  });
  expect(r.n).toBe(1);
  expect(r.name).toBe('Wohnzimmer');
  expect(r.pts).toBe(4);
  expect(r.ortho).toBe(true);           // Snap hat gegriffen
  expect(r.m2).toBeGreaterThan(1);      // plausible Fläche
  // Canvas enthält Raum-Polygon + Label
  const objs = await page.evaluate(async () => {
    const { canvas } = await import('/src/canvas.js');
    return canvas.getObjects().filter(o => o._roomId != null).length;
  });
  expect(objs).toBeGreaterThanOrEqual(2); // Polygon + Label
});
