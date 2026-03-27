import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addLabel, addEndpointDot, addRefEndmarks, formatDistance, ptDist, snapToPixel } from '../utils/helpers.js';
import { createModal } from '../ui/modals.js';
import { TOOL_HINTS, updateMeasureButtons } from './tool-manager.js';
import { calcAccuracy, calcFlightRecommendation, flightRecommendationTableHTML, showAccuracyDetail, hideAccuracyDetail, distErr_m } from '../io/photogrammetry.js';

// =========================================================
// REFERENCE TOOL
// =========================================================
export function handleRefClick(p) {
  if (state.refPoints.length === 0) {
    state.refPoints = [p];
    document.getElementById('status-hint').textContent = 'Endpunkt klicken …';
    addEndpointDot(p.x, p.y, '#cc0000', -1);
    state.drawingLine = new fabric.Line([p.x, p.y, p.x, p.y], {
      stroke: '#cc0000', strokeWidth: 0.5, strokeDashArray: [6, 3],
      selectable: false, evented: false, _noSelect: true, _tempDraw: true,
    });
    canvas.add(state.drawingLine);
  } else {
    const p1 = state.refPoints[0];
    canvas.getObjects().filter(o => o._tempDraw).forEach(o => canvas.remove(o));
    if (state.drawingLine) { canvas.remove(state.drawingLine); state.drawingLine = null; }
    state.refLine = new fabric.Line([p1.x, p1.y, p.x, p.y], {
      stroke: '#cc0000', strokeWidth: 0.5, strokeDashArray: [6, 3],
      selectable: false, evented: false, _noSelect: true,
    });
    canvas.add(state.refLine);
    canvas.renderAll();
    const pxLen = ptDist(p1.x, p1.y, p.x, p.y) / state.imgDisplayScale;
    state.refPoints = [];
    document.getElementById('status-hint').textContent = TOOL_HINTS['ref'];
    if (pxLen > 5) promptReference(pxLen);
    else { canvas.remove(state.refLine); state.refLine = null; }
  }
}

export function promptReference(pxLen) {
  createModal('Referenzmaß eingeben',
    `<p>Gezeichnete Linie: <b>${Math.round(pxLen)} px</b><br>Wie lang ist diese Strecke in Wirklichkeit?</p>
     <input type="number" id="ref-input" placeholder="z.B. 5.5" min="0.01" step="0.01" />
     <select id="ref-unit">
       <option value="1">Meter (m)</option>
       <option value="0.01">Zentimeter (cm)</option>
       <option value="0.001">Millimeter (mm)</option>
     </select>`,
    () => {
      const val = parseFloat(document.getElementById('ref-input').value);
      const unit = parseFloat(document.getElementById('ref-unit').value);
      const realLen_m = val * unit;
      if (!isNaN(val) && val > 0 && realLen_m >= 0.05 && realLen_m <= 10000) {
        // Plausibilitätsprüfung: weicht der neue Maßstab stark vom bisherigen ab?
        const newScale = pxLen / realLen_m;
        const commitRef = () => {
          // Gewichteter KQ-Ausgleich aller Referenzlinien:
          // s = Σ(pxLenᵢ × Lᵢ) / Σ(Lᵢ²)
          state.refLines.push({ pxLen, realLen_m });
          const num = state.refLines.reduce((s, r) => s + r.pxLen * r.realLen_m, 0);
          const den = state.refLines.reduce((s, r) => s + r.realLen_m ** 2, 0);
          state.scale = num / den;      // px/m (KQ-Schätzwert)
          state.refSumL2 = den;         // Σ Lᵢ² für Fehlerformel
          state.scaleSource = 'ref';
          state.refLine.set({ strokeWidth: 0.5, selectable: true, evented: true, _isRef: true, lockMovementX: true, lockMovementY: true });
          const unitStr = { '1': 'm', '0.01': 'cm', '0.001': 'mm' }[String(unit)];
          addRefEndmarks(state.refLine, '#cc0000', null);
          addLabel(
            (state.refLine.x1 + state.refLine.x2) / 2,
            (state.refLine.y1 + state.refLine.y2) / 2 - 12,
            `Ref: ${val}${unitStr}`, '#cc0000', null
          );
          state.refLine = null;
          updateRefStatus();
          canvas.renderAll();
          saveSnapshot();
        };

        if (state.scale && state.refLines.length > 0) {
          const deviation = Math.abs(newScale - state.scale) / state.scale;
          const deviationPct = (deviation * 100).toFixed(1);
          // Erwartete vs. gemessene Länge
          const expectedLen_m = pxLen / state.scale;
          const fmtLen = v => v >= 1 ? v.toFixed(2) + ' m' : (v * 100).toFixed(1) + ' cm';

          if (deviation > 0.05) {
            // > 5% Abweichung → Warnung, > 10% → starke Abweichung
            const severeColor = deviation > 0.10 ? '#ff3b30' : '#ff9500';
            const severeLabel = deviation > 0.10 ? 'Starke Abweichung' : 'Abweichung';
            createModal(
              `${severeLabel} erkannt`,
              `<div style="background:${severeColor}11;border:1px solid ${severeColor}44;border-radius:8px;padding:10px 12px;margin-bottom:12px;">
                <div style="font-size:13px;font-weight:600;color:${severeColor};margin-bottom:6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${severeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  ${deviationPct}% Abweichung vom bisherigen Maßstab
                </div>
                <div style="font-size:12px;color:#374151;line-height:1.5;">
                  <div style="display:flex;justify-content:space-between;"><span>Deine Angabe:</span><b>${fmtLen(realLen_m)}</b></div>
                  <div style="display:flex;justify-content:space-between;"><span>Erwartet (laut bisherigem Maßstab):</span><b>${fmtLen(expectedLen_m)}</b></div>
                  <div style="display:flex;justify-content:space-between;"><span>Differenz:</span><b style="color:${severeColor}">${fmtLen(Math.abs(realLen_m - expectedLen_m))}</b></div>
                </div>
              </div>
              <p style="font-size:12px;color:#6b7280;margin:0;">Mögliche Ursachen: falsche Längenangabe, ungenaues Einzeichnen, oder Verzerrung im Luftbild.</p>`,
              commitRef,
              () => { canvas.remove(state.refLine); state.refLine = null; },
              'Trotzdem verwenden'
            );
            return;
          }
        }

        commitRef();
      } else {
        canvas.remove(state.refLine);
        state.refLine = null;
      }
    },
    () => { canvas.remove(state.refLine); state.refLine = null; }
  );
  setTimeout(() => document.getElementById('ref-input')?.focus(), 80);
}

export function updateRefStatus() {
  const statusRef = document.getElementById('status-ref');
  const refStatus = document.getElementById('ref-status');

  if (state.scale) {
    const acc = calcAccuracy();
    const gsdStr = acc.gsd_cm < 1
      ? `${(acc.gsd_cm * 10).toFixed(2)} mm/px`
      : `${acc.gsd_cm.toFixed(2)} cm/px`;
    const err = acc.err100m_cm;
    const errStr = err < 100 ? `±${err.toFixed(1)} cm` : `±${(err / 100).toFixed(2)} m`;
    const n = state.refLines.length;
    const sourceLabel = state.scaleSource === 'ref'
      ? `${n} Ref${n > 1 ? 'erenzen' : 'erenz'}`
      : { exif: 'EXIF', form: 'Kameradaten' }[state.scaleSource] || '';

    // Farbcode für den Fehler
    const errColor = err <= 10 ? '#34c759' : err <= 20 ? '#ff9500' : '#ff3b30';

    refStatus.innerHTML =
      `<div class="ref-status-row">` +
        `<div class="ref-status-main">` +
          `<span class="ref-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> ${sourceLabel}</span>` +
          `<span class="ref-metrics">GSD <b>${gsdStr}</b> &nbsp;·&nbsp; <b style="color:${errColor}">${errStr}</b> bei 100 m</span>` +
        `</div>` +
        `<button class="ref-detail-btn" onclick="showAccuracyDetail()" title="Genauigkeits-Details"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>` +
      `</div>`;

    statusRef.innerHTML = `GSD: <b style="color:#1d1d1f">${gsdStr}</b> &nbsp;·&nbsp; <b style="color:${errColor}">${errStr}</b> bei 100 m`;
  } else {
    refStatus.innerHTML =
      `<span class="scale-unset-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Maßstab nicht gesetzt</span>` +
      `<div class="scale-unset-hint">Referenz-Werkzeug benutzen oder Bild mit GPS-Daten laden.</div>`;
    statusRef.textContent = 'Maßstab: –';
    statusRef.style.color = '#8e8e93';
  }
  updateMeasureButtons();
  // Update grid info when scale changes
  const gridInfo = document.getElementById('grid-info');
  if (gridInfo) {
    if (!state.scale) {
      gridInfo.textContent = 'Kein Maßstab gesetzt';
    } else if (!state.gridVisible) {
      gridInfo.textContent = 'Raster ausgeblendet';
    } else {
      canvas.renderAll(); // triggers after:render → drawGrid updates info
    }
  }
}
