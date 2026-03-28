// =========================================================
// STATE — Single source of truth
// =========================================================

export const PIPE_TYPES = {
  // Neue Spec-Keys (9 Medien)
  TW:          { label: 'Trinkwasser',       color: '#1565C0', dash: [],                   strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>' },
  AW:          { label: 'Abwasser',           color: '#795548', dash: [20,4,4,4],           strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 12V6a4 4 0 0 1 8 0v6"/><path d="M12 20v2"/></svg>' },
  RW:          { label: 'Regenwasser',        color: '#29B6F6', dash: [10,6],               strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="8" y1="20" x2="8" y2="20.01"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="12" y1="22" x2="12" y2="22.01"/><line x1="16" y1="16" x2="16" y2="16.01"/><line x1="16" y1="20" x2="16" y2="20.01"/></svg>' },
  GB:          { label: 'Gartenbew.',         color: '#43A047', dash: [22,8],               strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 10-10 10 10 0 0 0 10 10h-3"/><path d="M7 20h10"/></svg>' },
  G:           { label: 'Gas',                color: '#FFC107', dash: [16,6],               strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>' },
  St:          { label: 'Strom',              color: '#E53935', dash: [18,4,4,4,4,4],       strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  GF:          { label: 'Glasfaser',          color: '#8E24AA', dash: [4,4,14,4],           strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
  Cu:          { label: 'Kupfer',             color: '#EF6C00', dash: [8,3,8,3],            strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6.5l3-3"/><path d="M12 8.5l-3-3"/><path d="M12 22v-6.5l3 3"/><path d="M12 15.5l-3 3"/><circle cx="12" cy="12" r="3"/></svg>' },
  LR:          { label: 'Leerrohr',           color: '#9E9E9E', dash: [3,5],                strokeWidth: 5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>' },
  // Legacy-Aliase (für alte gespeicherte Pläne)
  FA:          { label: 'Feldaufnahme',      color: '#E65100', dash: [],                   strokeWidth: 2.5, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
  wasser:      { label: 'Trinkwasser',       color: '#1565C0', dash: [],                   strokeWidth: 5, get icon(){ return PIPE_TYPES.TW.icon; } },
  abwasser:    { label: 'Abwasser',           color: '#795548', dash: [20,4,4,4],           strokeWidth: 5, get icon(){ return PIPE_TYPES.AW.icon; } },
  strom:       { label: 'Strom',              color: '#E53935', dash: [18,4,4,4,4,4],       strokeWidth: 5, get icon(){ return PIPE_TYPES.St.icon; } },
  internet:    { label: 'Glasfaser',          color: '#8E24AA', dash: [4,4,14,4],           strokeWidth: 5, get icon(){ return PIPE_TYPES.GF.icon; } },
  regenwasser: { label: 'Regenwasser',        color: '#29B6F6', dash: [10,6],               strokeWidth: 5, get icon(){ return PIPE_TYPES.RW.icon; } },
  leerrohr:    { label: 'Leerrohr',           color: '#9E9E9E', dash: [3,5],                strokeWidth: 5, get icon(){ return PIPE_TYPES.LR.icon; } },
  bewaesserung:{ label: 'Gartenbew.',         color: '#43A047', dash: [22,8],               strokeWidth: 5, get icon(){ return PIPE_TYPES.GB.icon; } },
  regner:      { label: 'Gartenbew.',         color: '#43A047', dash: [22,8],               strokeWidth: 5, get icon(){ return PIPE_TYPES.GB.icon; } },
};

export const state = {
  tool: 'select',
  color: '#4ecca3',
  fontSize: 6,
  lineWidth: 1,
  labelBg: true,            // true = weißer Hintergrund / schwarze Schrift
  scale: null,              // original-px per meter
  scaleSource: null,        // 'exif' | 'form' | 'ref'
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

  // pipe
  pipeLayerVisible: true,
  pipeType: 'TW',
  pipePoints: [],
  drawingPipeLine: null,
  editingPipe: null,          // { id, polyline, handles: [] } — active pipe edit session
  editingArea: null,          // { id, polygon, handles: [] } — active area edit session
  pipeSnapLines: [],          // temp canvas objects for snap/distance guides
  assignModePipeId: null,
  _refsSnapshot: null,

  // pipe references (Grenzlinien / Referenzpunkte)
  pipeReferences: [],         // [{ id, type:'line'|'point', name }]
  activePipeRefs: [],         // IDs der aktiven Referenzen für Abstandsanzeige
  pipeRefMode: null,          // null | 'line-1' | 'line-2' | 'point' — sub-mode für Ref-Erstellung
  pipeRefTempPt: null,        // erster Punkt einer Ref-Linie
  parallelSnap: null,         // { refId, distancePx } — aktiver Parallel-Snap für Pipe-Tool

  backgroundImage: null,
  zoom: 1,
  panning: false,
  lastPan: null,
};

export let measureId = 0;
export function nextMeasureId() { return ++measureId; }
export function setMeasureId(val) { measureId = val; }

export const CANVAS_SERIAL_PROPS = ['_measureId','_isRef','_noSelect','_circlePreview','_arcPreview',
  '_tempDraw','_pipeType','_isPipeLegend','_pipePreview','_pipeDepth','_origPoints','_pipeOffset',
  '_pipeRefId','_pipeRefType','_pipeRefName','_userLabel','_isBackground','_libItem','_customLib',
  '_dimLinePipeId','_dimDraggableFoot','_dimRefId','_dimMeasureId',
  '_isPipeTag','_areaHandle','_areaHandleIdx','_areaHandleMeasureId'];

export const _isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (_isTouchDevice) document.documentElement.classList.add('touch-device');
export const TOUCH_SCALE = _isTouchDevice ? 1.5 : 1.0;
