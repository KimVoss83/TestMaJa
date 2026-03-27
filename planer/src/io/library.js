import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { showToast } from '../ui/modals.js';
import { setTool } from '../tools/tool-manager.js';

// =========================================================
// LIBRARY — 2D-Skizzen Vogelperspektive
// =========================================================
export const LIBRARY = [
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

export const LIB_CATS = [...new Set(LIBRARY.map(i => i.cat))];
export const EIGENE_CAT = 'Eigene';

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
export function sanitizeSVG(svgString) {
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

export async function initCustomLib() {
  await _openCustomDB();
  customLibItems = await _dbGetAll('items');
  // Try to restore directory handle
  try {
    const h = await _dbGet('settings', 'dirHandle');
    if (h) { _dirHandle = h; document.getElementById('btn-lib-folder')?.classList.add('linked'); }
  } catch(_) {}
}

export async function linkCustomLibFolder() {
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

export async function refreshFromDir() {
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

export async function uploadCustomLibFiles() {
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

export async function deleteCustomLibItem(id) {
  customLibItems = customLibItems.filter(i => i.id !== id);
  await _dbDel('items', id);
  renderLibrary(EIGENE_CAT);
}

export function placeCustomLibItem(item) {
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
export function toggleLibLayer() {
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

export function renderLibrary(activeCat) {
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

export function placeLibraryItem(item) {
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
