// Génère les illustrations par défaut (gravures au trait bronze) dans src/assets/img/.
// À remplacer idéalement par des captures en jeu. Usage : node scripts/illustrations.mjs
import fs from 'node:fs';

const W = 1200, H = 800;
const BG = '#121214', B = '#B08D57', B2 = '#7A6440', L = '#3A3833';
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const svg = (body, w = W, h = H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
<rect width="${w}" height="${h}" fill="${BG}"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</g>
<rect width="${w}" height="${h}" fill="url(#v)"/>
<defs><radialGradient id="v" cx="50%" cy="45%" r="75%"><stop offset="55%" stop-color="${BG}" stop-opacity="0"/><stop offset="100%" stop-color="#050506" stop-opacity=".85"/></radialGradient></defs>
</svg>`;
const line = (x1, y1, x2, y2, c = B, w = 1, o = 1) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" opacity="${o}"/>`;
const rect = (x, y, w, h, c = B, sw = 1, o = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${c}" stroke-width="${sw}" opacity="${o}"/>`;
const hatch = (x, y, w, h, step = 6, o = .25) => { let s = ''; for (let i = 0; i < w + h; i += step) s += line(x + Math.max(0, i - h), y + Math.min(h, i), x + Math.min(w, i), y + Math.max(0, i - w), B2, .6, o); return `<g clip-path="none">${s}</g>`; };

function skyline(baseY, scale = 1, o = .5) {
  let s = '', x = 0;
  while (x < W) {
    const w = (30 + rnd() * 70) * scale, h = (60 + rnd() * 260) * scale;
    s += rect(x, baseY - h, w, h, B2, .8, o);
    for (let wy = baseY - h + 12; wy < baseY - 8; wy += 14 * scale) s += line(x + 6, wy, x + w - 6, wy, B2, .4, o * .5);
    if (rnd() > .82) s += line(x + w / 2, baseY - h, x + w / 2, baseY - h - 40 * scale, B2, .8, o);
    x += w + 4 * scale;
  }
  return s;
}

// Palais de justice
function tribunal() {
  let s = '';
  for (let y = 40; y < 300; y += 9) s += line(0, y, W, y + 30, L, .5, .35);
  const left = 230, right = 970, top = 300, base = 640;
  s += `<path d="M${left - 40} ${top}L${W / 2} 150L${right + 40} ${top}Z" stroke="${B}" stroke-width="1.5"/>`;
  s += `<path d="M${left} ${top - 14}L${W / 2} 180L${right} ${top - 14}" stroke="${B2}"/>`;
  s += rect(left - 50, top, right - left + 100, 34, B, 1.4) + rect(left - 50, top + 34, right - left + 100, 16, B2, 1);
  const cols = 8, gap = (right - left) / (cols - 1);
  for (let i = 0; i < cols; i++) {
    const cx = left + i * gap;
    s += rect(cx - 22, top + 50, 44, 10, B, 1) + rect(cx - 26, base - 14, 52, 14, B, 1);
    for (let f = -14; f <= 14; f += 7) s += line(cx + f, top + 62, cx + f, base - 16, f === 0 ? B : B2, f === 0 ? 1.1 : .7);
  }
  for (let i = 0; i < 6; i++) s += rect(left - 70 - i * 22, base + i * 22, right - left + 140 + i * 44, 22, i % 2 ? B2 : B, 1, 1 - i * .1);
  s += hatch(left - 50, top + 50, right - left + 100, base - top - 64, 9, .12);
  return svg(s);
}

// Bibliothèque juridique
function bibliotheque() {
  let s = '';
  const shelves = 6, top = 70, sh = 110;
  for (let r = 0; r < shelves; r++) {
    const y = top + r * sh;
    s += line(60, y + sh, W - 60, y + sh, B, 2);
    let x = 70;
    while (x < W - 90) {
      const w = 12 + rnd() * 22, h = 60 + rnd() * 40;
      if (rnd() > .93) { x += 30; continue; }
      const tilt = rnd() > .95;
      s += tilt ? `<path d="M${x} ${y + sh}L${x + 18} ${y + sh - h}L${x + 18 + w} ${y + sh - h + 4}L${x + w} ${y + sh}" stroke="${B}" stroke-width=".9"/>`
                : rect(x, y + sh - h, w, h, rnd() > .5 ? B : B2, .9);
      if (!tilt) { s += line(x + 3, y + sh - h + 12, x + w - 3, y + sh - h + 12, B2, .6); s += line(x + 3, y + sh - 14, x + w - 3, y + sh - 14, B2, .6); }
      x += w + 2 + (tilt ? 18 : 0);
    }
  }
  s += rect(50, 50, W - 100, shelves * sh + 30, B, 2);
  s += line(820, 40, 760, H - 20, B, 2) + line(880, 40, 820, H - 20, B, 2);
  for (let y = 80; y < H - 30; y += 46) { const t = (y - 40) / (H - 60); s += line(820 - 60 * t, y, 880 - 60 * t, y, B, 1.6); }
  return svg(s);
}

// Salle de réunion (perspective centrale)
function reunion() {
  let s = '';
  const vx = W / 2, vy = 300;
  s += rect(260, 80, 680, 260, B2, 1);
  for (let x = 260; x <= 940; x += 136) s += line(x, 80, x, 340, B2, 1);
  seed = 21; s += `<clipPath id="w"><rect x="260" y="80" width="680" height="260"/></clipPath><g clip-path="url(#w)"><g transform="translate(260 340) scale(.567 .4)">${skyline(0, 1, .6)}</g></g>`;
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) s += line(x, y, vx + (x ? 340 : -340), y ? 560 : 80, L, .8, .6);
  s += `<path d="M380 470L820 470L1040 760L160 760Z" stroke="${B}" stroke-width="1.6"/>`;
  s += hatch(380, 470, 440, 40, 10, .15);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const lx = 380 - 220 * t - 40, rx = 820 + 220 * t + 10, y = 470 + 290 * t - 40, h = 50 + 30 * t, w = 30 + 20 * t;
    s += rect(lx - w * .3, y - h * .4, w, h, B, 1.1) + rect(rx, y - h * .4, w, h, B, 1.1);
  }
  s += line(0, 560, W, 560, L, .6, .5);
  return svg(s);
}

// Bureau avec vue sur Los Santos
function bureau() {
  let s = '';
  s += rect(120, 60, 960, 460, B, 1.4);
  seed = 3; s += `<clipPath id="w"><rect x="120" y="60" width="960" height="460"/></clipPath><g clip-path="url(#w)"><g transform="translate(120 520) scale(.8 .9)">${skyline(0, 1.15, .7)}</g></g>`;
  for (let x = 120; x <= 1080; x += 240) s += line(x, 60, x, 520, B, 1.2);
  for (const px of [200, 960]) {
    s += `<path d="M${px} 520 Q${px + 8} 380 ${px + 2} 300" stroke="${B2}" stroke-width="2"/>`;
    for (let a = 0; a < 7; a++) { const ang = -Math.PI + a * Math.PI / 6; s += `<path d="M${px + 2} 300 Q${px + 2 + Math.cos(ang) * 40} ${300 + Math.sin(ang) * 30 - 10} ${px + 2 + Math.cos(ang) * 80} ${300 + Math.sin(ang) * 20 + 30}" stroke="${B2}" stroke-width="1"/>`; }
  }
  s += `<path d="M240 600L960 600L1010 640L190 640Z" stroke="${B}" stroke-width="1.6"/>` + line(230, 640, 230, 780, B, 1.4) + line(970, 640, 970, 780, B, 1.4);
  s += line(820, 600, 860, 520, B, 1.2) + line(860, 520, 820, 480, B, 1.2) + `<path d="M790 470 L850 470 L835 495 L805 495Z" stroke="${B}"/>`;
  s += rect(360, 570, 160, 30, B2, 1) + rect(380, 560, 120, 10, B2, .8);
  s += hatch(190, 640, 820, 140, 12, .1);
  return svg(s);
}

// Façade du cabinet : immeuble moderne avec portique
function facade() {
  let s = '';
  seed = 11; s += skyline(760, 1.3, .25);
  s += rect(420, 60, 360, 600, B, 1.4);
  for (let y = 80; y < 640; y += 24) s += line(430, y, 770, y, B2, .6, .7);
  for (let x = 450; x < 770; x += 40) s += line(x, 70, x, 650, B2, .5, .5);
  s += rect(380, 660, 440, 20, B, 1.4);
  for (let i = 0; i < 5; i++) { const x = 410 + i * 95; for (let f = -8; f <= 8; f += 8) s += line(x + f, 680, x + f, 760, B, f ? .7 : 1.1); }
  s += rect(360, 760, 480, 14, B, 1.2);
  return svg(s);
}

const out = new URL('../src/assets/img/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
for (const [name, fn] of Object.entries({ tribunal, bibliotheque, reunion, bureau, facade })) {
  fs.writeFileSync(new URL(`${name}.svg`, out), fn());
  console.log('✔', name);
}

// ── Scène de nuit pour le hero : skyline de Los Santos, palmiers, façade du cabinet éclairée
import { crest } from '../src/assets/js/icons.mjs';
function heroNuit() {
  const w = 1920, h = 1080;
  seed = 42;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0a0d"/><stop offset=".45" stop-color="#2a1f22"/><stop offset=".72" stop-color="#5a3f33"/><stop offset="1" stop-color="#1a1210"/></linearGradient>
  <radialGradient id="glow" cx=".55" cy=".72" r=".5"><stop offset="0" stop-color="#c98a4e" stop-opacity=".35"/><stop offset="1" stop-color="#c98a4e" stop-opacity="0"/></radialGradient>
  <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b241f"/><stop offset="1" stop-color="#4a3a2b"/></linearGradient>
  <linearGradient id="col" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3026"/><stop offset=".7" stop-color="#7a5f42"/><stop offset="1" stop-color="#d9b07a"/></linearGradient>
  <linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0c27f" stop-opacity=".85"/><stop offset="1" stop-color="#a8713f" stop-opacity=".6"/></linearGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15100e"/><stop offset="1" stop-color="#050404"/></linearGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${h}" fill="url(#glow)"/>`;
  // étoiles discrètes
  for (let i = 0; i < 70; i++) s += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * 380).toFixed(0)}" r="${(rnd() * 1.1 + .3).toFixed(1)}" fill="#f3e3c8" opacity="${(rnd() * .5 + .1).toFixed(2)}"/>`;
  // skyline lointaine
  const city = (base, minH, maxH, color, lit, x0 = 0, x1 = w) => {
    let x = x0, out = '';
    while (x < x1) {
      const bw = 40 + rnd() * 90, bh = minH + rnd() * (maxH - minH);
      out += `<rect x="${x.toFixed(0)}" y="${(base - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="${color}"/>`;
      if (rnd() > .7) out += `<rect x="${(x + bw / 2 - 2).toFixed(0)}" y="${(base - bh - 30).toFixed(0)}" width="4" height="30" fill="${color}"/>`;
      for (let wy = base - bh + 10; wy < base - 10; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 11)
        if (rnd() < lit) out += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="5" height="7" fill="#f0c27f" opacity="${(rnd() * .6 + .25).toFixed(2)}"/>`;
      x += bw + 3;
    }
    return out;
  };
  s += city(820, 120, 300, '#191315', .12);
  // grandes tours du centre
  const tower = (x, top, bw, base = 820) => {
    let out = `<rect x="${x}" y="${top}" width="${bw}" height="${base - top}" fill="#0f0b0c"/><rect x="${x}" y="${top}" width="3" height="${base - top}" fill="#6b4c33" opacity=".5"/>`;
    for (let wy = top + 16; wy < base - 10; wy += 13) for (let wx = x + 8; wx < x + bw - 8; wx += 10)
      if (rnd() < .35) out += `<rect x="${wx}" y="${wy}" width="5" height="7" fill="#f0c27f" opacity="${(rnd() * .7 + .2).toFixed(2)}"/>`;
    return out;
  };
  s += tower(560, 250, 110) + tower(690, 330, 90) + tower(800, 170, 130) + tower(950, 300, 100) + tower(1070, 390, 80);
  s += `<path d="M865 170 L865 120 M860 120 h10" stroke="#0f0b0c" stroke-width="4"/>`;
  s += city(860, 40, 160, '#120d0e', .18);
  // façade du cabinet (à droite)
  const bx = 1180, by = 360, bw2 = 760, base = 900;
  s += `<rect x="${bx}" y="${by}" width="${bw2}" height="${base - by}" fill="url(#stone)"/>`;
  s += `<rect x="${bx - 20}" y="${by - 26}" width="${bw2 + 40}" height="26" fill="#3a2f26"/><rect x="${bx - 30}" y="${by - 34}" width="${bw2 + 60}" height="10" fill="#4d3d2e"/>`;
  for (let i = 0; i < 7; i++) {
    const cx = bx + 40 + i * 112;
    s += `<rect x="${cx}" y="${by + 30}" width="40" height="${base - by - 90}" fill="url(#col)"/>`;
    for (let f = 6; f < 40; f += 8) s += `<rect x="${cx + f}" y="${by + 30}" width="1.5" height="${base - by - 90}" fill="#20180f" opacity=".45"/>`;
    s += `<rect x="${cx - 6}" y="${by + 22}" width="52" height="10" fill="#5a4632"/><rect x="${cx - 6}" y="${base - 62}" width="52" height="10" fill="#8a6a46"/>`;
    s += `<ellipse cx="${cx + 20}" cy="${base - 52}" rx="70" ry="160" fill="#e3a964" opacity=".12" filter="url(#soft)"/>`;
    if (i < 6) for (let r = 0; r < 4; r++) s += `<rect x="${cx + 54}" y="${by + 50 + r * 110}" width="46" height="80" fill="url(#win)" opacity="${(rnd() * .4 + .45).toFixed(2)}"/>`;
  }
  // plaque du cabinet
  s += `<rect x="${bx + 205}" y="${base - 210}" width="350" height="150" fill="#2a221c" stroke="#6e5737"/>`;
  s += `<g transform="translate(${bx + 350} ${base - 205}) scale(.95)" color="#d9b07a">${crest('x').replace('class="x"', 'width="64" height="64"')}</g>`;
  s += `<text x="${bx + 380}" y="${base - 100}" text-anchor="middle" font-family="Didot, 'Bodoni 72', Georgia, serif" font-size="25" letter-spacing="3" fill="#e2bd86">AVOCAT &amp; CONSEIL</text>`;
  // marches et sol
  for (let i = 0; i < 5; i++) s += `<rect x="${bx - 20 - i * 18}" y="${base + i * 14}" width="${bw2 + 40 + i * 36}" height="14" fill="${i % 2 ? '#2a211b' : '#3b2f25'}"/>`;
  s += `<rect x="0" y="${base + 60}" width="${w}" height="${h - base - 60}" fill="url(#ground)"/><rect x="0" y="860" width="${bx - 120}" height="${h - 860}" fill="#0c0909"/>`;
  s += `<rect x="0" y="${base + 64}" width="${w}" height="3" fill="#c98a4e" opacity=".25"/>`;
  // palmiers
  const palm = (x, top, k = 1) => {
    let out = `<path d="M${x} ${h} Q${x + 18 * k} ${(h + top) / 2} ${x + 6 * k} ${top}" stroke="#070505" stroke-width="${10 * k}" fill="none"/>`;
    for (let a = 0; a < 9; a++) {
      const ang = (-170 + a * 21) * Math.PI / 180, L = (110 + rnd() * 40) * k;
      const ex = x + 6 * k + Math.cos(ang) * L, ey = top + Math.sin(ang) * L * .45 + 40 * k;
      out += `<path d="M${x + 6 * k} ${top} Q${x + 6 * k + Math.cos(ang) * L * .5} ${top + Math.sin(ang) * L * .5 - 25 * k} ${ex.toFixed(0)} ${ey.toFixed(0)}" stroke="#070505" stroke-width="${5 * k}" fill="none" stroke-linecap="round"/>`;
    }
    return out;
  };
  s += palm(80, 470, 1.1) + palm(430, 560, .85) + palm(1110, 430, 1.15) + palm(1880, 470, 1);
  return s + '</svg>';
}
fs.writeFileSync(new URL('hero-nuit.svg', out), heroNuit());
console.log('✔ hero-nuit');
