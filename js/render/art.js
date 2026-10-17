// Procedural art: character portraits, coats of arms, event scenes.
import { G } from '../state.js';
import { ch, T, age, rankOf, primary, faith, culture, skinColor, isRuler } from '../engine/core.js';
import { mulberry32, hash, mixHex, shadeHex, clamp } from '../util.js';

// ---------- Portraits ----------
const pcache = new Map();
export function portrait(c, size = 96, opts = {}) {
  if (!c) return `<svg viewBox="0 0 100 120" width="${size}" height="${size * 1.2}"><rect width="100" height="120" fill="#2a2420"/><text x="50" y="70" font-size="40" text-anchor="middle" fill="#6a5a4a">?</text></svg>`;
  const a = age(c); const r = rankOf(c);
  const key = `${c.id}|${Math.floor(a / 4)}|${r}|${c.dead ? 1 : 0}|${c.imprisoned ? 1 : 0}|${c.traits.join(',')}|${c.primary}|${c.fai}|${size}|${c.stress > 60 ? 1 : 0}`;
  if (pcache.has(key)) return pcache.get(key);
  const svg = buildPortrait(c, a, r, size);
  if (pcache.size > 600) pcache.clear();
  pcache.set(key, svg);
  return svg;
}
function buildPortrait(c, a, r, size) {
  const d = c.dna || { skin: 0.3, hair: '#3b2a1a', hairStyle: 0, beard: 0, eyes: '#3a2a1a', face: 0, nose: 0, brow: 0, jaw: 0 };
  const rnd = mulberry32(c.id * 7919);
  const skin = skinColor(d);
  const fam = faith(c.fai).family; const grp = culture(c.cul).group;
  const child = a < 14; const old = a >= 50; const elder = a >= 68;
  let hair = d.hair; if (elder) hair = '#e8e4dc'; else if (old) hair = mixHex(hair, '#b0aaa0', clamp((a - 50) / 20, 0.2, 0.8));
  const pt = primary(c); const realmCol = pt?.color || (c.court && ch(c.court) ? T(ch(c.court).primary)?.color : null) || '#5a4a3a';
  const cloth = shadeHex(realmCol, -0.15), cloth2 = shadeHex(realmCol, 0.25);
  const id = 'p' + c.id + '_' + size;
  const faceW = [26, 24, 22, 27][d.face] * (child ? 1.05 : 1), faceH = [31, 33, 35, 31][d.face] * (child ? 0.9 : 1);
  const cy = child ? 60 : 56; const cx = 50;
  const eyeY = cy - 2, eyeDX = faceW * 0.38;
  const veiled = c.f && a >= 14 && (fam === 'islamic' || (fam === 'christian' && c.spouse && rnd() < 0.6));
  const tr = t => c.traits.includes(t);
  const parts = [];
  // background
  parts.push(`<defs><radialGradient id="bg${id}" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${shadeHex(realmCol, 0.15)}"/><stop offset="1" stop-color="${shadeHex(realmCol, -0.65)}"/></radialGradient><linearGradient id="cl${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cloth2}"/><stop offset="1" stop-color="${cloth}"/></linearGradient><radialGradient id="sk${id}" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="${skin}"/><stop offset="1" stop-color="${shadeHex(rgbHex(skin), -0.22)}"/></radialGradient></defs>`);
  parts.push(`<rect width="100" height="120" fill="url(#bg${id})"/>`);
  parts.push(`<path d="M0 120 L0 ${r >= 3 ? 0 : 6} ${r >= 3 ? `L100 0` : ''}" fill="none"/>`);
  // hair back (long)
  const longHair = (c.f && !veiled) || (!c.f && (d.hairStyle >= 4 || grp === 'norse' && d.hairStyle >= 2));
  if (longHair && !child) parts.push(`<path d="M${cx - faceW - 3} ${cy - 10} Q${cx - faceW - 8} ${cy + 30} ${cx - faceW + 2} ${cy + 46} L${cx + faceW - 2} ${cy + 46} Q${cx + faceW + 8} ${cy + 30} ${cx + faceW + 3} ${cy - 10} Z" fill="${hair}"/>`);
  if (veiled) parts.push(`<path d="M${cx - faceW - 7} ${cy - 18} Q${cx} ${cy - 50} ${cx + faceW + 7} ${cy - 18} L${cx + faceW + 12} ${cy + 50} L${cx - faceW - 12} ${cy + 50} Z" fill="${fam === 'islamic' ? shadeHex(realmCol, 0.45) : '#ece6d8'}"/>`);
  // body / clothing
  const shoulderY = cy + faceH * 0.95;
  parts.push(`<path d="M8 120 Q10 ${shoulderY + 4} 34 ${shoulderY} L66 ${shoulderY} Q90 ${shoulderY + 4} 92 120 Z" fill="url(#cl${id})"/>`);
  if (tr('edu_mar_3') || tr('edu_mar_4') || tr('strategist') || (c.gov === 'tribal' && !c.f && a > 18)) parts.push(`<path d="M20 120 Q22 ${shoulderY + 8} 36 ${shoulderY + 2} L64 ${shoulderY + 2} Q78 ${shoulderY + 8} 80 120 Z" fill="#8a8e94" opacity="0.85"/><path d="M30 ${shoulderY + 10} L70 ${shoulderY + 10}" stroke="#b0b4ba" stroke-width="1.5"/>`);
  if (r >= 3) parts.push(`<path d="M14 120 Q16 ${shoulderY + 3} 34 ${shoulderY - 1} L40 ${shoulderY + 6} L30 120 Z" fill="#f4f0e8"/><path d="M86 120 Q84 ${shoulderY + 3} 66 ${shoulderY - 1} L60 ${shoulderY + 6} L70 120 Z" fill="#f4f0e8"/>` + Array.from({ length: 6 }, (_, k) => `<circle cx="${20 + k * 2 + (k % 2) * 3}" cy="${shoulderY + 14 + k * 7}" r="1" fill="#222"/><circle cx="${80 - k * 2 - (k % 2) * 3}" cy="${shoulderY + 14 + k * 7}" r="1" fill="#222"/>`).join(''));
  if (c.gov === 'theocracy') parts.push(`<path d="M44 ${shoulderY} L50 120 L56 ${shoulderY} Z" fill="#e8d070"/><path d="M46 ${shoulderY + 20} h8 M50 ${shoulderY + 14} v14" stroke="#7a2020" stroke-width="2"/>`);
  if (r >= 2 && c.gov !== 'theocracy') parts.push(`<path d="M38 ${shoulderY + 2} Q50 ${shoulderY + 16} 62 ${shoulderY + 2}" fill="none" stroke="#d8b040" stroke-width="2"/><circle cx="50" cy="${shoulderY + 14}" r="2.6" fill="${r >= 3 ? '#c03040' : '#3060c0'}" stroke="#d8b040"/>`);
  // neck
  parts.push(`<path d="M${cx - 8} ${cy + faceH * 0.6} L${cx - 9} ${shoulderY + 2} L${cx + 9} ${shoulderY + 2} L${cx + 8} ${cy + faceH * 0.6} Z" fill="${shadeHex(rgbHex(skin), -0.12)}"/>`);
  // ears
  parts.push(`<ellipse cx="${cx - faceW + 1}" cy="${cy}" rx="3.5" ry="6" fill="${skin}"/><ellipse cx="${cx + faceW - 1}" cy="${cy}" rx="3.5" ry="6" fill="${skin}"/>`);
  // face
  const chinY = cy + faceH + (d.jaw ? 2 : 0);
  parts.push(`<path d="M${cx - faceW} ${cy - faceH * 0.3} Q${cx - faceW} ${cy - faceH} ${cx} ${cy - faceH} Q${cx + faceW} ${cy - faceH} ${cx + faceW} ${cy - faceH * 0.3} Q${cx + faceW * 0.98} ${cy + faceH * 0.45} ${cx + faceW * 0.55} ${cy + faceH * 0.82} Q${cx} ${chinY + 2} ${cx - faceW * 0.55} ${cy + faceH * 0.82} Q${cx - faceW * 0.98} ${cy + faceH * 0.45} ${cx - faceW} ${cy - faceH * 0.3} Z" fill="url(#sk${id})"/>`);
  // cheeks blush for children/women
  if (child || c.f) parts.push(`<ellipse cx="${cx - faceW * 0.55}" cy="${cy + 7}" rx="5" ry="3" fill="#e08080" opacity="0.18"/><ellipse cx="${cx + faceW * 0.55}" cy="${cy + 7}" rx="5" ry="3" fill="#e08080" opacity="0.18"/>`);
  // eyes
  const eyeR = child ? 3.6 : 3;
  const blinkDur = (3.5 + rnd() * 3).toFixed(2), blinkDelay = (rnd() * 3).toFixed(2);
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeDX;
    if (tr('blind')) { parts.push(`<path d="M${ex - 5} ${eyeY} L${ex + 5} ${eyeY}" stroke="#3a2a1a" stroke-width="1.5"/>`); continue; }
    parts.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeR + 1.6}" ry="${eyeR * 0.75}" fill="#f8f4ee"/><circle cx="${ex + s * 0.3}" cy="${eyeY}" r="${eyeR * 0.68}" fill="${d.eyes}"/><circle cx="${ex + s * 0.3}" cy="${eyeY}" r="${eyeR * 0.3}" fill="#100808"/><circle cx="${ex + s * 0.3 - 0.8}" cy="${eyeY - 0.8}" r="0.6" fill="#fff"/>`);
    parts.push(`<path d="M${ex - eyeR - 2} ${eyeY - eyeR * 0.6} Q${ex} ${eyeY - eyeR * 1.3} ${ex + eyeR + 2} ${eyeY - eyeR * 0.6}" stroke="${shadeHex(rgbHex(skin), -0.4)}" stroke-width="0.8" fill="none"/>`);
    if (!c.dead && size >= 70) parts.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeR + 2}" ry="0" fill="${skin}"><animate attributeName="ry" values="0;0;${(eyeR * 0.95).toFixed(2)};0" keyTimes="0;0.93;0.965;1" dur="${blinkDur}s" begin="${blinkDelay}s" repeatCount="indefinite"/></ellipse>`);
  }
  if (tr('blind')) parts.push(`<path d="M${cx - faceW} ${eyeY - 3} L${cx + faceW} ${eyeY - 1}" stroke="#2a2a2a" stroke-width="5"/>`);
  // brows
  const browCol = elder ? '#d0ccc4' : shadeHex(d.hair, -0.1);
  const angry = tr('wrathful') || tr('sadistic') || c.stress > 60;
  for (const s of [-1, 1]) { const ex = cx + s * eyeDX; parts.push(`<path d="M${ex - 5 * s} ${eyeY - 6 + (angry ? -1 : 0)} Q${ex} ${eyeY - 8.5 - d.brow} ${ex + 5 * s} ${eyeY - 6.5 + (angry ? 2 : 0)}" stroke="${browCol}" stroke-width="${c.f ? 1.1 : 2}" fill="none" stroke-linecap="round"/>`); }
  // nose
  const nl = [7, 9, 10, 8][d.nose];
  parts.push(`<path d="M${cx - 1} ${eyeY + 2} Q${cx - 2.5} ${eyeY + nl} ${cx - 3.5} ${eyeY + nl + 1.5} Q${cx} ${eyeY + nl + 3.5} ${cx + 3.5} ${eyeY + nl + 1.5}" stroke="${shadeHex(rgbHex(skin), -0.35)}" stroke-width="1" fill="none"/>`);
  // mouth
  const my = eyeY + nl + 9; const happy = tr('content') || tr('gregarious') || tr('generous') || tr('reveler');
  const curve = happy ? 3 : angry ? -2 : 0.8;
  parts.push(`<path d="M${cx - 6} ${my} Q${cx} ${my + curve} ${cx + 6} ${my}" stroke="${c.f ? '#a04848' : shadeHex(rgbHex(skin), -0.45)}" stroke-width="${c.f ? 2 : 1.4}" fill="none" stroke-linecap="round"/>`);
  // wrinkles
  if (old) parts.push(`<path d="M${cx - eyeDX - 6} ${eyeY + 3} l-2 2 M${cx + eyeDX + 6} ${eyeY + 3} l2 2 M${cx - 8} ${my - 4} q-2 3 -1 6 M${cx + 8} ${my - 4} q2 3 1 6" stroke="${shadeHex(rgbHex(skin), -0.35)}" stroke-width="0.7" fill="none"/>`);
  if (tr('scarred') || tr('maimed')) parts.push(`<path d="M${cx + 6} ${eyeY - 10} L${cx + 14} ${eyeY + 12}" stroke="#a04040" stroke-width="1.4"/>`);
  if (tr('wounded')) parts.push(`<path d="M${cx - faceW} ${cy - faceH * 0.55} Q${cx} ${cy - faceH * 0.7} ${cx + faceW} ${cy - faceH * 0.5}" stroke="#f4f0e8" stroke-width="5"/><circle cx="${cx + faceW * 0.5}" cy="${cy - faceH * 0.58}" r="2" fill="#c03030"/>`);
  // beard
  if (!c.f && a >= 17) {
    const b = grp === 'arabic' || grp === 'iranian' || grp === 'greek' || grp === 'norse' || fam === 'islamic' ? Math.max(2, d.beard) : d.beard;
    const bc = elder ? '#e8e4dc' : old ? mixHex(d.hair, '#b0aaa0', 0.5) : d.hair;
    if (b === 1) parts.push(`<path d="M${cx - faceW * 0.85} ${cy + 6} Q${cx} ${cy + faceH + 4} ${cx + faceW * 0.85} ${cy + 6}" fill="${bc}" opacity="0.25"/>`);
    if (b >= 2 && b <= 4) { const l = [0, 0, 5, 12, 22][b]; parts.push(`<path d="M${cx - faceW * 0.9} ${cy + 2} Q${cx - faceW * 0.8} ${cy + faceH + l} ${cx} ${cy + faceH + l + 2} Q${cx + faceW * 0.8} ${cy + faceH + l} ${cx + faceW * 0.9} ${cy + 2} Q${cx + 6} ${my + 4} ${cx} ${my + 3} Q${cx - 6} ${my + 4} ${cx - faceW * 0.9} ${cy + 2} Z" fill="${bc}"/>`); }
    if (b >= 2 || b === 5) parts.push(`<path d="M${cx - 9} ${my - 1} Q${cx} ${my - 5} ${cx + 9} ${my - 1} Q${cx} ${my - 2} ${cx - 9} ${my - 1}" fill="${bc}"/>`);
  }
  // hair front
  if (!veiled) {
    const top = cy - faceH; const bald = !c.f && old && d.hairStyle === 0;
    if (!bald) {
      if (c.f && !child) parts.push(`<path d="M${cx - faceW - 2} ${cy - 2} Q${cx - faceW - 3} ${top - 6} ${cx} ${top - 5} Q${cx + faceW + 3} ${top - 6} ${cx + faceW + 2} ${cy - 2} Q${cx + faceW * 0.4} ${top + 4} ${cx} ${top + 6} Q${cx - faceW * 0.4} ${top + 4} ${cx - faceW - 2} ${cy - 2} Z" fill="${hair}"/>`);
      else if (d.hairStyle % 3 === 0) parts.push(`<path d="M${cx - faceW - 1} ${cy - 4} Q${cx - faceW} ${top - 7} ${cx} ${top - 6} Q${cx + faceW} ${top - 7} ${cx + faceW + 1} ${cy - 4} Q${cx + faceW * 0.7} ${top + 3} ${cx} ${top + 2} Q${cx - faceW * 0.7} ${top + 3} ${cx - faceW - 1} ${cy - 4} Z" fill="${hair}"/>`);
      else if (d.hairStyle % 3 === 1) parts.push(`<path d="M${cx - faceW - 2} ${cy} Q${cx - faceW - 2} ${top - 8} ${cx} ${top - 7} Q${cx + faceW + 2} ${top - 8} ${cx + faceW + 2} ${cy} L${cx + faceW - 2} ${cy - 8} Q${cx} ${top + 9} ${cx - faceW + 2} ${cy - 8} Z" fill="${hair}"/>`);
      else parts.push(`<path d="M${cx - faceW - 1} ${cy - 6} Q${cx - faceW + 4} ${top - 9} ${cx + 4} ${top - 6} Q${cx + faceW + 2} ${top - 4} ${cx + faceW + 1} ${cy - 6} Q${cx + 4} ${top + 6} ${cx - 10} ${top + 5} Z" fill="${hair}"/>`);
    } else parts.push(`<path d="M${cx - faceW - 1} ${cy - 2} Q${cx - faceW} ${cy - 14} ${cx - faceW + 6} ${cy - 16} M${cx + faceW + 1} ${cy - 2} Q${cx + faceW} ${cy - 14} ${cx + faceW - 6} ${cy - 16}" stroke="${hair}" stroke-width="4" fill="none"/>`);
  }
  // headgear
  parts.push(headgear(c, r, cx, cy - faceH, faceW, fam, grp, realmCol));
  if (c.traits.includes('ill') || c.traits.includes('pneumonic') || c.traits.includes('plague')) parts.push(`<rect width="100" height="120" fill="#80a040" opacity="0.15"/>`);
  if (c.traits.includes('ai_mind')) parts.push(`<circle cx="88" cy="12" r="7" fill="#1a1030" stroke="#b080ff" stroke-width="1.2"/><circle cx="88" cy="12" r="3" fill="#c0a0ff"><animate attributeName="r" values="2.2;3.6;2.2" dur="2.4s" repeatCount="indefinite"/></circle>`);
  if (c.imprisoned) parts.push(Array.from({ length: 6 }, (_, k) => `<rect x="${8 + k * 17}" y="0" width="3" height="120" fill="#2a2a2a"/>`).join(''));
  const filt = c.dead ? `<filter id="g${id}"><feColorMatrix type="saturate" values="0"/></filter>` : '';
  return `<svg viewBox="0 0 100 120" width="${size}" height="${Math.round(size * 1.2)}" class="portrait-svg">${filt}<g ${c.dead ? `filter="url(#g${id})" opacity="0.85"` : ''}>${parts.join('')}</g></svg>`;
}
function rgbHex(rgb) { const m = rgb.match(/\d+/g).map(Number); return '#' + m.map(v => v.toString(16).padStart(2, '0')).join(''); }
function headgear(c, r, cx, top, fw, fam, grp, col) {
  const pt = primary(c); const gold = '#e0b840', goldD = '#a07820', gem = '#c02838', gem2 = '#2850c0';
  if (pt?.id === 'k_papacy') return `<path d="M${cx - 15} ${top + 6} L${cx - 12} ${top - 22} Q${cx} ${top - 34} ${cx + 12} ${top - 22} L${cx + 15} ${top + 6} Z" fill="#f4f0e8" stroke="${gold}"/><path d="M${cx - 14} ${top - 2} h28 M${cx - 13} ${top - 11} h26 M${cx - 12} ${top - 19} h24" stroke="${gold}" stroke-width="2.5"/><circle cx="${cx}" cy="${top - 30}" r="2" fill="${gold}"/>`;
  if (c.gov === 'theocracy') return fam === 'islamic' ? turban(cx, top, fw, '#f0ece0', gem) : `<path d="M${cx - 13} ${top + 6} L${cx - 9} ${top - 18} L${cx} ${top - 26} L${cx + 9} ${top - 18} L${cx + 13} ${top + 6} Z" fill="#f4f0e8" stroke="${gold}"/><path d="M${cx} ${top - 22} v26 M${cx - 6} ${top - 8} h12" stroke="${gold}" stroke-width="2"/>`;
  if (!r) return '';
  if (fam === 'islamic' && grp !== 'turkic' && grp !== 'mongolic') return turban(cx, top, fw, r >= 3 ? '#f8f4ea' : shadeHex(col, 0.5), r >= 3 ? gem : gem2, r);
  if (c.gov === 'nomadic' || grp === 'mongolic' || (grp === 'turkic' && fam !== 'islamic')) return `<path d="M${cx - fw - 4} ${top + 8} Q${cx} ${top - 10} ${cx + fw + 4} ${top + 8} Q${cx} ${top + 2} ${cx - fw - 4} ${top + 8} Z" fill="#7a5a3a"/><path d="M${cx - fw + 2} ${top + 4} Q${cx} ${top - 26} ${cx + fw - 2} ${top + 4} Z" fill="${shadeHex(col, 0.1)}"/>${r >= 3 ? `<circle cx="${cx}" cy="${top - 14}" r="3" fill="${gold}"/>` : ''}`;
  if (grp === 'turkic' && fam === 'islamic') return turban(cx, top, fw, '#f4f0e6', gem, r);
  if (c.gov === 'tribal' && r <= 2 && (grp === 'norse' || grp === 'germanic' || grp === 'slavic' || grp === 'baltic' || grp === 'finnic')) return `<path d="M${cx - fw - 1} ${top + 10} Q${cx - fw} ${top - 12} ${cx} ${top - 14} Q${cx + fw} ${top - 12} ${cx + fw + 1} ${top + 10} Z" fill="#8a8e94" stroke="#4a4e54"/><path d="M${cx} ${top - 14} v28" stroke="#5a5e64" stroke-width="3"/>`;
  if (grp === 'greek' && r >= 4) return `<path d="M${cx - fw} ${top + 6} L${cx - fw + 2} ${top - 14} Q${cx} ${top - 26} ${cx + fw - 2} ${top - 14} L${cx + fw} ${top + 6} Z" fill="${gold}" stroke="${goldD}"/><circle cx="${cx}" cy="${top - 6}" r="3" fill="${gem}"/><circle cx="${cx - 9}" cy="${top - 2}" r="2" fill="${gem2}"/><circle cx="${cx + 9}" cy="${top - 2}" r="2" fill="${gem2}"/><path d="M${cx - fw} ${top + 6} v14 M${cx + fw} ${top + 6} v14" stroke="#f4f0e8" stroke-width="1.5" stroke-dasharray="2 1.5"/>`;
  if (r >= 4) return `<path d="M${cx - fw} ${top + 6} L${cx - fw} ${top - 8} L${cx + fw} ${top - 8} L${cx + fw} ${top + 6} Z" fill="${gold}" stroke="${goldD}"/><path d="M${cx - fw} ${top - 8} Q${cx} ${top - 30} ${cx + fw} ${top - 8}" fill="${shadeHex(col, -0.2)}" stroke="${gold}" stroke-width="2"/><path d="M${cx} ${top - 26} v-6 M${cx - 3} ${top - 29} h6" stroke="${gold}" stroke-width="2"/><circle cx="${cx}" cy="${top - 1}" r="2.6" fill="${gem}"/><circle cx="${cx - 11}" cy="${top - 1}" r="2" fill="${gem2}"/><circle cx="${cx + 11}" cy="${top - 1}" r="2" fill="${gem2}"/>`;
  if (r === 3) return `<path d="M${cx - fw} ${top + 6} L${cx - fw} ${top - 10} L${cx - fw * 0.55} ${top - 2} L${cx - fw * 0.2} ${top - 14} L${cx} ${top - 4} L${cx + fw * 0.2} ${top - 14} L${cx + fw * 0.55} ${top - 2} L${cx + fw} ${top - 10} L${cx + fw} ${top + 6} Z" fill="${gold}" stroke="${goldD}"/><circle cx="${cx}" cy="${top + 1}" r="2.4" fill="${gem}"/><circle cx="${cx - 12}" cy="${top + 1}" r="1.8" fill="${gem2}"/><circle cx="${cx + 12}" cy="${top + 1}" r="1.8" fill="${gem2}"/>`;
  if (r === 2) return `<path d="M${cx - fw} ${top + 6} L${cx - fw} ${top - 3} Q${cx - fw * 0.5} ${top - 9} ${cx} ${top - 4} Q${cx + fw * 0.5} ${top - 9} ${cx + fw} ${top - 3} L${cx + fw} ${top + 6} Z" fill="${gold}" stroke="${goldD}"/><circle cx="${cx}" cy="${top + 1}" r="2" fill="${gem2}"/>`;
  return `<path d="M${cx - fw} ${top + 5} Q${cx} ${top - 2} ${cx + fw} ${top + 5} L${cx + fw} ${top + 8} Q${cx} ${top + 1} ${cx - fw} ${top + 8} Z" fill="#c0c4ca" stroke="#808488"/>`;
}
function turban(cx, top, fw, colr, gem, r = 1) {
  return `<path d="M${cx - fw - 5} ${top + 10} Q${cx - fw - 8} ${top - 16} ${cx} ${top - 20} Q${cx + fw + 8} ${top - 16} ${cx + fw + 5} ${top + 10} Q${cx} ${top + 2} ${cx - fw - 5} ${top + 10} Z" fill="${colr}" stroke="${shadeHex(colr, -0.25)}"/><path d="M${cx - fw - 4} ${top + 2} Q${cx} ${top - 10} ${cx + fw + 4} ${top + 2} M${cx - fw - 2} ${top - 6} Q${cx} ${top - 16} ${cx + fw + 2} ${top - 6}" stroke="${shadeHex(colr, -0.2)}" fill="none"/>${r >= 2 ? `<circle cx="${cx}" cy="${top - 4}" r="3" fill="${gem}" stroke="#e0b840"/><path d="M${cx} ${top - 7} q4 -12 -2 -16" stroke="#f4f4f4" stroke-width="2" fill="none"/>` : ''}`;
}

// ---------- Coats of arms ----------
const TINCT = { or: '#e0b840', argent: '#f2f0ea', gules: '#c02828', azure: '#2850b0', vert: '#2a8040', sable: '#1e1e1e', purpure: '#7a3080' };
const METALS = ['or', 'argent'], COLORS = ['gules', 'azure', 'vert', 'sable', 'purpure'];
const CHARGES = {
  lion: 'M38 82 L34 70 Q30 60 38 52 L36 42 Q38 34 46 34 L50 28 L54 34 Q60 36 60 44 L56 50 Q66 52 66 62 L72 58 L70 68 L62 70 L64 82 L56 82 L54 72 L46 74 L46 82 Z',
  eagle: 'M50 30 L54 38 L66 32 L78 36 L70 44 L80 48 L68 52 L62 50 L58 60 L64 78 L56 72 L50 82 L44 72 L36 78 L42 60 L38 50 L32 52 L20 48 L30 44 L22 36 L34 32 L46 38 Z',
  cross: 'M44 28 h12 v22 h22 v12 h-22 v28 h-12 v-28 h-22 v-12 h22 Z',
  star: 'M50 28 L56 46 L76 46 L60 58 L66 78 L50 66 L34 78 L40 58 L24 46 L44 46 Z',
  crescent: 'M62 32 A26 26 0 1 0 62 84 A20 20 0 1 1 62 32 Z',
  fleur: 'M50 26 Q58 40 54 54 Q66 44 72 52 Q66 60 56 58 L56 66 L64 66 L64 70 L56 70 Q58 80 50 86 Q42 80 44 70 L36 70 L36 66 L44 66 L44 58 Q34 60 28 52 Q34 44 46 54 Q42 40 50 26 Z',
  tower: 'M34 84 L34 46 L30 46 L30 36 L36 36 L36 40 L42 40 L42 36 L48 36 L48 40 L52 40 L52 36 L58 36 L58 40 L64 40 L64 36 L70 36 L70 46 L66 46 L66 84 Z M46 84 L46 70 Q50 64 54 70 L54 84 Z',
  key: 'M46 28 h8 v40 h8 v6 h-8 v6 h6 v6 h-6 v4 h-8 Z M50 28 m-10 -0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0',
  sun: 'M50 40 A16 16 0 1 0 50.1 40 Z M50 24 L53 34 L47 34 Z M50 92 L53 82 L47 82 Z M26 58 L36 55 L36 61 Z M74 58 L64 55 L64 61 Z M33 41 L41 47 L37 51 Z M67 41 L59 47 L63 51 Z M33 75 L41 69 L37 65 Z M67 75 L59 69 L63 65 Z',
  boar: 'M26 64 Q28 50 44 48 L62 46 Q74 46 78 56 L74 60 L78 66 L70 66 L68 74 L62 74 L60 66 L42 66 L40 74 L34 74 L32 64 Z',
  wolf: 'M30 72 L36 56 L32 44 L40 50 L44 40 L48 50 L66 52 L76 60 L70 64 L64 62 L66 76 L58 76 L56 66 L44 68 L42 78 L36 78 L38 68 Z',
  rune: 'M44 26 h12 v60 h-12 Z M50 40 L70 30 L74 38 L54 48 Z M50 56 L70 66 L66 74 L50 64 Z',
};
const SHIELD = 'M10 8 H90 V58 Q90 92 50 112 Q10 92 10 58 Z';
const PRESETS = {
  k_england: { f: 'gules', ch: 'lion', c: 'or', n: 3 }, e_angevin: { f: 'gules', ch: 'lion', c: 'or', n: 3 }, k_france: { f: 'azure', ch: 'fleur', c: 'or', n: 3 }, e_hre: { f: 'or', ch: 'eagle', c: 'sable' },
  k_castile: { f: 'gules', ch: 'tower', c: 'or' }, k_leon: { f: 'argent', ch: 'lion', c: 'purpure' }, k_papacy: { f: 'gules', ch: 'key', c: 'or' }, e_byzantium: { f: 'gules', ch: 'eagle', c: 'or' },
  k_jerusalem: { f: 'argent', ch: 'cross', c: 'or', n: 1 }, k_scotland: { f: 'or', ch: 'lion', c: 'gules' }, k_denmark: { f: 'or', ch: 'lion', c: 'azure', n: 3 }, k_norway: { f: 'gules', ch: 'lion', c: 'or' },
  k_sweden: { f: 'azure', ch: 'sun', c: 'or' }, k_poland: { f: 'gules', ch: 'eagle', c: 'argent' }, k_hungary: { f: 'gules', div: 'barry', t2: 'argent' }, k_bohemia: { f: 'gules', ch: 'lion', c: 'argent' },
  k_aragon: { f: 'or', div: 'paly', t2: 'gules' }, k_portugal: { f: 'argent', ch: 'cross', c: 'azure' }, d_normandy: { f: 'gules', ch: 'lion', c: 'or', n: 2 }, e_ottoman: { f: 'gules', ch: 'crescent', c: 'argent' },
  e_mongol: { f: 'azure', ch: 'sun', c: 'or' }, k_georgia: { f: 'argent', ch: 'cross', c: 'gules' }, c_venice: { f: 'azure', ch: 'lion', c: 'or' }, k_burgundia: { f: 'azure', div: 'bend', t2: 'or' },
};
const coaCache = new Map();
export function coa(key, size = 40, opts = {}) {
  const ck = key + '|' + size;
  if (coaCache.has(ck)) return coaCache.get(ck);
  const spec = PRESETS[key] || genSpec(key, opts);
  const id = 'c' + hash(ck);
  const t1 = TINCT[spec.f], t2 = TINCT[spec.t2 || (METALS.includes(spec.f) ? COLORS[hash(key) % 5] : METALS[hash(key) % 2])];
  let div = '';
  switch (spec.div) {
    case 'pale': div = `<rect x="50" y="0" width="50" height="120" fill="${t2}"/>`; break;
    case 'fess': div = `<rect x="0" y="58" width="100" height="62" fill="${t2}"/>`; break;
    case 'bend': div = `<path d="M0 0 L22 0 L100 90 L100 120 Z" fill="${t2}"/>`; break;
    case 'chevron': div = `<path d="M0 100 L50 44 L100 100 L100 80 L50 24 L0 80 Z" fill="${t2}"/>`; break;
    case 'quarterly': div = `<rect x="50" y="0" width="50" height="58" fill="${t2}"/><rect x="0" y="58" width="50" height="62" fill="${t2}"/>`; break;
    case 'saltire': div = `<path d="M0 0 L16 0 L100 104 L100 120 L84 120 L0 16 Z M100 0 L84 0 L0 104 L0 120 L16 120 L100 16 Z" fill="${t2}"/>`; break;
    case 'chief': div = `<rect x="0" y="0" width="100" height="32" fill="${t2}"/>`; break;
    case 'barry': div = Array.from({ length: 4 }, (_, k) => `<rect x="0" y="${8 + k * 26}" width="100" height="13" fill="${t2}"/>`).join(''); break;
    case 'paly': div = Array.from({ length: 4 }, (_, k) => `<rect x="${16 + k * 20}" y="0" width="10" height="120" fill="${t2}"/>`).join(''); break;
    case 'bordure': div = `<path d="${SHIELD}" fill="none" stroke="${t2}" stroke-width="16"/>`; break;
  }
  let charge = '';
  if (spec.ch) {
    const cc = TINCT[spec.c || (spec.div ? (METALS.includes(spec.f) && METALS.includes(spec.t2) ? 'sable' : METALS.includes(spec.f) ? 'sable' : 'or') : (METALS.includes(spec.f) ? COLORS[(hash(key) >> 3) % 5] : METALS[(hash(key) >> 3) % 2]))];
    const n = spec.n || 1;
    if (n === 1) charge = `<path d="${CHARGES[spec.ch]}" fill="${cc}" stroke="rgba(0,0,0,0.35)" stroke-width="1" fill-rule="evenodd"/>`;
    else { const pos = n === 2 ? [[0, -22, 0.6], [0, 22, 0.6]] : [[0, -30, 0.48], [0, 0, 0.48], [0, 30, 0.48]]; charge = pos.map(([dx, dy, s]) => `<g transform="translate(${50 + dx - 50 * s} ${58 + dy - 58 * s}) scale(${s})"><path d="${CHARGES[spec.ch]}" fill="${cc}" stroke="rgba(0,0,0,0.35)" stroke-width="1.5" fill-rule="evenodd"/></g>`).join(''); }
  }
  const svg = `<svg viewBox="0 0 100 120" width="${size}" height="${Math.round(size * 1.2)}" class="coa-svg"><defs><clipPath id="${id}"><path d="${SHIELD}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient></defs><g clip-path="url(#${id})"><rect width="100" height="120" fill="${t1}"/>${div}${charge}<rect width="100" height="120" fill="url(#${id}g)"/></g><path d="${SHIELD}" fill="none" stroke="#2a1a08" stroke-width="3"/><path d="${SHIELD}" fill="none" stroke="#d8b040" stroke-width="1.2" transform="translate(4 4) scale(0.92)"/></svg>`;
  coaCache.set(ck, svg);
  return svg;
}
function genSpec(key, opts) {
  const r = mulberry32(hash(key));
  const pick = a => a[Math.floor(r() * a.length)];
  const fam = opts.family;
  const metalField = r() < 0.4;
  const f = metalField ? pick(METALS) : pick(COLORS);
  const t2 = metalField ? pick(COLORS) : pick(METALS);
  const div = r() < 0.55 ? pick(['pale', 'fess', 'bend', 'chevron', 'quarterly', 'saltire', 'chief', 'barry', 'paly', 'bordure']) : null;
  let chs = ['lion', 'eagle', 'cross', 'star', 'fleur', 'tower', 'key', 'sun', 'boar', 'wolf'];
  if (fam === 'islamic') chs = ['crescent', 'star', 'sun', 'tower'];
  if (fam === 'pagan') chs = ['wolf', 'boar', 'rune', 'sun', 'eagle'];
  const ch = div && r() < 0.5 ? null : pick(chs);
  return { f, t2, div, ch, n: ch && r() < 0.2 ? 3 : 1 };
}
export function titleCoa(tid, size = 40) { const t = T(tid); const h = t?.holder ? ch(t.holder) : null; return coa(tid, size, { family: h ? faith(h.fai).family : null }); }
export function dynCoa(dynId, size = 32) { const d = G.s.dyns[dynId]; return coa('dyn' + (d?.coa || dynId), size, {}); }

// ---------- Event scenes ----------
const SCENES = {
  throne: { sky: ['#2a1a10', '#6a3a1a'], draw: () => `<rect x="0" y="180" width="600" height="80" fill="#3a2214"/>${[60, 160, 440, 540].map(x => `<rect x="${x}" y="20" width="26" height="170" fill="#4a2e1a"/><rect x="${x - 4}" y="14" width="34" height="10" fill="#5a3a22"/>`).join('')}<path d="M220 0 Q300 40 380 0" fill="#7a1a1a" opacity="0.8"/><rect x="250" y="70" width="100" height="120" rx="6" fill="#5a2a12"/><rect x="262" y="40" width="76" height="40" rx="20" fill="#7a3a1a"/><rect x="270" y="110" width="60" height="30" fill="#8a1a20"/>${[200, 400].map(x => `<rect x="${x}" y="30" width="30" height="90" fill="#8a1a20"/><path d="M${x} 120 l15 14 l15 -14" fill="#8a1a20"/><circle cx="${x + 15}" cy="70" r="8" fill="#d8b040"/>`).join('')}${torch(120, 90)}${torch(480, 90)}` },
  forest: { sky: ['#3a5a6a', '#a8b890'], draw: () => `${trees(0, 160, '#2a3a2a', 14)}${trees(20, 190, '#1a2a1a', 11)}<path d="M0 260 Q300 200 600 260 Z" fill="#2a3a1a"/>${fog()}` },
  battle: { sky: ['#4a2a1a', '#c07a4a'], draw: () => `<path d="M0 200 Q150 150 300 190 T600 180 L600 260 L0 260 Z" fill="#3a2a1a"/>${[100, 180, 420, 500].map((x, k) => `<line x1="${x}" y1="200" x2="${x}" y2="120" stroke="#2a1a0a" stroke-width="3"/><path d="M${x} 120 h30 l-6 10 l6 10 h-30 z" fill="${k < 2 ? '#a02020' : '#2040a0'}"><animate attributeName="d" values="M${x} 120 h30 l-6 10 l6 10 h-30 z;M${x} 122 h28 l-4 9 l4 10 h-28 z;M${x} 120 h30 l-6 10 l6 10 h-30 z" dur="1.6s" repeatCount="indefinite"/></path>`).join('')}${smoke()}` },
  church: { sky: ['#1a1a2a', '#3a3050'], draw: () => `<rect x="0" y="200" width="600" height="60" fill="#2a2420"/>${[120, 260, 400].map(x => `<path d="M${x} 190 L${x} 70 Q${x + 40} 10 ${x + 80} 70 L${x + 80} 190 Z" fill="#20283a"/><path d="M${x + 10} 180 L${x + 10} 75 Q${x + 40} 25 ${x + 70} 75 L${x + 70} 180 Z" fill="url(#sg)" opacity="0.85"/>`).join('')}<path d="M300 40 L320 260 L280 260 Z" fill="#fff8d0" opacity="0.08"/>${candle(80, 200)}${candle(520, 200)}` , defs: `<linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c03040"/><stop offset="0.3" stop-color="#3050c0"/><stop offset="0.6" stop-color="#d0a030"/><stop offset="1" stop-color="#30a050"/></linearGradient>` },
  night: { sky: ['#05081a', '#1a2a4a'], draw: () => `${stars()}<circle cx="470" cy="60" r="28" fill="#f4ecd0"/><circle cx="482" cy="54" r="26" fill="#0a1228" opacity="0.15"/><path d="M0 260 L0 200 L80 200 L80 170 L100 170 L100 150 L120 150 L120 170 L150 170 L150 200 L260 210 L380 190 L380 160 L400 140 L420 160 L420 190 L600 200 L600 260 Z" fill="#05060c"/><rect x="104" y="160" width="8" height="10" fill="#f0c060"><animate attributeName="opacity" values="1;0.5;1" dur="3s" repeatCount="indefinite"/></rect>` },
  feast: { sky: ['#3a1a0a', '#8a4a1a'], draw: () => `<rect x="0" y="0" width="600" height="260" fill="#3a2212"/><rect x="40" y="150" width="520" height="22" fill="#6a3a1a"/><rect x="40" y="172" width="520" height="40" fill="#4a2a12"/>${[100, 180, 260, 340, 420, 500].map(x => `<ellipse cx="${x}" cy="148" rx="18" ry="6" fill="#d8c0a0"/>`).join('')}${[140, 300, 460].map(x => candle(x, 148)).join('')}<path d="M220 40 L380 40 L360 90 L240 90 Z" fill="#7a1a1a"/>` },
  market: { sky: ['#5a8ab0', '#e0d0a0'], draw: () => `<rect x="0" y="190" width="600" height="70" fill="#8a7a5a"/>${[30, 170, 310, 450].map((x, k) => `<rect x="${x}" y="130" width="110" height="70" fill="#6a4a2a"/><path d="M${x - 10} 130 L${x + 55} 95 L${x + 120} 130 Z" fill="${['#c04030', '#3060a0', '#d0a030', '#3a8a4a'][k]}"/>${[0, 1, 2, 3].map(j => `<path d="M${x - 10 + j * 32} 130 q16 12 32 0" fill="${['#c04030', '#3060a0', '#d0a030', '#3a8a4a'][k]}"/>`).join('')}`).join('')}` },
  bedroom: { sky: ['#1a0a10', '#4a2030'], draw: () => `<rect x="0" y="0" width="600" height="260" fill="#2a1418"/><rect x="180" y="110" width="260" height="90" fill="#6a2030"/><rect x="170" y="40" width="20" height="170" fill="#3a1a10"/><rect x="430" y="40" width="20" height="170" fill="#3a1a10"/><path d="M170 40 L450 40 L450 60 Q310 90 170 60 Z" fill="#8a2a3a"/>${candle(500, 180)}<rect x="60" y="40" width="70" height="100" fill="#1a1a3a" stroke="#4a3a2a" stroke-width="6"/>${stars(60, 40, 70, 100, 8)}` },
  study: { sky: ['#2a1a0a', '#6a4a2a'], draw: () => `<rect x="0" y="0" width="600" height="260" fill="#3a2614"/>${[0, 1, 2, 3].map(r => `<rect x="20" y="${30 + r * 45}" width="200" height="6" fill="#5a3a1a"/>${Array.from({ length: 12 }, (_, k) => `<rect x="${26 + k * 16}" y="${8 + r * 45}" width="12" height="22" fill="${['#7a2020', '#203a7a', '#2a5a2a', '#6a5a2a'][(k + r) % 4]}"/>`).join('')}`).join('')}<rect x="300" y="170" width="240" height="14" fill="#5a3a1a"/><rect x="350" y="150" width="70" height="22" fill="#e8dcc0"/>${candle(470, 168)}<circle cx="520" cy="140" r="22" fill="none" stroke="#c0a040" stroke-width="2"/><path d="M500 140 h40 M520 118 v44" stroke="#c0a040"/>` },
  road: { sky: ['#6a8ab0', '#e8c890'], draw: () => `<circle cx="480" cy="80" r="30" fill="#f8e0a0"/><path d="M0 170 Q150 120 300 160 T600 150 L600 260 L0 260 Z" fill="#6a7a4a"/><path d="M0 210 Q200 170 360 200 T600 190 L600 260 L0 260 Z" fill="#4a5a2a"/><path d="M260 260 Q300 200 340 180 Q360 170 380 172" stroke="#b09a6a" stroke-width="18" fill="none"/>${trees(400, 170, '#2a3a1a', 4)}` },
  sea: { sky: ['#4a6a8a', '#c0c8c0'], draw: () => `<rect x="0" y="160" width="600" height="100" fill="#2a4a6a"/>${[0, 1, 2].map(k => `<path d="M0 ${180 + k * 25} q25 -8 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#8ab0d0" fill="none" opacity="0.6"><animateTransform attributeName="transform" type="translate" values="0 0;-50 0" dur="${3 + k}s" repeatCount="indefinite"/></path>`).join('')}<g><animateTransform attributeName="transform" type="translate" values="0 0;0 4;0 0" dur="3s" repeatCount="indefinite"/><path d="M360 170 L470 170 L455 190 L375 190 Z" fill="#3a2414"/><line x1="415" y1="170" x2="415" y2="90" stroke="#2a1a0a" stroke-width="3"/><rect x="392" y="96" width="46" height="56" fill="#e8dcc0"/><path d="M392 110 h46 M392 124 h46 M392 138 h46" stroke="#a02020" stroke-width="5"/><path d="M470 170 q14 -10 10 -24" stroke="#3a2414" stroke-width="5" fill="none"/></g>` },
  tournament: { sky: ['#6aa0d0', '#e8e0c0'], draw: () => `<rect x="0" y="180" width="600" height="80" fill="#6a8a3a"/><rect x="0" y="196" width="600" height="6" fill="#8a6a3a"/>${[40, 150, 400, 510].map((x, k) => `<path d="M${x} 180 L${x + 35} 110 L${x + 70} 180 Z" fill="${['#c04030', '#3060c0', '#d0a030', '#7a3a9a'][k]}"/><path d="M${x + 35} 180 L${x + 35} 110" stroke="#f0e8d0"/><line x1="${x + 35}" y1="110" x2="${x + 35}" y2="92" stroke="#3a2a1a"/><path d="M${x + 35} 92 h14 l-4 5 l4 5 h-14 z" fill="${['#c04030', '#3060c0', '#d0a030', '#7a3a9a'][k]}"/>`).join('')}<g><animateTransform attributeName="transform" type="translate" values="-30 0;30 0;-30 0" dur="4s" repeatCount="indefinite"/><path d="M270 196 l10 -30 l30 0 l10 30 z" fill="#4a3a2a"/><circle cx="295" cy="150" r="10" fill="#9a9ea4"/><line x1="300" y1="160" x2="360" y2="150" stroke="#c0a060" stroke-width="3"/></g>` },
  plague: { sky: ['#1a1a10', '#4a4a2a'], draw: () => `<path d="M0 260 L0 170 L60 170 L60 140 L90 140 L90 170 L160 170 L180 120 L200 170 L300 170 L300 150 L340 150 L340 170 L600 170 L600 260 Z" fill="#141410"/>${[100, 240, 380, 500].map(x => `<path d="M${x} 230 v-24 M${x - 8} 214 h16" stroke="#6a6a5a" stroke-width="3"/>`).join('')}${fog('#6a7a4a')}` },
};
function torch(x, y) { return `<rect x="${x - 2}" y="${y}" width="4" height="22" fill="#3a2a1a"/><ellipse cx="${x}" cy="${y - 4}" rx="6" ry="10" fill="#ffa040"><animate attributeName="ry" values="10;12;9;10" dur="0.8s" repeatCount="indefinite"/></ellipse><ellipse cx="${x}" cy="${y - 2}" rx="3" ry="6" fill="#fff0a0"/>`; }
function candle(x, y) { return `<rect x="${x - 3}" y="${y - 20}" width="6" height="20" fill="#f0e8d0"/><ellipse cx="${x}" cy="${y - 26}" rx="3" ry="6" fill="#ffb040"><animate attributeName="ry" values="6;7;5;6" dur="0.6s" repeatCount="indefinite"/></ellipse><circle cx="${x}" cy="${y - 26}" r="30" fill="#ffb040" opacity="0.08"/>`; }
function trees(x0, y, col, n) { const r = mulberry32(x0 + y); return Array.from({ length: n }, (_, k) => { const x = x0 + k * (600 / n) + r() * 30; const h = 60 + r() * 50; return `<path d="M${x} ${y} L${x + 20} ${y - h} L${x + 40} ${y} Z" fill="${col}"/><rect x="${x + 17}" y="${y}" width="6" height="12" fill="#2a1a0a"/>`; }).join(''); }
function stars(x0 = 0, y0 = 0, w = 600, h = 150, n = 40) { const r = mulberry32(99); return Array.from({ length: n }, () => `<circle cx="${x0 + r() * w}" cy="${y0 + r() * h}" r="${r() * 1.3 + 0.3}" fill="#fff"><animate attributeName="opacity" values="1;0.3;1" dur="${2 + r() * 3}s" repeatCount="indefinite"/></circle>`).join(''); }
function fog(col = '#c0c8c0') { return `<rect x="-100" y="150" width="800" height="60" fill="${col}" opacity="0.18"><animateTransform attributeName="transform" type="translate" values="0 0;60 0;0 0" dur="12s" repeatCount="indefinite"/></rect>`; }
function smoke() { return [120, 300, 470].map((x, k) => `<circle cx="${x}" cy="170" r="20" fill="#9a8a7a" opacity="0.35"><animate attributeName="cy" values="180;120" dur="${4 + k}s" repeatCount="indefinite"/><animate attributeName="r" values="14;34" dur="${4 + k}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.4;0" dur="${4 + k}s" repeatCount="indefinite"/></circle>`).join(''); }
export function scene(name) {
  const s = SCENES[name] || SCENES.throne;
  return `<svg viewBox="0 0 600 260" preserveAspectRatio="xMidYMid slice" class="scene-svg"><defs><linearGradient id="sky${name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient>${s.defs || ''}</defs><rect width="600" height="260" fill="url(#sky${name})"/>${s.draw()}<rect width="600" height="260" fill="url(#vig)" opacity="0"/></svg>`;
}
