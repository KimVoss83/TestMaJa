import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.join(__dirname, 'fixtures', 'grundriss.pdf');

test('PDF → 1:100 wählen → Maßstab exakt gesetzt', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.fabric && window.pdfjsLib, null, { timeout: 20000 });
  await page.setInputFiles('#file-input', PDF);
  await expect(page.locator('#drop-overlay')).toHaveClass(/hidden/, { timeout: 20000 });
  await page.locator('#onboarding-overlay').waitFor({ state: 'visible', timeout: 10000 });
  await page.click('#ob-scale-100');
  const st = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { scaleFromPrintScale } = await import('/src/woflv/calc.js');
    const expected = scaleFromPrintScale(100, state.pdfPage.widthPt, state.pdfPage.renderedWidthPx);
    return { scale: state.scale, expected, source: state.scaleSource, print: state.printScale };
  });
  expect(st.scale).toBeCloseTo(st.expected, 5);
  expect(st.source).toBe('pdf');
  expect(st.print).toBe(100);
  // Overlay weg, Mess-Buttons freigeschaltet
  await expect(page.locator('#onboarding-overlay')).toHaveCount(0);
  const gated = await page.evaluate(() =>
    document.getElementById('btn-distance').classList.contains('needs-ref'));
  expect(gated).toBe(false);
});
