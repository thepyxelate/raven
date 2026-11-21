// Shop signs and rooftop billboards for the city: the business list, a design and a pictogram for each, and the
// atlas they are all drawn into. Self-contained: it only needs a canvas and fonts.
import { mkCanvas, canvasTex } from '../lib/canvas.js';

// one sign per business, indexed by position (the city stores the index)
export const SHOP_SIGNS = ['PERFORMANCE SHOP', 'BURGERS', 'TUNER HAVEN', 'NOODLES', 'SUSHI BAR', 'PIZZA', 'ARCADE', 'KARAOKE', 'TATTOO', 'MOTEL', 'DINER', 'TIRES',
  'BODY SHOP', 'PARTS', 'CAFE', 'RAMEN', 'TACOS', 'DONUTS', 'LAUNDRY', 'GYM', 'BOOKS', 'RECORDS', 'FLOWERS', 'BAKERY', 'CINEMA', 'HOTEL', 'CLUB',
  'NEON NIGHTS', 'CAR WASH', 'BOWLING', 'GARAGE', 'VIDEO',
  'RESTAURANT', 'MUSEUM', 'GALLERY', 'BISTRO', 'STEAK HOUSE', 'TEA HOUSE', 'PHARMACY', 'MARKET', 'BANK', 'LIBRARY', 'THEATER', 'ICE CREAM',
  'BARBER', 'PARKING', 'MALL', 'BAR & GRILL', 'TRATTORIA', 'KEBAB', 'PLOV HOUSE', 'CHOYXONA', 'SAMSA', 'FUEL', 'SUPERMARKET', 'SEAFOOD',
  'ROOFTOP BAR', 'JAZZ CLUB', 'SURF SHOP', 'ELECTRONICS', 'FASHION', 'COFFEE', 'BBQ', 'MARINA'];

/* ---- billboard atlas: invented brands, 2 x 4 panels ---- */
// Shop signs and rooftop billboards, drawn into one atlas. Every business gets a sign that suits it: only the
// nightlife glows as neon tubes; shops, pharmacies, banks and fuel stations get backlit light boxes; cafes, the
// choyxona, galleries, workshops and the rest get painted, carved or enamel boards that the sun lights like a wall.
// kind: 'neon' (bright, unlit), 'box' (backlit, unlit), 'paint' (lit by the scene)
const SERIF = 'Georgia, "Times New Roman", serif', SANS = '"Inter", Arial, sans-serif', DISPLAY = '"Chakra Petch", "Arial Narrow", sans-serif';
const ROMAN = '"Cinzel", "Trajan Pro", Georgia, serif';
const SCRIPT = '"Pacifico", "Brush Script MT", "Segoe Script", cursive', BLOCK = '"Bebas Neue", Impact, "Arial Black", sans-serif', MONO = '"Courier New", monospace';
// [kind, style, background, ink, accent]
const SHOP_STYLE = {
  'PERFORMANCE SHOP': ['paint', 'race', '#111216', '#f2f2f2', '#e0262f'], 'TUNER HAVEN': ['box', 'race', '#0d1626', '#ffffff', '#2ee6d6'],
  'BURGERS': ['box', 'bold', '#d62828', '#ffd23f', '#ffd23f'], 'NOODLES': ['box', 'asia', '#b3141c', '#fff4e0', '#f2c14e'],
  'SUSHI BAR': ['paint', 'asia', '#f4efe6', '#1b1b1b', '#c8102e'], 'RAMEN': ['neon', 'neon', '#07070d', '#ff5a3d', '#ffb547'],
  'PIZZA': ['box', 'italy', '#fdf6e3', '#b22222', '#009246'], 'TRATTORIA': ['paint', 'italy', '#f3ead6', '#2b5a2b', '#ce2b37'],
  'ARCADE': ['neon', 'pixel', '#07070d', '#9b5cff', '#2ee6d6'], 'KARAOKE': ['neon', 'neonScript', '#07070d', '#ff3da8', '#ffe066'],
  'TATTOO': ['paint', 'tattoo', '#141414', '#e8d9b0', '#b3261e'], 'MOTEL': ['neon', 'neonScript', '#07070d', '#ff5a3d', '#5fb8ff'],
  'DINER': ['neon', 'neonScript', '#07070d', '#5fb8ff', '#ff3da8'], 'TIRES': ['paint', 'stencil', '#f2c200', '#111111', '#111111'],
  'BODY SHOP': ['paint', 'stencil', '#2b2f36', '#f2c200', '#f2c200'], 'PARTS': ['paint', 'stencil', '#c8102e', '#ffffff', '#ffffff'],
  'GARAGE': ['paint', 'enamel', '#1e3a5f', '#ffffff', '#d9dde3'], 'CAR WASH': ['box', 'wave', '#1aa3e8', '#ffffff', '#bfe9ff'],
  'CAFE': ['paint', 'chalk', '#2b2b2b', '#f4f1e8', '#f4f1e8'], 'COFFEE': ['paint', 'wood', '#5a3a22', '#f3e3c3', '#c89b6d'],
  'BAKERY': ['paint', 'script', '#f6e7cf', '#7a4a24', '#c98b4a'], 'DONUTS': ['box', 'round', '#ff8fc7', '#ffffff', '#7a3b1e'],
  'ICE CREAM': ['box', 'round', '#bff0e6', '#e0457b', '#ffffff'], 'TACOS': ['box', 'bold', '#ff7a1a', '#ffffff', '#16a085'],
  'LAUNDRY': ['box', 'clean', '#e8f6ff', '#1d6fb8', '#7fc8ff'], 'GYM': ['box', 'bold', '#111111', '#ffffff', '#e0262f'],
  'BOOKS': ['paint', 'serif', '#1f3d2b', '#e8d48a', '#e8d48a'], 'RECORDS': ['paint', 'retro', '#f2e6c8', '#1b1b1b', '#e0262f'],
  'FLOWERS': ['paint', 'script', '#f3e8ef', '#8a3b6b', '#5e8c4a'], 'CINEMA': ['box', 'marquee', '#6b0f1a', '#fff3c4', '#ffd36b'],
  'THEATER': ['box', 'marquee', '#2a1033', '#fff3c4', '#ffd36b'], 'HOTEL': ['box', 'luxe', '#0d0d0f', '#e6c27a', '#e6c27a'],
  'CLUB': ['neon', 'neon', '#07070d', '#2ee6d6', '#ff3da8'], 'NEON NIGHTS': ['neon', 'neonScript', '#07070d', '#ff3da8', '#9b5cff'],
  'BOWLING': ['neon', 'neon', '#07070d', '#ffe066', '#ff5a3d'], 'VIDEO': ['neon', 'retro', '#07070d', '#ff3da8', '#2ee6d6'],
  'RESTAURANT': ['paint', 'luxe', '#14110f', '#e6c27a', '#e6c27a'], 'BISTRO': ['paint', 'script', '#1c2a3a', '#f4efe2', '#c8a96a'],
  'STEAK HOUSE': ['paint', 'wood', '#3a2416', '#f0d9a8', '#b5651d'], 'BAR & GRILL': ['paint', 'wood', '#2e1d12', '#ffcf7a', '#d2552a'],
  'MUSEUM': ['paint', 'greek', '#c9c4ba', '#5b5852', '#8d887e'], 'GALLERY': ['paint', 'minimal', '#f5f5f2', '#111111', '#111111'],
  'LIBRARY': ['paint', 'stone', '#c2b9a8', '#2a2621', '#2a2621'], 'BANK': ['box', 'luxe', '#0f2747', '#d9b45a', '#d9b45a'],
  'TEA HOUSE': ['paint', 'uzbek', '#0f3b6e', '#ffffff', '#3fc1c9'], 'CHOYXONA': ['paint', 'uzbek', '#12406f', '#ffffff', '#e8b64c'],
  'PLOV HOUSE': ['paint', 'uzbek', '#7a1f1f', '#fff1d6', '#e8b64c'], 'SAMSA': ['paint', 'uzbek', '#8a4b14', '#fff3dc', '#3fc1c9'],
  'KEBAB': ['box', 'flame', '#1a0f0a', '#ffd23f', '#ff5a1f'], 'BBQ': ['paint', 'flame', '#1c1410', '#ffe1a8', '#ff5a1f'],
  'PHARMACY': ['box', 'cross', '#ffffff', '#139a43', '#139a43'], 'MARKET': ['paint', 'awning', '#f7f2e6', '#2f6b2f', '#2f8f3a'],
  'SUPERMARKET': ['box', 'bold', '#e2231a', '#ffffff', '#ffd200'], 'MALL': ['box', 'clean', '#ffffff', '#222222', '#2ee6d6'],
  'ELECTRONICS': ['box', 'tech', '#0b1f3a', '#ffffff', '#38b6ff'], 'FASHION': ['box', 'minimal', '#ffffff', '#111111', '#111111'],
  'BARBER': ['paint', 'barber', '#f4f1ea', '#1b1b1b', '#c8102e'], 'PARKING': ['box', 'parking', '#1f5fbf', '#ffffff', '#ffffff'],
  'FUEL': ['box', 'fuel', '#ffffff', '#0b3d91', '#e2231a'], 'SEAFOOD': ['paint', 'nautical', '#0f2f4f', '#ffffff', '#e2231a'],
  'MARINA': ['paint', 'nautical', '#ffffff', '#0f2f4f', '#0f2f4f'], 'SURF SHOP': ['paint', 'wave', '#ffcf5a', '#0d5f8a', '#1aa3e8'],
  'ROOFTOP BAR': ['neon', 'neonScript', '#07070d', '#ffb547', '#2ee6d6'], 'JAZZ CLUB': ['neon', 'neonScript', '#07070d', '#5fb8ff', '#ffb547']
};
// the sign fonts are web fonts: make sure they are in before the city's atlas is drawn (never wait more than 2.5 s)
export const signFonts = () => (document.fonts && document.fonts.load ? Promise.race([Promise.all(['400 40px "Pacifico"', '400 40px "Bebas Neue"', '700 30px "Cinzel"', '800 30px "Inter"', '300 30px "Inter"'].map((f) => document.fonts.load(f))).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve());
// a pictogram on the left of each sign
const SHOP_ICON = {
  'BARBER': 'scissors', 'PIZZA': 'pizza', 'TRATTORIA': 'pizza', 'PLOV HOUSE': 'plov', 'SAMSA': 'samsa', 'CHOYXONA': 'teapot', 'TEA HOUSE': 'teapot',
  'KEBAB': 'skewer', 'BBQ': 'skewer', 'BURGERS': 'burger', 'NOODLES': 'bowl', 'RAMEN': 'bowl', 'SUSHI BAR': 'sushi', 'TACOS': 'taco',
  'DONUTS': 'donut', 'ICE CREAM': 'cone', 'COFFEE': 'cup', 'CAFE': 'cup', 'BAKERY': 'bread', 'FLOWERS': 'flower', 'BOOKS': 'book', 'LIBRARY': 'book',
  'GYM': 'dumbbell', 'LAUNDRY': 'washer', 'TIRES': 'tire', 'PARTS': 'wrench', 'BODY SHOP': 'wrench', 'GARAGE': 'wrench', 'CAR WASH': 'car',
  'CINEMA': 'film', 'THEATER': 'masks', 'BOWLING': 'pin', 'KARAOKE': 'mic', 'ARCADE': 'joystick', 'SEAFOOD': 'fish', 'SURF SHOP': 'board',
  'ELECTRONICS': 'bolt', 'FASHION': 'hanger', 'SUPERMARKET': 'cart', 'MARKET': 'cart', 'HOTEL': 'bed', 'MOTEL': 'bed', 'FUEL': 'pump',
  'MUSEUM': 'temple', 'BANK': 'temple', 'GALLERY': 'frame', 'STEAK HOUSE': 'steak', 'RESTAURANT': 'cutlery', 'BISTRO': 'cutlery', 'DINER': 'cutlery',
  'BAR & GRILL': 'glass', 'ROOFTOP BAR': 'glass', 'CLUB': 'disco', 'NEON NIGHTS': 'glass', 'JAZZ CLUB': 'note', 'VIDEO': 'tape', 'RECORDS': 'vinyl',
  'PERFORMANCE SHOP': 'gear', 'TUNER HAVEN': 'gear', 'TATTOO': 'heart', 'PHARMACY': 'cross', 'PARKING': 'parking', 'MARINA': 'anchor', 'MALL': 'bag'
};
export const SIGN_KIND = SHOP_SIGNS.map((n) => (SHOP_STYLE[n] || ['paint'])[0]);
// rooftop billboards: an ad campaign each, most of them printed and floodlit, two of them neon
export const BILLBOARDS = [
  ['MIDNIGHT FM', '104.2 · NIGHT DRIVE RADIO', 'box'], ['NEON NOODLE', 'OPEN ALL NIGHT', 'neon'], ['RAVEN RS', 'GARAGE · TUNE YOUR RIDE', 'neon'],
  ['PIXEL ARCADE', 'INSERT COIN', 'box'], ['LUMEN COFFEE', 'STAY AWAKE', 'paint'], ['NIGHT OWL DINER', '24 / 7', 'box'],
  ['BLUE MOTH HOTEL', 'VACANCY', 'paint'], ['HARBOR LIGHTS', 'SEAFOOD · LIVE MUSIC', 'paint']
];
export function signAtlas() {
  const c = mkCanvas(1024, 2048), g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // write text no wider than w, shrinking the font if needed; opts: letter spacing, stroke, glow
  const text = (t, cx, cy, w, size, font, fill, o = {}) => {
    if (font === SCRIPT) t = t.toLowerCase().replace(/(^|[\s&·])([a-z])/g, (m, a, b) => a + b.toUpperCase()); // script lettering reads in Title Case
    let sz = size; const setF = () => { g.font = `${o.italic ? 'italic ' : ''}${o.weight || 700} ${sz}px ${font}`; }; setF();
    const sp = o.spacing || 0, width = () => g.measureText(t).width + sp * (t.length - 1);
    while (width() > w && sz > 8) { sz -= 1; setF(); }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 10; }
    const draw = (fx) => {
      if (!sp) { fx(t, cx, cy); return; }
      let x = cx - width() / 2; g.textAlign = 'left';
      for (const ch of t) { fx(ch, x, cy); x += g.measureText(ch).width + sp; }
      g.textAlign = 'center';
    };
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.sw || 3; g.lineJoin = 'round'; draw((s, x, y) => g.strokeText(s, x, y)); }
    g.fillStyle = fill; draw((s, x, y) => g.fillText(s, x, y));
    g.shadowBlur = 0;
  };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const vgrad = (x, y, h, a, b) => { const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

  // ---- pictograms: drawn in a 48 px box around (0, 0); neon signs get glowing outlines instead of fills ----
  let bgCol = '#000000';
  const ICON = (kind, cx, cy, c1, c2, neon) => {
    g.save(); g.translate(cx, cy);
    const F = (col = c1) => { if (neon) { g.strokeStyle = col; g.lineWidth = 2.6; g.shadowColor = col; g.shadowBlur = 8; g.stroke(); } else { g.fillStyle = col; g.fill(); } };
    const S = (col = c1, w = 3) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; if (neon) { g.shadowColor = col; g.shadowBlur = 8; } g.stroke(); };
    const P = () => g.beginPath(), C = (x, y, r, a0 = 0, a1 = Math.PI * 2) => { g.arc(x, y, r, a0, a1); }, E = (x, y, rx, ry) => g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    switch (kind) {
      case 'scissors': P(); C(-9, 13, 7); F(); P(); C(9, 13, 7); F(); if (!neon) { g.fillStyle = 'rgba(0,0,0,0)'; } P(); g.moveTo(-6, 7); g.lineTo(9, -20); S(c1, 4); P(); g.moveTo(6, 7); g.lineTo(-9, -20); S(c1, 4); P(); C(0, -1, 2.2); F(c2); break;
      case 'pizza': P(); g.moveTo(-18, -14); g.quadraticCurveTo(0, -22, 18, -14); g.lineTo(0, 20); g.closePath(); F('#f2b632'); P(); g.moveTo(-18, -14); g.quadraticCurveTo(0, -22, 18, -14); S('#b5651d', 5); for (const [px, py] of [[-6, -8], [6, -6], [0, 4]]) { P(); C(px, py, 3.6); F('#c0392b'); } break;
      case 'plov': P(); E(0, 10, 22, 7); F(c2); P(); g.moveTo(-17, 8); g.quadraticCurveTo(0, -24, 17, 8); g.closePath(); F('#f0c060'); for (const [px, py] of [[-8, 0], [0, -6], [7, -1], [-2, 4], [4, 4]]) { P(); g.rect(px - 2, py - 1, 5, 2.2); F('#e8742a'); } for (const [px, py] of [[-4, -3], [5, 2]]) { P(); C(px, py, 2.6); F('#7a3b1e'); } break;
      case 'samsa': P(); g.moveTo(0, -18); g.lineTo(20, 15); g.lineTo(-20, 15); g.closePath(); F('#d9952e'); for (const [px, py] of [[0, -4], [-6, 6], [6, 6], [0, 9], [-3, 1], [3, 1]]) { P(); E(px, py, 1.2, 0.8); F('#fff3d6'); } break;
      case 'teapot': P(); E(0, 4, 14, 12); F(); P(); g.moveTo(12, 2); g.quadraticCurveTo(24, -2, 22, -12); S(c1, 4); P(); g.moveTo(-13, -2); g.quadraticCurveTo(-24, 2, -13, 12); S(c1, 3); P(); E(0, -9, 7, 3); F(c2); P(); C(0, -13, 2.4); F(c2); for (let k = -1; k <= 1; k++) { P(); C(k * 6, 4, 1.8); F(c2); } break;
      case 'skewer': P(); g.moveTo(-22, 16); g.lineTo(22, -16); S('#9a9a9a', 2.5); [[-12, 9, '#8a3b1e'], [-3, 2, '#e8742a'], [6, -4, '#8a3b1e'], [14, -10, '#5e8c4a']].forEach(([px, py, col]) => { P(); g.rect(px - 5, py - 5, 10, 10); F(col); }); break;
      case 'burger': P(); g.moveTo(-18, -2); g.quadraticCurveTo(0, -22, 18, -2); g.closePath(); F('#e0a040'); P(); g.rect(-19, 0, 38, 4); F('#5e8c4a'); P(); g.rect(-18, 4, 36, 6); F('#5a2e16'); P(); g.moveTo(-18, 11); g.lineTo(18, 11); g.quadraticCurveTo(18, 18, 0, 18); g.quadraticCurveTo(-18, 18, -18, 11); F('#e0a040'); break;
      case 'bowl': P(); g.moveTo(-20, -2); g.lineTo(20, -2); g.quadraticCurveTo(18, 18, 0, 18); g.quadraticCurveTo(-18, 18, -20, -2); F(); P(); g.moveTo(-4, -4); g.lineTo(10, -22); g.moveTo(2, -4); g.lineTo(16, -20); S(c2, 2.5); break;
      case 'sushi': P(); C(0, 0, 18); F('#1b1b1b'); P(); C(0, 0, 14); F('#ffffff'); P(); C(0, 0, 7); F('#ff7a5a'); break;
      case 'taco': P(); g.moveTo(-20, 12); g.quadraticCurveTo(0, -24, 20, 12); g.closePath(); F('#f2c14e'); P(); g.moveTo(-14, 6); g.quadraticCurveTo(-6, -8, 0, -6); g.quadraticCurveTo(8, -10, 14, 6); S('#5e8c4a', 4); P(); C(-4, 0, 2.5); F('#c0392b'); P(); C(5, 1, 2.5); F('#c0392b'); break;
      case 'donut': P(); C(0, 0, 19); F('#d9a066'); P(); C(0, 0, 15); F(c1); P(); C(0, 0, 6); F(c2 === c1 ? '#ffffff' : c2); g.fillStyle = '#ffffff'; for (let k = 0; k < 8; k++) { const a = k * 0.8; P(); g.rect(Math.cos(a) * 11 - 1.5, Math.sin(a) * 11 - 0.6, 3, 1.2); F(['#2ee6d6', '#ffe066', '#ffffff', '#9b5cff'][k % 4]); } break;
      case 'cone': P(); g.moveTo(-10, 0); g.lineTo(10, 0); g.lineTo(0, 22); g.closePath(); F('#d9a066'); P(); C(-5, -5, 8); F('#ff8fc7'); P(); C(5, -6, 8); F('#bff0e6'); P(); C(0, -14, 7); F('#7a3b1e'); break;
      case 'cup': P(); g.moveTo(-14, -6); g.lineTo(12, -6); g.lineTo(9, 16); g.lineTo(-11, 16); g.closePath(); F(); P(); C(14, 4, 6, -1.3, 1.3); S(c1, 3); for (const sx of [-6, 0, 6]) { P(); g.moveTo(sx, -9); g.bezierCurveTo(sx - 4, -14, sx + 4, -17, sx, -22); S(c2, 2); } break;
      case 'bread': P(); g.moveTo(-20, 8); g.quadraticCurveTo(0, -26, 20, 8); g.quadraticCurveTo(0, 0, -20, 8); F('#d9952e'); for (const sx of [-8, 0, 8]) { P(); g.moveTo(sx - 3, -4); g.lineTo(sx + 3, 4); S('#8a4b14', 2); } break;
      case 'flower': for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; P(); E(Math.cos(a) * 9, Math.sin(a) * 9 - 4, 7, 7); F(c1); } P(); C(0, -4, 5); F('#f2c14e'); P(); g.moveTo(0, 6); g.lineTo(0, 22); S(c2, 3); break;
      case 'book': P(); g.moveTo(0, -12); g.quadraticCurveTo(-12, -18, -22, -14); g.lineTo(-22, 14); g.quadraticCurveTo(-12, 10, 0, 16); g.quadraticCurveTo(12, 10, 22, 14); g.lineTo(22, -14); g.quadraticCurveTo(12, -18, 0, -12); g.closePath(); F(); P(); g.moveTo(0, -12); g.lineTo(0, 16); S(c2 === c1 ? '#000000' : c2, 2); break;
      case 'dumbbell': P(); g.rect(-14, -2, 28, 4); F(); for (const sx of [-18, 14]) { P(); g.rect(sx, -12, 5, 24); F(); } for (const sx of [-23, 19]) { P(); g.rect(sx, -8, 4, 16); F(); } break;
      case 'washer': P(); g.rect(-17, -20, 34, 40); F(); P(); C(0, 4, 11); F(c2 === c1 ? '#ffffff' : c2); P(); C(0, 4, 7); F(c1); for (const sx of [-11, -5]) { P(); C(sx, -14, 2); F('#ffffff'); } break;
      case 'tire': P(); C(0, 0, 20); F('#111111'); P(); C(0, 0, 10); F('#9a9a9a'); P(); C(0, 0, 4); F('#111111'); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; P(); g.rect(Math.cos(a) * 17 - 1.5, Math.sin(a) * 17 - 1.5, 3, 3); F('#444444'); } break;
      case 'wrench': // an open-end spanner: handle, round head, and a jaw cut back to the sign's own colour
        g.rotate(-Math.PI / 4); P(); g.rect(-3.5, -10, 7, 30); F(); P(); C(0, -14, 10); F(); P(); C(0, 18, 5); F();
        P(); g.moveTo(-4.5, -26); g.lineTo(-4.5, -14); g.lineTo(4.5, -14); g.lineTo(4.5, -26); g.closePath(); if (neon) S(c1, 2); else { g.fillStyle = bgCol; g.fill(); } break;
      case 'car': P(); g.moveTo(-22, 8); g.lineTo(-20, 0); g.lineTo(-10, -2); g.lineTo(-4, -10); g.lineTo(10, -10); g.lineTo(16, -2); g.lineTo(22, 0); g.lineTo(22, 8); g.closePath(); F(); for (const sx of [-12, 12]) { P(); C(sx, 9, 5); F('#1b1b1b'); } for (const [dx, dy] of [[-12, -20], [0, -22], [12, -20]]) { P(); g.moveTo(dx, dy - 4); g.quadraticCurveTo(dx + 3, dy + 1, dx, dy + 2); g.quadraticCurveTo(dx - 3, dy + 1, dx, dy - 4); F(c2); } break;
      case 'film': P(); C(0, 0, 19); F(); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - 1.57; P(); C(Math.cos(a) * 10, Math.sin(a) * 10, 4.5); F(c2 === c1 ? '#000000' : c2); } P(); C(0, 0, 3); F(c2 === c1 ? '#000000' : c2); break;
      case 'masks': for (const [sx, rot, smile] of [[-8, -0.25, 1], [9, 0.25, -1]]) { g.save(); g.translate(sx, 0); g.rotate(rot); P(); E(0, 0, 11, 15); F(smile > 0 ? c1 : c2); P(); E(-4, -4, 2.4, 1.6); E(4, -4, 2.4, 1.6); F('#000000'); P(); g.arc(0, smile > 0 ? 3 : 9, 5, smile > 0 ? 0.2 : Math.PI + 0.2, smile > 0 ? Math.PI - 0.2 : -0.2); S('#000000', 2); g.restore(); } break;
      case 'pin': P(); g.moveTo(-3, -20); g.quadraticCurveTo(-9, -12, -3, -4); g.quadraticCurveTo(-11, 8, -6, 20); g.lineTo(6, 20); g.quadraticCurveTo(11, 8, 3, -4); g.quadraticCurveTo(9, -12, 3, -20); g.closePath(); F(); P(); C(14, 12, 8); F(c2); break;
      case 'mic': P(); E(0, -10, 8, 10); F(); P(); g.moveTo(-12, -4); g.quadraticCurveTo(-12, 10, 0, 10); g.quadraticCurveTo(12, 10, 12, -4); S(c2, 3); P(); g.moveTo(0, 10); g.lineTo(0, 20); g.moveTo(-7, 20); g.lineTo(7, 20); S(c2, 3); break;
      case 'joystick': P(); g.rect(-18, 8, 36, 10); F(c2); P(); g.moveTo(0, 8); g.lineTo(0, -8); S(c1, 4); P(); C(0, -12, 7); F(); P(); C(10, 4, 3); F(c1); break;
      case 'fish': P(); g.moveTo(-18, 0); g.quadraticCurveTo(0, -14, 14, 0); g.quadraticCurveTo(0, 14, -18, 0); F(); P(); g.moveTo(12, 0); g.lineTo(22, -9); g.lineTo(22, 9); g.closePath(); F(); P(); C(-10, -2, 2); F(c2 === c1 ? '#000000' : c2); break;
      case 'board': g.rotate(-0.6); P(); E(0, 0, 7, 22); F(); P(); g.moveTo(0, -20); g.lineTo(0, 20); S(c2, 2); break;
      case 'bolt': P(); g.moveTo(4, -22); g.lineTo(-12, 3); g.lineTo(-1, 3); g.lineTo(-5, 22); g.lineTo(12, -4); g.lineTo(1, -4); g.closePath(); F(c2); break;
      case 'hanger': P(); g.moveTo(0, -8); g.lineTo(-20, 10); g.lineTo(20, 10); g.closePath(); S(c1, 3); P(); g.moveTo(0, -8); g.lineTo(0, -12); g.arc(4, -15, 4, Math.PI, 0.6 * Math.PI, false); S(c1, 3); break;
      case 'cart': P(); g.moveTo(-22, -14); g.lineTo(-14, -14); g.lineTo(-8, 8); g.lineTo(16, 8); g.lineTo(20, -8); g.lineTo(-11, -8); S(c1, 3); for (const sx of [-6, 13]) { P(); C(sx, 15, 3.5); F(); } break;
      case 'bed': P(); g.rect(-22, -2, 44, 10); F(); P(); g.rect(-22, -14, 5, 28); F(); P(); g.rect(-15, -9, 10, 7); F(c2); P(); g.rect(-22, 8, 4, 6); g.rect(18, 8, 4, 6); F(); break;
      case 'pump': P(); g.rect(-14, -18, 20, 36); F(); P(); g.rect(-10, -14, 12, 9); F(c2 === c1 ? '#ffffff' : c2); P(); g.moveTo(6, -10); g.lineTo(14, -6); g.lineTo(14, 12); S(c1, 3); break;
      case 'temple': P(); g.moveTo(-22, -10); g.lineTo(0, -21); g.lineTo(22, -10); g.closePath(); F(); P(); g.rect(-22, -9, 44, 3); F(); for (let k = 0; k < 4; k++) { P(); g.rect(-18 + k * 11, -5, 5, 20); F(); } P(); g.rect(-23, 15, 46, 4); F(); break;
      case 'frame': P(); g.rect(-20, -16, 40, 32); F(); P(); g.rect(-15, -11, 30, 22); F(c2 === c1 ? '#f5f5f2' : c2); P(); g.moveTo(-15, 11); g.lineTo(-4, -2); g.lineTo(3, 5); g.lineTo(8, 0); g.lineTo(15, 11); g.closePath(); F(c1); P(); C(8, -5, 3); F(c1); break;
      case 'steak': P(); g.moveTo(-18, -6); g.quadraticCurveTo(-10, -20, 8, -16); g.quadraticCurveTo(24, -10, 18, 6); g.quadraticCurveTo(10, 20, -8, 14); g.quadraticCurveTo(-24, 8, -18, -6); F('#8a2b1e'); P(); g.moveTo(-6, -8); g.lineTo(-6, 10); g.moveTo(-6, 0); g.lineTo(10, 0); S('#f3e3c3', 3); break;
      case 'cutlery': P(); g.moveTo(-8, -20); g.lineTo(-8, 20); S(c1, 3); for (const fx of [-13, -3]) { P(); g.moveTo(fx, -20); g.lineTo(fx, -8); S(c1, 2); } P(); g.moveTo(-13, -8); g.quadraticCurveTo(-8, -2, -3, -8); S(c1, 2); P(); g.moveTo(8, 20); g.lineTo(8, -20); g.quadraticCurveTo(16, -10, 8, 2); S(c1, 3); break;
      case 'glass': P(); g.moveTo(-14, -16); g.lineTo(14, -16); g.lineTo(0, 2); g.closePath(); F(); P(); g.moveTo(0, 2); g.lineTo(0, 16); g.moveTo(-8, 16); g.lineTo(8, 16); S(c1, 3); P(); C(8, -16, 4); F(c2); break;
      case 'disco': P(); C(0, 2, 16); F(); g.strokeStyle = c2; g.lineWidth = 1; for (let k = -12; k <= 12; k += 6) { P(); g.moveTo(-16, 2 + k); g.lineTo(16, 2 + k); S(c2, 1); P(); g.moveTo(k, -14); g.lineTo(k, 18); S(c2, 1); } P(); g.moveTo(0, -14); g.lineTo(0, -22); S(c1, 2); break;
      case 'note': P(); E(-8, 12, 7, 5); F(); P(); E(12, 8, 7, 5); F(); P(); g.moveTo(-2, 12); g.lineTo(-2, -16); g.lineTo(18, -20); g.lineTo(18, 8); S(c1, 3); break;
      case 'tape': P(); g.rect(-22, -13, 44, 26); F(); for (const sx of [-9, 9]) { P(); C(sx, -1, 5); F(c2); } P(); g.rect(-12, 6, 24, 4); F(c2); break;
      case 'vinyl': P(); C(0, 0, 20); F('#111111'); P(); C(0, 0, 7); F(c2); P(); C(0, 0, 2); F('#111111'); for (const r of [11, 15, 18]) { P(); C(0, 0, r); S('#333333', 1); } break;
      case 'gear': P(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k % 2 ? 14 : 20; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); F(); P(); C(0, 0, 6); F(c2 === c1 ? '#000000' : c2); break;
      case 'heart': P(); g.moveTo(0, 16); g.bezierCurveTo(-26, -2, -12, -24, 0, -10); g.bezierCurveTo(12, -24, 26, -2, 0, 16); F(); P(); g.rect(-20, -2, 40, 8); F(c2); break;
      case 'cross': P(); g.rect(-6, -18, 12, 36); g.rect(-18, -6, 36, 12); F(); break;
      case 'parking': P(); g.rect(-20, -20, 40, 40); F('#ffffff'); P(); g.rect(-16, -16, 32, 32); F(c2 === '#ffffff' ? '#1f5fbf' : c2); g.fillStyle = '#ffffff'; g.font = `900 30px ${SANS}`; g.fillText('P', 0, 2); break;
      case 'anchor': P(); g.moveTo(0, -16); g.lineTo(0, 16); g.moveTo(-10, -8); g.lineTo(10, -8); g.moveTo(-14, 4); g.quadraticCurveTo(0, 26, 14, 4); S(c1, 3.5); P(); C(0, -19, 4); S(c1, 3); break;
      case 'bag': P(); g.rect(-16, -8, 32, 26); F(); P(); g.arc(0, -8, 8, Math.PI, 0); S(c1, 3); break;
    }
    g.restore();
  };

  // ---- 64 shop signs, 256 x 64 each ----
  const shop = (name, x, y) => {
    const [kind, st, bg, ink, ac] = SHOP_STYLE[name] || ['paint', 'serif', '#333333', '#ffffff', '#ffffff'];
    const W = 256, H = 64, cy = y + H / 2, IC = SHOP_ICON[name], cx = x + W / 2 + (IC ? 22 : 0);
    // the text helper, with room left for the pictogram
    const T = (t, tx, ty, w, ...rest) => text(t, tx, ty, w - (IC ? 44 : 0), ...rest);
    g.save(); g.beginPath(); g.rect(x, y, W, H); g.clip();
    g.fillStyle = bg; g.fillRect(x, y, W, H);
    switch (st) {
      case 'neon': case 'neonScript': {
        g.fillStyle = '#0b0b12'; g.fillRect(x, y, W, H);
        g.strokeStyle = ac; g.lineWidth = 2; g.shadowColor = ac; g.shadowBlur = 8; rr(x + 6, y + 6, W - 12, H - 12, 10); g.stroke(); g.shadowBlur = 0;
        const scr = st === 'neonScript';
        T(name, cx, cy + 1, W - 30, scr ? 40 : 32, scr ? SCRIPT : DISPLAY, '#ffffff', { glow: ink, blur: 14, stroke: ink, sw: 5, italic: !scr, weight: scr ? 400 : 700 });
        break;
      }
      case 'pixel': {
        g.fillStyle = '#0b0b12'; g.fillRect(x, y, W, H);
        for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? ink : ac; g.fillRect(x + 6 + i * 15.5, y + 4, 8, 4); g.fillRect(x + 6 + i * 15.5, y + H - 8, 8, 4); }
        T(name, cx, cy, W - 24, 34, MONO, ac, { glow: ac, blur: 10, weight: 700, spacing: 4 });
        break;
      }
      case 'race': {
        for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) { g.fillStyle = '#ffffff'; if (!IC) g.fillRect(x + i * 6, y + j * 16, 6, 16); g.fillRect(x + W - 48 + i * 6, y + j * 16, 6, 16); }
        g.fillStyle = ac; g.beginPath(); g.moveTo(x + 52, y + H - 10); g.lineTo(x + W - 40, y + H - 10); g.lineTo(x + W - 46, y + H - 4); g.lineTo(x + 46, y + H - 4); g.fill();
        T(name, cx - (IC ? 14 : 0), cy - 3, W - (IC ? 70 : 110), 30, DISPLAY, ink, { italic: true });
        break;
      }
      case 'bold': {
        g.fillStyle = ac; g.fillRect(x, y + H - 8, W, 8); g.fillRect(x, y, W, 4);
        T(name, cx, cy - 1, W - 22, 40, BLOCK, ink, { weight: 400, spacing: 1, stroke: shade(bg, 0.55), sw: 4 });
        break;
      }
      case 'round': {
        g.fillStyle = ac; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + 14 + i * 29, y + 2, 12, 0, Math.PI); g.fill(); }
        T(name, cx, cy + 5, W - 30, 36, SANS, ink, { weight: 800, stroke: '#ffffff', sw: 6 });
        break;
      }
      case 'asia': {
        g.fillStyle = ac; g.fillRect(x, y, 10, H); g.fillRect(x + W - 10, y, 10, H);
        T(name, cx, cy, W - 40, 34, SERIF, ink, { weight: 700, spacing: 3 });
        break;
      }
      case 'italy': {
        const st3 = ['#009246', '#ffffff', '#ce2b37']; for (let i = 0; i < 3; i++) { g.fillStyle = st3[i]; g.fillRect(x + i * W / 3, y + H - 9, W / 3, 9); }
        T(name, cx, cy - 4, W - 30, 36, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'tattoo': {
        g.strokeStyle = ac; g.lineWidth = 2; g.strokeRect(x + 5, y + 5, W - 10, H - 10); g.strokeRect(x + 9, y + 9, W - 18, H - 18);
        T(name, cx, cy + 2, W - 40, 38, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'stencil': {
        for (const sx of [x, x + W - 34]) for (let i = -2; i < 6; i++) { g.fillStyle = i % 2 ? ink : bg; g.beginPath(); g.moveTo(sx + i * 12, y + H); g.lineTo(sx + i * 12 + 12, y + H); g.lineTo(sx + i * 12 + 12 + H * 0.5, y); g.lineTo(sx + i * 12 + H * 0.5, y); g.fill(); }
        g.fillStyle = bg; g.fillRect(x + 36, y, W - 72, H);
        T(name, cx, cy + 1, W - 84, 40, BLOCK, ink, { weight: 400, spacing: 2 });
        break;
      }
      case 'enamel': {
        g.fillStyle = ac; rr(x + 4, y + 4, W - 8, H - 8, 12); g.fill(); g.fillStyle = bg; rr(x + 8, y + 8, W - 16, H - 16, 9); g.fill();
        for (const sx of [x + 16, x + W - 16]) { g.fillStyle = ac; g.beginPath(); g.arc(sx, cy, 3, 0, 7); g.fill(); }
        T(name, cx, cy + 1, W - 50, 32, SANS, ink, { weight: 800, spacing: 4 });
        break;
      }
      case 'wave': {
        g.fillStyle = ac; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x, y + H); for (let i = 0; i <= W; i += 8) g.lineTo(x + i, y + H - 10 - k * 7 + Math.sin(i / 14 + k) * 4); g.lineTo(x + W, y + H); g.fill(); g.globalAlpha = 0.6; }
        g.globalAlpha = 1;
        T(name, cx, cy - 6, W - 26, 34, SANS, ink, { weight: 800, italic: true });
        break;
      }
      case 'chalk': {
        g.strokeStyle = '#8a6a44'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, W - 6, H - 6);
        g.globalAlpha = 0.08; g.fillStyle = '#ffffff'; for (let i = 0; i < 60; i++) g.fillRect(x + Math.random() * W, y + Math.random() * H, 6, 1); g.globalAlpha = 1;
        T(name, cx, cy + 2, W - 40, 40, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'wood': {
        for (let i = 0; i < 4; i++) { g.fillStyle = shade(bg, 0.85 + (i % 2) * 0.2); g.fillRect(x, y + i * 16, W, 15); }
        g.strokeStyle = shade(bg, 0.6); g.lineWidth = 4; g.strokeRect(x + 2, y + 2, W - 4, H - 4);
        T(name, cx, cy + 1, W - 30, 34, SERIF, ink, { weight: 700, spacing: 2, stroke: shade(bg, 0.5), sw: 3 });
        break;
      }
      case 'script': {
        g.strokeStyle = ac; g.lineWidth = 2; rr(x + 6, y + 6, W - 12, H - 12, 18); g.stroke();
        T(name, cx, cy + 2, W - 40, 42, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'serif': {
        g.strokeStyle = ac; g.lineWidth = 1.5; g.strokeRect(x + 6, y + 6, W - 12, H - 12);
        T(name, cx, cy + 1, W - 40, 32, SERIF, ink, { weight: 400, spacing: 6 });
        break;
      }
      case 'retro': {
        T(name, cx, cy + 1, W - 30, 36, BLOCK, ink, { weight: 400, italic: true, spacing: 1, glow: st === 'retro' && bg === '#07070d' ? ink : null, blur: 10 });
        break;
      }
      case 'marquee': {
        g.fillStyle = vgrad(x, y, H, shade(bg, 1.4), bg); g.fillRect(x, y, W, H);
        for (let i = 0; i < 20; i++) for (const yy of [y + 5, y + H - 5]) { g.fillStyle = ac; g.shadowColor = ac; g.shadowBlur = 4; g.beginPath(); g.arc(x + 8 + i * 12.6, yy, 2.6, 0, 7); g.fill(); }
        g.shadowBlur = 0;
        T(name, cx, cy + 1, W - 30, 34, DISPLAY, ink, { weight: 700, spacing: 5 });
        break;
      }
      case 'luxe': {
        g.strokeStyle = ac; g.lineWidth = 1; g.strokeRect(x + 5, y + 5, W - 10, H - 10); g.strokeRect(x + 9, y + 9, W - 18, H - 18);
        if (name === 'HOTEL') for (let i = 0; i < 5; i++) { const sx = cx - 28 + i * 14; g.fillStyle = ac; g.font = `12px ${SERIF}`; g.fillText('★', sx, y + 17); }
        T(name, cx, cy + (name === 'HOTEL' ? 7 : 1), W - 46, 30, SERIF, ink, { weight: 400, spacing: 7 });
        break;
      }
      case 'stone': {
        g.fillStyle = vgrad(x, y, H, shade(bg, 1.08), shade(bg, 0.86)); g.fillRect(x, y, W, H);
        g.strokeStyle = shade(bg, 0.7); g.lineWidth = 2; g.strokeRect(x + 4, y + 4, W - 8, H - 8);
        T(name, cx + 1, cy + 2, W - 36, 30, SERIF, 'rgba(255,255,255,0.55)', { weight: 400, spacing: 8 });
        T(name, cx, cy + 1, W - 36, 30, SERIF, ink, { weight: 400, spacing: 8 });
        break;
      }
      case 'greek': {
        // marble slab, a Greek key band above and below, carved Roman capitals
        g.fillStyle = vgrad(x, y, H, '#dcd8cf', '#b4afa4'); g.fillRect(x, y, W, H);
        g.strokeStyle = ink; g.lineWidth = 1.6;
        for (const yy of [y + 3, y + H - 11]) { g.beginPath(); for (let k = 0; k < 32; k++) { const kx = x + k * 8; g.moveTo(kx, yy + 8); g.lineTo(kx, yy); g.lineTo(kx + 6, yy); g.lineTo(kx + 6, yy + 5); g.lineTo(kx + 3, yy + 5); g.lineTo(kx + 3, yy + 3); } g.stroke(); }
        T(name, cx + 1, cy + 2, W - 30, 30, ROMAN, 'rgba(255,255,255,0.6)', { weight: 700, spacing: 7 });
        T(name, cx, cy + 1, W - 30, 30, ROMAN, ink, { weight: 700, spacing: 7 });
        break;
      }
      case 'minimal': {
        T(name, cx, cy + 1, W - 40, 28, SERIF, ink, { weight: 400, spacing: 10 });
        g.fillStyle = ink; g.fillRect(cx - 30, y + H - 12, 60, 1.5);
        break;
      }
      case 'uzbek': {
        // a tiled border of eight-point stars and diamonds, like the girih on a choyxona facade
        g.fillStyle = ac; g.fillRect(x, y, W, 11); g.fillRect(x, y + H - 11, W, 11);
        for (let i = 0; i < 18; i++) for (const yy of [y + 5.5, y + H - 5.5]) {
          const sx = x + 7 + i * 14.4; g.fillStyle = bg; g.beginPath(); g.moveTo(sx, yy - 4.5); g.lineTo(sx + 4.5, yy); g.lineTo(sx, yy + 4.5); g.lineTo(sx - 4.5, yy); g.fill();
          g.fillStyle = '#ffffff'; g.fillRect(sx - 1, yy - 1, 2, 2);
        }
        for (const sx of IC ? [x + W - 18] : [x + 18, x + W - 18]) { g.save(); g.translate(sx, cy); g.fillStyle = ac; for (let k = 0; k < 2; k++) { g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); } g.restore(); g.fillStyle = bg; g.beginPath(); g.arc(sx, cy, 3, 0, 7); g.fill(); }
        T(name, cx, cy + 1, W - 70, 28, SERIF, ink, { weight: 700, spacing: 3 });
        break;
      }
      case 'flame': {
        for (let i = 0; i < 16; i++) { const fx = x + i * 16 + 8, fh = 10 + ((i * 7) % 5) * 3; g.fillStyle = i % 2 ? ac : '#ffb02e'; g.beginPath(); g.moveTo(fx - 8, y + H); g.quadraticCurveTo(fx - 6, y + H - fh * 0.6, fx, y + H - fh); g.quadraticCurveTo(fx + 6, y + H - fh * 0.6, fx + 8, y + H); g.fill(); }
        T(name, cx, cy - 6, W - 30, 36, BLOCK, ink, { weight: 400, spacing: 2, stroke: '#000000', sw: 4 });
        break;
      }
      case 'cross': {
        g.fillStyle = ac; g.fillRect(x, y + H - 5, W, 5);
        T(name, cx, cy, W - 30, 32, SANS, ink, { weight: 800, spacing: 2 });
        break;
      }
      case 'awning': {
        for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : ac; g.fillRect(x + i * 16, y, 16, 16); g.beginPath(); g.arc(x + i * 16 + 8, y + 16, 8, 0, Math.PI); g.fill(); }
        T(name, cx, cy + 12, W - 40, 30, SERIF, ink, { weight: 700, spacing: 5 });
        break;
      }
      case 'clean': {
        g.fillStyle = ac; g.fillRect(x, y, 8, H);
        T(name, cx + 4, cy + 1, W - 40, 34, SANS, ink, { weight: 300, spacing: 6 });
        break;
      }
      case 'tech': {
        g.strokeStyle = ac; g.lineWidth = 1.5; if (!IC) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x, y + 10 + i * 11); g.lineTo(x + 18 + i * 4, y + 10 + i * 11); g.lineTo(x + 24 + i * 4, y + 4 + i * 11); g.stroke(); }
        T(name, cx, cy + 1, W - 40, 32, DISPLAY, ink, { weight: 700, spacing: 3 });
        g.fillStyle = ac; g.fillRect(x + 60, y + H - 9, W - 80, 3);
        break;
      }
      case 'barber': {
        // the striped pole on the right, scissors on the left
        g.save(); g.beginPath(); rr(x + W - 28, y + 8, 18, H - 16, 8); g.clip();
        g.fillStyle = '#ffffff'; g.fillRect(x + W - 28, y, 18, H);
        for (let i = -4; i < 8; i++) { g.fillStyle = i % 2 ? '#c8102e' : '#1d4ea8'; g.beginPath(); g.moveTo(x + W - 28, y + i * 10); g.lineTo(x + W - 10, y + i * 10 - 10); g.lineTo(x + W - 10, y + i * 10 - 5); g.lineTo(x + W - 28, y + i * 10 + 5); g.fill(); }
        g.restore();
        T(name, cx - 8, cy + 1, W - 60, 34, SERIF, ink, { weight: 700, spacing: 5 });
        break;
      }
      case 'parking': {
        T(name, cx, cy + 1, W - 30, 28, SANS, ink, { weight: 700, spacing: 3 });
        break;
      }
      case 'fuel': {
        g.fillStyle = ac; g.fillRect(x, y, W, 14); g.fillStyle = ink; g.fillRect(x, y + H - 10, W, 10);
        T(name, cx, cy + 2, W - 30, 34, BLOCK, ink, { weight: 400, spacing: 8 });
        break;
      }
      case 'nautical': {
        g.strokeStyle = ac; g.lineWidth = 3; g.setLineDash([6, 4]); g.strokeRect(x + 6, y + 6, W - 12, H - 12); g.setLineDash([]);
        T(name, cx, cy + 1, W - 40, 32, SERIF, ink, { weight: 700, spacing: 4 });
        break;
      }
      default: T(name, cx, cy, W - 20, 32, SANS, ink, {});
    }
    if (IC) {
      const neon = kind === 'neon', c1 = neon ? ink : (['bowl', 'teapot', 'cup', 'book', 'temple', 'gear', 'tape', 'film', 'mic', 'joystick', 'board', 'bed', 'pump', 'bag', 'frame', 'washer', 'cart', 'hanger', 'dumbbell', 'disco', 'note', 'glass', 'cutlery', 'masks', 'fish', 'heart', 'car', 'wrench', 'anchor', 'scissors', 'cross', 'pin', 'flower', 'donut'].includes(IC) ? (st === 'stencil' || st === 'bold' || st === 'fuel' || st === 'tech' ? ink : ac === bg ? ink : ac) : ink);
      const c2 = neon ? ac : ['scissors', 'bowl', 'teapot', 'plov', 'tape', 'masks', 'mic', 'joystick', 'glass', 'disco', 'heart', 'pin', 'car', 'cup', 'bolt', 'bed', 'pump', 'vinyl', 'flower', 'donut', 'gear'].includes(IC) ? (ink === c1 ? ac : ink) : ink;
      bgCol = st === 'stencil' ? bg : bg;
      ICON(IC, x + (st === 'stencil' ? 52 : st === 'uzbek' ? 26 : 30), cy + (st === 'awning' ? 8 : st === 'uzbek' ? 0 : 0), c1, c2, neon);
    }
    g.restore();
  };
  SHOP_SIGNS.forEach((t, i) => shop(t, (i % 4) * 256, 1024 + (i >> 2) * 64));

  // ---- 8 rooftop billboards, 512 x 256 each ----
  const bb = [
    (x, y) => { // radio: printed sunset gradient, sound waves
      g.fillStyle = vgrad(x, y, 256, '#2b0f4a', '#ff4f8b'); g.fillRect(x, y, 512, 256);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); for (let i = 0; i <= 512; i += 6) g.lineTo(x + i, y + 200 + Math.sin(i / (18 + k * 6) + k) * (6 + k * 5)); g.stroke(); }
      text('MIDNIGHT FM', x + 256, y + 92, 460, 72, DISPLAY, '#ffffff', { italic: true, stroke: '#2b0f4a', sw: 6 });
      text('104.2 · NIGHT DRIVE RADIO', x + 256, y + 158, 420, 28, SANS, '#ffe3f0', { weight: 600, spacing: 2 });
    },
    (x, y) => { // neon noodle: real neon on a dark wall, with a bowl
      g.fillStyle = '#0a0a10'; g.fillRect(x, y, 512, 256);
      g.strokeStyle = '#ffb547'; g.lineWidth = 6; g.shadowColor = '#ffb547'; g.shadowBlur = 16; g.beginPath(); g.arc(x + 90, y + 140, 50, 0, Math.PI); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x + 70, y + 60); g.lineTo(x + 100, y + 128); g.moveTo(x + 88, y + 56); g.lineTo(x + 112, y + 128); g.stroke(); g.shadowBlur = 0;
      text('NEON NOODLE', x + 310, y + 110, 330, 60, SCRIPT, '#ffffff', { weight: 400, glow: '#ff3da8', blur: 18, stroke: '#ff3da8', sw: 6 });
      text('OPEN ALL NIGHT', x + 310, y + 182, 300, 28, DISPLAY, '#ffb547', { glow: '#ffb547', blur: 10, spacing: 3 });
    },
    (x, y) => { // the garage's own neon
      g.fillStyle = '#03141a'; g.fillRect(x, y, 512, 256);
      g.strokeStyle = '#2ee6d6'; g.lineWidth = 5; g.shadowColor = '#2ee6d6'; g.shadowBlur = 16; g.strokeRect(x + 14, y + 14, 484, 228); g.shadowBlur = 0;
      text('RAVEN RS', x + 256, y + 106, 440, 76, DISPLAY, '#ffffff', { italic: true, glow: '#2ee6d6', blur: 20, stroke: '#2ee6d6', sw: 6 });
      text('GARAGE · TUNE YOUR RIDE', x + 256, y + 180, 420, 26, SANS, '#bff8f2', { weight: 600, spacing: 3 });
    },
    (x, y) => { // arcade: printed pixel art
      g.fillStyle = '#1b1040'; g.fillRect(x, y, 512, 256);
      for (let i = 0; i < 64; i++) { g.fillStyle = ['#ff3da8', '#2ee6d6', '#ffe066', '#9b5cff'][i % 4]; g.fillRect(x + (i * 37) % 500, y + 10 + ((i * 53) % 230), 6, 6); }
      const inv = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
      inv.forEach((row, r) => [...row].forEach((v, k) => { if (v === '1') { g.fillStyle = '#3bff8a'; g.fillRect(x + 30 + k * 9, y + 70 + r * 9, 9, 9); } }));
      text('PIXEL ARCADE', x + 330, y + 110, 330, 56, MONO, '#ffe066', { weight: 700, spacing: 2, stroke: '#ff3da8', sw: 4 });
      text('INSERT COIN', x + 330, y + 180, 260, 30, MONO, '#ffffff', { weight: 700, spacing: 6 });
    },
    (x, y) => { // coffee: warm printed poster with a steaming cup
      g.fillStyle = '#f3e3c3'; g.fillRect(x, y, 512, 256); g.fillStyle = '#5a3a22'; g.fillRect(x, y + 216, 512, 40);
      g.fillStyle = '#5a3a22'; g.beginPath(); g.moveTo(x + 50, y + 110); g.lineTo(x + 140, y + 110); g.lineTo(x + 128, y + 196); g.lineTo(x + 62, y + 196); g.fill();
      g.strokeStyle = '#5a3a22'; g.lineWidth = 8; g.beginPath(); g.arc(x + 146, y + 146, 18, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#a07a52'; g.lineWidth = 4; for (const sx of [80, 100, 120]) { g.beginPath(); g.moveTo(x + sx, y + 98); g.bezierCurveTo(x + sx - 10, y + 80, x + sx + 10, y + 70, x + sx, y + 50); g.stroke(); }
      text('LUMEN COFFEE', x + 330, y + 112, 320, 56, SERIF, '#3a2416', { weight: 700 });
      text('STAY AWAKE', x + 330, y + 168, 260, 30, SCRIPT, '#8a5a32', { weight: 400 });
      text('ROASTED IN NEON BAY', x + 256, y + 236, 400, 20, SANS, '#f3e3c3', { weight: 600, spacing: 4 });
    },
    (x, y) => { // 50s diner: checkerboard, red and cream
      g.fillStyle = '#fff4dc'; g.fillRect(x, y, 512, 256);
      for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) { g.fillStyle = '#111111'; g.fillRect(x + i * 16, y + 224 + j * 16, 16, 16); }
      g.fillStyle = '#d62828'; rr(x + 30, y + 40, 452, 120, 60); g.fill();
      text('NIGHT OWL DINER', x + 256, y + 100, 400, 52, SCRIPT, '#fff4dc', { weight: 400, stroke: '#7a0f0f', sw: 4 });
      text('BURGERS · SHAKES · 24 / 7', x + 256, y + 192, 420, 26, SANS, '#d62828', { weight: 800, spacing: 2 });
    },
    (x, y) => { // hotel: art deco print, navy and gold
      g.fillStyle = '#0d1b33'; g.fillRect(x, y, 512, 256);
      g.strokeStyle = '#d9b45a'; g.lineWidth = 2; g.strokeRect(x + 14, y + 14, 484, 228); g.strokeRect(x + 22, y + 22, 468, 212);
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(x + 256, y + 60); g.lineTo(x + 256 + (i - 4) * 22, y + 22); g.stroke(); }
      g.fillStyle = '#d9b45a'; g.beginPath(); g.moveTo(x + 230, y + 70); g.quadraticCurveTo(x + 256, y + 50, x + 256, y + 70); g.quadraticCurveTo(x + 256, y + 50, x + 282, y + 70); g.lineTo(x + 256, y + 82); g.fill();
      text('BLUE MOTH HOTEL', x + 256, y + 132, 420, 46, SERIF, '#f2e3b3', { weight: 400, spacing: 8 });
      text('VACANCY · SINCE 1962', x + 256, y + 192, 320, 22, SERIF, '#d9b45a', { weight: 400, spacing: 5 });
    },
    (x, y) => { // seafood: nautical print, waves, a lighthouse
      g.fillStyle = vgrad(x, y, 256, '#eaf4fb', '#bcdaf0'); g.fillRect(x, y, 512, 256);
      g.fillStyle = '#0f2f4f'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y + 256); for (let i = 0; i <= 512; i += 8) g.lineTo(x + i, y + 216 + k * 12 + Math.sin(i / 20 + k * 2) * 6); g.lineTo(x + 512, y + 256); g.globalAlpha = 0.5 + k * 0.25; g.fill(); }
      g.globalAlpha = 1;
      g.fillStyle = '#ffffff'; g.fillRect(x + 440, y + 80, 26, 130); g.fillStyle = '#e2231a'; for (let k = 0; k < 3; k++) g.fillRect(x + 440, y + 92 + k * 40, 26, 18); g.fillStyle = '#ffd36b'; g.fillRect(x + 436, y + 62, 34, 18);
      text('HARBOR LIGHTS', x + 230, y + 100, 380, 56, SERIF, '#0f2f4f', { weight: 700, spacing: 3 });
      text('SEAFOOD · LIVE MUSIC', x + 230, y + 158, 340, 26, SANS, '#e2231a', { weight: 800, spacing: 3 });
    }
  ];
  bb.forEach((draw, i) => { const x = (i % 2) * 512, y = (i >> 1) * 256; g.save(); g.beginPath(); g.rect(x, y, 512, 256); g.clip(); draw(x, y); g.restore(); });
  const t = canvasTex(c); t.flipY = false; t.anisotropy = 4; return t;
}
