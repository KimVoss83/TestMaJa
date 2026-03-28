import { state } from '../state.js';
import { formatErr } from '../utils/helpers.js';
import { createModal } from '../ui/modals.js';

// =========================================================
// EXIF / PHOTOGRAMMETRIE
// =========================================================

// Sensor-Datenbank: Kameramodell → Sensorbreite in mm
// Quellen: Herstellerspezifikationen / DJI, Sony, Hasselblad
export const SENSOR_DB = [
  // DJI (nach FC-Modellnummer, dann Klartextname)
  { keys:['FC3411','mini 3 pro'],             w:9.6,  h:7.2,  f:6.4,  imgW:4032, name:'DJI Mini 3 Pro' },
  { keys:['FC3681','dji flip','flip'],        w:9.6,  h:7.2,  f:6.7,  imgW:4032, name:'DJI Flip' },
  { keys:['FC3582','mavic 3 cine'],           w:17.3, h:13.0, f:12.3, imgW:5280, name:'DJI Mavic 3 Cine' },
  { keys:['FC3411','mavic 3'],                w:17.3, h:13.0, f:12.3, imgW:5280, name:'DJI Mavic 3' },
  { keys:['FC3170','mavic 3 classic'],        w:17.3, h:13.0, f:12.3, imgW:5280, name:'DJI Mavic 3 Classic' },
  { keys:['FC3371','mavic 3 enterprise'],     w:17.3, h:13.0, f:12.3, imgW:5280, name:'DJI Mavic 3E' },
  { keys:['FC7303','mavic 2 pro'],            w:13.2, h:8.8,  f:8.5,  imgW:5472, name:'DJI Mavic 2 Pro' },
  { keys:['FC2403','mavic air 2s'],           w:13.2, h:8.8,  f:8.1,  imgW:5472, name:'DJI Mavic Air 2S' },
  { keys:['FC2204','mavic air 2'],            w:6.4,  h:4.8,  f:6.2,  imgW:4000, name:'DJI Mavic Air 2' },
  { keys:['FC220', 'mavic pro'],              w:6.17, h:4.55, f:4.8,  imgW:4000, name:'DJI Mavic Pro' },
  { keys:['FC6310','phantom 4 pro'],          w:13.2, h:8.8,  f:8.8,  imgW:5472, name:'DJI Phantom 4 Pro' },
  { keys:['FC350', 'phantom 3 pro'],          w:6.17, h:4.55,                    name:'DJI Phantom 3 Pro' },
  { keys:['FC300', 'phantom 3 adv'],          w:6.17, h:4.55,                    name:'DJI Phantom 3 Adv' },
  { keys:['FC330', 'phantom 4'],              w:6.17, h:4.55,                    name:'DJI Phantom 4' },
  { keys:['FC300S','mini 2'],                 w:6.17, h:4.55, f:4.1,  imgW:4000, name:'DJI Mini 2' },
  { keys:['FC1102','mini'],                   w:6.17, h:4.55,                    name:'DJI Mini' },
  { keys:['FC550', 'inspire 1'],              w:8.8,  h:6.6,                     name:'DJI Inspire 1' },
  // Sony (gebräuchliche Drohnen-Payloads)
  { keys:['ilce-qx1'],                        w:23.2, h:15.4, name:'Sony ILCE-QX1' },
  { keys:['rx1'],                             w:35.8, h:23.9, name:'Sony RX1' },
  // Hasselblad
  { keys:['l1d-20c','hasselblad l1d'],        w:13.2, h:8.8,  f:12.3, imgW:5280, name:'Hasselblad L1D-20c' },
];

export function lookupSensor(make, model) {
  const haystack = `${(make||'')} ${(model||'')}`.toLowerCase();
  for (const entry of SENSOR_DB) {
    if (entry.keys.some(k => haystack.includes(k.toLowerCase()))) return entry;
  }
  return null;
}

// GSD = (H_m × Sw_mm) / (f_mm × iw_px)  →  m/px
export function calcGSD(altM, focalMM, sensorWidthMM, imgWidthPx) {
  return (altM * sensorWidthMM) / (focalMM * imgWidthPx);
}

// Erwartete Messgenauigkeit basierend auf GSD und Maßstab-Kalibrierquelle.
// Rückgabe: { gsd_cm, digitErr_cm, scaleErr_pct, err100m_cm }
// Modell:
//   Digitalisierungsfehler je 2-Punkt-Messung: ±√2 × GSD
//   Maßstabsfehler (EXIF/Form): barometrische Höhenungenauigkeit ±1 m → ε = 1/h
//   Maßstabsfehler (Referenzlinie): ±√2 × GSD / Referenzlänge
//   Gesamtfehler bei Distanz d: √(digitErr² + (d × ε)²)
export function calcAccuracy() {
  if (!state.scale) return null;
  const gsd_m = 1 / state.scale;
  const digitErr_m = Math.sqrt(2) * gsd_m;

  let scaleErr_pct;
  if ((state.scaleSource === 'exif' || state.scaleSource === 'form') && state.exifAltitude > 0) {
    scaleErr_pct = (1.0 / state.exifAltitude) * 100; // barometrische Unsicherheit ±1 m
  } else if (state.scaleSource === 'ref' && state.refSumL2 > 0) {
    // Kombinierter Maßstabsfehler aus allen Referenzlinien (KQ-Ausgleich):
    // σ = √2 × GSD / √(Σ Lᵢ²)
    scaleErr_pct = (Math.sqrt(2) * gsd_m / Math.sqrt(state.refSumL2)) * 100;
  } else {
    scaleErr_pct = 2.0; // konservativer Fallback
  }

  // Maßstabsfehler bei 100 m Messdistanz [m]: dist_m × (scaleErr_pct / 100)
  // Bei dist_m = 100: vereinfacht sich zu scaleErr_pct (numerisch gleich, aber korrekt dokumentiert)
  const scaleErr100_m = 100 * (scaleErr_pct / 100); // [m] – skaliert auf 100 m Distanz
  const err100m_m = Math.sqrt(digitErr_m ** 2 + scaleErr100_m ** 2); // Fehlerfortpflanzung [m]

  return {
    gsd_cm: gsd_m * 100,
    digitErr_cm: digitErr_m * 100,
    scaleErr_pct,
    err100m_cm: err100m_m * 100,
  };
}

// Was wird benötigt, um targetErr_m Genauigkeit bei dist_m Messdistanz zu erreichen?
// Rückgabe:
//   impossible: true  → GSD allein überschreitet Ziel (besseres Bild nötig)
//   reqSqrtSumL2      → benötigtes √(Σ Lᵢ²) in Metern
//   alreadyMet        → true wenn aktuelle Refs bereits ausreichen
//   suggestions       → [{n, len_m}] mögliche Ref-Konfigurationen
export function calcRequiredForTarget(targetErr_m = 0.10, dist_m = 100) {
  if (!state.scale) return null;
  const gsd_m = 1 / state.scale;
  const digitErr_m = Math.sqrt(2) * gsd_m;

  if (digitErr_m >= targetErr_m) {
    return {
      impossible: true,
      digitErr_m,
      reason: `Digitalisierungsfehler ${formatErr(digitErr_m)} übersteigt Ziel. Niedrigere Flughöhe / höher auflösendes Bild nötig.`,
    };
  }

  // Zulässiger Maßstabsfehler bei dist_m (quadratische Fehleraddition)
  const scaleErrBudget_m = Math.sqrt(targetErr_m ** 2 - digitErr_m ** 2);

  // scaleErr@dist_m = dist_m × √2 × GSD / √(ΣLi²)
  // → √(ΣLi²) ≥ dist_m × √2 × GSD / scaleErrBudget_m
  const reqSqrtSumL2 = dist_m * Math.sqrt(2) * gsd_m / scaleErrBudget_m;
  const currentSqrtSumL2 = Math.sqrt(state.refSumL2 || 0);
  const alreadyMet = currentSqrtSumL2 >= reqSqrtSumL2;

  // Mögliche Konfigurationen: 1–5 gleich lange Linien
  const suggestions = [1, 2, 3, 4].map(n => ({
    n,
    len_m: reqSqrtSumL2 / Math.sqrt(n),
  })).filter(s => s.len_m <= 500); // sinnvolle Obergrenze

  return { impossible: false, reqSqrtSumL2, currentSqrtSumL2, alreadyMet, suggestions, digitErr_m, scaleErrBudget_m };
}

// Maximale Flughöhe für Zielgenauigkeit T bei gegebener Kamera und Referenzlänge:
//   H_max = T / (g × √2 × √(1 + D²/L²))   mit g = sW/(f×imgW) [m/px pro m Höhe]
// Gibt Matrix distances × refLengths zurück (Werte in m, gecappt auf MAX_ALT).
export function calcFlightRecommendation(sW_mm, f_mm, imgW_px, targetErr_m = 0.10) {
  const g = (sW_mm / 1000) / (f_mm * imgW_px); // m/px per meter altitude
  const distances  = [20, 30, 50, 100]; // m — typische Messdistanzen Garten
  const refLengths = [5, 10, 15, 20];   // m — √(ΣLᵢ²) Referenzkombinationen
  const MAX_ALT = 120; // m — rechtliches Limit DE

  return distances.map(D =>
    refLengths.map(L => {
      const h = targetErr_m / (g * Math.sqrt(2) * Math.sqrt(1 + (D / L) ** 2));
      return Math.min(Math.round(h), MAX_ALT);
    })
  );
}

// Rendert die Flugempfehlungs-Matrix als HTML-Tabelle.
// highlightAlt: aktuelle Flughöhe zum Hervorheben (oder null).
export function flightRecommendationTableHTML(sW_mm, f_mm, imgW_px, cameraName, highlightAlt = null) {
  const matrix = calcFlightRecommendation(sW_mm, f_mm, imgW_px);
  const distances  = [20, 30, 50, 100];
  const refLengths = [5, 10, 15, 20];
  const MAX_ALT = 120;

  const cellColor = h => {
    if (h < 10)  return '#8e8e93'; // grau – nicht erreichbar
    if (h < 30)  return '#ff3b30'; // rot
    if (h < 60)  return '#ff9500'; // orange
    return '#34c759';               // grün
  };

  const cellStyle = h => {
    const color = cellColor(h);
    return `font-size:10.5px;font-weight:700;color:${color};text-align:right;padding:3px 5px;`;
  };

  const headerCellStyle = `font-size:10px;color:#8e8e93;text-align:right;padding:3px 5px;font-weight:400;`;
  const rowLabelStyle   = `font-size:10px;color:#636366;padding:3px 5px 3px 0;white-space:nowrap;`;

  const suffix = h => h >= MAX_ALT ? '*' : '';

  let rows = distances.map((D, di) => {
    const isNearAlt = highlightAlt != null && Math.abs(highlightAlt - (matrix[di][1] || 0)) < highlightAlt * 0.2;
    const rowBg = isNearAlt ? 'background:rgba(0,122,255,0.06);border-radius:4px;' : '';
    const cells = refLengths.map((L, li) => {
      const h = matrix[di][li];
      const val = h < 10 ? '–' : `${h} m${suffix(h)}`;
      return `<td style="${cellStyle(h)}">${val}</td>`;
    }).join('');
    return `<tr style="${rowBg}"><td style="${rowLabelStyle}">${D} m</td>${cells}</tr>`;
  }).join('');

  return `
    <div style="margin-top:10px;background:#f2f2f7;border-radius:10px;padding:10px 12px;">
      <div style="font-size:11px;font-weight:700;color:#1d1d1f;margin-bottom:6px;">
        Flugempfehlung${cameraName ? ` · ${cameraName}` : ''} – max. Höhe für ±10 cm
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${rowLabelStyle}font-weight:600;color:#1d1d1f;">Messdist.</th>
            ${refLengths.map(L => `<th style="${headerCellStyle}">Ref ${L} m</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="font-size:9.5px;color:#8e8e93;margin-top:4px;">
        * = auf 120 m (DE-Limit) begrenzt &nbsp;·&nbsp; Ref = √(ΣLᵢ²) kombinierter Referenzwert
      </div>
    </div>`;
}

// Absoluter Gesamtfehler [m] für eine Distanzmessung (2 Endpunkte).
// Setzt sich zusammen aus Digitalisierungsfehler + Maßstabsfehler.
export function distErr_m(dist_m) {
  const acc = calcAccuracy();
  if (!acc || dist_m == null) return null;
  const dig = acc.digitErr_cm / 100;                   // Digitalisierungsfehler [m]
  const scale = dist_m * acc.scaleErr_pct / 100;       // Maßstabsfehler [m]
  return Math.sqrt(dig ** 2 + scale ** 2);
}

// Relativer Gesamtfehler [%] für Flächenmessungen.
// Fläche skaliert quadratisch mit dem Maßstab → 2× relativer Maßstabsfehler.
// Digitalisierungsfehler bei Fläche: ±√2×GSD je Ecke, ~n Ecken → ε_digi_area klein.
export function areaRelErr_pct(area_m2, nPoints) {
  const acc = calcAccuracy();
  if (!acc || area_m2 == null) return null;
  const scaleRel = 2 * acc.scaleErr_pct;   // dominanter Term
  // Digitalisierungsbeitrag: ±GSD per Kante, über Umfang verteilt — vernachlässigbar
  return scaleRel;
}

// ── Accuracy Detail Panel ───────────────────────────────────────
export function showAccuracyDetail() {
  const panel = document.getElementById('acc-panel');
  const body  = document.getElementById('acc-panel-body');
  if (!state.scale) return;

  const acc    = calcAccuracy();
  const fmtL   = m => m >= 1 ? `${m.toFixed(1)} m` : `${(m * 100).toFixed(0)} cm`;
  const gsd_m  = 1 / state.scale;
  const gsdStr = acc.gsd_cm < 1 ? `${(acc.gsd_cm * 10).toFixed(2)} mm/px` : `${acc.gsd_cm.toFixed(2)} cm/px`;
  const err    = acc.err100m_cm;
  const errStr = err < 100 ? `±${err.toFixed(1)} cm` : `±${(err / 100).toFixed(2)} m`;
  const errColor = err <= 10 ? '#34c759' : err <= 20 ? '#ff9500' : '#ff3b30';

  // ── 1. Maßstabsquelle + Metadaten ──────────────────────────
  const metaHTML = document.getElementById('meta-content')?.innerHTML || '';
  const sourceSection = metaHTML
    ? `<div class="acc-section">
        <div class="acc-section-title">Bilddaten</div>
        <div class="acc-card">${metaHTML}</div>
       </div>`
    : '';

  // ── 2. Fehleranalyse ────────────────────────────────────────
  const n = state.refLines.length;
  let nextRefRow = '';
  if (state.scaleSource === 'ref' && n >= 1) {
    const minL      = Math.min(...state.refLines.map(r => r.realLen_m));
    const nextSumL2 = state.refSumL2 + minL ** 2;
    const nextErrPct  = (Math.sqrt(2) * gsd_m / Math.sqrt(nextSumL2)) * 100;
    const nextErr100  = Math.sqrt((acc.digitErr_cm / 100) ** 2 + nextErrPct ** 2) * 100;
    const nextStr     = nextErr100 < 100 ? `±${nextErr100.toFixed(1)} cm` : `±${(nextErr100 / 100).toFixed(2)} m`;
    const saving      = ((1 - nextErr100 / err) * 100).toFixed(0);
    nextRefRow = `<div class="acc-row" style="color:#8B3DFF;font-size:10.5px;">
      <span>+ 1 weitere Referenz</span><b>${nextStr} (−${saving}%)</b></div>`;
  }

  const errorSection =
    `<div class="acc-section">
      <div class="acc-section-title">Fehleranalyse</div>
      <div class="acc-card">
        <div class="acc-row"><span>Bodenauflösung (GSD)</span><b>${gsdStr}</b></div>
        <div class="acc-row"><span>Digitalisierungsfehler</span><b>±${acc.digitErr_cm.toFixed(2)} cm</b></div>
        <div class="acc-row"><span>Maßstabsfehler</span><b>±${acc.scaleErr_pct.toFixed(2)} %</b></div>
        ${nextRefRow}
        <div class="acc-total">
          <span>Gesamt bei 100 m</span>
          <span style="color:${errColor}">${errStr}</span>
        </div>
      </div>
    </div>`;

  // ── 3. Zielgenauigkeit ──────────────────────────────────────
  const req = calcRequiredForTarget(0.10, 100);
  let goalSection = '';
  if (req) {
    if (req.impossible) {
      goalSection =
        `<div class="acc-section">
          <div class="acc-section-title">Ziel ±10 cm bei 100 m</div>
          <div class="acc-goal-block impossible">
            <b style="color:#c0392b">Nicht erreichbar</b><br>
            ${req.reason}
          </div>
        </div>`;
    } else if (req.alreadyMet) {
      goalSection =
        `<div class="acc-section">
          <div class="acc-section-title">Ziel ±10 cm bei 100 m</div>
          <div class="acc-goal-block met">
            <b style="color:#1a7a35"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Bereits erreicht</b><br>
            Aktuelle Konfiguration erfüllt das Ziel.
          </div>
        </div>`;
    } else {
      const progress = req.currentSqrtSumL2 > 0
        ? `<div style="margin-bottom:5px;color:#636366;font-size:10.5px;">Aktuell: ${(req.currentSqrtSumL2 / req.reqSqrtSumL2 * 100).toFixed(0)} % erreicht</div>`
        : '';
      goalSection =
        `<div class="acc-section">
          <div class="acc-section-title">Für ±10 cm bei 100 m</div>
          <div class="acc-goal-block">
            ${progress}
            ${req.suggestions.slice(0, 3).map(s =>
              `<div>${s.n === 1 ? '1 Referenzlinie' : `${s.n} Ref. je`} <b>${fmtL(s.len_m)}</b></div>`
            ).join('')}
          </div>
        </div>`;
    }
  }

  // ── 4. Flugempfehlung ───────────────────────────────────────
  let flightSection = '';
  if (state.flightCam) {
    const { sW, f, imgW, name } = state.flightCam;
    flightSection =
      `<div class="acc-section">
        <div class="acc-section-title">Flugempfehlung</div>
        ${flightRecommendationTableHTML(sW, f, imgW, name, state.exifAltitude)}
      </div>`;
  }

  body.innerHTML = sourceSection + errorSection + goalSection + flightSection;
  panel.classList.add('open');
}

export function hideAccuracyDetail() {
  document.getElementById('acc-panel').classList.remove('open');
}

// Expose for inline onclick handlers
window.showAccuracyDetail = showAccuracyDetail;
