// =========================================================
// ONBOARDING
// =========================================================

let _deps = {};
export function initRefOnboarding(deps) { _deps = deps; }

export function showRefOnboarding(exifResult) {
  const existing = document.getElementById('onboarding-overlay');
  if (existing) existing.remove();

  const autoScale = exifResult?.autoScale;
  const gsd       = exifResult?.gsd;         // m/px
  const camera    = exifResult?.camera;
  const altitude  = exifResult?.altitude;
  const tilt      = exifResult?.tiltFromNadir;
  const partial   = exifResult?.partial ?? {};

  // ── Helpers ──────────────────────────────────────────────────────
  const errAtDist = (gsd_m, scaleErrPct, dist_m) => {
    const dig = Math.sqrt(2) * gsd_m;
    const sc  = dist_m * scaleErrPct / 100;
    return Math.sqrt(dig ** 2 + sc ** 2);
  };
  const fmtErr  = m => (m * 100) < 100 ? `±${(m * 100).toFixed(1)} cm` : `±${m.toFixed(2)} m`;
  const errColor = m => (m * 100) <= 5 ? '#34c759' : (m * 100) <= 20 ? '#ff9500' : '#ff3b30';

  const accuracyRows = (gsd_m, scaleErrPct) =>
    [10, 30, 100].map(dist => {
      const err = errAtDist(gsd_m, scaleErrPct, dist);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05);">
        <span style="color:#636366;font-size:12px;">bei ${dist} m Messung</span>
        <b style="color:${errColor(err)};font-size:13.5px;">${fmtErr(err)}</b>
      </div>`;
    }).join('');

  // ── Overlay + Karte ───────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.4);
    backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
    display:flex; align-items:center; justify-content:center; z-index:2000;
  `;
  document.body.appendChild(overlay);

  const card = document.createElement('div');
  card.style.cssText = `
    background:#fff; border-radius:20px; padding:28px 26px 22px;
    width:390px; max-width:95vw;
    box-shadow:0 40px 100px rgba(0,0,0,0.22),0 0 0 1px rgba(0,0,0,0.04);
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    max-height:92vh; overflow-y:auto;
    transition:opacity 0.15s;
    animation:obIn 0.22s cubic-bezier(.4,0,.2,1);
  `;
  overlay.appendChild(card);

  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.18s';
    setTimeout(() => overlay.remove(), 180);
  };

  // Zustand zwischen Stufen teilen
  let currentGsd = autoScale ? gsd : null;
  let currentScaleErrPct = autoScale && altitude ? (100 / altitude) : null;

  // Übergang zwischen Stufen (Fade)
  const goToStage = (n) => {
    card.style.opacity = '0';
    setTimeout(() => {
      card.innerHTML = n === 1 ? renderStage1() : renderStage2();
      card.style.opacity = '1';
      bindStage(n);
    }, 150);
  };

  // ── STUFE 1: Maßstab ─────────────────────────────────────────────
  const renderStage1 = () => {
    if (autoScale) {
      const tiltNote = tilt != null && tilt > 5
        ? `<div style="background:rgba(255,149,0,0.1);border:1px solid rgba(255,149,0,0.3);border-radius:8px;padding:8px 11px;margin-bottom:12px;font-size:11.5px;color:#b36200;">
             Neigung ${tilt.toFixed(1)}° erkannt – automatisch korrigiert.
           </div>` : '';
      return `
        <style>@keyframes obIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}</style>
        <div style="text-align:center;margin-bottom:18px;">
          <div style="line-height:1;margin-bottom:10px;"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div style="font-size:18px;font-weight:700;color:#1d1d1f;letter-spacing:-0.4px;margin-bottom:5px;">Maßstab erkannt</div>
          ${camera ? `<div style="font-size:12px;color:#636366;">${camera}${altitude ? ` · ${altitude.toFixed(1)} m Flughöhe` : ''}</div>` : ''}
        </div>
        ${tiltNote}
        <div style="background:#f2f2f7;border-radius:12px;padding:12px 14px;margin-bottom:18px;">
          <div style="font-size:10.5px;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Messgenauigkeit</div>
          ${accuracyRows(gsd, 100 / altitude)}
        </div>
        <div style="display:flex;gap:8px;">
          <button id="ob-refine" style="flex:1;padding:12px;border:1.5px solid rgba(0,0,0,0.15);border-radius:12px;background:transparent;color:#636366;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">Genauer →</button>
          <button id="ob-start" style="flex:2;padding:12px;border:none;border-radius:12px;background:#34c759;color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;">Los geht's messen →</button>
        </div>`;
    } else {
      // Fall B: Kameradaten fehlen → direkt zur Referenzlinie
      const missing = exifResult?.missing ?? [];
      const missingText = missing.length
        ? `<div style="font-size:12px;color:#636366;margin-top:6px;">Fehlend: ${missing.join(', ')}</div>`
        : '';
      return `
        <style>@keyframes obIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}</style>
        <div style="text-align:center;margin-bottom:20px;">
          <div style="line-height:1;margin-bottom:10px;"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/><path d="M10 12h4"/></svg></div>
          <div style="font-size:18px;font-weight:700;color:#1d1d1f;letter-spacing:-0.4px;margin-bottom:5px;">Referenzmaß zeichnen</div>
          <div style="font-size:12px;color:#636366;">Kameradaten konnten nicht ausgelesen werden.</div>
          ${missingText}
        </div>
        <div style="background:#f2f2f7;border-radius:12px;padding:13px 15px;margin-bottom:18px;font-size:12.5px;color:#3a3a3c;line-height:1.55;">
          Zeichne eine Linie über eine <b>bekannte Strecke</b> im Bild (z.B. Hausseite, Weglänge, Pflasterreihe) – die App berechnet daraus den Maßstab.
        </div>
        <button id="ob-draw-ref" style="width:100%;padding:14px;border:none;border-radius:12px;background:#8B3DFF;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px;">Referenzlinie zeichnen →</button>
        <div style="text-align:center;">
          <button id="ob-no-ref" style="background:none;border:none;color:#8e8e93;font-size:12px;cursor:pointer;font-family:inherit;padding:4px;">Ohne Maßstab messen (Pixel)</button>
        </div>`;
    }
  };

  // ── STUFE 2: Referenzlinien ───────────────────────────────────────
  const renderStage2 = () => {
    const gsd_m    = currentGsd;
    const curErrPct = currentScaleErrPct;
    const curErr30  = errAtDist(gsd_m, curErrPct, 30);

    const scenarios = [
      { label: '1 Referenzlinie × 5 m',  L: 5 },
      { label: '1 Referenzlinie × 10 m', L: 10 },
      { label: '1 Referenzlinie × 20 m', L: 20 },
      { label: '2 Referenzlinien × 10 m', L: Math.sqrt(2) * 10 },
    ];
    const refRows = scenarios.map(s => {
      const refScaleErrPct = (Math.sqrt(2) * gsd_m / s.L) * 100;
      const err30 = errAtDist(gsd_m, refScaleErrPct, 30);
      const improvement = Math.round((1 - err30 / curErr30) * 100);
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);">
          <span style="color:#636366;font-size:12px;">${s.label}</span>
          <div style="text-align:right;white-space:nowrap;">
            <b style="color:${errColor(err30)};font-size:13.5px;">${fmtErr(err30)}</b>
            <span style="color:#34c759;font-size:10px;margin-left:5px;">−${improvement}%</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div style="text-align:center;margin-bottom:18px;">
        <div style="line-height:1;margin-bottom:10px;"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/><path d="M10 12h4"/></svg></div>
        <div style="font-size:18px;font-weight:700;color:#1d1d1f;letter-spacing:-0.4px;margin-bottom:5px;">Genauer messen</div>
        <div style="font-size:12px;color:#636366;">Referenzlinie über bekannte Strecke zeichnen</div>
      </div>
      <div style="background:rgba(255,59,48,0.07);border:1px solid rgba(255,59,48,0.2);border-radius:10px;padding:10px 13px;margin-bottom:14px;">
        <div style="font-size:11.5px;color:#636366;margin-bottom:2px;">Aktuell (nur Metadaten) bei 30 m:</div>
        <div style="font-size:16px;font-weight:700;color:#ff3b30;">${fmtErr(curErr30)}</div>
      </div>
      <div style="background:#f2f2f7;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
        <div style="font-size:10.5px;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Mit Referenzlinie bei 30 m</div>
        ${refRows}
      </div>
      <div style="font-size:11px;color:#8e8e93;margin-bottom:14px;">Referenzlinie = Linie über bekannte Strecke im Bild (z.B. Hausseite, Weg, Pflasterreihe)</div>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button id="ob-back" style="flex:1;padding:12px;border:1.5px solid rgba(0,0,0,0.15);border-radius:12px;background:transparent;color:#636366;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">← Zurück</button>
        <button id="ob-draw-ref" style="flex:2;padding:12px;border:none;border-radius:12px;background:#8B3DFF;color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;">Referenzlinie zeichnen →</button>
      </div>
      <div style="text-align:center;">
        <button id="ob-no-ref" style="background:none;border:none;color:#8e8e93;font-size:12px;cursor:pointer;font-family:inherit;padding:4px;">Ohne Referenzlinie messen</button>
      </div>`;
  };

  // ── Button-Binding ────────────────────────────────────────────────
  const bindStage = (n) => {
    if (n === 1) {
      if (autoScale) {
        card.querySelector('#ob-start').onclick  = () => { close(); _deps.setTool('select'); };
        card.querySelector('#ob-refine').onclick = () => goToStage(2);
      } else {
        card.querySelector('#ob-draw-ref').onclick = () => { close(); _deps.setTool('ref'); };
        card.querySelector('#ob-no-ref').onclick   = () => { close(); _deps.setTool('select'); };
      }
    } else {
      card.querySelector('#ob-draw-ref').onclick = () => { close(); _deps.setTool('ref'); };
      card.querySelector('#ob-back').onclick     = () => goToStage(1);
      card.querySelector('#ob-no-ref').onclick   = () => { close(); _deps.setTool('select'); };
    }
  };

  // ── Start mit Stufe 1 ────────────────────────────────────────────
  card.innerHTML = renderStage1();
  bindStage(1);

  // Klick auf Overlay-Hintergrund schließt
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}
