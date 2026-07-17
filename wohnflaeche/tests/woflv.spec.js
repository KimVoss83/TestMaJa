import { test, expect } from '@playwright/test';

async function calc(page) {
  await page.goto('/');
  return (fn, ...args) => page.evaluate(
    async ({ fn, args }) => {
      const m = await import('/src/woflv/calc.js');
      return m[fn](...args);
    }, { fn, args });
}

// Rechteck 400×300 px, scale 100 px/m → 4×3 m = 12 m²
const RECT = [{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}];
const room = (over = {}) => ({ id:1, name:'Test', kind:'wohnflaeche', category:'normal',
  balkonFaktor:0.25, polygon:RECT, zones:[], deductions:[], ...over });

test('Rohfläche: Shoelace + scale²', async ({ page }) => {
  const c = await calc(page);
  expect(await c('shoelace', RECT)).toBe(120000);
  const r = await c('roomCalc', room(), 100);
  expect(r.roh).toBeCloseTo(12, 5);
  expect(r.anrechenbar).toBeCloseTo(12, 5);
});

test('50%-Zone reduziert anrechenbare Fläche', async ({ page }) => {
  const c = await calc(page);
  // Zone = halber Raum (400×150) → 6 m² · 0,5 = 3 m² → gesamt 6 + 3 = 9 m²
  const z = [{x:0,y:0},{x:400,y:0},{x:400,y:150},{x:0,y:150}];
  const r = await c('roomCalc', room({ zones:[{ polygon:z, height:'1bis2m' }] }), 100);
  expect(r.zone50).toBeCloseTo(6, 1);
  expect(r.anrechenbar).toBeCloseTo(9, 1);
});

test('0%-Zone zählt gar nicht', async ({ page }) => {
  const c = await calc(page);
  const z = [{x:0,y:0},{x:400,y:0},{x:400,y:150},{x:0,y:150}];
  const r = await c('roomCalc', room({ zones:[{ polygon:z, height:'unter1m' }] }), 100);
  expect(r.anrechenbar).toBeCloseTo(6, 1);
});

test('Zone wird am Raum geclippt', async ({ page }) => {
  const c = await calc(page);
  // Zone ragt komplett rechts raus: nur die Hälfte liegt im Raum
  const z = [{x:200,y:0},{x:600,y:0},{x:600,y:300},{x:200,y:300}];
  const r = await c('roomCalc', room({ zones:[{ polygon:z, height:'unter1m' }] }), 100);
  expect(r.zone0).toBeCloseTo(6, 1);   // nicht 12
});

test('Abzug ≤ 0,1 m² wird ignoriert (§3(3))', async ({ page }) => {
  const c = await calc(page);
  const small = [{x:0,y:0},{x:30,y:0},{x:30,y:30},{x:0,y:30}];   // 0,09 m²
  const big   = [{x:100,y:100},{x:150,y:100},{x:150,y:150},{x:100,y:150}]; // 0,25 m²
  const r = await c('roomCalc', room({ deductions:[{polygon:small,label:'s'},{polygon:big,label:'b'}] }), 100);
  expect(r.abzugSum).toBeCloseTo(0.25, 2);
});

test('Balkonfaktor: default 0,25 und Clamp auf 0,5', async ({ page }) => {
  const c = await calc(page);
  const b = await c('roomCalc', room({ category:'balkon' }), 100);
  expect(b.anrechenbar).toBeCloseTo(3, 5);          // 12 · 0,25
  const b2 = await c('roomCalc', room({ category:'balkon', balkonFaktor:0.9 }), 100);
  expect(b2.anrechenbar).toBeCloseTo(6, 5);         // clamp 0,5
});

test('Zubehör zählt 0, erscheint als Nutzfläche', async ({ page }) => {
  const c = await calc(page);
  const t = await c('totals', [room(), room({ id:2, kind:'zubehoer', name:'Keller' })], 100);
  expect(t.wohnflaeche).toBeCloseTo(12, 5);
  expect(t.nutzflaeche).toBeCloseTo(12, 5);
});

test('scaleFromPrintScale: A4 quer 1:100', async ({ page }) => {
  const c = await calc(page);
  // A4-Breite 595,28 pt = 0,20999 m Papier → bei 1:100 = 20,999 m real; 2380 px gerendert
  expect(await c('scaleFromPrintScale', 100, 595.28, 2380)).toBeCloseTo(113.34, 1);
});
