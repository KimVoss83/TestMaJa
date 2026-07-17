import { expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEMO = path.join(__dirname, '..', 'public', 'demo-plan.jpg');

// Hilfsfunktion: App laden, Onboarding weg, Maßstab programmatisch setzen (600px = 10m)
export async function setupApp(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  // Tutorial-Floating-Panel (main.js, gated nur ueber localStorage) unterdruecken:
  // es oeffnet sich sonst bei jedem frischen Browser-Kontext ungefragt und ueberlagert
  // den Canvas, wodurch Klicks der Mess-Werkzeuge verschluckt werden.
  await page.addInitScript(() => localStorage.setItem('gp_tut_seen', '1'));
  await page.goto('/');
  await page.waitForFunction(() => window.fabric && window.jspdf, null, { timeout: 20000 });
  await page.setInputFiles('#file-input', DEMO);
  await expect(page.locator('#drop-overlay')).toHaveClass(/hidden/, { timeout: 20000 });
  await page.locator('#onboarding-overlay').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('onboarding-overlay')?.remove());
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const ref = await import('/src/tools/ref.js');
    const pxLen = 600 / state.imgDisplayScale;
    state.refLines.push({ pxLen, realLen_m: 10 });
    state.scale = pxLen / 10; state.scaleSource = 'ref';
    ref.updateRefStatus();
  });
  return errors;
}
