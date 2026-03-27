import { state } from '../state.js';
import { showToast, createModal } from './modals.js';
import { formatArea, formatDistance } from '../utils/helpers.js';

// Local copy of calcAccuracy (only depends on state)
function calcAccuracy() {
  if (!state.scale) return null;
  const gsd_m = 1 / state.scale;
  const digitErr_m = Math.sqrt(2) * gsd_m;

  let scaleErr_pct;
  if ((state.scaleSource === 'exif' || state.scaleSource === 'form') && state.exifAltitude > 0) {
    scaleErr_pct = (1.0 / state.exifAltitude) * 100;
  } else if (state.scaleSource === 'ref' && state.refSumL2 > 0) {
    scaleErr_pct = (Math.sqrt(2) * gsd_m / Math.sqrt(state.refSumL2)) * 100;
  } else {
    scaleErr_pct = 2.0;
  }

  const scaleErr100_m = 100 * (scaleErr_pct / 100);
  const err100m_m = Math.sqrt(digitErr_m ** 2 + scaleErr100_m ** 2);

  return {
    gsd_cm: gsd_m * 100,
    digitErr_cm: digitErr_m * 100,
    scaleErr_pct,
    err100m_cm: err100m_m * 100,
  };
}

// Relativer Gesamtfehler [%] für Flächenmessungen.
function areaRelErr_pct(area_m2, nPoints) {
  const acc = calcAccuracy();
  if (!acc || area_m2 == null) return null;
  const scaleRel = 2 * acc.scaleErr_pct;
  return scaleRel;
}

export const MATERIALS = {
  // ── Dachfläche ──
  dachflaeche: {
    label: 'Dachfläche berechnen', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', types: ['area'],
    fields: [
      {
        key: 'typ', label: 'Dachtyp', type: 'select', default: 'sattel',
        options: [
          { value: 'sattel', label: 'Satteldach' },
          { value: 'pult',   label: 'Pultdach' },
          { value: 'walm',   label: 'Walmdach (Näherung)' },
          { value: 'flach',  label: 'Flachdach (< 5°)' },
        ]
      },
      { key: 'angle', label: 'Dachneigung (°)', type: 'number', min: 0, max: 75, default: 30, step: 0.5 },
      { key: 'sigma', label: 'Winkelmesstoleranz (±°)', type: 'number', min: 0.5, max: 5, default: 1, step: 0.5 },
    ],
    calc: (area, f) => {
      const alpha     = Math.max(0, Math.min(75, f.angle)) * Math.PI / 180;
      const sigmaAlpha = (f.sigma || 1) * Math.PI / 180;
      const cosA = Math.cos(alpha);
      const tanA = Math.tan(alpha);

      // Tatsächliche Dachfläche
      const A_dach = cosA > 0.001 ? area / cosA : area;

      // Fehlerfortpflanzung:
      // A_dach = A_proj / cos(α)
      // σ_A/A = √( (σ_proj/A_proj)² + (tan(α)·σ_α)² )
      const areaRelErr   = areaRelErr_pct(area, 4) || 0;
      const rel_proj     = areaRelErr / 100;            // Maßstabsfehler-Anteil
      const rel_angle    = tanA * sigmaAlpha;            // Winkelfehler-Anteil
      const rel_total    = Math.sqrt(rel_proj ** 2 + rel_angle ** 2);
      const sigma_dach   = A_dach * rel_total;

      const zuschlag = cosA > 0.001 ? ((1 / cosA - 1) * 100).toFixed(1) : '0.0';
      const faktor   = cosA > 0.001 ? (1 / cosA).toFixed(4) : '1.0000';

      const typeNote = {
        sattel: null,
        pult:   null,
        walm:   'Walmdach-Näherung: Formel gilt exakt nur, wenn alle Dachflächen dieselbe Neigung haben. Gültig als gute Näherung bei symmetrischen Walmdächern.',
        flach:  'Flachdach: Schrägflächenzuschlag < 0,4 % – Grundrissfläche entspricht praktisch der Dachfläche. Ein Winkel kann dennoch gesetzt werden.',
      }[f.typ] || null;

      return {
        results: [
          { label: 'Grundrissfläche (gemessen)',         value: formatArea(area) },
          { label: 'Dachneigung',                        value: `${f.angle}°` },
          { label: 'Schrägfaktor (×1/cos α)',            value: `${faktor}  (+${zuschlag} %)` },
          { label: '─────────────────',                  value: '' },
          { label: 'Tatsächliche Dachfläche',            value: formatArea(A_dach) },
          { label: 'Messfehler ±1σ',                     value: `± ${formatArea(sigma_dach)} (${(rel_total * 100).toFixed(1)} %)` },
          { label: '  └ Maßstabsfehler',                 value: `${(rel_proj * 100).toFixed(1)} %` },
          { label: `  └ Winkelfehler (±${f.sigma}°)`,   value: `${(rel_angle * 100).toFixed(1)} %` },
          { label: 'Dachfläche (konservativ +2σ)',       value: formatArea(A_dach + 2 * sigma_dach) },
        ],
        note: typeNote,
      };
    }
  },

  // ── Flächen-Materialien ──
  kies: {
    label: 'Kies / Schotter', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="16" r="4"/><circle cx="16" cy="14" r="3"/><circle cx="12" cy="8" r="3.5"/></svg>', types: ['area', 'circle', 'arc'],
    fields: [{ key: 'depth', label: 'Schichtdicke (cm)', type: 'number', min: 1, max: 100, default: 5 }],
    calc: (area, f) => {
      const vol = area * (f.depth / 100) * 1.05;
      const weight = vol * 1.6;
      return { results: [
        { label: 'Volumen', value: vol.toFixed(2) + ' m³' },
        { label: 'Gewicht', value: '≈ ' + weight.toFixed(2) + ' t' }
      ], note: 'Inkl. 5 % Zugabe. Schüttdichte ≈ 1,6 t/m³.' };
    }
  },
  pflaster: {
    label: 'Pflastersteine', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>', types: ['area', 'circle', 'arc'],
    fields: [
      { key: 'stoneW', label: 'Steinbreite (cm)', type: 'number', min: 5, max: 60, default: 20 },
      { key: 'stoneH', label: 'Steinlänge (cm)', type: 'number', min: 5, max: 60, default: 10 }
    ],
    calc: (area, f) => {
      const stoneArea = (f.stoneW / 100) * (f.stoneH / 100);
      const count = Math.ceil(area / stoneArea * 1.05);
      const sandVol = area * 0.04 * 1.05;
      const schotterVol = area * 0.15 * 1.05;
      return { results: [
        { label: 'Pflastersteine', value: count + ' Stück' },
        { label: 'Bettungssand (4 cm)', value: sandVol.toFixed(2) + ' m³' },
        { label: 'Schottertragschicht (15 cm)', value: schotterVol.toFixed(2) + ' m³' }
      ], note: 'Inkl. 5 % Zugabe + Verschnitt.' };
    }
  },
  rollrasen: {
    label: 'Rollrasen', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 5.2C9.2 4 10.5 3 12 3s2.8 1 4 2.2"/></svg>', types: ['area', 'circle', 'arc'],
    fields: [],
    calc: (area) => {
      const rollen = Math.ceil(area * 1.05);
      return { results: [
        { label: 'Rollrasen', value: rollen + ' m² (Rollen)' }
      ], note: 'Inkl. 5 % Zugabe. Standard-Rolle = 1 m².' };
    }
  },
  rasensaat: {
    label: 'Rasensaat', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M12 20V10"/><path d="M12 10c-2-3-6-4-8-2"/><path d="M12 10c2-3 6-4 8-2"/></svg>', types: ['area', 'circle', 'arc'],
    fields: [{ key: 'seedType', label: 'Art', type: 'select', options: [
      { value: 'neu', label: 'Neuansaat (30 g/m²)' },
      { value: 'nach', label: 'Nachsaat (20 g/m²)' },
      { value: 'schatten', label: 'Schattenrasen (35 g/m²)' }
    ], default: 'neu' }],
    calc: (area, f) => {
      const rates = { neu: 30, nach: 20, schatten: 35 };
      const grams = area * (rates[f.seedType] || 30);
      const kg = grams / 1000;
      return { results: [
        { label: 'Saatgut', value: kg.toFixed(2) + ' kg' },
        { label: 'Fläche', value: area.toFixed(2) + ' m²' }
      ], note: rates[f.seedType] + ' g/m² empfohlen.' };
    }
  },
  rindenmulch: {
    label: 'Rindenmulch', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16v8H4z"/><path d="M4 12h16"/><path d="M8 8v8"/><path d="M16 8v8"/></svg>', types: ['area', 'circle', 'arc'],
    fields: [{ key: 'depth', label: 'Schichtdicke (cm)', type: 'number', min: 3, max: 20, default: 7 }],
    calc: (area, f) => {
      const vol = area * (f.depth / 100) * 1.05;
      const saecke = Math.ceil(vol * 1000 / 60);
      return { results: [
        { label: 'Volumen', value: vol.toFixed(2) + ' m³' },
        { label: 'Säcke (60 L)', value: saecke + ' Stück' }
      ], note: 'Inkl. 5 % Zugabe.' };
    }
  },
  erde: {
    label: 'Erde / Mutterboden', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h20"/><path d="M2 16c3-2 5 0 8-2s5 0 8-2v8H2z"/><path d="M6 12a3 3 0 1 1 6 0"/></svg>', types: ['area', 'circle', 'arc'],
    fields: [{ key: 'depth', label: 'Schichtdicke (cm)', type: 'number', min: 1, max: 100, default: 10 }],
    calc: (area, f) => {
      const vol = area * (f.depth / 100) * 1.05;
      const weight = vol * 1.3;
      return { results: [
        { label: 'Volumen', value: vol.toFixed(2) + ' m³' },
        { label: 'Gewicht', value: '≈ ' + weight.toFixed(2) + ' t' }
      ], note: 'Inkl. 5 % Zugabe. Dichte ≈ 1,3 t/m³.' };
    }
  },
  vlies: {
    label: 'Unkrautvlies', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 12h20"/><path d="M12 6v12"/></svg>', types: ['area', 'circle', 'arc'],
    fields: [{ key: 'bahnbreite', label: 'Bahnbreite (m)', type: 'number', min: 0.5, max: 5, default: 1, step: 0.1 }],
    calc: (area, f) => {
      const bw = f.bahnbreite || 1;
      const lm = area / bw * 1.1;
      const rollen = Math.ceil(lm / 25);
      return { results: [
        { label: 'Laufmeter', value: lm.toFixed(1) + ' m' },
        { label: 'Rollen (25 m)', value: rollen + ' Stück' }
      ], note: 'Inkl. 10 % Überlappung.' };
    }
  },
  // ── Strecken-Materialien ──
  zaun: {
    label: 'Zaun', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="M12 4v16"/><path d="M20 4v16"/><path d="M4 8h16"/><path d="M4 16h16"/></svg>', types: ['distance'],
    fields: [
      { key: 'spacing', label: 'Pfostenabstand (m)', type: 'number', min: 0.5, max: 5, default: 2, step: 0.1 },
      { key: 'height', label: 'Zaunhöhe (m)', type: 'number', min: 0.5, max: 3, default: 1.2, step: 0.1 },
      { key: 'fenceType', label: 'Typ', type: 'select', options: [
        { value: 'draht', label: 'Maschendraht' },
        { value: 'latten', label: 'Holzlatten (ca. 10 cm breit)' },
        { value: 'doppelstab', label: 'Doppelstabmatten (2,51 m)' }
      ], default: 'draht' }
    ],
    calc: (length, f) => {
      const pfosten = Math.ceil(length / f.spacing) + 1;
      const results = [{ label: 'Pfosten', value: pfosten + ' Stück' }];
      if (f.fenceType === 'draht') {
        results.push({ label: 'Maschendraht', value: length.toFixed(1) + ' m (Rolle)' });
      } else if (f.fenceType === 'latten') {
        const latten = Math.ceil(length / 0.12);
        results.push({ label: 'Latten', value: latten + ' Stück' });
      } else if (f.fenceType === 'doppelstab') {
        const matten = Math.ceil(length / 2.51);
        results.push({ label: 'Doppelstabmatten', value: matten + ' Stück' });
      }
      results.push({ label: 'Zaunhöhe', value: f.height.toFixed(1) + ' m' });
      return { results, note: 'Pfosten inkl. Start- und Endpfosten.' };
    }
  },
  rasenkante: {
    label: 'Rasenkante / Beeteinfassung', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M4 20V4"/><path d="M4 20L20 4"/></svg>', types: ['distance'],
    fields: [{ key: 'kanteType', label: 'Material', type: 'select', options: [
      { value: 'metall', label: 'Metall (1 m Stücke)' },
      { value: 'stein', label: 'Rasenkantensteine (1 m)' },
      { value: 'palisade', label: 'Palisaden (25 cm breit)' }
    ], default: 'metall' }],
    calc: (length, f) => {
      const sizes = { metall: 1, stein: 1, palisade: 0.25 };
      const count = Math.ceil(length / sizes[f.kanteType]);
      const labels = { metall: 'Metallkanten', stein: 'Kantensteine', palisade: 'Palisaden' };
      return { results: [
        { label: labels[f.kanteType], value: count + ' Stück' }
      ], note: '' };
    }
  },
  hochbeet: {
    label: 'Hochbeet-Bretter', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="M4 14h16"/></svg>', types: ['distance'],
    fields: [
      { key: 'height', label: 'Hochbeet-Höhe (cm)', type: 'number', min: 20, max: 120, default: 80 },
      { key: 'brettbreite', label: 'Brettbreite (cm)', type: 'number', min: 10, max: 40, default: 20 }
    ],
    calc: (length, f) => {
      const reihen = Math.ceil(f.height / f.brettbreite);
      const lm = length * reihen;
      return { results: [
        { label: 'Brettreihen', value: reihen + ' übereinander' },
        { label: 'Laufmeter Bretter', value: lm.toFixed(1) + ' m' }
      ], note: 'Umfang × Reihen. Eckpfosten separat.' };
    }
  },
  rohr: {
    label: 'Entwässerungsrohr', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/><circle cx="4" cy="12" r="2"/><circle cx="20" cy="12" r="2"/><path d="M8 8v8"/><path d="M16 8v8"/></svg>', types: ['distance'],
    fields: [{ key: 'diameter', label: 'Durchmesser (mm)', type: 'select', options: [
      { value: '50', label: 'DN 50' },
      { value: '75', label: 'DN 75' },
      { value: '100', label: 'DN 100' },
      { value: '150', label: 'DN 150' }
    ], default: '100' }],
    calc: (length, f) => {
      const rohrLaenge = 1; // 1m Standardrohre
      const rohre = Math.ceil(length / rohrLaenge);
      const verbinder = rohre > 1 ? rohre - 1 : 0;
      return { results: [
        { label: 'Rohre (DN ' + f.diameter + ', 1 m)', value: rohre + ' Stück' },
        { label: 'Verbinder/Muffen', value: verbinder + ' Stück' }
      ], note: '' };
    }
  },
  // ── Kreis-Einfassung ──
  einfassung: {
    label: 'Umrandung / Einfassung', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/></svg>', types: ['circle'],
    fields: [{ key: 'einfType', label: 'Material', type: 'select', options: [
      { value: 'metall', label: 'Metallkante (1 m)' },
      { value: 'stein', label: 'Randsteine (50 cm)' },
      { value: 'palisade', label: 'Palisaden (25 cm)' }
    ], default: 'stein' }],
    calc: (_area, f, m) => {
      const circumference = 2 * Math.PI * m.rMeters;
      const sizes = { metall: 1, stein: 0.5, palisade: 0.25 };
      const count = Math.ceil(circumference / sizes[f.einfType]);
      const labels = { metall: 'Metallkanten', stein: 'Randsteine', palisade: 'Palisaden' };
      return { results: [
        { label: 'Umfang', value: circumference.toFixed(2) + ' m' },
        { label: labels[f.einfType], value: count + ' Stück' }
      ], note: '' };
    }
  }
};

export function openMaterialCalc(id) {
  const m = state.measurements.find(x => x.id === id);
  if (!m) return;
  if (!state.scale) {
    showToast('Bitte zuerst einen Maßstab setzen!', 'warning');
    return;
  }
  if (m.value < 0.01) {
    showToast('Messung zu klein für eine Materialberechnung.', 'warning'); return;
  }

  const isArea = m.type === 'area' || m.type === 'circle' || m.type === 'arc';
  const isDistance = m.type === 'distance';
  const isCircle = m.type === 'circle';

  // Filter materials for this measurement type
  const available = Object.entries(MATERIALS).filter(([, mat]) => mat.types.includes(m.type));
  // For circles, also include area materials
  const extraArea = isCircle ? Object.entries(MATERIALS).filter(([k, mat]) =>
    mat.types.includes('area') && !available.find(([ak]) => ak === k)
  ) : [];
  const allMats = [...available, ...extraArea];

  if (!allMats.length) { showToast('Kein Material für diesen Messtyp verfügbar.', 'info'); return; }

  const valueDisplay = isArea || isCircle || m.type === 'arc'
    ? formatArea(m.value) : formatDistance(m.value);

  const optionsHTML = allMats.map(([k, mat]) =>
    `<option value="${k}">${mat.label}</option>`
  ).join('');

  const bodyHTML = `
    <p style="margin-bottom:8px"><strong>Messung:</strong> ${valueDisplay}</p>
    <label style="font-size:12px;color:#636366;display:block;margin-bottom:3px">Material wählen:</label>
    <select id="calc-material">${optionsHTML}</select>
    <div id="calc-hint"></div>
    <div id="calc-fields"></div>
    <div id="calc-results" style="margin-top:8px"></div>
  `;

  const overlay = createModal('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>Materialrechner', bodyHTML, () => {}, () => {});

  // Replace OK button with "Berechnen"
  const okBtn = overlay.querySelector('#modal-ok');
  okBtn.textContent = 'Berechnen';

  // Replace cancel with "Schließen"
  const cancelBtn = overlay.querySelector('#modal-cancel');
  cancelBtn.textContent = 'Schließen';

  const matSelect = overlay.querySelector('#calc-material');
  const fieldsDiv = overlay.querySelector('#calc-fields');
  const resultsDiv = overlay.querySelector('#calc-results');

  const DACH_HINTS = {
    sattel: {
      rows: [
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', text: '<b>Gesamten Grundriss</b> einzeichnen – beide Dachhälften zusammen. Die Formel teilt automatisch korrekt auf.' },
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', text: 'Nicht jede Dachseite einzeln messen – gleiches Ergebnis, aber doppelter Digitalisierungsfehler.' },
      ],
      diagram:
        '   First\n' +
        '  /─────\\\n' +
        ' / Mess- \\\n' +
        '/  fläche \\\n' +
        '└──────────┘\n' +
        '  Grundriss (beide Seiten!)',
    },
    pult: {
      rows: [
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', text: '<b>Gesamte Grundrissfläche</b> einzeichnen. Eine Neigung → eine Messung.' },
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>', text: 'Der Dachüberstand sollte mit einbezogen werden.' },
      ],
      diagram:
        '──────────┐\n' +
        '  Mess-   │\n' +
        '  fläche  │\n' +
        '──────────┘\n' +
        '(gesamter Grundriss)',
    },
    walm: {
      rows: [
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', text: '<b>Gesamten Grundriss</b> als ein Polygon messen.' },
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', text: 'Haben Haupt- und Hüftflächen <b>unterschiedliche Neigungen</b>: Flächen separat messen und addieren.' },
      ],
      diagram:
        '   /─────\\\n' +
        '  / Mess- \\\n' +
        ' /  fläche \\\n' +
        '/────────────\\\n' +
        '\\            /\n' +
        ' └──────────┘\n' +
        '(inkl. Hüftflächen)',
    },
    flach: {
      rows: [
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', text: 'Gesamten Grundriss einzeichnen – Schrägflächenzuschlag ist bei < 5° minimal (< 0,4 %).' },
        { ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>', text: 'Für Flachdächer ist die Korrekturfaktor-Rechnung oft nicht nötig.' },
      ],
      diagram: null,
    },
  };

  function updateHint() {
    const hintDiv = overlay.querySelector('#calc-hint');
    if (!hintDiv) return;
    const matKey = matSelect.value;
    if (matKey !== 'dachflaeche') { hintDiv.innerHTML = ''; return; }
    const typEl = fieldsDiv.querySelector('[data-field="typ"]');
    const typ = typEl ? typEl.value : 'sattel';
    const h = DACH_HINTS[typ] || DACH_HINTS.sattel;
    const rows = h.rows.map(r =>
      `<div class="calc-hint-row"><span class="calc-hint-ico">${r.ico}</span><span>${r.text}</span></div>`
    ).join('');
    const diag = h.diagram
      ? `<div class="calc-hint-diagram">${h.diagram}</div>` : '';
    hintDiv.innerHTML = `<div class="calc-hint">${rows}${diag}</div>`;
  }

  function renderFields() {
    const matKey = matSelect.value;
    const mat = MATERIALS[matKey];
    fieldsDiv.innerHTML = mat.fields.map(f => {
      if (f.type === 'select') {
        const opts = f.options.map(o =>
          `<option value="${o.value}"${o.value === f.default ? ' selected' : ''}>${o.label}</option>`
        ).join('');
        return `<label style="font-size:12px;color:#636366;display:block;margin-bottom:3px;margin-top:6px">${f.label}</label>
                <select data-field="${f.key}">${opts}</select>`;
      }
      return `<label style="font-size:12px;color:#636366;display:block;margin-bottom:3px;margin-top:6px">${f.label}</label>
              <input type="number" data-field="${f.key}" value="${f.default}" min="${f.min}" max="${f.max}"${f.step ? ' step="' + f.step + '"' : ''}>`;
    }).join('');
    resultsDiv.innerHTML = '';
    updateHint();
    // Update hint when Dachtyp changes
    const typEl = fieldsDiv.querySelector('[data-field="typ"]');
    if (typEl) typEl.addEventListener('change', updateHint);
  }

  matSelect.addEventListener('change', renderFields);
  renderFields();

  // Override OK to calculate instead of close
  let done = false;
  okBtn.onclick = () => {
    const matKey = matSelect.value;
    const mat = MATERIALS[matKey];
    const fieldValues = {};
    mat.fields.forEach(f => {
      const el = fieldsDiv.querySelector(`[data-field="${f.key}"]`);
      fieldValues[f.key] = f.type === 'number' ? parseFloat(el.value) : el.value;
    });

    const result = mat.calc(m.value, fieldValues, m);
    let html = result.results.map(r =>
      r.label.startsWith('─')
        ? `<div style="border-top:1px solid #e5e7eb;margin:6px 0;"></div>`
        : `<div class="calc-result-row"><span class="calc-result-label">${r.label}</span><span class="calc-result-value">${r.value}</span></div>`
    ).join('');
    if (result.note) html += `<div class="calc-note">${result.note}</div>`;

    const copyText = result.results.map(r => r.label + ': ' + r.value).join('\n')
      + (result.note ? '\n(' + result.note + ')' : '');
    html += `<button class="calc-copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(copyText).replace(/"/g, '&quot;')}).then(()=>{this.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2.5\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg> Kopiert!';setTimeout(()=>{this.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'/><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'/></svg> Ergebnis kopieren'},1500)})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Ergebnis kopieren</button>`;

    resultsDiv.innerHTML = html;
  };

  // Prevent Enter from closing modal
  overlay.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); okBtn.click(); }
    if (e.key === 'Escape') { e.preventDefault(); if (!done) { done = true; document.body.removeChild(overlay); } }
  };
}

// Expose on window for inline onclick handlers in HTML
window.openMaterialCalc = openMaterialCalc;
