// =========================================================
// INTERACTIVE TUTORIAL — geführte Demo mit Beispielbild
// =========================================================
import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { setTool, TOOL_HINTS } from '../tools/tool-manager.js';

const DEMO_IMAGE = 'demo-plan.jpg';

const STEPS = [
  // ── 0: Intro ──────────────────────────────────────────
  {
    title: 'Interaktives Tutorial',
    subtitle: 'Lerne die wichtigsten Funktionen anhand eines Beispiel-Grundrisses kennen.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    content: `
      <div class="tut-preview">
        <img src="${DEMO_IMAGE}" alt="Demo-Grundriss" />
      </div>
      <p class="tut-desc">In 6 Schritten lernst du:</p>
      <div class="tut-checklist">
        <div class="tut-check-item"><span class="tut-num">1</span> Bild laden</div>
        <div class="tut-check-item"><span class="tut-num">2</span> Massstab setzen (Referenzlinie)</div>
        <div class="tut-check-item"><span class="tut-num">3</span> Hilfslinien anlegen</div>
        <div class="tut-check-item"><span class="tut-num">4</span> Distanzen messen</div>
        <div class="tut-check-item"><span class="tut-num">5</span> Flachen messen</div>
        <div class="tut-check-item"><span class="tut-num">6</span> Leitungen zeichnen</div>
      </div>`,
    cta: 'Tutorial starten',
    highlight: null,
  },
  // ── 1: Bild laden ─────────────────────────────────────
  {
    title: '1. Bild laden',
    subtitle: 'Ein Luftbild oder Grundriss wird in die App geladen.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    content: `
      <div class="tut-preview">
        <img src="${DEMO_IMAGE}" alt="Demo-Grundriss" />
      </div>
      <div class="tut-action">
        <div class="tut-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
        <div class="tut-action-text">Das Demo-Bild wird jetzt geladen. In der Praxis ziehst du dein eigenes Drohnenfoto per Drag & Drop in die App oder klickst auf <b>"Bild laden"</b>.</div>
      </div>
      <div class="tut-tip">Unterstuetzte Formate: JPEG, PNG, WebP, TIFF. Bei DJI-Drohnen wird der Massstab automatisch aus den EXIF-Daten berechnet.</div>`,
    cta: 'Bild laden & weiter',
    action: 'loadDemo',
    highlight: null,
  },
  // ── 2: Referenzlinie / Massstab ───────────────────────
  {
    title: '2. Massstab setzen',
    subtitle: 'Zeichne eine Referenzlinie ueber eine bekannte Strecke.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/><path d="M10 12h4"/></svg>',
    content: `
      <div class="tut-action">
        <div class="tut-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/></svg></div>
        <div class="tut-action-text">Waehle das Werkzeug <b>"Massstab"</b> in der Toolbar oben. Klicke dann zwei Punkte auf eine bekannte Strecke im Bild (z.B. eine Hauswand, deren Laenge du kennst).</div>
      </div>
      <div class="tut-steps-mini">
        <div class="tut-mini-step"><span class="tut-num">1</span> "Massstab" klicken</div>
        <div class="tut-mini-step"><span class="tut-num">2</span> Startpunkt auf bekannte Kante klicken</div>
        <div class="tut-mini-step"><span class="tut-num">3</span> Endpunkt klicken</div>
        <div class="tut-mini-step"><span class="tut-num">4</span> Echte Laenge eingeben (z.B. 12 m)</div>
      </div>
      <div class="tut-tip">Je laenger die Referenzstrecke, desto genauer alle Messungen. Mehrere Referenzlinien verbessern die Genauigkeit weiter.</div>`,
    cta: 'Verstanden, weiter',
    highlight: 'btn-ref',
  },
  // ── 3: Hilfslinien ────────────────────────────────────
  {
    title: '3. Hilfslinien & Hilfspunkte',
    subtitle: 'Markiere wichtige Grenzen und Orientierungspunkte.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23" stroke-dasharray="4 2"/><line x1="4" y1="12" x2="20" y2="12"/></svg>',
    content: `
      <div class="tut-action">
        <div class="tut-action-icon" style="color:#FF9500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23" stroke-dasharray="4 2"/><line x1="4" y1="12" x2="20" y2="12"/></svg></div>
        <div class="tut-action-text">Klicke <b>"Hilfslinie"</b> und setze zwei Punkte entlang einer Grundstuecksgrenze, Hauswand oder Zaun. <b>"Hilfspunkt"</b> markiert einzelne Referenzpositionen.</div>
      </div>
      <div class="tut-features">
        <div class="tut-feature">
          <span class="tut-feature-icon" style="color:#FF9500">|||</span>
          <div>
            <div class="tut-feature-title">Abstandsanzeige</div>
            <div class="tut-feature-desc">Beim Zeichnen wird der Abstand zu aktiven Hilfslinien automatisch angezeigt.</div>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon" style="color:#00BCD4">//</span>
          <div>
            <div class="tut-feature-title">Parallel zeichnen</div>
            <div class="tut-feature-desc">Mit dem "Parallel"-Button kannst du Distanzen und Leitungen exakt parallel zu einer Hilfslinie zeichnen.</div>
          </div>
        </div>
      </div>
      <div class="tut-tip">Hilfslinien koennen in der Sidebar unter "Hilfslinien" verwaltet und ein-/ausgeblendet werden.</div>`,
    cta: 'Weiter',
    highlight: 'btn-pipe-ref-line',
  },
  // ── 4: Distanzen messen ───────────────────────────────
  {
    title: '4. Distanzen messen',
    subtitle: 'Miss Entfernungen zwischen zwei beliebigen Punkten.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/><line x1="14" y1="13" x2="11" y2="10"/></svg>',
    content: `
      <div class="tut-action">
        <div class="tut-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/></svg></div>
        <div class="tut-action-text">Waehle <b>"Distanz"</b> und klicke zwei Punkte. Die Entfernung wird sofort in Metern angezeigt.</div>
      </div>
      <div class="tut-steps-mini">
        <div class="tut-mini-step"><span class="tut-num">1</span> "Distanz" klicken</div>
        <div class="tut-mini-step"><span class="tut-num">2</span> Startpunkt klicken</div>
        <div class="tut-mini-step"><span class="tut-num">3</span> Endpunkt klicken → Ergebnis erscheint</div>
      </div>
      <div class="tut-features">
        <div class="tut-feature">
          <span class="tut-feature-icon">//</span>
          <div>
            <div class="tut-feature-title">Parallel-Modus</div>
            <div class="tut-feature-desc">Aktiviere "Parallel" unter Zeichenhilfen, um exakt parallel zu einer Hilfslinie zu messen.</div>
          </div>
        </div>
      </div>
      <div class="tut-tip">Alle Messungen erscheinen in der Sidebar links unter "Messungen" und koennen dort geloescht werden.</div>`,
    cta: 'Weiter',
    highlight: 'btn-distance',
  },
  // ── 5: Flaechen messen ────────────────────────────────
  {
    title: '5. Flaechen messen',
    subtitle: 'Umrande einen Bereich, um die Flaeche zu berechnen.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>',
    content: `
      <div class="tut-action">
        <div class="tut-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>
        <div class="tut-action-text">Waehle <b>"Flaeche"</b> und klicke die Eckpunkte. <b>Doppelklick</b> schliesst das Polygon ab.</div>
      </div>
      <div class="tut-steps-mini">
        <div class="tut-mini-step"><span class="tut-num">1</span> "Flaeche" klicken</div>
        <div class="tut-mini-step"><span class="tut-num">2</span> Eckpunkte nacheinander klicken</div>
        <div class="tut-mini-step"><span class="tut-num">3</span> Doppelklick → Flaeche wird berechnet</div>
      </div>
      <div class="tut-features">
        <div class="tut-feature">
          <span class="tut-feature-icon">90</span>
          <div>
            <div class="tut-feature-title">90-Grad-Snap</div>
            <div class="tut-feature-desc">Halte <b>Shift</b> gedrueckt, um Kanten im rechten Winkel zu zeichnen.</div>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">||</span>
          <div>
            <div class="tut-feature-title">Kantenlaengen</div>
            <div class="tut-feature-desc">Jede Kante zeigt die Einzellaenge an. In der Sidebar per Button ein-/ausblendbar.</div>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg></span>
          <div>
            <div class="tut-feature-title">Nachbearbeiten</div>
            <div class="tut-feature-desc">Doppelklick auf eine Flaeche → Eckpunkte ziehen zum Anpassen.</div>
          </div>
        </div>
      </div>`,
    cta: 'Weiter',
    highlight: 'btn-area',
  },
  // ── 6: Leitungen ──────────────────────────────────────
  {
    title: '6. Leitungen zeichnen',
    subtitle: 'Zeichne Versorgungsleitungen ein — Wasser, Strom, Gas und mehr.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="M4 12h12"/><circle cx="20" cy="12" r="2"/><path d="M4 8h8"/></svg>',
    content: `
      <div class="tut-action">
        <div class="tut-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="M4 12h12"/><circle cx="20" cy="12" r="2"/></svg></div>
        <div class="tut-action-text">Waehle <b>"Leitung"</b>, dann den Leitungstyp (Trinkwasser, Strom, Gas, ...). Klicke die Punkte, <b>Doppelklick</b> schliesst ab.</div>
      </div>
      <div class="tut-pipe-types">
        <span class="tut-pipe-dot" style="background:#1565C0">TW</span>
        <span class="tut-pipe-dot" style="background:#795548">AW</span>
        <span class="tut-pipe-dot" style="background:#29B6F6">RW</span>
        <span class="tut-pipe-dot" style="background:#FFC107;color:#333">G</span>
        <span class="tut-pipe-dot" style="background:#E53935">St</span>
        <span class="tut-pipe-dot" style="background:#8E24AA">GF</span>
        <span class="tut-pipe-dot" style="background:#43A047">GB</span>
        <span class="tut-pipe-dot" style="background:#9E9E9E">LR</span>
      </div>
      <div class="tut-features">
        <div class="tut-feature">
          <span class="tut-feature-icon" style="color:#00BCD4">//</span>
          <div>
            <div class="tut-feature-title">Parallel zu Hilfslinien</div>
            <div class="tut-feature-desc">Aktiviere "Parallel" und waehle eine Hilfslinie — die Leitung wird exakt im gewuenschten Abstand gefuehrt.</div>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4v14h7"/><path d="M15 20l5-8-5-8"/></svg></span>
          <div>
            <div class="tut-feature-title">Referenz-Zuordnung</div>
            <div class="tut-feature-desc">Weise Leitungen Hilfslinien zu, um Abstaende in der Uebersicht zu sehen.</div>
          </div>
        </div>
      </div>`,
    cta: 'Weiter',
    highlight: 'btn-pipe',
  },
  // ── 7: Abschluss ──────────────────────────────────────
  {
    title: 'Bereit!',
    subtitle: 'Du kennst jetzt die wichtigsten Funktionen.',
    icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    content: `
      <div class="tut-features" style="margin-top:4px;">
        <div class="tut-feature">
          <span class="tut-feature-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg></span>
          <div>
            <div class="tut-feature-title">Speichern & Laden</div>
            <div class="tut-feature-desc">Projekte werden als JSON gespeichert. Ueber "Speichern" / "Laden" in der Sidebar.</div>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></span>
          <div>
            <div class="tut-feature-title">Undo / Redo</div>
            <div class="tut-feature-desc">Cmd+Z / Cmd+Shift+Z — jede Aktion kann rueckgaengig gemacht werden.</div>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></span>
          <div>
            <div class="tut-feature-title">Zoom & Navigation</div>
            <div class="tut-feature-desc">Scrollen zum Zoomen, Alt+Ziehen zum Verschieben, Doppelklick fuer 2x Zoom.</div>
          </div>
        </div>
      </div>
      <div class="tut-tip" style="background:rgba(22,163,106,0.08);border-color:rgba(22,163,106,0.25);">
        <b>Tipp:</b> Du kannst dieses Tutorial jederzeit ueber den <b>"?"</b>-Button oben rechts erneut starten.
      </div>`,
    cta: 'Los geht\'s!',
    ctaStyle: 'green',
    highlight: null,
  },
];

let _tutOverlay = null;
let _tutStep = 0;

export function showTutorial() {
  if (_tutOverlay) _tutOverlay.remove();

  _tutStep = 0;
  _tutOverlay = document.createElement('div');
  _tutOverlay.id = 'tutorial-ob';
  _tutOverlay.className = 'tut-overlay';
  document.body.appendChild(_tutOverlay);

  const close = () => {
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    _tutOverlay.style.opacity = '0';
    setTimeout(() => { _tutOverlay.remove(); _tutOverlay = null; }, 200);
    localStorage.setItem('gp_tut_seen', '1');
  };

  const goTo = (i) => {
    _tutStep = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
  };

  const render = () => {
    const sd = STEPS[_tutStep];
    const isLast = _tutStep === STEPS.length - 1;
    const pct = ((_tutStep + 1) / STEPS.length * 100).toFixed(0);

    const dots = Array.from({ length: STEPS.length }, (_, i) =>
      `<div class="wob-dot ${i === _tutStep ? 'active' : ''}" data-i="${i}"></div>`
    ).join('');

    // Highlight target button
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    if (sd.highlight) {
      const btn = document.getElementById(sd.highlight);
      if (btn) btn.classList.add('tut-highlight');
    }

    _tutOverlay.innerHTML = `
      <div class="wob-card" style="animation:wob-in 0.22s cubic-bezier(.4,0,.2,1);">
        <div class="wob-progress"><div class="wob-progress-bar" style="width:${pct}%"></div></div>
        <div class="wob-body">
          <div class="wob-icon">${sd.icon}</div>
          <div class="wob-title">${sd.title}</div>
          <div class="wob-subtitle">${sd.subtitle}</div>
          <div class="wob-content">${sd.content}</div>
        </div>
        <div class="wob-foot">
          <div class="wob-dots">${dots}</div>
          <div class="wob-btn-row">
            ${_tutStep > 0 ? `<button class="wob-btn-secondary" id="tut-back">\u2190 Zurueck</button>` : ''}
            <button class="wob-btn-primary ${sd.ctaStyle || ''}" id="tut-next">${sd.cta}</button>
          </div>
          <button class="wob-btn-skip" id="tut-skip">Schliessen</button>
        </div>
      </div>`;

    // Bind events
    _tutOverlay.querySelectorAll('.wob-dot').forEach(dot => {
      dot.onclick = () => goTo(parseInt(dot.dataset.i));
    });

    _tutOverlay.querySelector('#tut-back')?.addEventListener('click', () => goTo(_tutStep - 1));

    _tutOverlay.querySelector('#tut-next').addEventListener('click', () => {
      // Execute step action
      if (sd.action === 'loadDemo') {
        loadDemoImage();
      }
      if (isLast) {
        close();
      } else {
        goTo(_tutStep + 1);
      }
    });

    _tutOverlay.querySelector('#tut-skip').addEventListener('click', () => close());
    _tutOverlay.addEventListener('click', e => { if (e.target === _tutOverlay) close(); });
  };

  // Keyboard
  const onKey = e => {
    if (!document.getElementById('tutorial-ob')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); _tutStep < STEPS.length - 1 ? goTo(_tutStep + 1) : close(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(_tutStep - 1); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  };
  document.addEventListener('keydown', onKey);

  render();
}

function loadDemoImage() {
  const img = new Image();
  img.onload = () => {
    const cw = canvas.getWidth(), ch = canvas.getHeight();
    const scale = Math.min(cw / img.width, ch / img.height);

    const fImg = new fabric.Image(img, {
      left: 0, top: 0,
      scaleX: scale, scaleY: scale,
      selectable: false, evented: false,
      _isBackground: true, _noSelect: true,
    });

    // Remove existing background
    canvas.getObjects().filter(o => o._isBackground).forEach(o => canvas.remove(o));

    canvas.add(fImg);
    canvas.sendToBack(fImg);
    state.backgroundImage = fImg;
    state.imgDisplayScale = scale;

    // Set a demo scale (assuming house is ~12m wide, roughly 500px in image)
    // This is approximate for the demo
    state.scale = 500 / 12;  // ~42 px/m
    state.scaleSource = 'demo';

    canvas.renderAll();
  };
  img.src = DEMO_IMAGE;
}

// Expose globally
window.showTutorial = showTutorial;
