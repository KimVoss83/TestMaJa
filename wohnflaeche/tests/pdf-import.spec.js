import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.join(__dirname, 'fixtures', 'grundriss.pdf');

test('PDF laden → Hintergrundbild + pdfPage-Metadaten', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.fabric && window.pdfjsLib, null, { timeout: 20000 });
  await page.setInputFiles('#file-input', PDF);
  await expect(page.locator('#drop-overlay')).toHaveClass(/hidden/, { timeout: 20000 });
  const st = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return { hasBg: !!state.backgroundImage, pdf: state.pdfPage };
  });
  expect(st.hasBg).toBe(true);
  expect(st.pdf.widthPt).toBeGreaterThan(500);       // A4: 595 pt
  expect(st.pdf.renderedWidthPx).toBeGreaterThan(1500);
  expect(errors).toEqual([]);
});
