import { PIPE_TYPES, state, measureId, nextMeasureId, setMeasureId, CANVAS_SERIAL_PROPS, _isTouchDevice, TOUCH_SCALE } from './state.js';
import { canvas, wrapper, _safeHandler, showZoomHUD, setZoom, zoomToFit, startPan, stopPan } from './canvas.js';
import { history, registerRestoreHook, getSnapshot, saveSnapshot, restoreSnapshot, undo, redo, updateUndoRedoButtons } from './undo.js';
import { showToast, haptic, showMeasurementToast, createModal } from './ui/modals.js';
import { snapToPixel, projectPointOnLine, closestPointOnSegment, addLabel, addEndpointDot, addRefEndmarks, addTickMarks, ptDist, pointToSegmentDist, polygonArea, formatDistance, formatArea, formatErr } from './utils/helpers.js';
import * as _loupe from './utils/loupe.js';
import { throttledRender } from './utils/loupe.js';
import { drawGrid, toggleGrid, setGridStep, setGridColor, setGridOpacity } from './ui/grid.js';
import { MATERIALS, openMaterialCalc } from './ui/materialrechner.js';
import { _prevCounts, _notifyBadge } from './ui/statusbar.js';
import { showWelcomeOnboarding } from './onboarding/welcome.js';
import { initRefOnboarding, showRefOnboarding } from './onboarding/ref-onboarding.js';
import { initWhatsNew } from './ui/whats-new.js';
import { TOOL_NAMES, TOOL_HINTS, MEASURE_TOOLS, setTool, requireScale, updateMeasureButtons, initToolManager, initToolbar, registerToolHook } from './tools/tool-manager.js';
import { handleDistanceClick, finishDistance } from './tools/distance.js';
import { handleAreaClick, updatePreviewPolygon, finishArea } from './tools/area.js';
import { handleCircleClick, updatePreviewCircle, finishCircle } from './tools/circle.js';
import { handleArcClick, updatePreviewArc, arcSweepDir, buildSectorPath, finishArc } from './tools/arc.js';
import { handleLabelClick, editLabel, updateLiveLabel, removeLiveLabel } from './tools/label.js';
import { SENSOR_DB, lookupSensor, calcGSD, calcAccuracy, calcRequiredForTarget, calcFlightRecommendation, flightRecommendationTableHTML, distErr_m, areaRelErr_pct, showAccuracyDetail, hideAccuracyDetail } from './io/photogrammetry.js';
import { handleRefClick, promptReference, updateRefStatus } from './tools/ref.js';
import { PIPE_LINE_WIDTH, handlePipeClick, updatePreviewPipe, finishPipe, startPipeEdit, endPipeEdit, updatePipeFromHandles, insertPipeVertex, deletePipeVertex, togglePipeLayer, sendPipesToBack, offsetOverlappingPipes, updatePipePanel } from './tools/pipe.js';
import { PIPE_REF_LINE_COLOR, PIPE_REF_GUIDE_COLOR, handlePipeRefClick, promptPipeRefName, createPipeRefLine, createPipeRefPoint, removePipeRef, togglePipeRef, updatePipeRefList } from './tools/pipe-refs.js';
import { clearPipeDistanceGuides, showPipeDistanceGuides, computeDimLine, renderDimLinesForPipe, renderAllDimLines, clearDimLinesForPipe } from './ui/pipe-guides.js';
import { startAssignMode, endAssignMode, confirmAssignMode, cancelAssignMode, toggleRefAssignment, directToggleRef } from './ui/pipe-assign.js';
import { updatePipeLegend } from './ui/pipe-legend.js';

// =========================================================
// LIBRARY — 2D-Skizzen Vogelperspektive
// =========================================================
const LIBRARY = [
  // ── Bäume ───────────────────────────────────────────────
  { cat: 'Bäume', name: 'Laubbaum\ngroß', size: 90, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="32" cy="34" rx="22" ry="20" fill="rgba(0,0,0,0.12)"/><path d="M30 8 C35 7 41 9 45 14 C50 19 51 27 49 33 C47 39 42 44 36 46 C31 48 25 47 20 43 C14 39 11 31 12 24 C13 17 17 10 22 9 C25 7 28 8 30 8Z" fill="#b4d484" stroke="#4a7224" stroke-width="1.3"/><path d="M30 14 C34 13 39 16 42 21 C44 26 43 32 40 36 C37 40 33 42 29 41 C24 40 20 35 20 29 C20 23 25 15 30 14Z" fill="#98c464" opacity="0.6"/><g stroke="#3d6020" stroke-width="0.7" opacity="0.45"><line x1="30" y1="30" x2="30" y2="9"/><line x1="30" y1="30" x2="46" y2="16"/><line x1="30" y1="30" x2="49" y2="33"/><line x1="30" y1="30" x2="37" y2="46"/><line x1="30" y1="30" x2="19" y2="44"/><line x1="30" y1="30" x2="12" y2="27"/><line x1="30" y1="30" x2="16" y2="13"/></g><circle cx="30" cy="30" r="2.8" fill="#6b4220" stroke="#472c12" stroke-width="0.9"/></svg>` },
  { cat: 'Bäume', name: 'Laubbaum\nmittel', size: 65, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="32" cy="33" rx="18" ry="16" fill="rgba(0,0,0,0.12)"/><path d="M30 11 C34 10 40 13 43 18 C47 23 47 30 44 35 C41 40 36 44 31 44 C26 44 21 41 18 36 C14 30 14 23 17 18 C20 13 26 11 30 11Z" fill="#b8da8a" stroke="#4a7224" stroke-width="1.2"/><path d="M30 17 C33 16 37 19 39 23 C41 28 40 33 37 37 C34 40 30 41 27 39 C23 37 21 32 22 27 C23 21 27 17 30 17Z" fill="#9cc870" opacity="0.6"/><g stroke="#3d6020" stroke-width="0.7" opacity="0.45"><line x1="30" y1="30" x2="30" y2="12"/><line x1="30" y1="30" x2="44" y2="18"/><line x1="30" y1="30" x2="45" y2="33"/><line x1="30" y1="30" x2="32" y2="44"/><line x1="30" y1="30" x2="17" y2="40"/><line x1="30" y1="30" x2="14" y2="24"/></g><circle cx="30" cy="30" r="2.2" fill="#6b4220" stroke="#472c12" stroke-width="0.9"/></svg>` },
  { cat: 'Bäume', name: 'Laubbaum\nklein', size: 45, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="32" cy="33" rx="14" ry="13" fill="rgba(0,0,0,0.12)"/><path d="M30 15 C33 14 37 16 40 21 C43 26 43 32 40 36 C37 40 33 42 29 41 C25 40 21 37 19 32 C17 27 18 21 21 17 C24 14 27 15 30 15Z" fill="#bada90" stroke="#4a7224" stroke-width="1.2"/><path d="M30 21 C33 20 36 22 37 26 C38 30 37 34 34 36 C32 38 29 38 27 36 C24 34 23 30 24 26 C25 22 28 21 30 21Z" fill="#a0cc74" opacity="0.6"/><g stroke="#3d6020" stroke-width="0.7" opacity="0.45"><line x1="30" y1="30" x2="30" y2="16"/><line x1="30" y1="30" x2="41" y2="21"/><line x1="30" y1="30" x2="41" y2="36"/><line x1="30" y1="30" x2="19" y2="37"/><line x1="30" y1="30" x2="18" y2="21"/></g><circle cx="30" cy="30" r="1.8" fill="#6b4220" stroke="#472c12" stroke-width="0.8"/></svg>` },
  { cat: 'Bäume', name: 'Nadelbaum', size: 60, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="32" cy="34" rx="18" ry="15" fill="rgba(0,0,0,0.13)"/><g transform="translate(30,30)"><polygon points="0,-20 3,-9 8,-16 4,-5 14,-10 7,0 14,10 4,5 8,16 3,9 0,20 -3,9 -8,16 -4,5 -14,10 -7,0 -14,-10 -4,-5 -8,-16 -3,-9" fill="#5e8c38" stroke="#3a6020" stroke-width="1" stroke-linejoin="round"/><circle cx="0" cy="0" r="6.5" fill="#4a7230" stroke="#2e5018" stroke-width="0.9"/><circle cx="0" cy="0" r="2.2" fill="#6b4220" stroke="#472c12" stroke-width="0.8"/></g></svg>` },
  { cat: 'Bäume', name: 'Obstbaum', size: 65, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="32" cy="33" rx="19" ry="17" fill="rgba(0,0,0,0.11)"/><path d="M30 11 C35 10 40 13 44 18 C48 23 48 30 45 35 C42 40 37 44 32 44 C27 44 22 41 18 36 C15 31 14 24 17 19 C20 13 26 11 30 11Z" fill="#c8e4a0" stroke="#508028" stroke-width="1.2"/><path d="M30 17 C34 16 37 18 39 22 C41 27 40 33 37 36 C34 39 30 40 27 38 C23 36 22 31 23 26 C24 20 27 17 30 17Z" fill="#b0d880" opacity="0.55"/><g stroke="#3d6020" stroke-width="0.65" opacity="0.4"><line x1="30" y1="30" x2="30" y2="12"/><line x1="30" y1="30" x2="45" y2="19"/><line x1="30" y1="30" x2="45" y2="35"/><line x1="30" y1="30" x2="16" y2="39"/><line x1="30" y1="30" x2="14" y2="22"/></g><circle cx="21" cy="20" r="3" fill="#cc2818" stroke="#981808" stroke-width="0.7"/><circle cx="38" cy="17" r="3" fill="#cc2818" stroke="#981808" stroke-width="0.7"/><circle cx="43" cy="32" r="3" fill="#e09020" stroke="#b06010" stroke-width="0.7"/><circle cx="36" cy="42" r="3" fill="#cc2818" stroke="#981808" stroke-width="0.7"/><circle cx="19" cy="38" r="3" fill="#e09020" stroke="#b06010" stroke-width="0.7"/><circle cx="30" cy="30" r="2.2" fill="#6b4220" stroke="#472c12" stroke-width="0.8"/></svg>` },

  // ── Sträucher ────────────────────────────────────────────
  { cat: 'Sträucher', name: 'Strauch', size: 55, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="31" cy="35" rx="20" ry="16" fill="rgba(0,0,0,0.11)"/><path d="M18 32 C16 26 18 20 23 17 C27 14 33 15 37 17 C41 14 47 17 48 24 C49 30 45 37 40 39 C37 41 33 41 29 39 C24 41 19 38 18 32Z" fill="#a8cc78" stroke="#48701e" stroke-width="1.3"/><path d="M23 30 C23 24 26 21 30 21 C34 21 37 24 37 29 C37 34 34 37 30 37 C26 37 23 34 23 30Z" fill="#8eb860" opacity="0.6"/></svg>` },
  { cat: 'Sträucher', name: 'Rosenbusch', size: 50, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="31" cy="35" rx="19" ry="15" fill="rgba(0,0,0,0.11)"/><path d="M19 32 C17 26 19 20 24 17 C28 14 34 15 38 17 C42 14 47 18 47 25 C48 31 43 38 38 40 C35 42 31 42 27 40 C22 41 18 38 19 32Z" fill="#b0cc88" stroke="#48701e" stroke-width="1.2"/><path d="M24 30 C24 25 27 22 30 22 C34 22 37 25 37 29 C37 33 34 36 31 36 C27 36 24 33 24 30Z" fill="#98b870" opacity="0.55"/><circle cx="24" cy="23" r="3.5" fill="#e06888" stroke="#b83858" stroke-width="0.8"/><circle cx="24" cy="23" r="1.3" fill="#c03050"/><circle cx="37" cy="21" r="3.5" fill="#e87090" stroke="#b83858" stroke-width="0.8"/><circle cx="37" cy="21" r="1.3" fill="#c03050"/><circle cx="41" cy="32" r="3.2" fill="#e06888" stroke="#b83858" stroke-width="0.8"/><circle cx="41" cy="32" r="1.2" fill="#c03050"/><circle cx="21" cy="38" r="2.8" fill="#e87090" stroke="#b83858" stroke-width="0.8"/><circle cx="36" cy="39" r="2.8" fill="#e06888" stroke="#b83858" stroke-width="0.8"/></svg>` },
  { cat: 'Sträucher', name: 'Hecke', size: 120, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><ellipse cx="60" cy="26" rx="56" ry="13" fill="rgba(0,0,0,0.11)"/><rect x="3" y="9" width="114" height="24" rx="4" fill="#98c870" stroke="#487828" stroke-width="1.3"/><path d="M3 18 C12 11 22 16 32 11 C42 7 52 13 62 11 C72 9 82 14 92 11 C102 9 112 13 117 11" fill="none" stroke="#5a8830" stroke-width="1.1" opacity="0.5"/><path d="M8 12 Q14 6 20 12 Q26 6 32 12 Q38 6 44 12 Q50 6 56 12 Q62 6 68 12 Q74 6 80 12 Q86 6 92 12 Q98 6 104 12 Q110 6 116 12" fill="none" stroke="#487828" stroke-width="1.3"/><rect x="3" y="9" width="114" height="24" rx="4" fill="none" stroke="#487828" stroke-width="1.3"/></svg>` },
  { cat: 'Sträucher', name: 'Bambus', size: 50, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="31" cy="35" rx="19" ry="15" fill="rgba(0,0,0,0.09)"/><circle cx="20" cy="30" r="3.8" fill="#8cc048" stroke="#567828" stroke-width="1"/><circle cx="28" cy="24" r="3.2" fill="#98c850" stroke="#567828" stroke-width="1"/><circle cx="37" cy="27" r="3.8" fill="#88b840" stroke="#567828" stroke-width="1"/><circle cx="30" cy="36" r="3.2" fill="#8cc048" stroke="#567828" stroke-width="1"/><circle cx="21" cy="39" r="3" fill="#98c850" stroke="#567828" stroke-width="1"/><circle cx="39" cy="39" r="3.2" fill="#88b840" stroke="#567828" stroke-width="1"/><circle cx="44" cy="27" r="2.8" fill="#80a838" stroke="#567828" stroke-width="1"/><circle cx="15" cy="22" r="2.8" fill="#8cc048" stroke="#567828" stroke-width="1"/><path d="M20 28 Q12 21 8 23" fill="none" stroke="#507020" stroke-width="1.1" stroke-linecap="round"/><path d="M37 25 Q45 18 49 20" fill="none" stroke="#507020" stroke-width="1.1" stroke-linecap="round"/><path d="M30 34 Q28 25 30 19" fill="none" stroke="#507020" stroke-width="0.9" stroke-linecap="round"/></svg>` },

  // ── Beete ────────────────────────────────────────────────
  { cat: 'Beete', name: 'Blumenbeet', size: 110, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 70"><rect x="3" y="3" width="104" height="64" rx="4" fill="#e4dcc8" stroke="#8a6a3a" stroke-width="1.4"/><circle cx="18" cy="18" r="7" fill="#f0a0bc" stroke="#c05878" stroke-width="0.9"/><circle cx="18" cy="18" r="3" fill="#f8d0e0"/><circle cx="18" cy="18" r="1.4" fill="#d06080"/><circle cx="40" cy="30" r="7" fill="#f8d060" stroke="#c09018" stroke-width="0.9"/><circle cx="40" cy="30" r="3" fill="#fce890"/><circle cx="40" cy="30" r="1.4" fill="#c09018"/><circle cx="18" cy="50" r="6.5" fill="#90b4e8" stroke="#3868b0" stroke-width="0.9"/><circle cx="18" cy="50" r="2.5" fill="#c0d8f4"/><circle cx="18" cy="50" r="1.2" fill="#3868b0"/><circle cx="60" cy="14" r="6" fill="#c090d0" stroke="#7040a0" stroke-width="0.9"/><circle cx="60" cy="14" r="2.5" fill="#e0c0f0"/><circle cx="60" cy="14" r="1.2" fill="#7040a0"/><circle cx="80" cy="28" r="7" fill="#f4a040" stroke="#c06010" stroke-width="0.9"/><circle cx="80" cy="28" r="3" fill="#fcc880"/><circle cx="80" cy="28" r="1.4" fill="#c06010"/><circle cx="58" cy="52" r="6.5" fill="#f0a0bc" stroke="#c05878" stroke-width="0.9"/><circle cx="58" cy="52" r="2.5" fill="#f8d0e0"/><circle cx="58" cy="52" r="1.2" fill="#d06080"/><circle cx="94" cy="48" r="6" fill="#f4f0e0" stroke="#a09050" stroke-width="0.9"/><circle cx="94" cy="48" r="2.5" fill="#fffcf0"/><circle cx="94" cy="48" r="1.2" fill="#a09050"/><circle cx="94" cy="15" r="6.5" fill="#e04040" stroke="#a01010" stroke-width="0.9"/><circle cx="94" cy="15" r="2.5" fill="#f88080"/><circle cx="94" cy="15" r="1.2" fill="#a01010"/><g fill="#78a848" opacity="0.75"><circle cx="30" cy="20" r="2"/><circle cx="52" cy="20" r="2"/><circle cx="32" cy="46" r="2"/><circle cx="70" cy="42" r="2"/><circle cx="44" cy="58" r="2"/><circle cx="74" cy="56" r="2"/></g><rect x="3" y="3" width="104" height="64" rx="4" fill="none" stroke="#8a6a3a" stroke-width="1.4"/></svg>` },
  { cat: 'Beete', name: 'Gemüsebeet', size: 120, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="3" y="3" width="114" height="74" rx="3" fill="#d0b070" stroke="#7a5a2a" stroke-width="1.4"/><line x1="3" y1="22" x2="117" y2="22" stroke="#7a5a2a" stroke-width="0.9" stroke-dasharray="4,3"/><line x1="3" y1="41" x2="117" y2="41" stroke="#7a5a2a" stroke-width="0.9" stroke-dasharray="4,3"/><line x1="3" y1="60" x2="117" y2="60" stroke="#7a5a2a" stroke-width="0.9" stroke-dasharray="4,3"/><g fill="#88c050" stroke="#487820" stroke-width="0.8"><circle cx="14" cy="12" r="4.5"/><circle cx="28" cy="12" r="4.5"/><circle cx="42" cy="12" r="4.5"/><circle cx="56" cy="12" r="4.5"/><circle cx="70" cy="12" r="4.5"/><circle cx="84" cy="12" r="4.5"/><circle cx="98" cy="12" r="4.5"/><circle cx="112" cy="12" r="4.5"/></g><g><circle cx="15" cy="31" r="5.5" fill="#e04830" stroke="#981808" stroke-width="0.8"/><circle cx="15" cy="31" r="1.8" fill="#c02818"/><circle cx="31" cy="31" r="5.5" fill="#e04830" stroke="#981808" stroke-width="0.8"/><circle cx="31" cy="31" r="1.8" fill="#c02818"/><circle cx="47" cy="31" r="5.5" fill="#e04830" stroke="#981808" stroke-width="0.8"/><circle cx="47" cy="31" r="1.8" fill="#c02818"/><circle cx="63" cy="31" r="5.5" fill="#e04830" stroke="#981808" stroke-width="0.8"/><circle cx="63" cy="31" r="1.8" fill="#c02818"/><circle cx="79" cy="31" r="5.5" fill="#e04830" stroke="#981808" stroke-width="0.8"/><circle cx="79" cy="31" r="1.8" fill="#c02818"/><circle cx="95" cy="31" r="5.5" fill="#e04830" stroke="#981808" stroke-width="0.8"/><circle cx="95" cy="31" r="1.8" fill="#c02818"/><circle cx="111" cy="31" r="5.5" fill="#e04830" stroke="#981808" stroke-width="0.8"/><circle cx="111" cy="31" r="1.8" fill="#c02818"/></g><g fill="#70a838" stroke="#386018" stroke-width="0.8"><ellipse cx="16" cy="50" rx="7" ry="4" transform="rotate(-30 16 50)"/><ellipse cx="34" cy="50" rx="7" ry="4" transform="rotate(30 34 50)"/><ellipse cx="52" cy="50" rx="7" ry="4" transform="rotate(-30 52 50)"/><ellipse cx="70" cy="50" rx="7" ry="4" transform="rotate(30 70 50)"/><ellipse cx="88" cy="50" rx="7" ry="4" transform="rotate(-30 88 50)"/><ellipse cx="106" cy="50" rx="7" ry="4" transform="rotate(30 106 50)"/></g><g stroke="#589820" stroke-width="0.9" fill="none"><path d="M10 68 Q13 62 16 68"/><path d="M18 66 Q20 60 22 66"/><path d="M26 68 Q29 62 32 68"/><path d="M34 66 Q36 60 38 66"/><path d="M42 68 Q45 62 48 68"/><path d="M50 66 Q52 60 54 66"/><path d="M58 68 Q61 62 64 68"/><path d="M66 66 Q68 60 70 66"/><path d="M74 68 Q77 62 80 68"/><path d="M82 66 Q84 60 86 66"/><path d="M90 68 Q93 62 96 68"/><path d="M98 66 Q100 60 102 66"/></g><rect x="3" y="3" width="114" height="74" rx="3" fill="none" stroke="#7a5a2a" stroke-width="1.4"/></svg>` },
  { cat: 'Beete', name: 'Rasen', size: 110, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 80"><rect x="3" y="3" width="104" height="74" rx="3" fill="#cce8a0" stroke="#508830" stroke-width="1.4"/><rect x="3" y="3" width="17.3" height="74" fill="#b8da8c" opacity="0.7"/><rect x="20.3" y="3" width="17.3" height="74" fill="#cce8a0" opacity="0.7"/><rect x="37.6" y="3" width="17.3" height="74" fill="#b8da8c" opacity="0.7"/><rect x="54.9" y="3" width="17.3" height="74" fill="#cce8a0" opacity="0.7"/><rect x="72.2" y="3" width="17.3" height="74" fill="#b8da8c" opacity="0.7"/><rect x="89.5" y="3" width="17.5" height="74" fill="#cce8a0" opacity="0.7"/><rect x="3" y="3" width="104" height="74" rx="3" fill="none" stroke="#508830" stroke-width="1.4"/></svg>` },
  { cat: 'Beete', name: 'Kräuterbeet', size: 80, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="3" y="3" width="74" height="74" rx="3" fill="#dcd4a8" stroke="#7a6a20" stroke-width="1.4"/><line x1="40" y1="3" x2="40" y2="77" stroke="#7a6a20" stroke-width="1.3"/><line x1="3" y1="40" x2="77" y2="40" stroke="#7a6a20" stroke-width="1.3"/><g fill="#78b840" stroke="#406020" stroke-width="0.9"><ellipse cx="16" cy="17" rx="5.5" ry="3.5" transform="rotate(-25 16 17)"/><ellipse cx="26" cy="13" rx="5" ry="3" transform="rotate(20 26 13)"/><ellipse cx="21" cy="24" rx="4.5" ry="3" transform="rotate(-10 21 24)"/><ellipse cx="32" cy="20" rx="4.5" ry="3" transform="rotate(15 32 20)"/></g><g fill="#90a850" stroke="#506020" stroke-width="0.7"><circle cx="52" cy="13" r="2.8"/><circle cx="59" cy="18" r="2.8"/><circle cx="66" cy="12" r="2.8"/><circle cx="72" cy="19" r="2.8"/><circle cx="55" cy="25" r="2.8"/><circle cx="69" cy="26" r="2.8"/><circle cx="62" cy="32" r="2.8"/><circle cx="50" cy="30" r="2.8"/></g><g fill="#70c880" stroke="#308040" stroke-width="0.9"><ellipse cx="16" cy="53" rx="5.5" ry="2.8"/><ellipse cx="26" cy="57" rx="5.5" ry="2.8" transform="rotate(15 26 57)"/><ellipse cx="20" cy="64" rx="5.5" ry="2.8" transform="rotate(-10 20 64)"/><ellipse cx="33" cy="59" rx="5" ry="2.8" transform="rotate(25 33 59)"/><ellipse cx="13" cy="70" rx="5" ry="2.8" transform="rotate(-20 13 70)"/></g><g stroke="#587028" stroke-width="0.9" fill="none"><line x1="56" y1="52" x2="53" y2="44"/><line x1="56" y1="52" x2="59" y2="44"/><line x1="56" y1="52" x2="50" y2="48"/><line x1="56" y1="52" x2="62" y2="48"/><line x1="56" y1="52" x2="56" y2="44"/><line x1="69" y1="61" x2="66" y2="53"/><line x1="69" y1="61" x2="72" y2="53"/><line x1="69" y1="61" x2="64" y2="57"/><line x1="69" y1="61" x2="74" y2="57"/><line x1="57" y1="71" x2="54" y2="63"/><line x1="57" y1="71" x2="60" y2="63"/><line x1="57" y1="71" x2="52" y2="67"/><line x1="57" y1="71" x2="62" y2="67"/></g><rect x="3" y="3" width="74" height="74" rx="3" fill="none" stroke="#7a6a20" stroke-width="1.4"/></svg>` },

  // ── Möbel ────────────────────────────────────────────────
  { cat: 'Möbel', name: 'Tisch +\nStühle', size: 100, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="27" y="3" width="26" height="18" rx="3" fill="#f0dfc0" stroke="#7a5a30" stroke-width="1.2"/><rect x="30" y="5" width="20" height="11" rx="2" fill="#e8d0a8" stroke="#7a5a30" stroke-width="0.7"/><rect x="27" y="59" width="26" height="18" rx="3" fill="#f0dfc0" stroke="#7a5a30" stroke-width="1.2"/><rect x="30" y="65" width="20" height="11" rx="2" fill="#e8d0a8" stroke="#7a5a30" stroke-width="0.7"/><rect x="3" y="27" width="18" height="26" rx="3" fill="#f0dfc0" stroke="#7a5a30" stroke-width="1.2"/><rect x="5" y="30" width="11" height="20" rx="2" fill="#e8d0a8" stroke="#7a5a30" stroke-width="0.7"/><rect x="59" y="27" width="18" height="26" rx="3" fill="#f0dfc0" stroke="#7a5a30" stroke-width="1.2"/><rect x="64" y="30" width="11" height="20" rx="2" fill="#e8d0a8" stroke="#7a5a30" stroke-width="0.7"/><circle cx="40" cy="40" r="20" fill="#f5e8d0" stroke="#7a5a30" stroke-width="1.5"/><circle cx="40" cy="40" r="2" fill="#7a5a30"/></svg>` },
  { cat: 'Möbel', name: 'Gartenbank', size: 90, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 34"><rect x="3" y="3" width="84" height="11" rx="2" fill="#e8d0b0" stroke="#7a5a30" stroke-width="1.2"/><line x1="3" y1="8.5" x2="87" y2="8.5" stroke="#7a5a30" stroke-width="0.6" stroke-dasharray="4,3"/><rect x="3" y="19" width="84" height="12" rx="2" fill="#f0dfc0" stroke="#7a5a30" stroke-width="1.2"/><line x1="3" y1="25" x2="87" y2="25" stroke="#7a5a30" stroke-width="0.6" stroke-dasharray="4,3"/><rect x="8" y="14" width="9" height="6" rx="1" fill="#c8a870" stroke="#7a5a30" stroke-width="0.8"/><rect x="73" y="14" width="9" height="6" rx="1" fill="#c8a870" stroke="#7a5a30" stroke-width="0.8"/></svg>` },
  { cat: 'Möbel', name: 'Sonnenliege', size: 100, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 34"><rect x="3" y="7" width="78" height="20" rx="3" fill="#f0e0c0" stroke="#7a5a30" stroke-width="1.2"/><line x1="18" y1="7" x2="18" y2="27" stroke="#7a5a30" stroke-width="0.6"/><line x1="33" y1="7" x2="33" y2="27" stroke="#7a5a30" stroke-width="0.6"/><line x1="48" y1="7" x2="48" y2="27" stroke="#7a5a30" stroke-width="0.6"/><line x1="63" y1="7" x2="63" y2="27" stroke="#7a5a30" stroke-width="0.6"/><rect x="79" y="9" width="18" height="16" rx="3" fill="#e8d0a8" stroke="#7a5a30" stroke-width="1.2"/><line x1="79" y1="13" x2="97" y2="13" stroke="#7a5a30" stroke-width="0.6"/></svg>` },
  { cat: 'Möbel', name: 'Sonnen-\nschirm', size: 80, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="31" cy="33" rx="22" ry="18" fill="rgba(0,0,0,0.06)"/><path d="M30 29 L30 7 A22 22 0 0 1 45.6 18 Z" fill="#f8c840" opacity="0.45"/><path d="M30 29 L45.6 18 A22 22 0 0 1 52 35 Z" fill="#f0e0b0" opacity="0.45"/><path d="M30 29 L52 35 A22 22 0 0 1 44.6 47 Z" fill="#f8c840" opacity="0.45"/><path d="M30 29 L44.6 47 A22 22 0 0 1 30 51 Z" fill="#f0e0b0" opacity="0.45"/><path d="M30 29 L30 51 A22 22 0 0 1 15.4 47 Z" fill="#f8c840" opacity="0.45"/><path d="M30 29 L15.4 47 A22 22 0 0 1 8 35 Z" fill="#f0e0b0" opacity="0.45"/><path d="M30 29 L8 35 A22 22 0 0 1 14.4 18 Z" fill="#f8c840" opacity="0.45"/><path d="M30 29 L14.4 18 A22 22 0 0 1 30 7 Z" fill="#f0e0b0" opacity="0.45"/><circle cx="30" cy="29" r="22" fill="none" stroke="#8a7030" stroke-width="1.2"/><line x1="30" y1="29" x2="30" y2="7" stroke="#8a7030" stroke-width="0.8"/><line x1="30" y1="29" x2="45.6" y2="18" stroke="#8a7030" stroke-width="0.8"/><line x1="30" y1="29" x2="52" y2="35" stroke="#8a7030" stroke-width="0.8"/><line x1="30" y1="29" x2="44.6" y2="47" stroke="#8a7030" stroke-width="0.8"/><line x1="30" y1="29" x2="30" y2="51" stroke="#8a7030" stroke-width="0.8"/><line x1="30" y1="29" x2="15.4" y2="47" stroke="#8a7030" stroke-width="0.8"/><line x1="30" y1="29" x2="8" y2="35" stroke="#8a7030" stroke-width="0.8"/><line x1="30" y1="29" x2="14.4" y2="18" stroke="#8a7030" stroke-width="0.8"/><circle cx="30" cy="29" r="3" fill="#c8a870" stroke="#8a6030" stroke-width="1"/></svg>` },
  { cat: 'Möbel', name: 'Feuerstelle', size: 70, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="31" cy="33" rx="18" ry="14" fill="rgba(0,0,0,0.06)"/><circle cx="30" cy="30" r="20" fill="#d8d0c0" stroke="#888" stroke-width="1.3"/><circle cx="30" cy="30" r="14" fill="#c8b8a0" stroke="#888" stroke-width="0.8"/><circle cx="30" cy="30" r="7" fill="#e08030" stroke="#a05020" stroke-width="1"/><circle cx="30" cy="30" r="3.5" fill="#f0a040" stroke="#c06020" stroke-width="0.8"/><line x1="16" y1="30" x2="44" y2="30" stroke="#888" stroke-width="1"/><line x1="30" y1="16" x2="30" y2="44" stroke="#888" stroke-width="1"/><line x1="20" y1="20" x2="40" y2="40" stroke="#888" stroke-width="0.7"/><line x1="40" y1="20" x2="20" y2="40" stroke="#888" stroke-width="0.7"/></svg>` },

  // ── Wasser ───────────────────────────────────────────────
  { cat: 'Wasser', name: 'Teich', size: 120, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 80"><ellipse cx="55" cy="44" rx="48" ry="36" fill="rgba(0,0,0,0.05)"/><path d="M10 42 C8 26 18 10 32 8 C44 5 57 11 64 8 C74 5 88 13 92 26 C97 40 92 57 80 64 C70 70 57 69 47 66 C34 69 18 62 12 52 Z" fill="#c5e8f8" stroke="#4a90b8" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 42 C32 37 40 34 48 36 C56 38 62 43 62 46" fill="none" stroke="#4a90b8" stroke-width="0.7" opacity="0.5"/><path d="M26 49 C29 44 38 42 46 44 C54 46 60 52 57 56" fill="none" stroke="#4a90b8" stroke-width="0.6" opacity="0.4"/><circle cx="70" cy="34" r="6" fill="#90c870" stroke="#4a8030" stroke-width="0.8" opacity="0.8"/><line x1="70" y1="34" x2="70" y2="29" stroke="#4a8030" stroke-width="0.6" opacity="0.6"/></svg>` },
  { cat: 'Wasser', name: 'Brunnen', size: 65, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><ellipse cx="31" cy="33" rx="20" ry="16" fill="rgba(0,0,0,0.05)"/><circle cx="30" cy="30" r="22" fill="#d8e8f0" stroke="#6090a8" stroke-width="1.5"/><circle cx="30" cy="30" r="16" fill="#b8ddf0" stroke="#4a90b8" stroke-width="1"/><circle cx="30" cy="30" r="3" fill="#c0a870" stroke="#8a7040" stroke-width="1"/><circle cx="30" cy="30" r="8" fill="none" stroke="#4a90b8" stroke-width="0.6" opacity="0.5"/><circle cx="30" cy="30" r="12" fill="none" stroke="#4a90b8" stroke-width="0.5" opacity="0.3"/></svg>` },
  { cat: 'Wasser', name: 'Bachlauf', size: 120, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 50"><path d="M4 38 C20 42 30 20 50 22 C70 24 80 40 100 36 C110 34 116 28 118 20" fill="none" stroke="#4a90b8" stroke-width="10" stroke-linecap="round" opacity="0.3"/><path d="M4 38 C20 42 30 20 50 22 C70 24 80 40 100 36 C110 34 116 28 118 20" fill="none" stroke="#4a90b8" stroke-width="10" stroke-linecap="round" opacity="0.3"/><path d="M4 38 C20 42 30 20 50 22 C70 24 80 40 100 36 C110 34 116 28 118 20" fill="none" stroke="#b8ddf0" stroke-width="8" stroke-linecap="round"/><path d="M4 38 C20 42 30 20 50 22 C70 24 80 40 100 36 C110 34 116 28 118 20" fill="none" stroke="#4a90b8" stroke-width="8" stroke-linecap="round" stroke-dasharray="0" opacity="0"/><path d="M16 34 C22 30 28 26 34 28" fill="none" stroke="#4a90b8" stroke-width="0.8" opacity="0.5"/><path d="M60 26 C66 22 72 24 78 28" fill="none" stroke="#4a90b8" stroke-width="0.8" opacity="0.5"/></svg>` },

  // ── Bauwerke ─────────────────────────────────────────────
  { cat: 'Bauwerke', name: 'Gartenhaus', size: 120, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90"><rect x="5" y="5" width="84" height="74" rx="2" fill="#f0ece0" stroke="#777" stroke-width="1.5"/><line x1="47" y1="5" x2="47" y2="79" stroke="#999" stroke-width="1" stroke-dasharray="4,3"/><rect x="11" y="11" width="72" height="62" rx="1" fill="#f8f4e8" stroke="#999" stroke-width="0.8"/><rect x="33" y="59" width="18" height="14" rx="1" fill="#d8c898" stroke="#888" stroke-width="1"/><circle cx="48" cy="66" r="1.5" fill="#888"/><rect x="14" y="18" width="18" height="14" rx="1" fill="#d0eaf8" stroke="#888" stroke-width="1"/><line x1="23" y1="18" x2="23" y2="32" stroke="#888" stroke-width="0.6"/><line x1="14" y1="25" x2="32" y2="25" stroke="#888" stroke-width="0.6"/><rect x="52" y="18" width="18" height="14" rx="1" fill="#d0eaf8" stroke="#888" stroke-width="1"/><line x1="61" y1="18" x2="61" y2="32" stroke="#888" stroke-width="0.6"/><line x1="52" y1="25" x2="70" y2="25" stroke="#888" stroke-width="0.6"/></svg>` },
  { cat: 'Bauwerke', name: 'Gewächs-\nhaus', size: 130, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70"><rect x="3" y="3" width="114" height="64" rx="3" fill="rgba(200,230,255,0.3)" stroke="#5a8aaa" stroke-width="1.5"/><line x1="3" y1="35" x2="117" y2="35" stroke="#5a8aaa" stroke-width="0.8"/><line x1="24" y1="3" x2="24" y2="67" stroke="#5a8aaa" stroke-width="0.8"/><line x1="45" y1="3" x2="45" y2="67" stroke="#5a8aaa" stroke-width="0.8"/><line x1="66" y1="3" x2="66" y2="67" stroke="#5a8aaa" stroke-width="0.8"/><line x1="87" y1="3" x2="87" y2="67" stroke="#5a8aaa" stroke-width="0.8"/><line x1="108" y1="3" x2="108" y2="67" stroke="#5a8aaa" stroke-width="0.8"/><g fill="#90c060" stroke="#3a7820" stroke-width="0.7" opacity="0.65"><circle cx="13" cy="19" r="4.5"/><circle cx="34" cy="19" r="4.5"/><circle cx="55" cy="19" r="4.5"/><circle cx="76" cy="19" r="4.5"/><circle cx="97" cy="19" r="4.5"/><circle cx="13" cy="51" r="4.5"/><circle cx="34" cy="51" r="4.5"/><circle cx="55" cy="51" r="4.5"/><circle cx="76" cy="51" r="4.5"/><circle cx="97" cy="51" r="4.5"/></g><rect x="3" y="3" width="114" height="64" rx="3" fill="none" stroke="#5a8aaa" stroke-width="1.5"/></svg>` },
  { cat: 'Bauwerke', name: 'Kompost', size: 65, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect x="3" y="3" width="54" height="54" rx="3" fill="#c8a870" stroke="#7a5a2a" stroke-width="1.5"/><line x1="3" y1="13" x2="57" y2="13" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><line x1="3" y1="23" x2="57" y2="23" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><line x1="3" y1="33" x2="57" y2="33" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><line x1="3" y1="43" x2="57" y2="43" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><line x1="13" y1="3" x2="13" y2="57" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><line x1="23" y1="3" x2="23" y2="57" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><line x1="33" y1="3" x2="33" y2="57" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><line x1="43" y1="3" x2="43" y2="57" stroke="#7a5a2a" stroke-width="0.5" opacity="0.4"/><g fill="#78c040" stroke="#3a6820" stroke-width="0.7"><path d="M14 22 Q17 16 20 22" fill="#90d050"/><circle cx="17" cy="15" r="3.5" fill="#78c040"/><path d="M33 32 Q36 26 39 32" fill="#90d050"/><circle cx="36" cy="25" r="3.5" fill="#78c040"/><path d="M14 44 Q17 38 20 44" fill="#90d050"/><circle cx="17" cy="37" r="3" fill="#78c040"/></g></svg>` },
  { cat: 'Bauwerke', name: 'Spielplatz', size: 120, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 80"><rect x="3" y="3" width="104" height="74" rx="4" fill="#f0dca0" stroke="#a08040" stroke-width="1.5"/><rect x="9" y="9" width="44" height="30" rx="3" fill="#f8e8b0" stroke="#a08040" stroke-width="1"/><rect x="63" y="9" width="38" height="24" rx="2" fill="#e0d0f0" stroke="#8060a0" stroke-width="1.2"/><line x1="82" y1="9" x2="82" y2="33" stroke="#8060a0" stroke-width="0.7"/><line x1="63" y1="21" x2="101" y2="21" stroke="#8060a0" stroke-width="0.7"/><line x1="58" y1="44" x2="101" y2="44" stroke="#8a6030" stroke-width="1.5"/><line x1="68" y1="44" x2="68" y2="58" stroke="#8a6030" stroke-width="1"/><rect x="64" y="58" width="8" height="4" rx="1" fill="#d08040" stroke="#8a6030" stroke-width="0.8"/><line x1="84" y1="44" x2="84" y2="58" stroke="#8a6030" stroke-width="1"/><rect x="80" y="58" width="8" height="4" rx="1" fill="#d08040" stroke="#8a6030" stroke-width="0.8"/><rect x="9" y="48" width="40" height="24" rx="2" fill="none" stroke="#c05030" stroke-width="1.2"/><line x1="22" y1="48" x2="22" y2="72" stroke="#c05030" stroke-width="1"/><line x1="35" y1="48" x2="35" y2="72" stroke="#c05030" stroke-width="1"/><line x1="9" y1="60" x2="49" y2="60" stroke="#c05030" stroke-width="1"/></svg>` },
];

const LIB_CATS = [...new Set(LIBRARY.map(i => i.cat))];
const EIGENE_CAT = 'Eigene';

// =========================================================
// CUSTOM LIBRARY  (IndexedDB + File System Access API)
// =========================================================
let _customDB  = null;
let _dirHandle = null;
let customLibItems = [];   // [{id, name, dataUrl, type:'svg'|'image'}]
let libLayerVisible = true;

function _openCustomDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('gp-custom-lib', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('items'))    db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = e => { _customDB = e.target.result; res(); };
    req.onerror   = rej;
  });
}
function _dbGet(store, key) {
  return new Promise(res => {
    const tx = _customDB.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => res(null);
  });
}
function _dbPut(store, val, key) {
  return new Promise(res => {
    const tx = _customDB.transaction(store, 'readwrite');
    key !== undefined ? tx.objectStore(store).put(val, key) : tx.objectStore(store).put(val);
    tx.oncomplete = res;
  });
}
function _dbDel(store, key) {
  return new Promise(res => {
    const tx = _customDB.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = res;
  });
}
function _dbGetAll(store) {
  return new Promise(res => {
    const tx = _customDB.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res([]);
  });
}

function _fileToDataUrl(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(file);
  });
}
function _dataUrlToSvgText(dataUrl) {
  const [meta, data] = dataUrl.split(',');
  return meta.includes('base64') ? atob(data) : decodeURIComponent(data);
}

// ── SVG-Sanitizer (XSS-Schutz) ──────────────────────────
function sanitizeSVG(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  // Entferne gefährliche Tags
  const dangerous = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style[type="text/javascript"]'];
  dangerous.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  });
  // Entferne Event-Handler-Attribute (on*) und javascript:-URIs
  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (attr.name === 'href' && /^javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      if (attr.name === 'xlink:href' && /^javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    });
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

async function initCustomLib() {
  await _openCustomDB();
  customLibItems = await _dbGetAll('items');
  // Try to restore directory handle
  try {
    const h = await _dbGet('settings', 'dirHandle');
    if (h) { _dirHandle = h; document.getElementById('btn-lib-folder')?.classList.add('linked'); }
  } catch(_) {}
}

async function linkCustomLibFolder() {
  if (!window.showDirectoryPicker) {
    showToast('Browser unterstützt Ordnerauswahl nicht – bitte direkt hochladen.');
    return;
  }
  try {
    _dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    await _dbPut('settings', _dirHandle, 'dirHandle');
    document.getElementById('btn-lib-folder')?.classList.add('linked');
    await refreshFromDir();
  } catch(e) {
    if (e.name !== 'AbortError') showToast('Ordner konnte nicht verknüpft werden.');
  }
}

async function refreshFromDir() {
  if (!_dirHandle) { showToast('Kein Ordner verknüpft.'); return; }
  try {
    const perm = await _dirHandle.requestPermission({ mode: 'read' });
    if (perm !== 'granted') { showToast('Zugriff verweigert.'); return; }
  } catch(_) { showToast('Zugriff auf Ordner fehlgeschlagen.'); return; }

  const loaded = [];
  for await (const [name, fh] of _dirHandle.entries()) {
    const lo = name.toLowerCase();
    if (!/\.(svg|png|jpg|jpeg)$/.test(lo)) continue;
    const file  = await fh.getFile();
    const dataUrl = await _fileToDataUrl(file);
    const type  = lo.endsWith('.svg') ? 'svg' : 'image';
    loaded.push({ id: 'dir__' + name, name: name.replace(/\.[^.]+$/, ''), dataUrl, type });
  }
  // Replace old dir__ items
  customLibItems = customLibItems.filter(i => !i.id.startsWith('dir__'));
  for (const item of loaded) {
    customLibItems.push(item);
    await _dbPut('items', item);
  }
  renderLibrary(EIGENE_CAT);
  showToast(`${loaded.length} Objekt${loaded.length !== 1 ? 'e' : ''} geladen`);
}

async function uploadCustomLibFiles() {
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.accept = '.svg,.png,.jpg,.jpeg';
  // Override global input[type=file] CSS so the element is clickable
  input.style.cssText = 'position:fixed;top:-200px;left:-200px;width:1px;height:1px;opacity:0;pointer-events:auto;';
  document.body.appendChild(input);
  const cleanup = () => { try { document.body.removeChild(input); } catch(_) {} };
  input.onchange = async () => {
    let count = 0;
    for (const file of input.files) {
      const lo = file.name.toLowerCase();
      const type = lo.endsWith('.svg') ? 'svg' : 'image';
      const dataUrl = await _fileToDataUrl(file);
      const id = 'upload__' + Date.now() + '__' + file.name;
      const item = { id, name: file.name.replace(/\.[^.]+$/, ''), dataUrl, type };
      customLibItems.push(item);
      await _dbPut('items', item);
      count++;
    }
    cleanup();
    renderLibrary(EIGENE_CAT);
    showToast(`${count} Objekt${count !== 1 ? 'e' : ''} hochgeladen`);
  };
  // Cleanup if user cancels without selecting
  input.addEventListener('cancel', cleanup);
  input.click();
}

async function deleteCustomLibItem(id) {
  customLibItems = customLibItems.filter(i => i.id !== id);
  await _dbDel('items', id);
  renderLibrary(EIGENE_CAT);
}

function placeCustomLibItem(item) {
  const vpt = canvas.viewportTransform;
  const cx = (canvas.width  / 2 - vpt[4]) / vpt[0];
  const cy = (canvas.height / 2 - vpt[5]) / vpt[3];
  const place = obj => {
    const maxDim = Math.max(obj.width || 60, obj.height || 60);
    obj.scale(100 / maxDim);
    obj.set({ left: cx, top: cy, originX: 'center', originY: 'center', _customLib: true });
    obj.objectCaching = false;
    canvas.add(obj);
    canvas.sendToBack(obj);
    if (state.backgroundImage) canvas.sendToBack(state.backgroundImage);
    canvas.setActiveObject(obj); canvas.renderAll(); setTool('select');
  };
  if (item.type === 'svg') {
    fabric.loadSVGFromString(sanitizeSVG(_dataUrlToSvgText(item.dataUrl)), (objects, options) => {
      if (!objects.length) return;
      const g = fabric.util.groupSVGElements(objects, options);
      g.forEachObject(o => { o.objectCaching = false; });
      place(g);
    });
  } else {
    fabric.Image.fromURL(item.dataUrl, img => place(img));
  }
}

// ── Bibliotheksobjekte (inkl. eigene) als Ebene ein-/ausblenden ──
function toggleLibLayer() {
  libLayerVisible = !libLayerVisible;
  canvas.getObjects().forEach(o => {
    if (o._libItem || o._customLib) o.visible = libLayerVisible;
  });
  canvas.renderAll();
  const btn = document.getElementById('btn-lib-layer-toggle');
  if (btn) {
    btn.textContent = libLayerVisible ? 'Sichtbar' : 'Ausgeblendet';
    btn.classList.toggle('hidden-layer', !libLayerVisible);
  }
}

function renderLibrary(activeCat) {
  const allCats = [...LIB_CATS, EIGENE_CAT];
  if (!allCats.includes(activeCat)) activeCat = allCats[0];

  // Category tabs
  const catsEl = document.getElementById('lib-cats');
  catsEl.innerHTML = allCats.map(c =>
    `<button class="lib-cat${c === activeCat ? ' active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
  catsEl.querySelectorAll('.lib-cat').forEach(btn => {
    btn.onclick = () => renderLibrary(btn.dataset.cat);
  });

  // Layer toggle (render once, above grid)
  let layerBar = document.getElementById('lib-layer-bar');
  if (!layerBar) {
    layerBar = document.createElement('div');
    layerBar.id = 'lib-layer-bar';
    layerBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
    layerBar.innerHTML =
      `<span style="font-size:10px;color:#6b7280;">Ebene</span>` +
      `<button id="btn-lib-layer-toggle" class="pipe-layer-toggle-btn" onclick="toggleLibLayer()">Sichtbar</button>`;
    catsEl.after(layerBar);
  }

  const grid = document.getElementById('lib-grid');

  if (activeCat === EIGENE_CAT) {
    if (!customLibItems.length) {
      grid.innerHTML = '<div style="font-size:10px;color:#9ca3af;padding:6px 0;">Noch keine eigenen Objekte.<br>Ordner verknüpfen oder Dateien hochladen.</div>';
    } else {
      grid.innerHTML = customLibItems.map(item =>
        `<div class="lib-item custom-item" data-id="${item.id}" title="${item.name}">
          <img src="${item.dataUrl}" style="width:40px;height:40px;object-fit:contain;display:block;margin:0 auto;" />
          <span>${item.name}</span>
          <button class="custom-item-del" onclick="event.stopPropagation();deleteCustomLibItem('${item.id}')" title="Entfernen"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>`
      ).join('');
      grid.querySelectorAll('.custom-item').forEach(el => {
        const item = customLibItems.find(i => i.id === el.dataset.id);
        if (item) el.onclick = () => placeCustomLibItem(item);
      });
    }
    return;
  }

  // Built-in items
  const items = LIBRARY.filter(i => i.cat === activeCat);
  grid.innerHTML = items.map(item =>
    `<div class="lib-item" data-idx="${LIBRARY.indexOf(item)}" title="${item.name.replace('\n',' ')}">
      ${item.svg.replace('<svg ', '<svg width="44" height="44" ')}
      <span>${item.name}</span>
    </div>`
  ).join('');
  grid.querySelectorAll('.lib-item').forEach(el => {
    el.onclick = () => placeLibraryItem(LIBRARY[parseInt(el.dataset.idx)]);
  });
}

function placeLibraryItem(item) {
  fabric.loadSVGFromString(item.svg, (objects, options) => {
    if (!objects.length) return;
    const group = fabric.util.groupSVGElements(objects, options);
    const maxDim = Math.max(group.width || 60, group.height || 60);
    const s = item.size / maxDim;
    group.scale(s);
    // Disable bitmap cache → always renders as crisp vector at any zoom
    group.objectCaching = false;
    group.forEachObject(o => { o.objectCaching = false; });
    // Place at current viewport center
    const vpt = canvas.viewportTransform;
    const cx = (canvas.width  / 2 - vpt[4]) / vpt[0];
    const cy = (canvas.height / 2 - vpt[5]) / vpt[3];
    group.set({ left: cx, top: cy, originX: 'center', originY: 'center', _libItem: true });
    canvas.add(group);
    canvas.sendToBack(group);
    if (state.backgroundImage) canvas.sendToBack(state.backgroundImage);
    canvas.setActiveObject(group);
    canvas.renderAll();
    setTool('select');
  });
}

// Init library (custom lib async, then render)
initCustomLib()
  .catch(() => {}) // IndexedDB-Fehler isolieren
  .then(() => renderLibrary(LIB_CATS[0]));

// =========================================================
// TOOL MANAGEMENT — extracted to ./tools/tool-manager.js
// TOOL_NAMES, TOOL_HINTS, MEASURE_TOOLS, setTool, requireScale,
// updateMeasureButtons, initToolManager, initToolbar imported above.
// =========================================================

// Init pipe ref list
updatePipeRefList();

// Absoluter Fehler in cm für eine Einzelmessung (Distanz in m).
async function readAndApplyExif(file, imgWidthPx) {
  const panel = document.getElementById('meta-panel');
  const content = document.getElementById('meta-content');

  const noData = { autoScale: false, missing: ['Flughöhe','Brennweite','Sensorgröße'], partial: {} };

  if (!window.exifr) { panel.style.display = 'none'; return noData; }

  let raw, rawSep;
  try {
    // mergeOutput: true  → alle EXIF/GPS/TIFF-Tags flach zugänglich
    raw    = await exifr.parse(file, { xmp: true, gps: true, tiff: true, exif: true, mergeOutput: true });
    // mergeOutput: false → XMP-Segment separat, verhindert Kollision mit GPS-Tags
    rawSep = await exifr.parse(file, { xmp: true, mergeOutput: false });
  } catch (e) { panel.style.display = 'none'; return noData; }
  if (!raw) { panel.style.display = 'none'; return noData; }

  // ── 1. Kamera ──────────────────────────────────────────
  const make  = raw.Make  || raw.make  || '';
  const model = raw.Model || raw.model || '';
  const camera = [make, model].filter(Boolean).join(' ') || null;

  // ── 2. Brennweite ──────────────────────────────────────
  const focalLength   = raw.FocalLength || null;        // mm
  const focal35mm     = raw.FocalLengthIn35mmFilm || null;

  // ── 3. Flughöhe ────────────────────────────────────────
  // NUR XMP RelativeAltitude (Höhe über Abflugpunkt / AGL) verwenden.
  // GPSAltitude ist Höhe über Meeresspiegel (MSL) – völlig ungeeignet für GSD.
  // DJI speichert im XMP-Namespace "drone-dji:" als RelativeAltitude.
  // Separate Parsung (rawSep.xmp) ist zuverlässiger als mergeOutput,
  // weil mergeOutput GPS- und XMP-Tags kollidieren lassen kann.
  const xmp = rawSep?.xmp ?? {};
  const relAltRaw =
    xmp.RelativeAltitude ??
    xmp['drone-dji:RelativeAltitude'] ??
    raw.RelativeAltitude ??
    raw['drone-dji:RelativeAltitude'] ??
    raw['drone-djiRelativeAltitude'] ??
    raw.relative_altitude ??
    null;
  const altitude  = relAltRaw != null && !isNaN(parseFloat(relAltRaw))
    ? Math.abs(parseFloat(relAltRaw))
    : null;
  const altSource = altitude != null ? 'relativ (XMP)' : null;

  // ── 4. Gimbal / Neigung ────────────────────────────────
  const gimbalPitchRaw =
    xmp.GimbalPitch ?? xmp['drone-dji:GimbalPitch'] ??
    raw.GimbalPitch ?? raw['drone-dji:GimbalPitch'] ??
    raw.FlightPitch ?? raw.gimbal_pitch ?? null;
  const gimbalPitch  = gimbalPitchRaw != null ? parseFloat(gimbalPitchRaw) : null;
  // DJI: -90 = Nadir (gerade runter), 0 = horizontal
  const tiltFromNadir = gimbalPitch != null ? Math.abs(gimbalPitch + 90) : null; // Grad von Nadir

  // ── 5. Sensorgröße ─────────────────────────────────────
  let sensorEntry = lookupSensor(make, model);
  let sensorWidth = sensorEntry?.w ?? null;
  let sensorName  = sensorEntry?.name ?? camera;

  // Fallback: aus 35mm-Äquivalent ableiten (cropfaktor → Sensorbreite)
  if (!sensorWidth && focal35mm && focalLength && focal35mm > 0 && focalLength > 0) {
    const crop = focal35mm / focalLength;
    sensorWidth = 36 / crop;   // 36mm = Kleinbild-Sensorbreite
  }

  // ── 6. GSD + Neigungskorrektur ─────────────────────────
  let gsd        = null;
  let corrFactor = 1.0;
  let autoScale  = false;
  let warnings   = [];
  let missing    = [];
  const partial  = { altitude, focalLength, sensorWidth, tiltFromNadir };

  if (altitude && focalLength && sensorWidth && imgWidthPx) {
    gsd = calcGSD(altitude, focalLength, sensorWidth, imgWidthPx);

    if (tiltFromNadir != null && tiltFromNadir > 1.0) {
      const tiltRad = tiltFromNadir * Math.PI / 180;
      corrFactor = 1 / Math.cos(tiltRad);
      gsd *= corrFactor;

      if (tiltFromNadir > 30) {
        warnings.push(`Starke Neigung (${tiltFromNadir.toFixed(1)}°) – Messungen am Bildrand können erheblich abweichen. Referenzlinie empfohlen.`);
      } else if (tiltFromNadir > 5) {
        warnings.push(`Neigung ${tiltFromNadir.toFixed(1)}° korrigiert (Faktor ×${corrFactor.toFixed(3)}).`);
      }
    }

    state.scale = 1 / gsd;
    state.scaleSource = 'exif';
    state.exifAltitude = altitude;
    state.flightCam = sensorEntry?.f ? { sW: sensorEntry.w, f: sensorEntry.f, imgW: sensorEntry.imgW, name: sensorEntry.name } : null;
    autoScale = true;
    updateRefStatus();
    updateMeasureButtons();
  } else {
    if (!altitude)    missing.push('Flughöhe');
    if (!focalLength) missing.push('Brennweite');
    if (!sensorWidth) missing.push('Sensorgröße');
    if (missing.length) warnings.push(`Maßstab konnte nicht automatisch berechnet werden (fehlend: ${missing.join(', ')}).`);
  }

  // ── 7. Metadaten-Panel befüllen ────────────────────────
  const rows = [
    camera     ? ['Kamera',    camera]                          : null,
    focalLength ? ['Brennweite', `${focalLength} mm`]           : null,
    sensorWidth ? ['Sensor',    `${sensorWidth} × ${(sensorEntry?.h ?? '?')} mm`] : null,
    altitude    ? ['Flughöhe',  `${altitude.toFixed(1)} m (${altSource})`]       : null,
    tiltFromNadir != null ? ['Neigung', tiltFromNadir < 1 ? 'Nadir OK' : `${tiltFromNadir.toFixed(1)}° (${corrFactor.toFixed(3)}×)`] : null,
    gsd         ? ['GSD',       `${(gsd * 100).toFixed(3)} cm/px`]               : null,
  ].filter(Boolean);

  let html = rows.map(([k,v]) =>
    `<div class="meta-row"><span class="meta-key">${k}</span><span class="meta-val">${v}</span></div>`
  ).join('');

  if (autoScale) {
    html += `<div class="meta-ok">Maßstab automatisch aus Bilddaten berechnet. Zur Überprüfung kann zusätzlich eine Referenzlinie gezeichnet werden.</div>`;
  }
  warnings.forEach(w => { html += `<div class="meta-warn">${w}</div>`; });

  content.innerHTML = html;
  panel.style.display = '';

  return { gsd, altitude, focalLength, sensorWidth, tiltFromNadir, corrFactor, autoScale, camera, missing, partial };
}

// =========================================================
// IMAGE UPLOAD
// =========================================================

// Normalisiert EXIF-Orientierung: zeichnet das Bild auf einen temporären Canvas
// und gibt die korrigierten Pixeldaten als Data-URL zurück.
async function normalizeOrientation(file) {
  return new Promise(resolve => {
    let orientation = 1;
    const proceed = dataUrl => {
      if (orientation === 1) { resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        const swap = orientation === 6 || orientation === 8;
        const c = document.createElement('canvas');
        c.width  = swap ? img.height : img.width;
        c.height = swap ? img.width  : img.height;
        const ctx = c.getContext('2d');
        switch (orientation) {
          case 3: ctx.translate(c.width, c.height); ctx.rotate(Math.PI);        break;
          case 6: ctx.translate(c.width, 0);        ctx.rotate(Math.PI / 2);    break;
          case 8: ctx.translate(0, c.height);       ctx.rotate(-Math.PI / 2);   break;
        }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.95));
      };
      img.src = dataUrl;
    };

    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      try {
        if (window.exifr) {
          const exif = await exifr.parse(file, { tiff: true, mergeOutput: true });
          orientation = exif?.Orientation ?? 1;
        }
      } catch (_) {}
      proceed(dataUrl);
    };
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl, sourceFile) {
  fabric.Image.fromURL(dataUrl, async img => {
      const scaleX = (canvas.width * 0.95) / img.width;
      const scaleY = (canvas.height * 0.95) / img.height;
      const s = Math.min(scaleX, scaleY, 1);
      img.scale(s);
      state.imgDisplayScale = s;
      img.set({
        left: (canvas.width - img.width * s) / 2,
        top: (canvas.height - img.height * s) / 2,
        selectable: false, evented: false, hasBorders: false, hasControls: false,
        _noSelect: true, _isBackground: true,
      });
      state.backgroundImage = img;
      state.imgOriginalWidth = img.width;
      canvas.clear();
      canvas.add(img);
      canvas.sendToBack(img);
      document.getElementById('drop-overlay').classList.add('hidden');
      state.scale = null;
      state.scaleSource = null;
      state.exifAltitude = null;
      state.refLines = [];
      state.refSumL2 = 0;
      state.measurements = [];
      updateMeasurementList();
      updateRefStatus();

      const exifResult = sourceFile ? await readAndApplyExif(sourceFile, img.width) : null;
      showRefOnboarding(exifResult);
  });
}

async function loadImage(file) {
  const dataUrl = await normalizeOrientation(file);
  loadImageFromDataUrl(dataUrl, file);
}

async function loadPdf(file) {
  if (!window.pdfjsLib) { showToast('PDF.js nicht verfügbar.', 'error'); return; }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    const renderPage = async pageNum => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3 });
      const c = document.createElement('canvas');
      c.width = viewport.width;
      c.height = viewport.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
      return c.toDataURL('image/png');
    };

    if (numPages === 1) {
      const dataUrl = await renderPage(1);
      loadImageFromDataUrl(dataUrl, null);
    } else {
      const bodyHTML = `
        <p style="font-size:13px;color:#636366;margin-bottom:12px;">
          Die PDF hat <b>${numPages} Seiten</b>. Welche Seite soll geladen werden?
        </p>
        <input id="_pdf-page-input" type="number" min="1" max="${numPages}" value="1"
          style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;" />
        <div style="font-size:11px;color:#8e8e93;margin-top:4px;">Seite 1 – ${numPages}</div>
      `;
      createModal('PDF-Seite auswählen', bodyHTML, async () => {
        const n = Math.min(numPages, Math.max(1, parseInt(document.getElementById('_pdf-page-input').value) || 1));
        const dataUrl = await renderPage(n);
        loadImageFromDataUrl(dataUrl, null);
      });
    }
  } catch (err) {
    showToast('PDF konnte nicht geladen werden.', 'error');
    console.error(err);
  }
}

function loadFileAuto(file) {
  if (!file) return;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    loadPdf(file);
  } else {
    loadImage(file);
  }
}

// btn-upload ist jetzt ein <label for="file-input"> — kein JS nötig
document.getElementById('btn-how-it-works').addEventListener('click', () => showWelcomeOnboarding());
document.getElementById('file-input').onchange = e => { loadFileAuto(e.target.files[0]); };

wrapper.addEventListener('dragover', e => { e.preventDefault(); wrapper.style.outline = '3px dashed #4ecca3'; });
wrapper.addEventListener('dragleave', () => { wrapper.style.outline = ''; });
wrapper.addEventListener('drop', e => {
  e.preventDefault();
  wrapper.style.outline = '';
  const file = e.dataTransfer.files[0];
  if (file && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) loadFileAuto(file);
});

// _loupe and throttledRender are imported from ./utils/loupe.js

// =========================================================
// CANVAS EVENTS
// =========================================================

canvas.on('mouse:move', _safeHandler(opt => {
  const p = canvas.getPointer(opt.e);
  document.getElementById('status-coords').textContent = `x: ${Math.round(p.x)}, y: ${Math.round(p.y)}`;

  // Auf Touch-Geräten: Preview-Updates nur wenn NICHT im Adjust-Modus
  // (dort übernimmt der Capture-Touchmove-Handler die Updates, um Doppel-Rendering zu vermeiden)
  const _skipPreview = typeof _mobileAdjust !== 'undefined' && _mobileAdjust.active;
  if (!_skipPreview) {
  // Ref line preview
  if (state.tool === 'ref' && state.refPoints.length === 1 && state.drawingLine) {
    state.drawingLine.set({ x2: p.x, y2: p.y });
    throttledRender();
  }
  // Distance preview mit Live-Messwert
  if (state.tool === 'distance' && state.distPoints.length === 1 && state.drawingLine) {
    state.drawingLine.set({ x2: p.x, y2: p.y });
    const p1 = state.distPoints[0];
    const pxDist = ptDist(p1.x, p1.y, p.x, p.y) / state.imgDisplayScale;
    const meters = state.scale ? pxDist / state.scale : null;
    const liveText = meters ? formatDistance(meters) : `${Math.round(pxDist)} px`;
    updateLiveLabel(p1, p, liveText);
    throttledRender();
  }
  // Area preview
  if (state.tool === 'area' && state.areaPoints.length > 0) {
    updatePreviewPolygon([...state.areaPoints, p]);
  }
  // Circle preview mit Live-Radius
  if (state.tool === 'circle' && state.circleCenter) {
    const r = Math.hypot(p.x - state.circleCenter.x, p.y - state.circleCenter.y);
    updatePreviewCircle(state.circleCenter, r, p);
    const rOrig = r / state.imgDisplayScale;
    const rMeters = state.scale ? rOrig / state.scale : null;
    const liveText = rMeters ? `r = ${formatDistance(rMeters)}` : `r = ${Math.round(r)} px`;
    updateLiveLabel(state.circleCenter, p, liveText);
  }
  // Arc preview
  if (state.tool === 'arc' && state.arcStep >= 1) {
    updatePreviewArc(p);
  }
  // Pipe preview
  if (state.tool === 'pipe') {
    if (state.pipePoints.length > 0) {
      updatePreviewPipe([...state.pipePoints, p]);
    }
  }
  // Distance guides for all measurement tools + pipe + Maßstab (when not in ref mode)
  if (['ref','distance','area','circle','arc','pipe'].includes(state.tool) && !state.pipeRefMode) {
    showPipeDistanceGuides(p);
  }
  } // end !_skipPreview
  // Ref line preview for all measurement tools + pipe + Maßstab
  if (['ref','distance','area','circle','arc','pipe'].includes(state.tool) && state.pipeRefMode === 'line-2' && state.pipeRefTempPt) {
    canvas.getObjects().filter(o => o._pipeRefTemp && o.type === 'line').forEach(o => canvas.remove(o));
    const tempLine = new fabric.Line([state.pipeRefTempPt.x, state.pipeRefTempPt.y, p.x, p.y], {
      stroke: PIPE_REF_LINE_COLOR, strokeWidth: 1, strokeDashArray: [6, 3], opacity: 0.6,
      selectable: false, evented: false, _pipeRefTemp: true, _noSelect: true,
    });
    canvas.add(tempLine);
    throttledRender();
  }

  // Loupe: show when a drawing/measurement tool or anchor mode is active, hide during pan
  const _loupeActive =
    (state.tool !== 'select' || _anchorExport.active || _anchorImport.active) &&
    !state.panning && !state.spacePan && !!state.backgroundImage;
  if (_loupeActive) { _loupe.show(); _loupe.update(opt.e.clientX, opt.e.clientY, opt.e.offsetX, opt.e.offsetY); }
  else              { _loupe.hide(); }

  // Mobile Magnifiers werden jetzt über die Touch-Capture-Handlers gesteuert
}));

canvas.on('mouse:out', () => { _loupe.hide(); });


canvas.on('mouse:down', _safeHandler(opt => {
  if (_touchSuppressClick) { _touchSuppressClick = false; return; }
  if (opt.e.altKey || state.spacePan) { startPan(opt.e); return; }
  const pRaw = canvas.getPointer(opt.e);
  const p = (state.tool !== 'select' && state.tool !== 'label') ? snapToPixel(pRaw) : pRaw;

  // 2-Punkt-Ausrichtung beim Einmessen von Leitungen
  if (_anchorExport.active || _anchorImport.active) { handleLeitungenAlignClick(p); return; }

  // End pipe edit when clicking on something that isn't a pipe handle or the edited pipe
  if (state.tool === 'select' && state.editingPipe && opt.target) {
    if (!opt.target._pipeHandle && opt.target !== state.editingPipe.polyline && !opt.target._isPipeLegend) {
      endPipeEdit();
    }
  }
  // End pipe edit when clicking on empty canvas
  if (state.tool === 'select' && state.editingPipe && !opt.target) {
    endPipeEdit();
  }

  // Ignore clicks on legend — it's always draggable
  if (opt.target && opt.target._isPipeLegend) return;

  // Label tool: clicking an existing label → select/drag, not create new
  if (state.tool === 'label' && opt.target && opt.target._userLabel) return;

  // Reference creation works from all tools (auch Auswahl)
  if (['select','ref','distance','area','circle','arc','pipe'].includes(state.tool) && handlePipeRefClick(p)) return;

  switch (state.tool) {
    case 'ref':      handleRefClick(p); break;
    case 'distance': handleDistanceClick(p); break;
    case 'area':     handleAreaClick(p); break;
    case 'circle':   handleCircleClick(p); break;
    case 'arc':      handleArcClick(p); break;
    case 'label':    handleLabelClick(p); break;
    case 'pipe':     handlePipeClick(p); break;
  }
}));

canvas.on('mouse:up', _safeHandler(opt => {
  // Assign-Modus: Klick auf Ref-Objekt
  if (state.assignModePipeId != null && opt.target?._pipeRefId != null) {
    toggleRefAssignment(opt.target._pipeRefId);
    return;
  }
  stopPan();
  // After handle drag, clear guides
  if (state.editingPipe) clearPipeDistanceGuides();
}));

// Pipe handle dragging — live update polyline + distance guides
canvas.on('object:moving', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || !obj._pipeHandle || !state.editingPipe) return;
  // Show distance guides from this handle position
  showPipeDistanceGuides({ x: obj.left, y: obj.top });
  // Live-update the polyline shape
  updatePipeFromHandles();
}));

// Sync sibling objects (labels, endpoint circles) when a pipe reference is dragged
canvas.on('object:moving', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || obj._pipeRefId == null) return;

  const refId = obj._pipeRefId;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref) return;

  // --- Line reference: reposition label + endpoint circles ---
  if (ref.type === 'line' && obj.type === 'line') {
    // calcLinePoints() gibt lokale Koordinaten (zentriert um 0,0)
    const lp = obj.calcLinePoints();
    const matrix = obj.calcTransformMatrix();
    const absP1 = fabric.util.transformPoint(new fabric.Point(lp.x1, lp.y1), matrix);
    const absP2 = fabric.util.transformPoint(new fabric.Point(lp.x2, lp.y2), matrix);

    // Reposition endpoint circles
    const circles = canvas.getObjects().filter(o => o._pipeRefId === refId && o._noSelect === true);
    if (circles.length >= 2) {
      circles[0].set({ left: absP1.x, top: absP1.y });
      circles[0].setCoords();
      circles[1].set({ left: absP2.x, top: absP2.y });
      circles[1].setCoords();
    }

    // Reposition label at midpoint with perpendicular offset
    const label = canvas.getObjects().find(o => o._pipeRefId === refId && o._pipeRefType === 'line-label');
    if (label) {
      const mx = (absP1.x + absP2.x) / 2, my = (absP1.y + absP2.y) / 2;
      const angle = Math.atan2(absP2.y - absP1.y, absP2.x - absP1.x);
      const offX = -Math.sin(angle) * 10, offY = Math.cos(angle) * 10;
      label.set({ left: mx + offX, top: my + offY });
      label.setCoords();
    }
  }

  // --- Point reference: reposition label ---
  if (ref.type === 'point' && obj._pipeRefType === 'point') {
    const center = obj.getCenterPoint();
    const dx = center.x - ref.x;
    const dy = center.y - ref.y;
    const label = canvas.getObjects().find(o => o._pipeRefId === refId && o._pipeRefType === 'point-label');
    if (label) {
      label.set({ left: ref.x + 6 + dx, top: ref.y - 6 + dy });
      label.setCoords();
    }
  }
}));

// Snapshot after any object is moved/scaled/rotated
canvas.on('object:modified', _safeHandler(opt => {
  const obj = opt.target;
  // Wenn eine Referenz verschoben wurde → Maßlinien aller Rohre neu berechnen die sie nutzen
  if (obj?._pipeRefId != null) {
    const refId = obj._pipeRefId;
    // Ref-Koordinaten aus Fabric-Objekt aktualisieren
    const ref = state.pipeReferences.find(r => r.id === refId);
    if (ref) {
      if (ref.type === 'line' && obj.type === 'line') {
        // calcLinePoints() gibt die lokalen Render-Koordinaten (zentriert um 0,0)
        // obj.x1/y1 sind die Original-Konstruktor-Werte — NICHT für transformPoint nutzbar
        const lp = obj.calcLinePoints();
        const matrix = obj.calcTransformMatrix();
        const absP1 = fabric.util.transformPoint(new fabric.Point(lp.x1, lp.y1), matrix);
        const absP2 = fabric.util.transformPoint(new fabric.Point(lp.x2, lp.y2), matrix);
        ref.x1 = absP1.x; ref.y1 = absP1.y; ref.x2 = absP2.x; ref.y2 = absP2.y;
      } else if (ref.type === 'point') {
        // getCenterPoint() gibt die Mitte des Objekts (nicht die BBox-Ecke wie left/top)
        const center = obj.getCenterPoint();
        ref.x = center.x; ref.y = center.y;
      }
    }
    // Alle Rohre die diese Ref nutzen neu rendern
    state.measurements
      .filter(m => m.type === 'pipe' && m.refs?.includes(refId))
      .forEach(m => renderDimLinesForPipe(m.id));
  }
  // Wenn ein Rohr verschoben wurde → seine Maßlinien neu berechnen
  if (obj?._measureId != null) {
    const meas = state.measurements.find(m => m.id === obj._measureId && m.type === 'pipe');
    if (meas) renderDimLinesForPipe(meas.id);
  }
  saveSnapshot();
}));

canvas.on('mouse:dblclick', _safeHandler(opt => {
  // Doppelklick auf Label → bearbeiten (in jedem Tool-Modus)
  if (opt.target && opt.target._userLabel) {
    editLabel(opt.target);
    return;
  }

  // Werkzeug-spezifische Aktionen
  if (state.tool === 'area' && state.areaPoints.length >= 3) { finishArea(); return; }
  if (state.tool === 'pipe' && state.pipePoints.length >= 2) { finishPipe(); return; }
  if (state.tool === 'arc' && state.arcStep === 2) { finishArc(snapToPixel(canvas.getPointer(opt.e))); return; }

  // Pipe editing: double-click on pipe polyline → enter edit mode
  if (state.tool === 'select') {
    const target = opt.target;
    // Ignore double-click on legend (just drag it)
    if (target && target._isPipeLegend) return;
    if (target && target._pipeType && target.type === 'polyline') {
      startPipeEdit(target);
      return;
    }
    // Double-click on pipe segment during edit → insert vertex
    if (state.editingPipe) {
      const p = canvas.getPointer(opt.e);
      const ep = state.editingPipe;
      const pl = ep.polyline;
      const pts = ep.handles.map(h => ({ x: h.left, y: h.top }));
      // Find closest segment
      let bestDist = Infinity, bestSeg = -1;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = pointToSegmentDist(p, pts[i], pts[i + 1]);
        if (d < bestDist) { bestDist = d; bestSeg = i; }
      }
      if (bestSeg >= 0 && bestDist < 15) {
        insertPipeVertex(bestSeg, p);
        return;
      }
      // Click on empty area → end edit
      if (!opt.target || (!opt.target._pipeHandle && opt.target !== pl)) {
        endPipeEdit();
      }
      return;
    }
    // Apple-Zoom: Doppelklick → 1:1 / Fit-Toggle
    const z = canvas.getZoom();
    const cx = opt.e.offsetX, cy = opt.e.offsetY;
    if (Math.abs(z - 1) < 0.08 && Math.abs(canvas.viewportTransform[4]) < 4 && Math.abs(canvas.viewportTransform[5]) < 4) {
      setZoom(2, { x: cx, y: cy });      // fit → 2x
    } else {
      zoomToFit();                        // irgendwas → Fit
    }
  }
}));

// =========================================================
// PANNING & ZOOM  (Apple-style)
// =========================================================

document.addEventListener('mousemove', e => {
  if (!state.panning) return;
  const dx = e.clientX - state.lastPan.x;
  const dy = e.clientY - state.lastPan.y;
  state.lastPan = { x: e.clientX, y: e.clientY };
  const vpt = canvas.viewportTransform.slice();
  vpt[4] += dx; vpt[5] += dy;
  canvas.setViewportTransform(vpt);
});
document.addEventListener('mouseup', stopPan);

// Leertaste → Pan-Modus
state.spacePan = false;
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && !e.target.matches('input,textarea,select')) {
    e.preventDefault();
    state.spacePan = true;
    canvas.defaultCursor = 'grab';
    wrapper.classList.add('space-pan');
    _loupe.hide();
  }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    state.spacePan = false;
    wrapper.classList.remove('space-pan', 'panning');
    canvas.defaultCursor = state.tool === 'select' ? 'default' : 'crosshair';
  }
});

// Wheel: Pinch/Cmd+Scroll → Zoom  |  Rest → Pan
wrapper.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    // Pinch-Geste (Trackpad) oder Cmd+Scroll → Zoom
    const factor = Math.exp(-e.deltaY * 0.009);
    setZoom(canvas.getZoom() * factor, { x: e.offsetX, y: e.offsetY });
  } else {
    // Zwei-Finger-Scroll → Pan (wie Apple Photos)
    const vpt = canvas.viewportTransform.slice();
    vpt[4] -= e.deltaX;
    vpt[5] -= e.deltaY;
    canvas.setViewportTransform(vpt);
  }
}, { passive: false });

// =========================================================
// KEYBOARD
// =========================================================
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && state.assignModePipeId != null) { confirmAssignMode(); return; }
  if (e.key === 'Escape' && state.assignModePipeId != null) { cancelAssignMode(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.tool === 'select') {
    // If editing a pipe and a handle is selected, delete that vertex
    if (state.editingPipe) {
      const active = canvas.getActiveObjects();
      const handle = active.find(o => o._pipeHandle);
      if (handle) {
        e.preventDefault();
        deletePipeVertex(handle._pipeHandleIdx);
        canvas.discardActiveObject();
        return;
      }
    }
    const active = canvas.getActiveObjects();
    if (active.length) {
      // Delete pipe references
      const refIds = new Set(active.map(o => o._pipeRefId).filter(id => id != null));
      refIds.forEach(id => removePipeRef(id));
      // Delete measurements
      const ids = new Set(active.map(o => o._measureId).filter(id => id != null));
      ids.forEach(id => removeMeasurement(id));
      active.filter(o => o._measureId == null && o._pipeRefId == null).forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }
  if (e.key === 'Escape') {
    if (state.editingPipe) { endPipeEdit(); return; }
    cancelDrawing();
  }
  // Undo / Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (!e.target.matches('input,textarea,select')) { e.preventDefault(); undo(); }
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    if (!e.target.matches('input,textarea,select')) { e.preventDefault(); redo(); }
  }
});

// =========================================================
// DISTANCE TOOL — extracted to ./tools/distance.js
// handleDistanceClick, finishDistance imported above.
// =========================================================

// =========================================================
// AREA TOOL — extracted to ./tools/area.js
// handleAreaClick, updatePreviewPolygon, finishArea imported above.
// =========================================================

// =========================================================
// PIPE TOOL — extracted to ./tools/pipe.js
// PIPE_LINE_WIDTH, handlePipeClick, updatePreviewPipe, finishPipe imported above.
// =========================================================

// =========================================================
// PIPE EDITING — extracted to ./tools/pipe.js
// startPipeEdit, endPipeEdit, updatePipeFromHandles, insertPipeVertex, deletePipeVertex imported above.
// =========================================================

// =========================================================
// PIPE REFERENCES — extracted to ./tools/pipe-refs.js
// PIPE_REF_LINE_COLOR, PIPE_REF_GUIDE_COLOR, handlePipeRefClick, promptPipeRefName,
// createPipeRefLine, createPipeRefPoint, removePipeRef, togglePipeRef, updatePipeRefList imported above.
// =========================================================

// --- Reference creation sub-modes (button handlers stay here — need TOOL_HINTS/state.tool) ---
document.getElementById('btn-pipe-ref-line').onclick = () => {
  if (state.pipeRefMode === 'line-1') {
    // Cancel
    state.pipeRefMode = null; state.pipeRefTempPt = null;
    canvas.getObjects().filter(o => o._pipeRefTemp).forEach(o => canvas.remove(o));
    document.getElementById('btn-pipe-ref-line').classList.remove('active');
    document.getElementById('tt-helpers')?.classList.remove('sub-active');
    document.getElementById('status-hint').textContent = TOOL_HINTS[state.tool] || '';
    canvas.renderAll();
    return;
  }
  state.pipeRefMode = 'line-1';
  state.pipeRefTempPt = null;
  document.getElementById('btn-pipe-ref-line').classList.add('active');
  document.getElementById('tt-helpers')?.classList.add('sub-active');
  document.getElementById('tt-helpers')?.classList.remove('sub-active');
  document.getElementById('btn-pipe-ref-point').classList.remove('active');
  document.getElementById('status-hint').textContent = 'Startpunkt der Hilfslinie klicken …';
};

document.getElementById('btn-pipe-ref-point').onclick = () => {
  if (state.pipeRefMode === 'point') {
    state.pipeRefMode = null;
    document.getElementById('btn-pipe-ref-point').classList.remove('active');
    document.getElementById('tt-helpers')?.classList.remove('sub-active');
    document.getElementById('status-hint').textContent = TOOL_HINTS[state.tool] || '';
    return;
  }
  state.pipeRefMode = 'point';
  state.pipeRefTempPt = null;
  document.getElementById('btn-pipe-ref-point').classList.add('active');
  document.getElementById('tt-helpers')?.classList.add('sub-active');
  document.getElementById('tt-helpers')?.classList.remove('sub-active');
  document.getElementById('btn-pipe-ref-line').classList.remove('active');
  document.getElementById('status-hint').textContent = 'Position des Hilfspunktes klicken …';
};

// clearPipeDistanceGuides, showPipeDistanceGuides, computeDimLine, renderDimLinesForPipe,
// renderAllDimLines, clearDimLinesForPipe extracted to ./ui/pipe-guides.js

// startAssignMode, endAssignMode, confirmAssignMode, cancelAssignMode,
// toggleRefAssignment, directToggleRef extracted to ./ui/pipe-assign.js

// updatePipeLegend extracted to ./ui/pipe-legend.js

// drawGrid, toggleGrid, setGridStep, setGridColor, setGridOpacity are imported from ./ui/grid.js

// =========================================================
// PIPE LAYER TOGGLE & SIDEBAR PANEL — extracted to ./tools/pipe.js
// togglePipeLayer, sendPipesToBack, offsetOverlappingPipes, updatePipePanel imported above.
// =========================================================

// =========================================================
// CIRCLE TOOL — extracted to ./tools/circle.js
// handleCircleClick, updatePreviewCircle, finishCircle imported above.
// =========================================================

// =========================================================
// ARC / SECTOR TOOL — extracted to ./tools/arc.js
// handleArcClick, updatePreviewArc, arcSweepDir, buildSectorPath, finishArc imported above.
// =========================================================

// =========================================================
// LABEL TOOL — extracted to ./tools/label.js
// handleLabelClick (was promptLabel), editLabel imported above.
// =========================================================

// =========================================================
// LIVE LABEL — extracted to ./tools/label.js
// updateLiveLabel, removeLiveLabel imported above.
// =========================================================


// distErr_m and areaRelErr_pct extracted to ./io/photogrammetry.js

// =========================================================
// CANCEL DRAWING
// =========================================================
function cancelDrawing() {
  removeLiveLabel();
  endPipeEdit();
  clearPipeDistanceGuides();
  if (state.refLine) { canvas.remove(state.refLine); state.refLine = null; }
  state.refPoints = [];
  if (state.drawingLine) { canvas.remove(state.drawingLine); state.drawingLine = null; }
  if (state.drawingPolygon) { canvas.remove(state.drawingPolygon); state.drawingPolygon = null; }
  if (state.drawingPipeLine) { canvas.remove(state.drawingPipeLine); state.drawingPipeLine = null; }
  canvas.getObjects().filter(o => o._circlePreview || o._arcPreview || o._tempDraw || o._pipePreview || o._pipeGuide || o._pipeRefTemp).forEach(o => canvas.remove(o));
  state.distPoints = [];
  state.areaPoints = [];
  state.pipePoints = [];
  state.pipeRefMode = null;
  state.pipeRefTempPt = null;
  state.circleCenter = null;
  state.arcStep = 0;
  state.arcCenter = null;
  state.arcStartPt = null;
  document.getElementById('btn-pipe-ref-line')?.classList.remove('active');
  document.getElementById('btn-pipe-ref-point')?.classList.remove('active');
  canvas.renderAll();
  document.getElementById('status-hint').textContent = state.tool in TOOL_HINTS ? TOOL_HINTS[state.tool] : '';
}

// =========================================================
// WIRE UP TOOL MANAGER
// =========================================================
// Inject cancelDrawing and loupe callbacks into tool-manager
initToolManager({
  cancelDrawing,
  loupeHide: () => _loupe.hide(),
  mobileMagHide: () => { if (typeof _mobileMag !== 'undefined') _mobileMag.hide(); },
});

// =========================================================
// MEASUREMENT LIST
// =========================================================
const TYPE_ICONS = {
  distance: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/></svg>',
  area: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  circle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  arc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2"/></svg>',
  pipe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="M4 12h12"/><circle cx="20" cy="12" r="2"/></svg>'
};
const TYPE_LABELS = { distance: 'Distanz', area: 'Fläche', circle: 'Kreis', arc: 'Kreisabschnitt', pipe: 'Leitung' };

function updateMeasurementList() {
  updatePipePanel();
  const list = document.getElementById('measurements-list');
  const nonPipe = state.measurements.filter(m => m.type !== 'pipe').slice().reverse();
  _notifyBadge('badge-messungen', 'acc-messungen', nonPipe.length, 'messungen');
  if (!nonPipe.length) {
    list.innerHTML = '<div style="font-size:11px;color:#444;padding:3px 0;">Noch keine Messungen</div>';
    return;
  }
  list.innerHTML = nonPipe.map(m => {
    return `
    <div class="measurement-item">
      <div class="m-label">
        <span>${TYPE_ICONS[m.type] || '•'} ${TYPE_LABELS[m.type] || m.type}</span>
        <span class="m-btns"><button class="m-calc" onclick="openMaterialCalc(${m.id})" title="Materialrechner"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg></button><button class="m-delete" onclick="removeMeasurement(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>
      </div>
      <div class="m-value">${m.label}</div>
    </div>`;
  }).join('');
}

function removeMeasurement(id) {
  saveSnapshot();
  // If this pipe is being edited, end the edit first
  if (state.editingPipe && state.editingPipe.id === id) endPipeEdit();
  const wasPipe = state.measurements.some(m => m.id === id && m.type === 'pipe');
  canvas.getObjects().filter(o => o._measureId === id || o._dimLinePipeId === id).forEach(o => canvas.remove(o));
  state.measurements = state.measurements.filter(m => m.id !== id);
  updateMeasurementList();
  if (wasPipe) {
    updatePipeLegend();
    offsetOverlappingPipes();
  }
  canvas.renderAll();
}

// MATERIALS and openMaterialCalc are imported from ./ui/materialrechner.js

// =========================================================
// REGISTER HOOKS FOR TOOL MODULES
// =========================================================
// These allow tool modules (distance, area, circle, arc) to call back into main.js
// for functions that are still defined here.
registerToolHook('removeLiveLabel', removeLiveLabel);
registerToolHook('updateMeasurementList', updateMeasurementList);
registerToolHook('distErr_m', distErr_m);
registerToolHook('areaRelErr_pct', areaRelErr_pct);
registerToolHook('updateRefStatus', updateRefStatus);
// Hooks needed by pipe.js and pipe-assign.js
registerToolHook('showPipeDistanceGuides', showPipeDistanceGuides);
registerToolHook('clearPipeDistanceGuides', clearPipeDistanceGuides);
registerToolHook('updatePipeLegend', updatePipeLegend);
registerToolHook('renderDimLinesForPipe', renderDimLinesForPipe);

// Expose functions used in inline onclick handlers generated by pipe.js (updatePipePanel)
window.removeMeasurement = removeMeasurement;
// window.directToggleRef is set in ./ui/pipe-assign.js

// Init toolbar buttons, pickers, and line-width controls (extracted to tool-manager.js)
initToolbar();

// SAVE / LOAD  (Zentrales Modal)
// =========================================================

function _saveOptionHTML(id, icon, title, desc) {
  return `<label class="save-load-option" data-action="${id}">
    <span class="slo-icon">${icon}</span>
    <span class="slo-text"><strong>${title}</strong><br><span class="slo-desc">${desc}</span></span>
  </label>`;
}

function openSaveModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'save-load-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h2>Speichern</h2>
      <p style="margin:0 0 10px;color:#888;font-size:12px;">Was möchtest du speichern?</p>
      <div id="sl-step1" style="display:flex;flex-direction:column;gap:6px;">
        ${_saveOptionHTML('save-project', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>', 'Gesamtes Projekt', 'Alle Messungen, Leitungen, Einstellungen')}
        ${_saveOptionHTML('save-pipes', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', 'Nur Leitungen', 'Leitungen mit Ankerpunkten für neues Luftbild')}
      </div>
      <div id="sl-step2" style="display:none;">
        <p style="margin:0 0 10px;color:#888;font-size:12px;">In welchem Format?</p>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${_saveOptionHTML('fmt-json', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', 'Projektdatei (.json)', 'Zum Weiterarbeiten – kann wieder geladen werden')}
          ${_saveOptionHTML('fmt-pdf', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', 'PDF', 'Zum Drucken und Teilen')}
          ${_saveOptionHTML('fmt-png', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>', 'Bild (.png)', 'Als hochauflösende Bilddatei')}
        </div>
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button id="sl-back" style="display:none;">Zurück</button>
        <button id="sl-close">Abbrechen</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => document.body.removeChild(overlay);
  overlay.querySelector('#sl-close').onclick = close;

  // Step 1: Was speichern?
  overlay.querySelectorAll('#sl-step1 .save-load-option').forEach(opt => {
    opt.onclick = () => {
      const action = opt.dataset.action;
      if (action === 'save-pipes') {
        close();
        exportLeitungen();
      } else if (action === 'save-project') {
        overlay.querySelector('#sl-step1').style.display = 'none';
        overlay.querySelector('#sl-step2').style.display = '';
        overlay.querySelector('#sl-back').style.display = '';
        overlay.querySelector('h2').textContent = 'Projekt speichern';
        overlay.querySelector('p').textContent = 'In welchem Format?';
      }
    };
  });

  // Back button
  overlay.querySelector('#sl-back').onclick = () => {
    overlay.querySelector('#sl-step1').style.display = '';
    overlay.querySelector('#sl-step2').style.display = 'none';
    overlay.querySelector('#sl-back').style.display = 'none';
    overlay.querySelector('h2').textContent = 'Speichern';
    overlay.querySelector('p').textContent = 'Was möchtest du speichern?';
  };

  // Step 2: Format
  overlay.querySelectorAll('#sl-step2 .save-load-option').forEach(opt => {
    opt.onclick = () => {
      close();
      const fmt = opt.dataset.action;
      if (fmt === 'fmt-json') doSaveProjectJSON();
      else if (fmt === 'fmt-pdf') doSavePDF();
      else if (fmt === 'fmt-png') doSavePNG();
    };
  });

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function openLoadModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'save-load-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h2>Laden</h2>
      <p style="margin:0 0 10px;color:#888;font-size:12px;">Was möchtest du laden?</p>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${_saveOptionHTML('load-project', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', 'Projekt laden (.json)', 'Gespeichertes Projekt öffnen und weiterarbeiten')}
        ${_saveOptionHTML('load-pipes', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', 'Leitungen einmessen', 'Gespeicherte Leitungen in neues Luftbild übertragen')}
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button id="sl-close">Abbrechen</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => document.body.removeChild(overlay);
  overlay.querySelector('#sl-close').onclick = close;

  overlay.querySelectorAll('.save-load-option').forEach(opt => {
    opt.onclick = () => {
      close();
      const action = opt.dataset.action;
      if (action === 'load-project') document.getElementById('json-input').click();
      else if (action === 'load-pipes') document.getElementById('leitungen-import-input').click();
    };
  });

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

document.getElementById('btn-central-save').onclick = openSaveModal;
document.getElementById('btn-central-load').onclick = openLoadModal;

// ─── Einzelne Speicherfunktionen (vom Modal aufgerufen) ───

function doSavePNG() {
  endPipeEdit(); clearPipeDistanceGuides();
  const url = canvas.toDataURL({ format: 'png', multiplier: 3 });

  // Data-URL → Blob konvertieren
  const byteString = atob(url.split(',')[1]);
  const mimeString = url.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: mimeString });
  const file = new File([blob], 'gartenplan.png', { type: 'image/png' });

  // iOS/Mobile: Share Sheet verwenden wenn verfügbar
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Gartenplan' }).catch(() => {});
    return;
  }

  // Fallback: Blob-URL Download (funktioniert besser als data: URL)
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = 'gartenplan.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

document.getElementById('btn-save-png').onclick = doSavePNG;

function doSavePDF() {
  endPipeEdit(); clearPipeDistanceGuides();
  if (!state.backgroundImage) { showToast('Bitte zuerst ein Luftbild laden.'); return; }
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  if (!canvasW || !canvasH) { showToast('Canvas nicht initialisiert.'); return; }

  const btn = document.getElementById('btn-save-pdf');
  btn.textContent = 'Wird erstellt …';
  btn.disabled = true;

  // Render at 3× resolution
  const imgData = canvas.toDataURL({ format: 'png', multiplier: 3 });
  const isLandscape = canvasW >= canvasH;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const footerH = 22; // mm for scale bar + legend
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - footerH;

  const aspect = canvasW / canvasH;
  let imgW = maxW;
  let imgH = imgW / aspect;
  if (imgH > maxH) { imgH = maxH; imgW = imgH * aspect; }

  const offsetX = margin + (maxW - imgW) / 2;
  const offsetY = margin + (maxH - imgH) / 2;

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, imgW, imgH);

  // ── Rahmen um Karte ──
  pdf.setDrawColor(180); pdf.setLineWidth(0.2);
  pdf.rect(offsetX, offsetY, imgW, imgH);

  const footerY = offsetY + imgH + 4;

  // ── Maßstabsbalken ──
  if (state.scale && state.imgDisplayScale) {
    // Meter pro mm auf der Karte (PDF-Koordinaten)
    const pxPerMm = (canvasW / imgW);                           // canvas-px pro pdf-mm
    const mPerMm  = pxPerMm / (state.imgDisplayScale * state.scale); // m pro pdf-mm
    // Wähle schöne Balkenlänge
    const NICE = [1,2,5,10,20,25,50,100,200,500,1000];
    const targetMm = 30;
    const rawM = targetMm * mPerMm;
    const barM = NICE.find(n => n >= rawM) || NICE[NICE.length - 1];
    const barMm = barM / mPerMm;
    const bx = offsetX;
    const by = footerY + 3;

    pdf.setDrawColor(40); pdf.setLineWidth(0.4); pdf.setFillColor(40);
    // Hauptlinie
    pdf.line(bx, by, bx + barMm, by);
    // Endticks
    pdf.line(bx, by - 1.2, bx, by + 1.2);
    pdf.line(bx + barMm, by - 1.2, bx + barMm, by + 1.2);
    // Halbtick
    pdf.setLineWidth(0.2);
    pdf.line(bx + barMm / 2, by - 0.8, bx + barMm / 2, by + 0.8);
    // Labels
    pdf.setFontSize(6.5); pdf.setTextColor(40);
    pdf.text('0', bx, by + 3.5);
    pdf.text(`${barM >= 1000 ? (barM/1000)+'km' : barM+'m'}`, bx + barMm, by + 3.5, { align: 'right' });
    pdf.setFontSize(5.5); pdf.setTextColor(100);
    pdf.text('Maßstabsbalken', bx, by + 6);
  }

  // ── Legende (Leitungstypen) ──
  const pipeTypes = [...new Set(
    canvas.getObjects().filter(o => o._pipeType).map(o => o._pipeType)
  )];
  if (pipeTypes.length) {
    let lx = offsetX + 45;
    const ly = footerY + 1;
    pdf.setFontSize(6); pdf.setTextColor(80);
    pdf.text('Leitungen:', lx, ly + 3);
    lx += 18;
    pipeTypes.forEach(key => {
      const pt = PIPE_TYPES[key];
      if (!pt) return;
      const [r, g, b] = pt.color.match(/\w\w/g).map(x => parseInt(x, 16));
      pdf.setFillColor(r, g, b);
      pdf.setDrawColor(r, g, b);
      pdf.rect(lx, ly + 1, 8, 2, 'F');
      pdf.setTextColor(40); pdf.setFontSize(6);
      pdf.text(`${pt.icon} ${pt.label}`, lx + 10, ly + 3.5);
      lx += 10 + pdf.getTextWidth(`${pt.icon} ${pt.label}`) + 4;
    });
  }

  // ── Titelblock rechts ──
  const dateStr = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  pdf.setFontSize(7); pdf.setTextColor(80);
  pdf.text(`Planer`, pageW - margin, footerY + 3, { align: 'right' });
  pdf.setFontSize(6); pdf.setTextColor(130);
  pdf.text(`Exportiert: ${dateStr}`, pageW - margin, footerY + 7, { align: 'right' });
  if (state.scale && state.imgDisplayScale) {
    const acc = calcAccuracy();
    if (acc) {
      const gsd = acc.gsd_cm < 1 ? `${(acc.gsd_cm*10).toFixed(1)} mm/px` : `${acc.gsd_cm.toFixed(1)} cm/px`;
      pdf.text(`GSD: ${gsd}`, pageW - margin, footerY + 11, { align: 'right' });
    }
  }

  // iOS/Mobile: Share Sheet wenn verfügbar
  const pdfBlob = pdf.output('blob');
  const pdfFile = new File([pdfBlob], 'gartenplan.pdf', { type: 'application/pdf' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    navigator.share({ files: [pdfFile], title: 'Gartenplan' }).catch(() => {});
  } else {
    pdf.save('gartenplan.pdf');
  }

  btn.textContent = 'PDF exportieren';
  btn.disabled = false;
}
document.getElementById('btn-save-pdf').onclick = doSavePDF;

function doSaveProjectJSON() {
  endPipeEdit();
  clearPipeDistanceGuides();
  const data = {
    version: 3,
    scale: state.scale,
    scaleSource: state.scaleSource,
    imgDisplayScale: state.imgDisplayScale,
    exifAltitude: state.exifAltitude,
    refLines: state.refLines,
    refSumL2: state.refSumL2,
    imgOriginalWidth: state.imgOriginalWidth,
    flightCam: state.flightCam || null,
    fontSize: state.fontSize,
    labelBg: state.labelBg,
    gridStepM: state.gridStepM || 0,
    gridColor: state.gridColor || '#ffffff',
    gridOpacity: state.gridOpacity != null ? state.gridOpacity : 0.28,
    measurements: state.measurements.map(({ id, type, label, value, rMeters, pipeType, pipeDepth, refs, nennweite, dimFootOverrides }) => ({ id, type, label, value, rMeters, pipeType, pipeDepth, refs: refs || [], nennweite: nennweite || null, dimFootOverrides: dimFootOverrides || {} })),
    pipeReferences: state.pipeReferences,
    activePipeRefs: state.activePipeRefs,
    canvas: canvas.toJSON(CANVAS_SERIAL_PROPS),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], 'gartenplan.json', { type: 'application/json' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Gartenplan' }).catch(() => {});
    return;
  }
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl; a.download = 'gartenplan.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}
document.getElementById('btn-save-json').onclick = doSaveProjectJSON;

document.getElementById('btn-load-json').onclick = () => document.getElementById('json-input').click();
document.getElementById('json-input').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (typeof data !== 'object' || !data.canvas) throw new Error('Ungültiges Format');
      state.scale           = (typeof data.scale === 'number' && data.scale > 0) ? data.scale : null;
      state.scaleSource     = data.scaleSource || null;
      state.imgDisplayScale = (typeof data.imgDisplayScale === 'number' && data.imgDisplayScale > 0) ? data.imgDisplayScale : 1;
      state.exifAltitude    = (typeof data.exifAltitude === 'number' && data.exifAltitude > 0) ? data.exifAltitude : null;
      state.refLines        = Array.isArray(data.refLines) ? data.refLines : [];
      state.refSumL2        = (typeof data.refSumL2 === 'number') ? data.refSumL2 : 0;
      state.imgOriginalWidth = data.imgOriginalWidth || null;
      state.flightCam       = data.flightCam || null;
      state.fontSize = (Number.isInteger(data.fontSize) && data.fontSize >= 6 && data.fontSize <= 72) ? data.fontSize : 13;
      state.labelBg  = data.labelBg === true;
      state.gridStepM  = (typeof data.gridStepM === 'number') ? data.gridStepM : 0;
      state.gridColor  = (typeof data.gridColor === 'string' && /^#[0-9a-f]{6}$/i.test(data.gridColor)) ? data.gridColor : '#ffffff';
      state.gridOpacity = (typeof data.gridOpacity === 'number') ? data.gridOpacity : 0.28;
      // Update grid UI controls
      const _gss = document.getElementById('grid-step-select'); if (_gss) _gss.value = String(state.gridStepM);
      const _gci = document.getElementById('grid-color-input'); if (_gci) _gci.value = state.gridColor;
      const _gor = document.getElementById('grid-opacity-range'); if (_gor) _gor.value = Math.round(state.gridOpacity * 100);
      const _gol = document.getElementById('grid-opacity-label'); if (_gol) _gol.textContent = Math.round(state.gridOpacity * 100) + '%';
      state.measurements = (data.measurements || []).map(m => ({ ...m }));
      state.pipeReferences = Array.isArray(data.pipeReferences) ? data.pipeReferences : [];
      state.activePipeRefs = Array.isArray(data.activePipeRefs) ? data.activePipeRefs : [];
      pipeRefId = state.pipeReferences.reduce((max, r) => Math.max(max, r.id), 0);
      document.getElementById('font-size-input').value = state.fontSize;
      btnLabelBg.innerHTML = _bgIcon + (state.labelBg ? ' BG: Hell' : ' BG: Dunkel');
      btnLabelBg.classList.toggle('active', state.labelBg);
      canvas.loadFromJSON(data.canvas, () => {
        canvas.renderAll();
        // Remove any stale dim-line objects that were saved in the canvas JSON
        canvas.getObjects().filter(o => o._dimLinePipeId != null).forEach(o => canvas.remove(o));
        renderAllDimLines();
        updateRefStatus();
        updateMeasurementList();
        updatePipeLegend();
        updatePipeRefList();
        offsetOverlappingPipes();
        document.getElementById('drop-overlay').classList.add('hidden');
        history.past = []; history.future = []; updateUndoRedoButtons();
        showToast('Projekt geladen', 'success');
      });
    } catch { showToast('Fehler beim Laden der Datei.', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
};

// =========================================================
// LEITUNGEN EXPORTIEREN / EINMESSEN
// =========================================================


// ── Hilfsfunktionen ──────────────────────────────────────

function _leitungenToMeters(cx, cy) {
  const img = state.backgroundImage;
  return {
    x: (cx - img.left) / (state.imgDisplayScale * state.scale),
    y: (cy - img.top)  / (state.imgDisplayScale * state.scale),
  };
}

function _leitungenToCanvas(mx, my) {
  const img = state.backgroundImage;
  return {
    x: mx * state.imgDisplayScale * state.scale + img.left,
    y: my * state.imgDisplayScale * state.scale + img.top,
  };
}

function _collectPipeData() {
  const pipes = canvas.getObjects()
    .filter(o => o._pipeType && o.type === 'polyline' && !o._pipePreview)
    .map(polyline => {
      const matrix = polyline.calcTransformMatrix();
      const pts = polyline.points.map(pt => {
        const abs = fabric.util.transformPoint(
          new fabric.Point(pt.x - polyline.pathOffset.x, pt.y - polyline.pathOffset.y),
          matrix
        );
        return _leitungenToMeters(abs.x, abs.y);
      });
      const meas = state.measurements.find(m => m.id === polyline._measureId);
      return {
        id:        polyline._measureId,
        pipeType:  polyline._pipeType,
        pipeDepth: polyline._pipeDepth || null,
        label:     meas ? meas.label : (PIPE_TYPES[polyline._pipeType]?.label || ''),
        points_m:  pts,
      };
    });
  const pipeReferences = state.pipeReferences.map(r => {
    if (r.type === 'line') {
      const p1 = _leitungenToMeters(r.x1, r.y1);
      const p2 = _leitungenToMeters(r.x2, r.y2);
      return { id: r.id, type: r.type, name: r.name, x1_m: p1.x, y1_m: p1.y, x2_m: p2.x, y2_m: p2.y };
    }
    const p = _leitungenToMeters(r.x, r.y);
    return { id: r.id, type: r.type, name: r.name, x_m: p.x, y_m: p.y };
  });
  return { pipes, pipeReferences };
}

// ── Ankerpunkt-Marker auf Canvas ─────────────────────────

function _addAnchorMarker(x, y, label, idx) {
  const color = '#FF9500';
  const size  = 10;
  const objs  = [];
  // Kreuz
  [[[x - size, y], [x + size, y]], [[x, y - size], [x, y + size]]].forEach(([p1, p2]) => {
    const l = new fabric.Line([p1[0], p1[1], p2[0], p2[1]], {
      stroke: color, strokeWidth: 2,
      selectable: false, evented: false, _leitungenAnchorMarker: true,
    });
    canvas.add(l);
    objs.push(l);
  });
  // Kreis
  const c = new fabric.Circle({
    left: x, top: y, radius: 5,
    fill: color, opacity: 0.85,
    originX: 'center', originY: 'center',
    selectable: false, evented: false, _leitungenAnchorMarker: true,
  });
  canvas.add(c);
  objs.push(c);
  // Label
  const t = new fabric.Text(`AP${idx}: ${label}`, {
    left: x + 9, top: y - 16,
    fontSize: 11, fill: color,
    fontFamily: 'Inter, sans-serif', fontWeight: '600',
    selectable: false, evented: false, _leitungenAnchorMarker: true,
    shadow: new fabric.Shadow({ color: '#000', blur: 3, offsetX: 0, offsetY: 0 }),
  });
  canvas.add(t);
  objs.push(t);
  canvas.renderAll();
  return objs;
}

function _removeAnchorMarkers() {
  canvas.getObjects().filter(o => o._leitungenAnchorMarker).forEach(o => canvas.remove(o));
  canvas.renderAll();
}

// ── Overlay-Banner ───────────────────────────────────────

function _anchorBannerExport(msg) {
  document.getElementById('leitungen-anchor-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'leitungen-anchor-overlay';
  el.style.cssText = 'position:fixed;bottom:52px;left:50%;transform:translateX(-50%);' +
    'background:#1c1c1e;color:#fff;padding:11px 18px;border-radius:10px;font-size:12.5px;' +
    'z-index:9999;display:flex;align-items:center;gap:14px;box-shadow:0 4px 20px rgba(0,0,0,0.4);' +
    'max-width:90vw;';
  el.innerHTML = `<span style="display:flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span id="leitungen-anchor-msg">${msg}</span>
    </span>
    <button onclick="_cancelAnchorExport()" style="background:#3a3a3c;color:#fff;border:none;
      border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;white-space:nowrap;">Abbrechen</button>`;
  document.body.appendChild(el);
}

function _anchorBannerImport(msg) {
  document.getElementById('leitungen-anchor-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'leitungen-anchor-overlay';
  el.style.cssText = 'position:fixed;bottom:52px;left:50%;transform:translateX(-50%);' +
    'background:#1c1c1e;color:#fff;padding:11px 18px;border-radius:10px;font-size:12.5px;' +
    'z-index:9999;display:flex;align-items:center;gap:14px;box-shadow:0 4px 20px rgba(0,0,0,0.4);' +
    'max-width:90vw;';
  el.innerHTML = `<span style="display:flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span id="leitungen-anchor-msg">${msg}</span>
    </span>
    <button onclick="_cancelAnchorImport()" style="background:#3a3a3c;color:#fff;border:none;
      border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;white-space:nowrap;">Abbrechen</button>`;
  document.body.appendChild(el);
}

function _removeBanner() {
  document.getElementById('leitungen-anchor-overlay')?.remove();
  document.getElementById('status-hint').textContent = '';
}

// ── EXPORT: Ankerpunkte sammeln, dann speichern ───────────

const _anchorExport = { active: false, step: 0, collected: [], markerObjs: [], pendingData: null };

function exportLeitungen() {
  if (!state.backgroundImage) { showToast('Bitte zuerst ein Luftbild laden.', 'error'); return; }
  if (!state.scale)           { showToast('Bitte zuerst den Maßstab setzen.', 'error'); return; }
  endPipeEdit();
  clearPipeDistanceGuides();

  const { pipes } = _collectPipeData();
  if (pipes.length === 0) { showToast('Keine Leitungen zum Speichern vorhanden.', 'error'); return; }

  const pendingData = _collectPipeData();

  createModal(
    'Ankerpunkte setzen',
    `<p style="margin:0 0 12px;color:#555;font-size:13px;">
      Um die Leitungen später in ein neues Luftbild einzumessen, werden <b>2 Ankerpunkte</b> benötigt.<br><br>
      Du klickst gleich zwei gut erkennbare, feste Punkte im Bild an und gibst ihnen einen Namen –
      zum Beispiel eine <b>Hausecke</b>, einen <b>Schachtdeckel</b> oder einen <b>Vermessungsstein</b>.<br><br>
      Beim Laden wirst du gebeten, dieselben Punkte im neuen Luftbild zu markieren.
    </p>`,
    () => {
      _anchorExport.pendingData = pendingData;
      _anchorExport.collected   = [];
      _anchorExport.markerObjs  = [];
      _anchorExport.active      = true;
      _anchorExport.step        = 1;
      _startAnchorExportStep();
    },
    null
  );
}

function _startAnchorExportStep() {
  const step = _anchorExport.step;
  _anchorBannerExport(
    `Ankerpunkt ${step} von 2 – klicke auf einen <b>gut erkennbaren, festen Punkt</b> im Luftbild`
  );
}

function _cancelAnchorExport() {
  _anchorExport.active = false;
  _anchorExport.step   = 0;
  _anchorExport.markerObjs.forEach(o => canvas.remove(o));
  _anchorExport.markerObjs  = [];
  _anchorExport.collected   = [];
  _anchorExport.pendingData = null;
  _removeBanner();
  canvas.renderAll();
}

function _handleAnchorExportClick(p) {
  if (!_anchorExport.active) return false;
  const step = _anchorExport.step;

  // Namenseingabe per kleinem Modal
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal" style="max-width:360px;">
    <h2>Ankerpunkt ${step} benennen</h2>
    <p style="margin:0 0 10px;color:#555;font-size:13px;">
      Gib einen eindeutigen Namen ein, damit du diesen Punkt im neuen Luftbild wiederfindest.<br>
      <span style="color:#888;font-size:11px;">Beispiele: Hausecke NW, Schachtdeckel Einfahrt, Vermessungsstein</span>
    </p>
    <input id="_ap-name-input" type="text" placeholder="z.B. Hausecke NW"
      style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;margin-bottom:4px;" />
    <div id="_ap-name-error" style="color:#ef4444;font-size:11px;margin-bottom:10px;display:none;">Bitte einen Namen eingeben.</div>
    <div class="btn-row">
      <button id="_ap-cancel">Abbrechen</button>
      <button id="_ap-ok" style="background:#4ecca3;color:#1a1a2e;font-weight:600;">Setzen</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const inp = ov.querySelector('#_ap-name-input');
  inp.focus();

  const errEl = ov.querySelector('#_ap-name-error');
  const confirm = () => {
    const name = inp.value.trim();
    if (!name) { inp.style.borderColor = '#ef4444'; errEl.style.display = 'block'; inp.focus(); return; }
    errEl.style.display = 'none';
    document.body.removeChild(ov);

    const m = _leitungenToMeters(p.x, p.y);
    _anchorExport.collected.push({ name, x_m: m.x, y_m: m.y });
    const newMarkers = _addAnchorMarker(p.x, p.y, name, step);
    _anchorExport.markerObjs.push(...newMarkers);

    if (step === 1) {
      _anchorExport.step = 2;
      _startAnchorExportStep();
    } else {
      // Beide Ankerpunkte gesetzt → Datei speichern
      _anchorExport.active = false;
      _removeBanner();
      setTimeout(() => {
        _anchorExport.markerObjs.forEach(o => canvas.remove(o));
        _anchorExport.markerObjs = [];
        canvas.renderAll();
      }, 1500);

      const { pipes, pipeReferences } = _anchorExport.pendingData;
      const data = {
        version: 2,
        exportDate: new Date().toISOString(),
        anchors: _anchorExport.collected,
        imageInfo: {
          scale: state.scale,
          imgDisplayScale: state.imgDisplayScale,
          imgOriginalWidth: state.imgOriginalWidth,
        },
        pipes,
        pipeReferences,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'leitungen.json';
      a.click();
      showToast(`${pipes.length} Leitung${pipes.length === 1 ? '' : 'en'} gespeichert`, 'success');
      _anchorExport.collected   = [];
      _anchorExport.pendingData = null;
    }
  };

  ov.querySelector('#_ap-ok').onclick     = confirm;
  ov.querySelector('#_ap-cancel').onclick = () => { document.body.removeChild(ov); _cancelAnchorExport(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { document.body.removeChild(ov); _cancelAnchorExport(); } });
  return true;
}

// ── IMPORT: Ankerpunkte im neuen Bild setzen ─────────────

const _anchorImport = { active: false, anchors: [], step: 0, clicked: [], markerObjs: [], data: null };

function _cancelAnchorImport() {
  _anchorImport.active = false;
  _anchorImport.step   = 0;
  _anchorImport.clicked = [];
  _anchorImport.markerObjs.forEach(o => canvas.remove(o));
  _anchorImport.markerObjs = [];
  _anchorImport.data    = null;
  _removeBanner();
  canvas.renderAll();
}

function _startAnchorImport(data) {
  _anchorImport.data     = data;
  _anchorImport.anchors  = data.anchors;
  _anchorImport.step     = 0;
  _anchorImport.clicked  = [];
  _anchorImport.markerObjs = [];
  _anchorImport.active   = true;
  _showAnchorImportStep();
}

function _showAnchorImportStep() {
  const idx    = _anchorImport.step;
  const anchor = _anchorImport.anchors[idx];
  const total  = _anchorImport.anchors.length;
  _anchorBannerImport(
    `Ankerpunkt ${idx + 1} von ${total}: Klicke auf <b>&bdquo;${anchor.name}&ldquo;</b> im neuen Luftbild`
  );
}

function _handleAnchorImportClick(p) {
  if (!_anchorImport.active) return false;
  const idx    = _anchorImport.step;
  const anchor = _anchorImport.anchors[idx];

  // Marker setzen
  const newMarkers = _addAnchorMarker(p.x, p.y, anchor.name, idx + 1);
  _anchorImport.markerObjs.push(...newMarkers);
  _anchorImport.clicked.push({ x: p.x, y: p.y });
  _anchorImport.step++;

  if (_anchorImport.step < _anchorImport.anchors.length) {
    _showAnchorImportStep();
  } else {
    // Alle Ankerpunkte gesetzt → einmessen
    _anchorImport.active = false;
    _removeBanner();
    const data    = _anchorImport.data;
    const clicked = _anchorImport.clicked.slice();
    setTimeout(() => {
      _anchorImport.markerObjs.forEach(o => canvas.remove(o));
      _anchorImport.markerObjs = [];
      canvas.renderAll();
    }, 1500);
    _doImportLeitungen(data, clicked);
  }
  return true;
}

// ── Gemeinsamer Canvas-Klick-Handler (aus mouse:down) ────

function handleLeitungenAlignClick(p) {
  if (_anchorExport.active) return _handleAnchorExportClick(p);
  if (_anchorImport.active) return _handleAnchorImportClick(p);
  return false;
}

// ── Leitungen tatsächlich auf Canvas platzieren ──────────

function _doImportLeitungen(data, clickedPts) {
  // clickedPts = Canvas-Koordinaten der vom Nutzer gesetzten Ankerpunkte
  // data.anchors = gespeicherte Ankerpunkte (x_m, y_m)
  const img   = state.backgroundImage;
  const s     = state.imgDisplayScale;
  const scale = state.scale;

  // Basis-Transformation: Meter → Canvas
  let toCanvas = (mx, my) => ({
    x: mx * s * scale + img.left,
    y: my * s * scale + img.top,
  });

  // Affine 2-Punkt-Transformation mit gespeicherten Ankerpunkten
  if (clickedPts && clickedPts.length >= 2 && data.anchors && data.anchors.length >= 2) {
    const base0 = toCanvas(data.anchors[0].x_m, data.anchors[0].y_m);
    const base1 = toCanvas(data.anchors[1].x_m, data.anchors[1].y_m);
    const dst0  = clickedPts[0];
    const dst1  = clickedPts[1];

    const dx0 = base1.x - base0.x, dy0 = base1.y - base0.y;
    const dx1 = dst1.x  - dst0.x,  dy1 = dst1.y  - dst0.y;
    const lenS = Math.hypot(dx0, dy0), lenD = Math.hypot(dx1, dy1);

    if (lenS > 0 && lenD > 0) {
      const sf   = lenD / lenS;
      const rot  = Math.atan2(dy1, dx1) - Math.atan2(dy0, dx0);
      const cosR = Math.cos(rot) * sf, sinR = Math.sin(rot) * sf;
      const tx   = dst0.x - (cosR * base0.x - sinR * base0.y);
      const ty   = dst0.y - (sinR * base0.x + cosR * base0.y);
      const base = toCanvas;
      toCanvas = (mx, my) => {
        const b = base(mx, my);
        return { x: cosR * b.x - sinR * b.y + tx, y: sinR * b.x + cosR * b.y + ty };
      };
    }
  }

  // Duplikat-Schutz: Rohre mit bereits vorhandener ID überspringen
  const existingIds = new Set(state.measurements.map(m => m.id));
  const pipesToImport = data.pipes.filter(p => !existingIds.has(p.id));
  const skipped = data.pipes.length - pipesToImport.length;
  if (skipped > 0) showToast(`${skipped} bereits vorhandene Leitung${skipped === 1 ? '' : 'en'} übersprungen.`, 'info');
  if (pipesToImport.length === 0) { showToast('Alle Leitungen bereits vorhanden – Import übersprungen.', 'warning'); return; }

  let importedCount = 0;
  pipesToImport.forEach(pipe => {
    if (!pipe.points_m || pipe.points_m.length < 2) return;
    if (!PIPE_TYPES[pipe.pipeType]) return;

    const pts = pipe.points_m.map(p => toCanvas(p.x, p.y));
    const id  = nextMeasureId();
    const pt  = PIPE_TYPES[pipe.pipeType];
    const depth = pipe.pipeDepth || null;

    const line = new fabric.Polyline(pts.map(p => ({ x: p.x, y: p.y })), {
      fill: 'transparent',
      stroke: pt.color, strokeWidth: PIPE_LINE_WIDTH,
      strokeDashArray: pt.dash && pt.dash.length ? pt.dash : undefined,
      selectable: true, evented: true,
      _measureId: id, _pipeType: pipe.pipeType, _pipeDepth: depth,
      lockMovementX: true, lockMovementY: true,
    });
    canvas.add(line);
    pts.forEach(p => addEndpointDot(p.x, p.y, pt.color, id));

    if (!state.pipeLayerVisible) {
      canvas.getObjects().filter(o => o._measureId === id && !o._pipeHandle).forEach(o => { o.visible = false; });
    }

    const depthLabel = depth ? ` (${depth} cm)` : '';
    state.measurements.push({ id, type: 'pipe', label: pt.label + depthLabel, value: null, pipeType: pipe.pipeType, pipeDepth: depth, refs: [] });
    importedCount++;
  });

  sendPipesToBack();
  offsetOverlappingPipes();
  updateMeasurementList();
  updatePipeLegend();
  saveSnapshot();
  showToast(`${importedCount} Leitung${importedCount === 1 ? '' : 'en'} eingemessen`, 'success');
  renderAllDimLines();
}

// ── Import-Datei laden ────────────────────────────────────

document.getElementById('leitungen-import-input').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  if (!state.backgroundImage) { showToast('Bitte zuerst ein Luftbild laden.', 'error'); e.target.value = ''; return; }
  if (!state.scale)           { showToast('Bitte zuerst den Maßstab setzen.', 'error');  e.target.value = ''; return; }

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.pipes || !Array.isArray(data.pipes)) throw new Error('Ungültiges Format');
      if (data.version !== 2 || !Array.isArray(data.anchors) || data.anchors.length < 2) {
        createModal(
          'Älteres Dateiformat',
          `<p style="margin:0 0 12px;color:#555;font-size:13px;">
            Diese Leitungsdatei hat <b>keine Ankerpunkte</b> und kann nicht eingemessen werden.<br><br>
            So geht's: Öffne das <b>Original-Luftbild</b> als Projekt (Laden), wechsle dann ins
            Leitungen-Panel und klicke <b>„Leitungen speichern"</b> – dabei werden die Ankerpunkte neu festgelegt.
          </p>`,
          () => {},
          null
        );
        return;
      }

      const dateStr = data.exportDate ? new Date(data.exportDate).toLocaleDateString('de-DE') : '–';
      const names   = data.anchors.map(a => `<b>${a.name}</b>`).join(', ');
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.innerHTML = `<div class="modal" style="max-width:400px;">
        <h2>Leitungen einmessen</h2>
        <p style="margin:0 0 12px;color:#555;font-size:13px;">
          <b>${data.pipes.length} Leitung${data.pipes.length === 1 ? '' : 'en'}</b> vom ${dateStr}.<br><br>
          Du wirst jetzt nacheinander gebeten, folgende Ankerpunkte im neuen Luftbild anzuklicken:<br>
          <span style="display:block;margin:8px 0 0 0;line-height:1.9;">${data.anchors.map((a, i) =>
            `<span style="display:inline-flex;align-items:center;gap:5px;">
              <span style="background:#FF9500;color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${i+1}</span>
              ${a.name}
            </span>`).join('<br>')}</span>
        </p>
        <div class="btn-row">
          <button id="_li-cancel">Abbrechen</button>
          <button id="_li-ok" style="background:#4ecca3;color:#1a1a2e;font-weight:600;">Ankerpunkte setzen</button>
        </div>
      </div>`;
      document.body.appendChild(ov);
      const close = () => document.body.removeChild(ov);
      ov.querySelector('#_li-ok').onclick     = () => { close(); _startAnchorImport(data); };
      ov.querySelector('#_li-cancel').onclick = close;
    } catch (err) { showToast(err.message || 'Fehler beim Laden der Leitungsdatei.', 'error'); e.target.value = ''; }
  };
  reader.readAsText(file);
  e.target.value = '';
};

document.getElementById('btn-undo').onclick = () => undo();
document.getElementById('btn-redo').onclick = () => redo();

document.getElementById('btn-clear-all').onclick = () => {
  createModal(
    'Alles löschen?',
    '<p style="margin:0 0 12px;color:#555;font-size:13px;">Alle Markierungen und das Hintergrundbild werden unwiderruflich gelöscht.</p>',
    () => {
      history.past = []; history.future = []; updateUndoRedoButtons();
      canvas.clear();
      canvas.backgroundColor = '#e5e5ea';
      state.measurements = [];
      state.scale = null;
      state.scaleSource = null;
      state.exifAltitude = null;
      state.flightCam = null;
      state.refLines = [];
      state.refSumL2 = 0;
      state.backgroundImage = null;
      state.pipeReferences = [];
      state.activePipeRefs = [];
      state.pipeLayerVisible = true;
      state.gridVisible = false;
      const gcClear = document.getElementById('grid-canvas');
      if (gcClear) gcClear.getContext('2d').clearRect(0, 0, gcClear.width, gcClear.height);
      const btnGridTog = document.getElementById('btn-grid-toggle');
      if (btnGridTog) { btnGridTog.textContent = 'Ausgeblendet'; btnGridTog.classList.add('hidden-layer'); }
      const gridInfoClear = document.getElementById('grid-info');
      if (gridInfoClear) gridInfoClear.textContent = 'Kein Maßstab gesetzt';
      pipeRefId = 0;
      cancelDrawing();
      document.getElementById('drop-overlay').classList.remove('hidden');
      updateMeasurementList();
      updatePipeRefList();
      updateRefStatus();
      canvas.renderAll();
    }
  );
};

// =========================================================
// RESIZE
// =========================================================
window.addEventListener('resize', () => {
  canvas.setWidth(wrapper.clientWidth);
  canvas.setHeight(wrapper.clientHeight);
  const gc = document.getElementById('grid-canvas');
  if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
  canvas.renderAll();
});

// Register restore hooks for undo/redo
registerRestoreHook(() => updateRefStatus());
registerRestoreHook(() => updateMeasurementList());
registerRestoreHook(() => updatePipeLegend());
registerRestoreHook(() => updatePipeRefList());
registerRestoreHook(() => updatePipePanel());
registerRestoreHook(() => renderAllDimLines());

// =========================================================
// INIT
// =========================================================

// Size grid canvas to match wrapper
(function initGridCanvas() {
  const gc = document.getElementById('grid-canvas');
  if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
})();

// =========================================================
// SIDEBAR RESIZE
// =========================================================
(function initSidebarResize() {
  const sidebar = document.getElementById('sidebar');
  const handle  = document.getElementById('sidebar-resize-handle');
  if (!sidebar || !handle) return;

  const MIN_W = 160, MAX_W = 480;
  const STORAGE_KEY = 'gp_sidebar_w';

  // Restore saved width
  const saved = parseInt(localStorage.getItem(STORAGE_KEY));
  if (saved >= MIN_W && saved <= MAX_W) sidebar.style.width = saved + 'px';

  let startX, startW;

  function onMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = clientX - startX;
    const newW  = Math.min(MAX_W, Math.max(MIN_W, startW + delta));
    sidebar.style.width = newW + 'px';
  }

  function onUp() {
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(STORAGE_KEY, parseInt(sidebar.style.width));
    // Trigger canvas resize so Fabric + grid canvas stay in sync
    canvas.setWidth(wrapper.clientWidth);
    canvas.setHeight(wrapper.clientHeight);
    const gc = document.getElementById('grid-canvas');
    if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
    canvas.renderAll();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onUp);
  }

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  handle.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend',  onUp);
  }, { passive: true });
})();

// Redraw grid after every Fabric.js render (covers zoom + pan)
let _gridRafPending = false;
canvas.on('after:render', () => {
  if (_gridRafPending) return;
  _gridRafPending = true;
  requestAnimationFrame(() => { _gridRafPending = false; drawGrid(); });
});

// =========================================================
// AKKORDEON SIDEBAR
// =========================================================
function toggleAcc(header) {
  const section = header.closest('.acc-section');
  section.classList.toggle('open');
  if (section.classList.contains('open')) {
    const badge = section.querySelector('.acc-badge');
    if (badge) badge.classList.remove('visible');
  }
}

function openAccSection(id) {
  const sec = document.getElementById(id);
  if (sec) { sec.classList.add('open'); const b = sec.querySelector('.acc-badge'); if (b) b.classList.remove('visible'); }
}

updateRefStatus();
updateMeasurementList();

// =========================================================
// SCHRIFTGRÖSSEN-CLUSTER
// =========================================================
function resizeLabelCluster(clusterKey, newSize) {
  newSize = parseInt(newSize);
  if (!newSize || newSize < 4 || newSize > 72) return;
  canvas.getObjects().filter(o => {
    if (o.type !== 'text') return false;
    switch (clusterKey) {
      case 'measure': return o._measureId != null && !o._userLabel;
      case 'label':   return o._userLabel === true;
      case 'ref':     return o._measureId == null && !o._userLabel && !o._pipeRefType && !o._isPipeLegend;
      case 'guide':   return o._pipeRefType === 'line-label' || o._pipeRefType === 'point-label';
    }
    return false;
  }).forEach(o => o.set({ fontSize: newSize }));
  canvas.renderAll();
}

document.getElementById('fs-measure').addEventListener('input', e => resizeLabelCluster('measure', e.target.value));
document.getElementById('fs-label').addEventListener('input',   e => resizeLabelCluster('label',   e.target.value));
document.getElementById('fs-ref').addEventListener('input',     e => resizeLabelCluster('ref',     e.target.value));
document.getElementById('fs-guide').addEventListener('input',   e => resizeLabelCluster('guide',   e.target.value));

// Wire up ref-onboarding dependency on setTool
initRefOnboarding({ setTool });

// Welcome-Onboarding beim ersten Besuch
if (!localStorage.getItem('gp_ob_seen')) {
  showWelcomeOnboarding();
}

// Acc-Panel Close
document.getElementById('acc-panel-close').onclick = hideAccuracyDetail;

// Klick außerhalb schließt das Panel
document.addEventListener('click', e => {
  const panel = document.getElementById('acc-panel');
  if (panel.classList.contains('open') &&
      !panel.contains(e.target) &&
      !e.target.classList.contains('ref-detail-btn')) {
    hideAccuracyDetail();
  }
});

// Help-Button
document.getElementById('btn-help').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('help-popover').classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('#help-popover') && e.target.id !== 'btn-help') {
    document.getElementById('help-popover').classList.remove('open');
  }
});

// =========================================================
// RELEASE NOTES & BUG REPORT — init (extracted to ui/whats-new.js)
// =========================================================
initWhatsNew();

// =========================================================
// MOBILE: DRAWER TOGGLE
// =========================================================
const _sidebar = document.getElementById('sidebar');
const _drawerToggle = document.getElementById('mobile-drawer-toggle');
const _drawerBackdrop = document.getElementById('drawer-backdrop');

function openDrawer() {
  _sidebar.classList.add('drawer-open');
  _drawerBackdrop.style.display = 'block';
  requestAnimationFrame(() => _drawerBackdrop.classList.add('visible'));
  _drawerToggle.textContent = 'Schließen ▼';
  const tt = document.getElementById('touch-toolbar');
  if (tt) tt.style.display = 'none';
}
function closeDrawer() {
  _sidebar.classList.remove('drawer-open');
  _drawerBackdrop.classList.remove('visible');
  setTimeout(() => { _drawerBackdrop.style.display = 'none'; }, 260);
  _drawerToggle.textContent = 'Messungen & Bibliothek ▲';
  const tt = document.getElementById('touch-toolbar');
  if (tt && _isTouchDevice) tt.style.display = 'flex';
}
_drawerToggle.onclick = () => {
  _sidebar.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
};
_drawerBackdrop.onclick = closeDrawer;

// Swipe-down auf Drawer schließt ihn
let _drawerTouchY = null;
_sidebar.addEventListener('touchstart', e => {
  _drawerTouchY = e.touches[0].clientY;
}, { passive: true });
_sidebar.addEventListener('touchmove', e => {
  if (_drawerTouchY == null) return;
  const dy = e.touches[0].clientY - _drawerTouchY;
  if (dy > 50 && _sidebar.scrollTop <= 0) closeDrawer();
}, { passive: true });
_sidebar.addEventListener('touchend', () => { _drawerTouchY = null; }, { passive: true });

// =========================================================
// MOBILE: TOUCH EVENTS FÜR CANVAS
// =========================================================

// ── Mobile Onboarding dismiss ──
document.getElementById('mobile-ob-dismiss').onclick = () => {
  localStorage.setItem('gp_mobile_ob_seen', '1');
  document.getElementById('mobile-onboarding').classList.remove('visible');
};

// Mobile: Canvas-Größe an die nun größere Fläche anpassen (Header/Toolbar ausgeblendet)
if (_isTouchDevice) {
  requestAnimationFrame(() => {
    canvas.setWidth(wrapper.clientWidth);
    canvas.setHeight(wrapper.clientHeight);
    canvas.renderAll();
  });
}

// =========================================================
// MOBILE: BOTTOM TOUCH TOOLBAR
// =========================================================
if (_isTouchDevice) {
  const _ttToolMap = {
    'tt-select': 'select', 'tt-ref': 'ref', 'tt-distance': 'distance',
    'tt-area': 'area', 'tt-circle': 'circle', 'tt-pipe': 'pipe',
  };
  Object.entries(_ttToolMap).forEach(([btnId, tool]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.onclick = () => setTool(tool);
  });
  document.getElementById('tt-undo').onclick = () => undo();

  // ── Mobile Helpers Bar (Hilfselemente) ──
  let _activeHelper = 'pipe-ref-line'; // default
  const _helpersBar = document.getElementById('mobile-helpers-bar');
  const HELPER_ITEMS = [
    { id: 'pipe-ref-line', label: 'Hilfslinie', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23" stroke-dasharray="4 2"/><line x1="4" y1="12" x2="20" y2="12"/></svg>' },
    { id: 'pipe-ref-point', label: 'Hilfspunkt', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/></svg>' },
  ];
  if (_helpersBar) {
    HELPER_ITEMS.forEach(h => {
      const chip = document.createElement('button');
      chip.className = 'mp-chip';
      chip.dataset.helper = h.id;
      chip.innerHTML = h.icon + ' ' + h.label;
      if (h.id === _activeHelper) chip.classList.add('active');
      chip.onclick = () => {
        _activeHelper = h.id;
        _helpersBar.querySelectorAll('.mp-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('btn-' + h.id).click();
      };
      _helpersBar.appendChild(chip);
    });
  }
  document.getElementById('tt-helpers').onclick = () => {
    const bar = document.getElementById('mobile-helpers-bar');
    if (bar.classList.contains('visible')) {
      // Already open — activate the current helper
      document.getElementById('btn-' + _activeHelper).click();
    } else {
      bar.classList.add('visible');
      document.getElementById('btn-' + _activeHelper).click();
    }
  };

  // ── Mobile Drei-Punkte-Menü ──
  const _mmMenu = document.getElementById('mobile-menu');
  const _mmBackdrop = document.getElementById('mobile-menu-backdrop');

  function _openMobileMenu() {
    _mmBackdrop.classList.add('visible');
    // Force reflow so transition plays
    _mmMenu.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => _mmMenu.classList.add('visible')));
  }
  function _closeMobileMenu() {
    _mmMenu.classList.remove('visible');
    _mmBackdrop.classList.remove('visible');
    setTimeout(() => { if (!_mmMenu.classList.contains('visible')) _mmMenu.style.display = 'none'; }, 260);
  }

  document.getElementById('tt-more').onclick = _openMobileMenu;
  _mmBackdrop.onclick = _closeMobileMenu;

  // Datei-Aktionen: leiten an die existierenden Header-Buttons weiter
  document.getElementById('mm-upload').onclick = () => { _closeMobileMenu(); document.getElementById('file-input').click(); };
  document.getElementById('mm-save').onclick = () => { _closeMobileMenu(); document.getElementById('btn-central-save').click(); };
  document.getElementById('mm-load').onclick = () => { _closeMobileMenu(); document.getElementById('btn-central-load').click(); };
  document.getElementById('mm-undo').onclick = () => { undo(); };
  document.getElementById('mm-redo').onclick = () => { document.getElementById('btn-redo').click(); };
  document.getElementById('mm-clear').onclick = () => { _closeMobileMenu(); document.getElementById('btn-clear-all').click(); };
  document.getElementById('mm-help').onclick = () => { _closeMobileMenu(); document.getElementById('btn-help').click(); };
  document.getElementById('mm-drawer').onclick = () => { _closeMobileMenu(); setTimeout(openDrawer, 280); };

  // Farb-Punkte ins Menü spiegeln
  const _mmColors = document.getElementById('mm-colors');
  document.querySelectorAll('#color-picker .color-dot').forEach(dot => {
    const c = dot.dataset.color;
    const el = document.createElement('div');
    el.className = 'mm-color-dot' + (dot.classList.contains('active') ? ' active' : '');
    el.style.background = c;
    if (c === '#ffffff') el.style.border = '2px solid #666';
    el.onclick = () => {
      dot.click(); // trigger original color picker
      _mmColors.querySelectorAll('.mm-color-dot').forEach(d => d.classList.remove('active'));
      el.classList.add('active');
    };
    _mmColors.appendChild(el);
  });

  // Linienstärke ins Menü spiegeln
  const _mmLW = document.getElementById('mm-linewidths');
  document.querySelectorAll('#line-width-picker .lw-dot').forEach(dot => {
    const lw = dot.dataset.lw;
    const el = document.createElement('div');
    el.className = 'mm-lw-dot' + (dot.classList.contains('active') ? ' active' : '');
    el.innerHTML = `<svg width="22" height="22"><line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" stroke-width="${lw}"/></svg>`;
    el.onclick = () => {
      dot.click(); // trigger original lw picker
      _mmLW.querySelectorAll('.mm-lw-dot').forEach(d => d.classList.remove('active'));
      el.classList.add('active');
    };
    _mmLW.appendChild(el);
  });
}

// Prüfe ob Touch auf dem Drop-Overlay oder dessen Buttons stattfindet
function _touchOnOverlay(e) {
  const overlay = document.getElementById('drop-overlay');
  return overlay && !overlay.classList.contains('hidden') && overlay.contains(e.target);
}

// Verhindere iOS-Bounce/Zoom auf dem Canvas-Bereich
wrapper.addEventListener('touchmove', e => {
  if (_touchOnOverlay(e)) return; // Overlay-Buttons nicht blockieren
  if (e.touches.length >= 2 || state.tool !== 'select') {
    e.preventDefault();
  }
}, { passive: false });

// =========================================================
// TOUCH: STATE-MACHINE MIT PUNKT-JUSTIERUNG
// Auf Mobilgeräten: Punkt wird beim Aufsetzen des Fingers
// vorläufig platziert, kann verschoben werden, und wird
// erst beim Anheben bestätigt.
// =========================================================
let _touchState = { type: null, lastDist: 0, lastMid: null, startTime: 0 };
const _PINCH_COOLDOWN_MS = 350;
let _pinchCooldownUntil = 0;
let _lastTapTime = 0;
const _DOUBLE_TAP_MS = 400;
let _touchSuppressClick = false;

// Mobile Adjust State: Track touch-adjust mode for drawing tools
let _mobileAdjust = {
  active: false,       // currently adjusting a point
  lastCanvasPos: null, // last known canvas-coordinate position
};
const _crosshairEl = document.getElementById('mobile-crosshair');
const _finishBtn = document.getElementById('mobile-finish-btn');

// Lupe auf Touch-Geräten deaktivieren (Desktop-Lupe nicht nötig)
if (_isTouchDevice) {
  _loupe.disable();
}

// =========================================================
// MOBILE MAGNIFIER: Zwei Lupen-Kreise (Anfang links, Ende rechts)
// =========================================================
const _mobileMag = (() => {
  if (!_isTouchDevice) return { show() {}, hide() {}, updateStart() {}, updateEnd() {}, hideStart() {}, hideEnd() {}, active: false };

  const SIZE = 130, ZOOM = 4;
  const dpr = () => window.devicePixelRatio || 1;

  function createMagCanvas(container) {
    const c = document.createElement('canvas');
    container.insertBefore(c, container.firstChild);
    const d = dpr();
    c.width = SIZE * d;
    c.height = SIZE * d;
    c.style.width = SIZE + 'px';
    c.style.height = SIZE + 'px';
    return { canvas: c, ctx: c.getContext('2d') };
  }

  const startEl = document.getElementById('mobile-mag-start');
  const endEl = document.getElementById('mobile-mag-end');
  const startMag = createMagCanvas(startEl);
  const endMag = createMagCanvas(endEl);

  function renderMag(mag, canvasX, canvasY, color) {
    const d = dpr();
    const ctx = mag.ctx;
    const c = mag.canvas;

    if (c.width !== SIZE * d) {
      c.width = SIZE * d; c.height = SIZE * d;
      c.style.width = SIZE + 'px'; c.style.height = SIZE + 'px';
    }

    const vpt = canvas.viewportTransform;
    const screenX = canvasX * vpt[0] + vpt[4];
    const screenY = canvasY * vpt[3] + vpt[5];
    const cpx = screenX * d, cpy = screenY * d;

    const srcW = (SIZE / ZOOM) * d, srcH = (SIZE / ZOOM) * d;
    const srcX = cpx - srcW / 2, srcY = cpy - srcH / 2;

    ctx.clearRect(0, 0, SIZE * d, SIZE * d);
    try { ctx.drawImage(canvas.lowerCanvasEl, srcX, srcY, srcW, srcH, 0, 0, SIZE * d, SIZE * d); } catch(_) {}

    ctx.save();
    ctx.scale(d, d);
    const h = SIZE / 2, GAP = 6;

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath(); ctx.arc(h, h, GAP + 1, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = color || 'rgba(210,30,30,0.92)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(h - GAP, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h + GAP, h); ctx.lineTo(SIZE, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h, 0); ctx.lineTo(h, h - GAP); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h, h + GAP); ctx.lineTo(h, SIZE); ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = color || 'rgba(210,30,30,1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h, h, 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  let _active = false;
  return {
    get active() { return _active; },
    updateStart(canvasX, canvasY, color) { startEl.classList.add('visible'); _active = true; renderMag(startMag, canvasX, canvasY, color); },
    updateEnd(canvasX, canvasY, color) { endEl.classList.add('visible'); _active = true; renderMag(endMag, canvasX, canvasY, color); },
    hideStart() { startEl.classList.remove('visible'); },
    hideEnd() { endEl.classList.remove('visible'); },
    show() { _active = true; },
    hide() { _active = false; startEl.classList.remove('visible'); endEl.classList.remove('visible'); },
  };
})();

// =========================================================
// MOBILE CROSSHAIR: Positionierung + Sichtbarkeit
// =========================================================
function _showMobileCrosshair(clientX, clientY) {
  _crosshairEl.style.left = clientX + 'px';
  _crosshairEl.style.top = clientY + 'px';
  _crosshairEl.classList.add('visible');
}
function _hideMobileCrosshair() {
  _crosshairEl.classList.remove('visible');
}

// =========================================================
// MOBILE FINISH BUTTON: für Fläche/Leitung (Multi-Punkt)
// =========================================================
function _updateFinishBtn() {
  if (!_isTouchDevice) return;
  const showFinish =
    (state.tool === 'area' && state.areaPoints.length >= 3) ||
    (state.tool === 'pipe' && state.pipePoints.length >= 2);
  if (showFinish) {
    _finishBtn.classList.add('visible');
  } else {
    _finishBtn.classList.remove('visible');
  }
}
if (_isTouchDevice) {
  _finishBtn.addEventListener('click', () => {
    if (state.tool === 'area' && state.areaPoints.length >= 3) {
      finishArea();
    } else if (state.tool === 'pipe' && state.pipePoints.length >= 2) {
      finishPipe();
    }
    _finishBtn.classList.remove('visible');
    _mobileMag.hide();
    _hideMobileCrosshair();
  });
}

// =========================================================
// MOBILE: Punkt-Justierung via Capture-Phase
// Fängt touchstart VOR Fabric.js ab, damit mouse:down
// unterdrückt wird. Der Punkt wird erst bei touchend gesetzt.
// =========================================================
function _getCanvasPtrFromTouch(touch) {
  // Fabric.js getPointer verwenden für korrekte DPR/Retina-Berechnung
  return canvas.getPointer({
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.pageX,
    pageY: touch.pageY,
  });
}

function _updateMobileMagnifiers(p) {
  const col = state.color || 'rgba(210,30,30,0.92)';
  let hasStart = false;
  if (state.tool === 'ref' && state.refPoints.length === 1) {
    _mobileMag.updateStart(state.refPoints[0].x, state.refPoints[0].y, '#cc0000');
    hasStart = true;
  } else if (state.tool === 'distance' && state.distPoints.length === 1) {
    _mobileMag.updateStart(state.distPoints[0].x, state.distPoints[0].y, col);
    hasStart = true;
  } else if (state.tool === 'circle' && state.circleCenter) {
    _mobileMag.updateStart(state.circleCenter.x, state.circleCenter.y, col);
    hasStart = true;
  } else if (state.tool === 'arc' && state.arcStep >= 1 && state.arcCenter) {
    _mobileMag.updateStart(state.arcCenter.x, state.arcCenter.y, col);
    hasStart = true;
  } else if (state.tool === 'area' && state.areaPoints.length >= 1) {
    const lastPt = state.areaPoints[state.areaPoints.length - 1];
    _mobileMag.updateStart(lastPt.x, lastPt.y, col);
    hasStart = true;
  } else if (state.tool === 'pipe' && state.pipePoints.length >= 1) {
    const lastPt = state.pipePoints[state.pipePoints.length - 1];
    _mobileMag.updateStart(lastPt.x, lastPt.y, col);
    hasStart = true;
  }
  if (hasStart) {
    // Zweiter Punkt: A zeigt Startpunkt (oben gesetzt), B zeigt Fingerposition
    _mobileMag.updateEnd(p.x, p.y, col);
  } else {
    // Erster Punkt: A zeigt Fingerposition, B ausblenden
    _mobileMag.updateStart(p.x, p.y, col);
    _mobileMag.hideEnd();
  }
}

if (_isTouchDevice) {
  const DRAWING_TOOLS = ['ref', 'distance', 'area', 'circle', 'arc', 'pipe'];

  // Capture-Phase: fängt Touch VOR Fabric.js ab
  canvas.upperCanvasEl.addEventListener('touchstart', e => {
    if (!DRAWING_TOOLS.includes(state.tool)) return;
    if (!state.backgroundImage) return;
    if (e.touches.length !== 1) return;
    if (Date.now() < _pinchCooldownUntil) return;

    // iOS-Standardverhalten verhindern (verhindert auch Fabric.js mouse:down via Maus-Emulation)
    e.preventDefault();
    e.stopImmediatePropagation();

    // Fabric.js mouse:down unterdrücken (falls es trotzdem feuert)
    _touchSuppressClick = true;
    _mobileAdjust.active = true;

    const touch = e.touches[0];
    const p = _getCanvasPtrFromTouch(touch);
    _mobileAdjust.lastCanvasPos = p;

    // Crosshair + Magnifier sofort zeigen
    _showMobileCrosshair(touch.clientX, touch.clientY);
    _updateMobileMagnifiers(p);
  }, { capture: true, passive: false });

  // Touchmove: Crosshair + Magnifier updaten, Preview-Linie updaten
  canvas.upperCanvasEl.addEventListener('touchmove', e => {
    if (!_mobileAdjust.active || e.touches.length !== 1) return;

    // Fabric.js darf diesen Move nicht verarbeiten (sonst Doppel-Rendering)
    e.preventDefault();
    e.stopImmediatePropagation();

    const touch = e.touches[0];
    const p = _getCanvasPtrFromTouch(touch);
    _mobileAdjust.lastCanvasPos = p;

    // Crosshair-Overlay verschieben
    _showMobileCrosshair(touch.clientX, touch.clientY);

    // Preview-Linie manuell updaten
    const snapped = snapToPixel(p);
    if (state.tool === 'ref' && state.refPoints.length === 1 && state.drawingLine) {
      state.drawingLine.set({ x2: snapped.x, y2: snapped.y });
      throttledRender();
    }
    if (state.tool === 'distance' && state.distPoints.length === 1 && state.drawingLine) {
      state.drawingLine.set({ x2: snapped.x, y2: snapped.y });
      const p1 = state.distPoints[0];
      const pxDist = ptDist(p1.x, p1.y, snapped.x, snapped.y) / state.imgDisplayScale;
      const meters = state.scale ? pxDist / state.scale : null;
      const liveText = meters ? formatDistance(meters) : `${Math.round(pxDist)} px`;
      updateLiveLabel(p1, snapped, liveText);
      throttledRender();
    }
    if (state.tool === 'area' && state.areaPoints.length > 0) {
      updatePreviewPolygon([...state.areaPoints, snapped]);
    }
    if (state.tool === 'circle' && state.circleCenter) {
      const r = Math.hypot(snapped.x - state.circleCenter.x, snapped.y - state.circleCenter.y);
      updatePreviewCircle(state.circleCenter, r, snapped);
      const rOrig = r / state.imgDisplayScale;
      const rMeters = state.scale ? rOrig / state.scale : null;
      const liveText = rMeters ? `r = ${formatDistance(rMeters)}` : `r = ${Math.round(r)} px`;
      updateLiveLabel(state.circleCenter, snapped, liveText);
    }
    if (state.tool === 'arc' && state.arcStep >= 1) {
      updatePreviewArc(snapped);
    }
    if (state.tool === 'pipe' && state.pipePoints.length > 0) {
      updatePreviewPipe([...state.pipePoints, snapped]);
    }
    if (DRAWING_TOOLS.includes(state.tool) && !state.pipeRefMode) {
      showPipeDistanceGuides(snapped);
    }

    // Magnifier updaten
    _updateMobileMagnifiers(snapped);
  }, { capture: true, passive: false });

  // Touchend: Punkt bestätigen
  canvas.upperCanvasEl.addEventListener('touchend', e => {
    if (!_mobileAdjust.active) return;

    // Fabric.js touchend unterdrücken
    e.stopImmediatePropagation();

    _mobileAdjust.active = false;
    _touchSuppressClick = false; // Reset für nächsten Touch
    _hideMobileCrosshair();
    haptic('light'); // Haptisches Feedback bei Punkt-Bestätigung

    const touch = e.changedTouches[0];
    const p = _getCanvasPtrFromTouch(touch);
    const snapped = snapToPixel(p);

    // Punkt an Tool-Handler übergeben
    // Prüfe zuerst Referenz-Erstellung
    if (DRAWING_TOOLS.includes(state.tool) && handlePipeRefClick(snapped)) {
      _mobileMag.hide();
      return;
    }

    switch (state.tool) {
      case 'ref':      handleRefClick(snapped); break;
      case 'distance': handleDistanceClick(snapped); break;
      case 'area':     handleAreaClick(snapped); break;
      case 'circle':   handleCircleClick(snapped); break;
      case 'arc':      handleArcClick(snapped); break;
      case 'pipe':     handlePipeClick(snapped); break;
    }

    // Finish-Button für Multi-Punkt-Tools aktualisieren
    _updateFinishBtn();

    // Magnifier aktualisieren: Start-Lupe zeigt den gerade gesetzten Punkt
    _updateMobileMagnifiers(snapped);

    // Wenn Messung abgeschlossen (Tool-State zurückgesetzt), Lupen ausblenden
    const toolDone =
      (state.tool === 'ref' && state.refPoints.length === 0) ||
      (state.tool === 'distance' && state.distPoints.length === 0) ||
      (state.tool === 'circle' && !state.circleCenter) ||
      (state.tool === 'arc' && state.arcStep === 0);
    if (toolDone) {
      _mobileMag.hide();
    }
  }, { capture: true });
}

// --- touchstart (Bubbling: Pinch + Pan) ---
wrapper.addEventListener('touchstart', e => {
  if (_touchOnOverlay(e)) return;

  if (e.touches.length === 2) {
    e.preventDefault();
    _touchSuppressClick = true;
    if (_mobileAdjust.active) { _mobileAdjust.active = false; _hideMobileCrosshair(); }
    _touchState.type = 'pinch';
    _touchState.lastDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    _touchState.lastMid = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
    return;
  }

  if (e.touches.length === 1) {
    if (Date.now() < _pinchCooldownUntil) {
      _touchSuppressClick = true;
      _touchState.type = 'cooldown';
      return;
    }
    _touchState.type = 'single';
    _touchState.startTime = Date.now();
    _touchState.lastMid = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: false });

// --- touchmove (Pinch + Pan) ---
wrapper.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && _touchState.type === 'pinch') {
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const mid = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
    const factor = dist / _touchState.lastDist;
    const rect = wrapper.getBoundingClientRect();
    setZoom(canvas.getZoom() * factor, {
      x: mid.x - rect.left,
      y: mid.y - rect.top,
    });
    const dx = mid.x - _touchState.lastMid.x;
    const dy = mid.y - _touchState.lastMid.y;
    const vpt = canvas.viewportTransform.slice();
    vpt[4] += dx;
    vpt[5] += dy;
    canvas.setViewportTransform(vpt);
    _touchState.lastDist = dist;
    _touchState.lastMid = mid;
    return;
  }

  if (e.touches.length === 1 && _touchState.type === 'single' && state.tool === 'select') {
    e.preventDefault();
    const t = e.touches[0];
    if (_touchState.lastMid) {
      const dx = t.clientX - _touchState.lastMid.x;
      const dy = t.clientY - _touchState.lastMid.y;
      const vpt = canvas.viewportTransform.slice();
      vpt[4] += dx;
      vpt[5] += dy;
      canvas.setViewportTransform(vpt);
    }
    _touchState.lastMid = { x: t.clientX, y: t.clientY };
  }
}, { passive: false });

// --- touchend (Pinch-Cooldown) ---
wrapper.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    if (_touchState.type === 'pinch') {
      _pinchCooldownUntil = Date.now() + _PINCH_COOLDOWN_MS;
      _touchSuppressClick = true;
    }
    _touchState.type = null;
    _touchState.lastMid = null;
  }
}, { passive: true });

// =========================================================
// MOBILE: CANVAS-GRÖßE BEI ORIENTATION-CHANGE
// =========================================================
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    canvas.setWidth(wrapper.clientWidth);
    canvas.setHeight(wrapper.clientHeight);
    canvas.renderAll();
  }, 200);
});

// Verhindere Browser-Doppeltipp-Zoom auf Touch-Geräten
document.addEventListener('dblclick', e => {
  if (_isTouchDevice) e.preventDefault();
}, { passive: false });
