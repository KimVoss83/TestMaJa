// Erzeugt eine einseitige A4-PDF mit einem einfachen Grundriss-Rechteck.
// Aufruf: node tests/fixtures/make-fixture.mjs
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(`<div style="width:500px;height:350px;border:3px solid #000;
  margin:80px;position:relative;font-family:sans-serif;">
  <div style="position:absolute;top:10px;left:10px;">Grundriss-Fixture · Maßstab 1:100</div></div>`);
await p.pdf({ path: 'tests/fixtures/grundriss.pdf', format: 'A4' });
await b.close();
console.log('fixture geschrieben');
