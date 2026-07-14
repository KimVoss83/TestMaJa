// =========================================================
// INTERACTIVE TUTORIAL — floating panel with animated demos
// =========================================================
import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { setTool } from '../tools/tool-manager.js';

const DEMO_IMAGE = 'demo-plan.jpg';

// ── Animated SVG scenes for each step ──────────────────
// Each returns an SVG string that plays as a looping "screen recording"

const CURSOR = `<path class="tut-cursor" d="M0,0 L0,13 L3.5,9.5 L7,15.5 L9,14 L5.5,8 L10,7.5 Z" fill="#fff" stroke="#333" stroke-width="0.8"/>`;

function animStageGrid() {
  return `<defs>
    <pattern id="tg" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0L0 0 0 24" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="340" height="170" fill="url(#tg)"/>`;
}

function animLoad() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Frame -->
    <rect x="90" y="30" width="160" height="110" rx="6" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="6 4"/>
    <!-- Image icon dropping in -->
    <g opacity="0">
      <animateTransform attributeName="transform" type="translate" values="0,-40;0,0;0,0" dur="2.5s" repeatCount="indefinite" keyTimes="0;0.35;1"/>
      <animate attributeName="opacity" values="0;1;1;1;0" dur="2.5s" repeatCount="indefinite" keyTimes="0;0.2;0.6;0.85;1"/>
      <rect x="110" y="45" width="120" height="80" rx="4" fill="rgba(139,61,255,0.2)" stroke="#8B3DFF" stroke-width="1.5"/>
      <circle cx="135" cy="65" r="8" fill="rgba(255,200,50,0.5)"/>
      <polygon points="120,110 155,78 180,100 200,82 220,110" fill="rgba(100,200,150,0.4)" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>
    </g>
    <!-- Label -->
    <text x="170" y="158" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="10" font-family="DM Sans,sans-serif" opacity="0">
      Drag &amp; Drop oder "Bild laden"
      <animate attributeName="opacity" values="0;0;1;1;0" dur="2.5s" repeatCount="indefinite" keyTimes="0;0.4;0.55;0.85;1"/>
    </text>
  </svg>`;
}

function animRef() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Building outline hint -->
    <rect x="60" y="50" width="220" height="80" rx="2" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
    <!-- Click point 1 -->
    <circle cx="80" cy="90" r="4" fill="#8B3DFF" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;1;1;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.12;0.15;0.7;0.85;0.92;1"/>
    </circle>
    <circle cx="80" cy="90" r="8" class="tut-click-ring">
      <animate attributeName="opacity" values="0;0;0.8;0;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.12;0.15;0.25;1"/>
      <animate attributeName="r" values="4;12;12" dur="5s" repeatCount="indefinite" keyTimes="0;0.25;1"/>
    </circle>
    <!-- Line drawing -->
    <line x1="80" y1="90" x2="260" y2="90" stroke="#4ecca3" stroke-width="2" stroke-dasharray="180" stroke-dashoffset="180">
      <animate attributeName="stroke-dashoffset" values="180;180;0;0;0;180" dur="5s" repeatCount="indefinite" keyTimes="0;0.18;0.45;0.85;0.92;1"/>
    </line>
    <!-- Tick marks -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.46;0.5;0.85;1"/>
      <line x1="80" y1="84" x2="80" y2="96" stroke="#4ecca3" stroke-width="1.5"/>
      <line x1="260" y1="84" x2="260" y2="96" stroke="#4ecca3" stroke-width="1.5"/>
    </g>
    <!-- Click point 2 -->
    <circle cx="260" cy="90" r="4" fill="#8B3DFF" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;1;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.4;0.43;0.85;0.92;1"/>
    </circle>
    <circle cx="260" cy="90" r="8" class="tut-click-ring">
      <animate attributeName="opacity" values="0;0;0.8;0;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.4;0.43;0.53;1"/>
    </circle>
    <!-- Label "12.50 m" -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.52;0.58;0.85;1"/>
      <rect x="137" y="62" width="66" height="20" rx="4" fill="rgba(255,255,255,0.92)"/>
      <text x="170" y="76" text-anchor="middle" fill="#333" font-size="11" font-weight="bold" font-family="monospace">12.50 m</text>
    </g>
    <!-- Dialog hint -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.55;0.62;0.85;1"/>
      <rect x="120" y="105" width="100" height="28" rx="6" fill="rgba(255,255,255,0.95)" stroke="#8B3DFF" stroke-width="1"/>
      <text x="170" y="123" text-anchor="middle" fill="#6b7280" font-size="9" font-family="DM Sans,sans-serif">Laenge eingeben</text>
    </g>
    <!-- Cursor -->
    <g class="tut-cursor" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0.9;0.9;0.9;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.05;0.45;0.85;0.9;1"/>
      <animateTransform attributeName="transform" type="translate" values="60,80;75,85;75,85;255,85;255,85" dur="5s" repeatCount="indefinite" keyTimes="0;0.12;0.18;0.42;1"/>
      ${CURSOR}
    </g>
  </svg>`;
}

function animGuideline() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Guideline being drawn -->
    <line x1="170" y1="15" x2="170" y2="155" stroke="#FF9500" stroke-width="1.5" stroke-dasharray="5 3" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4s" repeatCount="indefinite" keyTimes="0;0.2;0.3;0.85;1"/>
    </line>
    <!-- Distance indicators appearing -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4s" repeatCount="indefinite" keyTimes="0;0.4;0.5;0.85;1"/>
      <!-- Left distance -->
      <line x1="80" y1="85" x2="165" y2="85" stroke="rgba(255,149,0,0.5)" stroke-width="0.8" stroke-dasharray="3 2"/>
      <rect x="100" y="74" width="44" height="16" rx="3" fill="rgba(255,149,0,0.15)" stroke="rgba(255,149,0,0.3)" stroke-width="0.5"/>
      <text x="122" y="86" text-anchor="middle" fill="#FF9500" font-size="9" font-weight="600" font-family="monospace">3.2 m</text>
      <!-- Right distance -->
      <line x1="175" y1="85" x2="280" y2="85" stroke="rgba(255,149,0,0.5)" stroke-width="0.8" stroke-dasharray="3 2"/>
      <rect x="205" y="74" width="44" height="16" rx="3" fill="rgba(255,149,0,0.15)" stroke="rgba(255,149,0,0.3)" stroke-width="0.5"/>
      <text x="227" y="86" text-anchor="middle" fill="#FF9500" font-size="9" font-weight="600" font-family="monospace">5.1 m</text>
    </g>
    <!-- Reference point -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4s" repeatCount="indefinite" keyTimes="0;0.55;0.65;0.85;1"/>
      <circle cx="80" cy="85" r="4" fill="none" stroke="#FF9500" stroke-width="1.5"/>
      <line x1="80" y1="77" x2="80" y2="93" stroke="#FF9500" stroke-width="1"/>
      <line x1="72" y1="85" x2="88" y2="85" stroke="#FF9500" stroke-width="1"/>
    </g>
    <!-- Cursor -->
    <g class="tut-cursor" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0.9;0.9;0" dur="4s" repeatCount="indefinite" keyTimes="0;0.05;0.8;0.88;1"/>
      <animateTransform attributeName="transform" type="translate" values="165,10;165,10;165,148;165,148" dur="4s" repeatCount="indefinite" keyTimes="0;0.15;0.35;1"/>
      ${CURSOR}
    </g>
  </svg>`;
}

function animDistance() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Building hint -->
    <path d="M50,130 L50,50 L180,50 L180,90 L290,90 L290,130 Z" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>
    <!-- Click 1 -->
    <circle cx="70" cy="90" r="3.5" fill="#4ecca3" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.13;0.16;0.8;0.9;1"/>
    </circle>
    <circle cx="70" cy="90" r="7" class="tut-click-ring">
      <animate attributeName="opacity" values="0;0;0.7;0;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.13;0.16;0.28;1"/>
    </circle>
    <!-- Line -->
    <line x1="70" y1="90" x2="270" y2="70" stroke="#4ecca3" stroke-width="2" stroke-dasharray="205" stroke-dashoffset="205">
      <animate attributeName="stroke-dashoffset" values="205;205;0;0;0;205" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.18;0.48;0.8;0.9;1"/>
    </line>
    <!-- Click 2 -->
    <circle cx="270" cy="70" r="3.5" fill="#4ecca3" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.44;0.47;0.8;0.9;1"/>
    </circle>
    <circle cx="270" cy="70" r="7" class="tut-click-ring">
      <animate attributeName="opacity" values="0;0;0.7;0;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.44;0.47;0.57;1"/>
    </circle>
    <!-- Label -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.52;0.58;0.85;1"/>
      <rect x="140" y="57" width="55" height="18" rx="4" fill="rgba(255,255,255,0.92)"/>
      <text x="167" y="70" text-anchor="middle" fill="#333" font-size="11" font-weight="bold" font-family="monospace">8.34 m</text>
    </g>
    <!-- Tick marks -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.52;0.56;0.85;1"/>
      <line x1="67" y1="83" x2="73" y2="97" stroke="#4ecca3" stroke-width="1.5"/>
      <line x1="267" y1="63" x2="273" y2="77" stroke="#4ecca3" stroke-width="1.5"/>
    </g>
    <!-- Cursor -->
    <g class="tut-cursor" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0.9;0.9;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.05;0.82;0.88;1"/>
      <animateTransform attributeName="transform" type="translate" values="55,82;65,85;65,85;265,64;265,64" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.13;0.2;0.46;1"/>
      ${CURSOR}
    </g>
  </svg>`;
}

function animArea() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Polygon points appearing one by one -->
    <!-- Point 1 -->
    <circle cx="80" cy="120" r="3" fill="#e74c3c" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.08;0.1;0.82;1"/>
    </circle>
    <!-- Point 2 -->
    <circle cx="100" cy="45" r="3" fill="#e74c3c" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.18;0.2;0.82;1"/>
    </circle>
    <!-- Point 3 -->
    <circle cx="240" cy="40" r="3" fill="#e74c3c" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.28;0.3;0.82;1"/>
    </circle>
    <!-- Point 4 -->
    <circle cx="270" cy="130" r="3" fill="#e74c3c" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.38;0.4;0.82;1"/>
    </circle>
    <!-- Edges drawing progressively -->
    <line x1="80" y1="120" x2="100" y2="45" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="80" stroke-dashoffset="80">
      <animate attributeName="stroke-dashoffset" values="80;80;0;0;0;80" dur="6s" repeatCount="indefinite" keyTimes="0;0.1;0.18;0.82;0.92;1"/>
    </line>
    <line x1="100" y1="45" x2="240" y2="40" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="140" stroke-dashoffset="140">
      <animate attributeName="stroke-dashoffset" values="140;140;0;0;0;140" dur="6s" repeatCount="indefinite" keyTimes="0;0.2;0.3;0.82;0.92;1"/>
    </line>
    <line x1="240" y1="40" x2="270" y2="130" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="95" stroke-dashoffset="95">
      <animate attributeName="stroke-dashoffset" values="95;95;0;0;0;95" dur="6s" repeatCount="indefinite" keyTimes="0;0.3;0.4;0.82;0.92;1"/>
    </line>
    <!-- Closing edge + fill on double-click -->
    <line x1="270" y1="130" x2="80" y2="120" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="190" stroke-dashoffset="190">
      <animate attributeName="stroke-dashoffset" values="190;190;0;0;0;190" dur="6s" repeatCount="indefinite" keyTimes="0;0.48;0.55;0.82;0.92;1"/>
    </line>
    <!-- Polygon fill -->
    <polygon points="80,120 100,45 240,40 270,130" fill="rgba(231,76,60,0.15)" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.53;0.58;0.82;1"/>
    </polygon>
    <!-- Area label -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.58;0.65;0.82;1"/>
      <rect x="137" y="72" width="66" height="20" rx="4" fill="rgba(255,255,255,0.92)"/>
      <text x="170" y="86" text-anchor="middle" fill="#333" font-size="10" font-weight="bold" font-family="monospace">42.7 m²</text>
    </g>
    <!-- Edge labels -->
    <g opacity="0" font-size="8" fill="rgba(231,76,60,0.9)" font-family="monospace" font-weight="600">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.62;0.68;0.82;1"/>
      <text x="78" y="80" text-anchor="middle">4.2 m</text>
      <text x="170" y="36" text-anchor="middle">7.8 m</text>
      <text x="264" y="82" text-anchor="middle">5.1 m</text>
      <text x="175" y="136" text-anchor="middle">10.5 m</text>
    </g>
    <!-- Cursor -->
    <g class="tut-cursor" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0.9;0.9;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.03;0.5;0.85;1"/>
      <animateTransform attributeName="transform" type="translate" values="65,115;75,115;75,115;95,40;95,40;235,35;235,35;265,125;265,125;265,125" dur="6s" repeatCount="indefinite" keyTimes="0;0.08;0.12;0.2;0.23;0.3;0.33;0.4;0.46;1"/>
      ${CURSOR}
    </g>
    <!-- Double-click indicator -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;0.5;1;0;0" dur="6s" repeatCount="indefinite" keyTimes="0;0.46;0.47;0.485;0.5;0.55;1"/>
      <circle cx="270" cy="130" r="10" fill="none" stroke="#fff" stroke-width="1.5"/>
    </g>
  </svg>`;
}

function animCircle() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Center click -->
    <circle cx="170" cy="85" r="3" fill="#3498db" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.13;0.16;0.82;1"/>
    </circle>
    <circle cx="170" cy="85" r="7" class="tut-click-ring" stroke="#3498db">
      <animate attributeName="opacity" values="0;0;0.7;0;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.13;0.16;0.28;1"/>
    </circle>
    <!-- Circle being drawn -->
    <circle cx="170" cy="85" r="55" fill="rgba(52,152,219,0.1)" stroke="#3498db" stroke-width="1.5" stroke-dasharray="346" stroke-dashoffset="346">
      <animate attributeName="stroke-dashoffset" values="346;346;0;0;0;346" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.2;0.5;0.82;0.9;1"/>
      <animate attributeName="fill-opacity" values="0;0;0;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.45;0.49;0.52;0.82;1"/>
    </circle>
    <!-- Radius line -->
    <line x1="170" y1="85" x2="225" y2="85" stroke="#3498db" stroke-width="1" stroke-dasharray="4 3" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.52;0.56;0.82;1"/>
    </line>
    <!-- Edge click -->
    <circle cx="225" cy="85" r="3" fill="#3498db" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.46;0.49;0.82;1"/>
    </circle>
    <!-- Labels -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.55;0.62;0.82;1"/>
      <rect x="179" y="68" width="52" height="14" rx="3" fill="rgba(255,255,255,0.9)"/>
      <text x="205" y="79" text-anchor="middle" fill="#333" font-size="9" font-weight="bold" font-family="monospace">r = 3.2 m</text>
      <rect x="140" y="91" width="60" height="14" rx="3" fill="rgba(255,255,255,0.9)"/>
      <text x="170" y="102" text-anchor="middle" fill="#333" font-size="9" font-weight="bold" font-family="monospace">A = 32.2 m²</text>
    </g>
    <!-- Cursor -->
    <g class="tut-cursor" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0.9;0.9;0" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.05;0.52;0.85;1"/>
      <animateTransform attributeName="transform" type="translate" values="155,78;165,80;165,80;220,78;220,78" dur="4.5s" repeatCount="indefinite" keyTimes="0;0.13;0.2;0.48;1"/>
      ${CURSOR}
    </g>
  </svg>`;
}

function animPipe() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Building outline -->
    <rect x="40" y="30" width="260" height="110" rx="2" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>
    <!-- TW pipe (blue) -->
    <polyline points="60,130 60,60 160,60" fill="none" stroke="#1565C0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="180" stroke-dashoffset="180">
      <animate attributeName="stroke-dashoffset" values="180;180;0;0;0;180" dur="5.5s" repeatCount="indefinite" keyTimes="0;0.08;0.35;0.75;0.92;1"/>
    </polyline>
    <!-- TW label -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="5.5s" repeatCount="indefinite" keyTimes="0;0.36;0.42;0.75;1"/>
      <rect x="82" y="47" width="24" height="13" rx="3" fill="#1565C0"/>
      <text x="94" y="57" text-anchor="middle" fill="#fff" font-size="8" font-weight="700" font-family="monospace">TW</text>
      <rect x="87" y="63" width="40" height="12" rx="3" fill="rgba(255,255,255,0.9)"/>
      <text x="107" y="73" text-anchor="middle" fill="#333" font-size="8" font-weight="600" font-family="monospace">5.8 m</text>
    </g>
    <!-- AW pipe (brown) -->
    <polyline points="160,130 160,100 280,100" fill="none" stroke="#795548" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="150" stroke-dashoffset="150">
      <animate attributeName="stroke-dashoffset" values="150;150;150;0;0;0;150" dur="5.5s" repeatCount="indefinite" keyTimes="0;0.35;0.4;0.6;0.75;0.92;1"/>
    </polyline>
    <!-- AW label -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="5.5s" repeatCount="indefinite" keyTimes="0;0.61;0.67;0.75;1"/>
      <rect x="200" y="87" width="24" height="13" rx="3" fill="#795548"/>
      <text x="212" y="97" text-anchor="middle" fill="#fff" font-size="8" font-weight="700" font-family="monospace">AW</text>
      <rect x="195" y="103" width="40" height="12" rx="3" fill="rgba(255,255,255,0.9)"/>
      <text x="215" y="113" text-anchor="middle" fill="#333" font-size="8" font-weight="600" font-family="monospace">6.2 m</text>
    </g>
    <!-- Pipe type legend -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" dur="5.5s" repeatCount="indefinite" keyTimes="0;0.42;0.5;0.75;1"/>
      <rect x="240" y="37" width="22" height="11" rx="2.5" fill="#1565C0"/>
      <text x="251" y="46" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="monospace">TW</text>
      <rect x="266" y="37" width="22" height="11" rx="2.5" fill="#795548"/>
      <text x="277" y="46" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="monospace">AW</text>
      <rect x="240" y="51" width="22" height="11" rx="2.5" fill="#E53935"/>
      <text x="251" y="60" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="monospace">St</text>
      <rect x="266" y="51" width="22" height="11" rx="2.5" fill="#FFC107"/>
      <text x="277" y="60" text-anchor="middle" fill="#333" font-size="7" font-weight="700" font-family="monospace">G</text>
    </g>
    <!-- Cursor -->
    <g class="tut-cursor" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0.9;0.9;0" dur="5.5s" repeatCount="indefinite" keyTimes="0;0.03;0.65;0.8;1"/>
      <animateTransform attributeName="transform" type="translate" values="55,125;55,125;55,55;55,55;155,55;155,55;155,125;155,125;155,95;155,95;275,95;275,95" dur="5.5s" repeatCount="indefinite" keyTimes="0;0.08;0.18;0.22;0.3;0.35;0.4;0.44;0.48;0.52;0.58;1"/>
      ${CURSOR}
    </g>
  </svg>`;
}

function animDone() {
  return `<svg viewBox="0 0 340 170" xmlns="http://www.w3.org/2000/svg">
    ${animStageGrid()}
    <!-- Checkmark circle -->
    <circle cx="170" cy="75" r="35" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-dasharray="220" stroke-dashoffset="220">
      <animate attributeName="stroke-dashoffset" values="220;0;0" dur="2s" fill="freeze" keyTimes="0;0.5;1"/>
    </circle>
    <polyline points="152,75 165,88 192,62" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1" dur="2s" fill="freeze" keyTimes="0;0.5;0.65;1"/>
    </polyline>
    <!-- Save/Undo/Zoom icons -->
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1" dur="2.5s" fill="freeze" keyTimes="0;0.6;0.8;1"/>
      <!-- Save -->
      <rect x="65" y="125" width="50" height="24" rx="5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
      <text x="90" y="141" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9" font-family="DM Sans,sans-serif">Speichern</text>
      <!-- Undo -->
      <rect x="145" y="125" width="50" height="24" rx="5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
      <text x="170" y="141" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9" font-family="DM Sans,sans-serif">Undo</text>
      <!-- Zoom -->
      <rect x="225" y="125" width="50" height="24" rx="5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
      <text x="250" y="141" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9" font-family="DM Sans,sans-serif">Zoom</text>
    </g>
  </svg>`;
}

// ── Step definitions ──────────────────────────────────

const STEPS = [
  {
    title: 'Bild laden',
    desc: 'Ziehe ein Luftbild oder Grundriss per <b>Drag & Drop</b> in die App oder klicke auf "Bild laden". DJI-Drohnenbilder erkennen den Massstab automatisch.',
    tip: 'Formate: JPEG, PNG, WebP, TIFF, PDF',
    highlight: null,
    anim: animLoad,
    action: 'loadDemo',
    cta: 'Demo laden & weiter',
  },
  {
    title: 'Massstab setzen',
    desc: 'Klicke <b>"Massstab"</b> und zeichne eine Linie ueber eine bekannte Strecke. Gib die echte Laenge ein — alle Messungen werden daraus berechnet.',
    tip: 'Je laenger die Referenzstrecke, desto genauer alle Messungen.',
    highlight: 'btn-ref',
    anim: animRef,
    cta: 'Weiter',
  },
  {
    title: 'Hilfslinien & Punkte',
    desc: 'Setze <b>Hilfslinien</b> entlang von Grenzen oder Waenden. Beim Zeichnen werden Abstaende zur Hilfslinie automatisch angezeigt.',
    tip: 'Hilfslinien koennen in der Sidebar verwaltet und ein-/ausgeblendet werden.',
    highlight: 'btn-pipe-ref-line',
    anim: animGuideline,
    cta: 'Weiter',
  },
  {
    title: 'Distanzen messen',
    desc: 'Klicke <b>"Distanz"</b>, dann zwei Punkte. Die Entfernung wird sofort in Metern angezeigt. Mit <b>Shift</b> wird horizontal/vertikal eingerastet.',
    tip: 'Alle Messungen erscheinen in der Sidebar unter "Messungen".',
    highlight: 'btn-distance',
    anim: animDistance,
    cta: 'Weiter',
  },
  {
    title: 'Flaechen messen',
    desc: 'Klicke <b>"Flaeche"</b> und setze die Eckpunkte. <b>Doppelklick</b> schliesst das Polygon. Jede Kante zeigt die Einzellaenge an.',
    tip: 'Doppelklick auf eine fertige Flaeche → Eckpunkte ziehen zum Nachbearbeiten.',
    highlight: 'btn-area',
    anim: animArea,
    cta: 'Weiter',
  },
  {
    title: 'Leitungen zeichnen',
    desc: 'Waehle <b>"Leitung"</b> und den Typ (Trinkwasser, Abwasser, Strom, Gas, ...). Klicke die Punkte, <b>Doppelklick</b> schliesst ab.',
    tip: 'Mit "Parallel" zeichnest du Leitungen exakt parallel zu einer Hilfslinie.',
    highlight: 'btn-pipe',
    anim: animPipe,
    cta: 'Weiter',
  },
  {
    title: 'Bereit!',
    desc: 'Du kennst jetzt alle Werkzeuge. <b>Speichern</b> sichert das Projekt als JSON. <b>Cmd+Z</b> macht jede Aktion rueckgaengig. Scrolle zum Zoomen.',
    tip: 'Tutorial jederzeit ueber den "?" Button oben rechts erneut starten.',
    highlight: null,
    anim: animDone,
    cta: 'Los geht\'s!',
    ctaStyle: 'green',
  },
];

// ── Tutorial state ────────────────────────────────────

let _panel = null;
let _scrim = null;
let _step = 0;
let _onKeyHandler = null;

export function showTutorial() {
  if (_panel) closeTutorial();

  _step = 0;

  // Scrim (subtle, non-blocking)
  _scrim = document.createElement('div');
  _scrim.className = 'tut-scrim';
  document.body.appendChild(_scrim);

  // Panel
  _panel = document.createElement('div');
  _panel.className = 'tut-panel';
  _panel.id = 'tutorial-ob';
  document.body.appendChild(_panel);

  render();

  // Keyboard navigation
  _onKeyHandler = e => {
    if (!document.getElementById('tutorial-ob')) { document.removeEventListener('keydown', _onKeyHandler); return; }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); _step < STEPS.length - 1 ? goTo(_step + 1) : closeTutorial(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(_step - 1); }
    if (e.key === 'Escape') { e.preventDefault(); closeTutorial(); }
  };
  document.addEventListener('keydown', _onKeyHandler);
}

function closeTutorial() {
  document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
  if (_panel) { _panel.style.opacity = '0'; setTimeout(() => { _panel?.remove(); _panel = null; }, 200); }
  if (_scrim) { _scrim.style.opacity = '0'; setTimeout(() => { _scrim?.remove(); _scrim = null; }, 200); }
  if (_onKeyHandler) { document.removeEventListener('keydown', _onKeyHandler); _onKeyHandler = null; }
  localStorage.setItem('gp_tut_seen', '1');
}

function goTo(i) {
  _step = Math.max(0, Math.min(STEPS.length - 1, i));
  render();
}

function render() {
  if (!_panel) return;
  const sd = STEPS[_step];
  const isLast = _step === STEPS.length - 1;
  const stepLabel = isLast ? 'Fertig' : `Schritt ${_step + 1} von ${STEPS.length}`;

  // Highlight toolbar button
  document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
  if (sd.highlight) {
    const btn = document.getElementById(sd.highlight);
    if (btn) btn.classList.add('tut-highlight');
  }

  const dots = STEPS.map((_, i) =>
    `<div class="tut-dot ${i === _step ? 'active' : ''}" data-i="${i}"></div>`
  ).join('');

  _panel.innerHTML = `
    <div class="tut-panel-head">
      <span class="tut-panel-step">${stepLabel}</span>
      <button class="tut-panel-close" id="tut-close-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="tut-stage">${sd.anim()}</div>
    <div class="tut-panel-body">
      <div class="tut-panel-title">${sd.title}</div>
      <div class="tut-panel-desc">${sd.desc}</div>
      ${sd.tip ? `<div class="tut-panel-tip">${sd.tip}</div>` : ''}
    </div>
    <div class="tut-panel-foot">
      <div class="tut-dots">${dots}</div>
      <div class="tut-btn-row">
        ${_step > 0 ? `<button class="tut-btn-back" id="tut-back">\u2190</button>` : ''}
        <button class="tut-btn-next ${sd.ctaStyle || ''}" id="tut-next">${sd.cta}</button>
      </div>
      <button class="tut-btn-skip" id="tut-skip">Schliessen</button>
    </div>`;

  // Bind events
  _panel.querySelector('#tut-close-btn').addEventListener('click', closeTutorial);
  _panel.querySelector('#tut-skip').addEventListener('click', closeTutorial);
  _panel.querySelector('#tut-back')?.addEventListener('click', () => goTo(_step - 1));
  _panel.querySelector('#tut-next').addEventListener('click', () => {
    if (sd.action === 'loadDemo') loadDemoImage();
    if (isLast) closeTutorial();
    else goTo(_step + 1);
  });
  _panel.querySelectorAll('.tut-dot').forEach(dot => {
    dot.onclick = () => goTo(parseInt(dot.dataset.i));
  });
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

    canvas.getObjects().filter(o => o._isBackground).forEach(o => canvas.remove(o));
    canvas.add(fImg);
    canvas.sendToBack(fImg);
    state.backgroundImage = fImg;
    state.imgDisplayScale = scale;
    state.scale = 500 / 12;
    state.scaleSource = 'demo';
    canvas.renderAll();
  };
  img.src = DEMO_IMAGE;
}

// Expose globally
window.showTutorial = showTutorial;
