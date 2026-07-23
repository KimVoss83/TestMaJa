import { test, expect } from '@playwright/test';
import { setupApp } from './helpers.js';

async function addRoomsProgrammatically(page) {
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { rebuildRooms, syncRoomIdCounter } = await import('/src/tools/room.js');
    // Canvas-px pro Meter: state.scale ist in Original-Bild-px/m kalibriert
    // (siehe ref.js), Polygone werden aber in Canvas-Display-px gespeichert
    // (wie echte Mausklicks sie liefern) — daher zusätzlich × imgDisplayScale.
    const s = state.scale * state.imgDisplayScale;
    const rect = (x, y, wM, hM) => [
      { x, y }, { x: x + wM * s, y }, { x: x + wM * s, y: y + hM * s }, { x, y: y + hM * s }];
    state.rooms = [
      { id: 1, name: 'Wohnzimmer', kind: 'wohnflaeche', category: 'normal',
        balkonFaktor: 0.25, polygon: rect(100, 100, 4, 3), zones: [], deductions: [] },
      { id: 2, name: 'Balkon', kind: 'wohnflaeche', category: 'balkon',
        balkonFaktor: 0.25, polygon: rect(600, 100, 2, 2), zones: [], deductions: [] },
      { id: 3, name: 'Keller', kind: 'zubehoer', category: 'normal',
        balkonFaktor: 0.25, polygon: rect(100, 500, 2, 2), zones: [], deductions: [] },
    ];
    syncRoomIdCounter(); rebuildRooms(); window.updateRoomList();
  });
}

test('Raumliste zeigt Räume und korrekte Summen', async ({ page }) => {
  await setupApp(page);
  await addRoomsProgrammatically(page);
  const list = page.locator('#room-list');
  await expect(list).toContainText('Wohnzimmer');
  await expect(list).toContainText('Balkon');
  await expect(list).toContainText('Keller');
  // Wohnfläche = 12 + 4·0,25 = 13,00 m²; Nutzfläche = 4,00 m²
  await expect(page.locator('#room-sums')).toContainText('13,00');
  await expect(page.locator('#room-sums')).toContainText('4,00');
  await expect(page.locator('#badge-raeume')).toHaveText('3');
});

test('XSS: bösartiger Raumname wird escaped', async ({ page }) => {
  await setupApp(page);
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    state.rooms = [{ id: 1, name: '<img src=x onerror="window.__xss=1">',
      kind: 'wohnflaeche', category: 'normal', balkonFaktor: 0.25,
      polygon: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], zones: [], deductions: [] }];
    window.updateRoomList();
  });
  const html = await page.evaluate(() => document.getElementById('room-list').innerHTML);
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img src=x onerror');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});
