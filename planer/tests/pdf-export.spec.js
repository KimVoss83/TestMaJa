import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_IMAGE = path.join(__dirname, '..', 'public', 'demo-plan.jpg');

// Collect console/page errors so a broken render path (e.g. from the escaping
// changes) fails the test instead of silently passing.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test('PDF export produces a valid PDF file', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  // External libs (fabric + jsPDF) must load — also verifies SRI hashes are valid,
  // since a hash mismatch would block the script and leave these undefined.
  await page.waitForFunction(() => window.fabric && window.jspdf, null, { timeout: 20_000 });

  // Load a background image (doSavePDF bails out early without one).
  await page.setInputFiles('#file-input', DEMO_IMAGE);
  await expect(page.locator('#drop-overlay')).toHaveClass(/hidden/, { timeout: 20_000 });

  // Trigger the export. The hidden #btn-save-pdf is wired to doSavePDF().
  // In headless Chromium navigator.share is undefined, so it falls back to a download.
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await page.evaluate(() => document.getElementById('btn-save-pdf').click());
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('gartenplan.pdf');

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const buf = Buffer.concat(chunks);

  // Valid PDFs start with "%PDF-" and end with "%%EOF".
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buf.subarray(-1024).toString('latin1')).toContain('%%EOF');
  // A real rendered A4 page with an embedded 3× image is well over 10 KB.
  expect(buf.length).toBeGreaterThan(10_000);

  expect(errors, `unexpected console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('escHtml neutralizes HTML/attribute-breaking characters', async ({ page }) => {
  await page.goto('/');
  // Import the real helper module through the dev server (Vite serves ES modules).
  const out = await page.evaluate(async () => {
    const m = await import('/src/utils/helpers.js');
    return m.escHtml(`<img src=x onerror=alert(1)>"'&`);
  });
  expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
});

test('malicious measurement label from a loaded project does not execute', async ({ page }) => {
  await page.goto('/');
  const html = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const sidebar = await import('/src/ui/sidebar.js');
    // Simulate the label a crafted/shared project JSON could contain.
    state.measurements = [{ id: 1, type: 'distance', label: '<img src=x onerror="window.__xss=1">' }];
    sidebar.updateMeasurementList();
    return document.getElementById('measurements-list').innerHTML;
  });
  // Rendered as inert, escaped text — not a live <img> element.
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img src=x onerror');
  // The onerror handler must never have fired.
  const xss = await page.evaluate(() => window.__xss);
  expect(xss).toBeUndefined();
});
