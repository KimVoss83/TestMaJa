// =========================================================
// STATE — Single source of truth
// =========================================================

export const state = {
  tool: 'select',
  color: '#4ecca3',
  fontSize: 6,
  lineWidth: 1,
  labelBg: true,            // true = weißer Hintergrund / schwarze Schrift
  scale: null,              // original-px per meter
  scaleSource: null,        // 'ref' | 'pdf'
  exifAltitude: null,       // Flughöhe in m (für EXIF/form-Genauigkeit)
  imgDisplayScale: 1,       // canvas-px pro original-px (Fit-Skalierung beim Laden)
  refLines: [],             // [{pxLen, realLen_m}] — alle Referenzlinien (KQ-Ausgleich)
  refSumL2: 0,              // Σ realLen_m² — für Fehlerformel
  imgOriginalWidth: null,   // Originalpixelbreite des geladenen Bildes

  // ref
  refLine: null,
  refPoints: [],

  // distance
  distPoints: [],
  drawingLine: null,

  // area
  areaPoints: [],
  drawingPolygon: null,

  // circle
  circleCenter: null,
  drawingCircle: null,
  drawingRadiusLine: null,

  // arc / sector
  arcStep: 0,               // 0=idle, 1=center set, 2=start set
  arcCenter: null,
  arcStartPt: null,
  drawingArcPath: null,
  drawingArcLines: [],

  measurements: [],
  // grid
  gridVisible: false,
  gridStepM: 0,        // 0 = auto
  gridColor: '#ffffff',
  gridOpacity: 0.28,

  editingArea: null,          // { id, polygon, handles: [] } — active area edit session

  backgroundImage: null,
  zoom: 1,
  panning: false,
  lastPan: null,

  rooms: [],          // Wohnflächen-Räume (siehe Spec-Datenmodell)
  roomDraft: [],      // Punkte des aktuell gezeichneten Raum-Polygons
  roomSnap: true,     // 90°-Snap default AN (Shift = frei)
  printScale: null,   // 1:X aus PDF-Kalibrierung (nur Anzeige)
  pdfPage: null,       // { widthPt, heightPt, renderedWidthPx } nach PDF-Import
};

export let measureId = 0;
export function nextMeasureId() { return ++measureId; }
export function setMeasureId(val) { measureId = val; }

export const CANVAS_SERIAL_PROPS = ['_measureId','_isRef','_noSelect','_circlePreview','_arcPreview',
  '_tempDraw','_userLabel','_isBackground','_libItem','_customLib',
  '_areaHandle','_areaHandleIdx','_areaHandleMeasureId',
  '_areaEdgeLabel','_areaEdgeIdx'];

// Touch-only Geräte: Touch vorhanden UND kein präziser Mauszeiger (hover)
// → Laptops mit Touchscreen (Edge, Chrome) werden NICHT als mobil erkannt
const _hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const _hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const _isTouchDevice = _hasTouch && !_hasMouse;
if (_isTouchDevice) document.documentElement.classList.add('touch-device');
export const TOUCH_SCALE = _isTouchDevice ? 1.5 : 1.0;
