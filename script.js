// Video frames: add data-video-src="<url>" to a .video element and the play
// button will swap the poster for an inline player. Without it the button is inert.
document.querySelectorAll('.video').forEach((frame) => {
  const button = frame.querySelector('.play');
  const src = frame.dataset.videoSrc;
  if (!button || !src) return;

  button.addEventListener('click', () => {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    const poster = frame.querySelector('.video__poster');
    if (poster) video.poster = poster.currentSrc || poster.src;
    frame.replaceChildren(video);
    video.focus();
  });
});

// Viewport width without the scrollbar, for the full-bleed panels (--vw in styles.css).
(() => {
  const setVw = () => document.documentElement.style.setProperty('--vw', `${document.documentElement.clientWidth}px`);
  setVw();
  window.addEventListener('resize', setVw);
})();

// Scroll fade-ins. The `js-reveal` class is set in <head> only when
// IntersectionObserver exists and the visitor hasn't asked for reduced motion.
if (document.documentElement.classList.contains('js-reveal')) {
  const targets = document.querySelectorAll(
    '[data-reveal]:not([data-reveal="children"]), [data-reveal="children"] > *'
  );
  const observer = new IntersectionObserver(
    (entries) => {
      // Elements entering together are staggered, top to bottom.
      entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((entry, i) => {
          entry.target.style.setProperty('--reveal-delay', `${Math.min(i, 6) * 90}ms`);
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
    },
    { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
  );
  targets.forEach((target) => observer.observe(target));

  // Elements at the very end of the page can never cross the trigger line,
  // so reveal whatever is left once the visitor reaches the bottom.
  const revealRest = () => {
    if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 2) return;
    targets.forEach((target) => {
      target.classList.add('is-visible');
      observer.unobserve(target);
    });
    window.removeEventListener('scroll', revealRest);
  };
  window.addEventListener('scroll', revealRest, { passive: true });
  revealRest();
}

// ---------------------------------------------------------------------------
// Section 2: the receipts
// ---------------------------------------------------------------------------
// The paper is meant to look hand-made. Everything the receipts do runs at a
// low frame rate (stop-motion), and once a second every receipt shifts a hair.
// Text, and the card in section 3, stay smooth.
//
//   moment 1   Sarah's receipt unrolls: it feeds upward like a till printer
//              and comes to rest on its claims summary.
//   moment 2   her receipt shrinks into a collage, and other people's
//              receipts deal out around it.
//   leaving    every receipt crumples into a ball and falls out of the panel.
//
// Moment 2 and "leaving" only happen where the panel is pinned (desktop).
// Elsewhere the receipt unrolls when it scrolls into view and the collage is
// a still picture.

// Everything about how the receipts move. Open the page with ?controls in the
// address (for example http://localhost:8080/?controls) for a panel that
// changes these live; its "Copy values" button gives this object back.
const RECEIPT_SETTINGS = {
  fps: 7,              // frames per second of everything the receipts do
  shiftEvery: 1.5,     // seconds between the paper's small shifts
  shiftAmount: 2,      // size of those shifts (1 = up to 0.8px and 0.65 degrees either way)
  creaseFlip: true,    // mirror the paper's creases at random when it shifts
  wobble: 1,           // stop-motion imperfection while receipts move (0 = none)
  unrollSeconds: 4,    // on the roll -> fully out
  moveSeconds: 1,      // moment 1 <-> moment 2
  landShare: 0.6,      // share of that move Sarah's receipt takes to reach the pile
  dealShare: 0.15,     // share each other receipt takes to slide out of the pile
  crumpleAfter: 110,   // px scrolled past moment 2 before the receipts crumple
  stageFrames: 1,      // frames each crumple drawing is held (folded, scrunched, ball)
  staggerFrames: 2,    // receipts start crumpling up to this many frames apart
  gravity: 5800,       // falling balls: px per second, per second
  hop: 2.7,            // the little jump before the fall (1 = 110 to 260 px/s upward)
  drift: 2.6,          // sideways drift (1 = up to 100 px/s either way)
  spin: 2.1,           // tumbling (1 = up to 400 degrees/s either way)
  ballSize: 0.75,      // ball diameter, as a share of the receipt's width
  // The look of the crumpled paper (folded sheet, scrunched sheet and ball):
  ballFacets: 7,       // facets across the ball: more = a finer crumple
  ballRough: 0.24,     // how dented the outline is (0 = smooth)
  ballShading: 1.5,    // contrast between the lit and the shaded facets
  ballSoft: 0.35,      // how rounded the folds are (0 = sharp)
  ballCrease: 0.6,     // strength of the crease lines between facets
  ballPrint: 1,        // how strongly the receipt's print shows (0 = blank paper)
  ballShade: '#857aa3', // colour of the shadows
  ballShadow: 0.16,    // opacity of the shadow under the paper
};

// Other people's receipts. ILLUSTRATIVE, like Sarah's: invented people and
// claims, there to show that she is one of many. They are drawn too small to
// read. Each claim: [date, specialty, reason for visit, services, plan paid].
// `slot` places the receipt in the collage, in px of a 560 × 640 box:
// [centre x, top, width, rotation in degrees, stacking order].
const SARAH_SLOT = [292, 34, 122, 2, 8];
const OTHER_RECEIPTS = [
  {
    name: 'Maria Alvarez', age: 49, id: 'MA730145528', group: '061907', plan: 'Select HMO', planId: 'HMO-26104',
    member: 240, savings: 268.35, slot: [54, 150, 96, -9, 2],
    claims: [
      ['Jan 22', 'Primary care', 'Heart palpitations', 'Visit, ECG', 212.4],
      ['Mar 3', 'Cardiology', 'Palpitations, chest tightness', 'Visit, Holter monitor', 486.75],
      ['Apr 28', 'Behavioral health', 'Panic symptoms', 'Visit', 148],
      ['Jul 14', 'Sleep medicine', 'Insomnia, night sweats', 'Visit, sleep study', 612.3],
      ['Sep 9', 'Primary care', 'Fatigue', 'Follow-up, labs', 131.6],
      ['Nov 5', 'Cardiology', 'Palpitations', 'Follow-up', 174.25],
    ],
  },
  {
    name: 'Denise Carter', age: 52, id: 'DC518304776', group: '112750', plan: 'Choice Plus PPO', planId: 'PPO-26018',
    member: 420, savings: 512.6, slot: [124, 40, 104, 5, 4],
    claims: [
      ['Jan 8', 'Primary care', 'Joint stiffness', 'Visit, labs', 176.9],
      ['Feb 19', 'Rheumatology', 'Joint pain, both hands', 'Visit, antibody panel', 398.2],
      ['Mar 26', 'Orthopedics', 'Frozen shoulder', 'Visit, imaging', 402.15],
      ['May 12', 'Physical therapy', 'Shoulder mobility', 'Course of visits', 588],
      ['Jun 30', 'Dermatology', 'Dry, itchy skin', 'Visit', 139.45],
      ['Aug 4', 'Behavioral health', 'Low mood', 'Visit', 146],
      ['Sep 22', 'Primary care', 'Weight gain, fatigue', 'Visit, thyroid panel', 203.75],
      ['Nov 10', 'Rheumatology', 'Joint pain', 'Follow-up', 162.3],
    ],
  },
  {
    name: 'Priya Nair', age: 44, id: 'PN906217345', group: '084216', plan: 'Core EPO', planId: 'EPO-26233',
    member: 185, savings: 204.1, slot: [186, 306, 92, -5, 6],
    claims: [
      ['Feb 5', 'Primary care', 'Migraines', 'Visit', 128.5],
      ['Apr 9', 'Neurology', 'Migraines, brain fog', 'Visit, MRI', 742.6],
      ['Jul 21', 'Gynecology', 'Irregular periods', 'Visit, labs', 236.85],
      ['Oct 15', 'Behavioral health', 'Trouble concentrating', 'Visit', 144],
    ],
  },
  {
    name: 'Angela Brooks', age: 47, id: 'AB245968103', group: '039481', plan: 'Open Access POS', planId: 'POS-26077',
    member: 310, savings: 356.9, slot: [222, 12, 100, -3, 3],
    claims: [
      ['Jan 15', 'Urgent care', 'Urinary symptoms', 'Visit, urinalysis', 164.2],
      ['Mar 12', 'Urology', 'Recurrent UTIs', 'Visit, cystoscopy', 538.9],
      ['Apr 30', 'Primary care', 'Night sweats, poor sleep', 'Visit', 124.75],
      ['Jun 18', 'Gynecology', 'Heavy bleeding', 'Visit, ultrasound', 318.4],
      ['Aug 7', 'Urgent care', 'Urinary symptoms', 'Visit, urinalysis', 164.2],
      ['Sep 24', 'Behavioral health', 'Irritability, low mood', 'Visit', 146],
      ['Nov 19', 'Urology', 'Recurrent UTIs', 'Follow-up', 171.35],
    ],
  },
  {
    name: 'Mei-Ling Chen', age: 51, id: 'MC671420958', group: '207365', plan: 'Premier PPO', planId: 'PPO-26341',
    member: 260, savings: 298.45, slot: [372, 262, 96, 8, 9],
    claims: [
      ['Feb 24', 'Primary care', 'Dizziness, flushing', 'Visit, labs', 189.3],
      ['Apr 14', 'Cardiology', 'Dizziness', 'Visit, echocardiogram', 564.8],
      ['Jun 2', 'Endocrinology', 'Weight changes', 'Visit, hormone panel', 342.15],
      ['Aug 27', 'Sleep medicine', 'Insomnia', 'Visit', 218.6],
      ['Oct 29', 'Primary care', 'Fatigue', 'Follow-up', 118.45],
    ],
  },
  {
    name: 'Tamika Johnson', age: 45, id: 'TJ384750216', group: '061907', plan: 'Select HMO', planId: 'HMO-26104',
    member: 385, savings: 441.75, slot: [400, 8, 104, -4, 5],
    claims: [
      ['Jan 27', 'Primary care', 'Anxiety, poor sleep', 'Visit', 126.8],
      ['Feb 23', 'Behavioral health', 'New onset anxiety', 'Visit', 148],
      ['Apr 6', 'Gastroenterology', 'Bloating, reflux', 'Visit, endoscopy', 684.25],
      ['May 19', 'Behavioral health', 'Anxiety', 'Follow-up, prescription', 156.4],
      ['Jul 8', 'Dermatology', 'Hair thinning', 'Visit, labs', 198.7],
      ['Aug 25', 'Primary care', 'Fatigue', 'Follow-up, labs', 133.95],
      ['Oct 13', 'Gynecology', 'Irregular bleeding', 'Visit, ultrasound', 309.6],
      ['Nov 23', 'Behavioral health', 'Anxiety', 'Follow-up', 148],
    ],
  },
  {
    name: 'Laura Bennett', age: 54, id: 'LB159836420', group: '112750', plan: 'Value HDHP', planId: 'HDHP-26009',
    member: 330, savings: 372.2, slot: [458, 236, 92, 4, 7],
    claims: [
      ['Feb 11', 'Primary care', 'Knee and hip pain', 'Visit', 121.3],
      ['Mar 31', 'Orthopedics', 'Knee pain', 'Visit, imaging', 376.5],
      ['May 26', 'Physical therapy', 'Knee pain', 'Course of visits', 612],
      ['Jul 29', 'Primary care', 'Poor sleep', 'Visit', 121.3],
      ['Sep 16', 'Sleep medicine', 'Insomnia', 'Visit, sleep study', 598.45],
      ['Nov 2', 'Orthopedics', 'Hip pain', 'Follow-up, injection', 284.1],
    ],
  },
  {
    name: 'Fatima Rahman', age: 48, id: 'FR820594137', group: '039481', plan: 'Core EPO', planId: 'EPO-26233',
    member: 295, savings: 334.8, slot: [506, 58, 100, 9, 1],
    claims: [
      ['Jan 20', 'Primary care', 'Fatigue, low mood', 'Visit, labs', 182.15],
      ['Mar 9', 'Behavioral health', 'Low mood', 'Visit', 146],
      ['Apr 22', 'Neurology', 'Brain fog, headaches', 'Visit, cognitive screen', 431.2],
      ['Jun 11', 'Endocrinology', 'Fatigue, weight gain', 'Visit, thyroid panel', 327.65],
      ['Aug 18', 'Gynecology', 'Irregular bleeding', 'Visit', 214.9],
      ['Oct 1', 'Behavioral health', 'Low mood', 'Follow-up, prescription', 158.75],
      ['Nov 17', 'Primary care', 'Fatigue', 'Follow-up', 118.45],
    ],
  },
  {
    name: "Karen O'Neill", age: 50, id: 'KO467201895', group: '207365', plan: 'Premier PPO', planId: 'PPO-26341',
    member: 215, savings: 247.3, slot: [108, 296, 96, 7, 10],
    claims: [
      ['Mar 4', 'Primary care', 'Chest tightness', 'Visit, ECG', 208.35],
      ['Mar 18', 'Cardiology', 'Chest tightness, palpitations', 'Visit, stress test', 692.4],
      ['Jun 23', 'Behavioral health', 'Panic symptoms', 'Visit', 148],
      ['Sep 2', 'Gynecology', 'Irregular bleeding', 'Visit', 196.2],
      ['Nov 11', 'Primary care', 'Poor sleep', 'Follow-up', 118.45],
    ],
  },
];

(() => {
  const track = document.querySelector('.sarah-track');
  if (!track) return;
  const panel = track.querySelector('.sarah');
  const windowEl = track.querySelector('.receipt-window');
  const morph = track.querySelector('.receipt-morph');
  const sarah = track.querySelector('.receipt--sarah');
  const collage = track.querySelector('.collage');
  if (!panel || !windowEl || !morph || !sarah || !collage) return;

  const pinned = matchMedia('(min-width: 1024px) and (min-height: 720px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOMENT_2_AT = 0.85; // where moment 2 rests, as a share of the pinned scroll
  const S = RECEIPT_SETTINGS;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (v) => v * v * (3 - 2 * v);
  const easeOut = (v) => 1 - (1 - v) * (1 - v);
  // Seeded random numbers, so the collage and the crumples look the same on every visit.
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // ---- Build the collage ----
  const COLLAGE_W = 560;
  const COLLAGE_H = 640;
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const shortDate = (label) => {
    const [month, day] = label.split(' ');
    return `${String(MONTHS.indexOf(month.toLowerCase()) + 1).padStart(2, '0')}/${day.padStart(2, '0')}/26`;
  };

  // A copy of Sarah's receipt, filled in with someone else's claims.
  const receiptFor = (person) => {
    const el = sarah.cloneNode(true);
    el.classList.remove('receipt--sarah');
    el.removeAttribute('aria-label');
    if (!person) return el;
    const set = (key, value) => el.querySelectorAll(`[data-f="${key}"]`).forEach((node) => { node.textContent = value; });
    const paid = person.claims.reduce((sum, claim) => sum + claim[4], 0);
    set('name', person.name);
    set('age', person.age);
    set('member-id', person.id);
    set('group', person.group);
    set('plan', person.plan);
    set('plan-id', person.planId);
    set('claims', person.claims.length);
    set('specialties', new Set(person.claims.map((claim) => claim[1])).size);
    set('period', `${shortDate(person.claims[0][0])}—${shortDate(person.claims[person.claims.length - 1][0])}`);
    set('submitted', usd.format(paid + person.member + person.savings));
    set('savings', usd.format(person.savings));
    set('member', usd.format(person.member));
    set('paid', usd.format(paid));
    const list = el.querySelector('[data-f="visits"]');
    const template = list.firstElementChild;
    list.replaceChildren(...person.claims.map(([date, specialty, reason, services, amount]) => {
      const item = template.cloneNode(true);
      const put = (key, value) => { item.querySelector(`[data-f="${key}"]`).textContent = value; };
      put('visit-date', `${date}, 2026`);
      put('visit-specialty', specialty);
      put('visit-reason', reason);
      put('visit-services', services);
      put('visit-amount', usd.format(amount));
      return item;
    }));
    return el;
  };

  // ---- Crumpled paper, painted pixel by pixel on a canvas ----
  // The sheet is broken into irregular facets. Each facet leans its own way
  // and is lit from the top left, so some catch the light and some fall into
  // shadow; creases darken where facets meet; and the receipt's print runs
  // across each facet at its own angle, the way it does on a real crumpled
  // receipt. Three versions per receipt: a = folded, b = scrunched, c = ball.
  const STAGES = {
    //   squareness: 1 = sheet-shaped, 0 = round   crumple: how far the facets lean
    //   bulge: how ball-like the volume is        facets: facet count, as a share of S.ballFacets
    a: { squareness: 0.86, crumple: 0.4, bulge: 0.15, facets: 0.42, dent: 0.5 },
    b: { squareness: 0.5, crumple: 0.75, bulge: 0.55, facets: 0.7, dent: 0.85 },
    c: { squareness: 0.1, crumple: 1, bulge: 0.95, facets: 1, dent: 1 },
  };
  const hash = (a, b) => {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (from, to, x) => {
    const t = clamp01((x - from) / (to - from));
    return t * t * (3 - 2 * t);
  };
  const channels = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  // Is there print at this point of the receipt? Rows of "words": some rows
  // blank, some bold.
  const printAt = (x, y) => {
    const row = Math.floor(y / 7);
    const kind = hash(row, 11);
    if (kind < 0.3 || y / 7 - row > (kind > 0.9 ? 0.55 : 0.34)) return 0;
    const along = x / 12 + kind * 9;
    const word = Math.floor(along);
    return hash(row, word + 100) > 0.45 && along - word < 0.78 ? 1 : 0;
  };

  const LIGHT = [-0.42, -0.62, 0.66];
  // Paint one version of the crumpled receipt, `width` × `height` CSS px.
  // `id` keeps each receipt's shape the same however the look settings change.
  const paintCrumple = (canvas, stage, id, width, height) => {
    const look = STAGES[stage];
    const density = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(2, Math.round(width * density));
    const H = Math.max(2, Math.round(height * density));
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(W, H);
    const data = image.data;
    const shade = channels(S.ballShade);

    // Outline: an irregular polygon. `edge[i]` is how far out it reaches at each
    // of 720 angles (1 = touching the box).
    const corners = 15 + (id % 5);
    const points = Array.from({ length: corners }, (_, i) => {
      const angle = ((i + (hash(id, i) - 0.5) * 0.6) / corners) * Math.PI * 2;
      const boxy = 1 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
      return [angle, (1 + (boxy - 1) * look.squareness) * (1 - S.ballRough * look.dent * hash(id, i + 50))];
    });
    const edge = new Float32Array(720);
    for (let i = 0; i < 720; i += 1) {
      const angle = (i / 720) * Math.PI * 2;
      let k = 0;
      while (k < corners - 1 && points[k + 1][0] <= angle) k += 1;
      if (angle < points[0][0]) k = corners - 1;
      const [a1, r1] = points[k];
      let [a2, r2] = points[(k + 1) % corners];
      if (a2 <= a1) a2 += Math.PI * 2;
      const at = angle < a1 ? angle + Math.PI * 2 : angle;
      edge[i] = (r1 * r2 * Math.sin(a2 - a1)) / (r1 * Math.sin(at - a1) + r2 * Math.sin(a2 - at));
    }

    const cell = Math.max(6, W / Math.max(1, S.ballFacets * look.facets)); // facet size, px
    const lean = 1.15 * look.crumple;
    const turn = Math.PI * 2 * look.crumple ** 3;   // how far the print turns from facet to facet
    const slip = 70 * look.crumple * density;       // and how far it slips
    const seedX = id * 31 + 7;
    const seedY = id * 17 + 3;
    const softness = S.ballSoft * 0.6 + 0.001;
    const fade = 3 / Math.min(W, H);                // soft edge, about 1.5px

    for (let py = 0; py < H; py += 1) {
      for (let px = 0; px < W; px += 1) {
        const o = (py * W + px) * 4;
        const nx = (px + 0.5 - W / 2) / (W / 2);
        const ny = (py + 0.5 - H / 2) / (H / 2);
        const r = Math.hypot(nx, ny);
        let angle = Math.atan2(ny, nx);
        if (angle < 0) angle += Math.PI * 2;
        const reach = edge[Math.min(719, Math.floor((angle / (Math.PI * 2)) * 720))];
        if (r >= reach) continue;

        // Which facet is this, and which is its nearest neighbour?
        const gx = px / cell;
        const gy = py / cell;
        const cx = Math.floor(gx);
        const cy = Math.floor(gy);
        let d1 = 1e9;
        let d2 = 1e9;
        let f1x = 0; let f1y = 0; let f2x = 0; let f2y = 0;
        for (let j = -1; j <= 1; j += 1) {
          for (let i = -1; i <= 1; i += 1) {
            const sx = cx + i;
            const sy = cy + j;
            const d = Math.hypot(sx + hash(sx + seedX, sy + seedY) - gx, sy + hash(sx - seedY, sy + seedX) - gy);
            if (d < d1) { d2 = d1; f2x = f1x; f2y = f1y; d1 = d; f1x = sx; f1y = sy; } else if (d < d2) { d2 = d; f2x = sx; f2y = sy; }
          }
        }
        const gap = d2 - d1; // 0 on the crease between the two facets

        // Each facet leans its own way; near a crease it blends into its neighbour.
        const blend = 0.5 * (1 - smooth(0, softness, gap));
        const tx = lerp(hash(f1x + seedX, f1y - seedX) - 0.5, hash(f2x + seedX, f2y - seedX) - 0.5, blend) * 2 * lean;
        const ty = lerp(hash(f1x - seedY, f1y + seedY * 3) - 0.5, hash(f2x - seedY, f2y + seedY * 3) - 0.5, blend) * 2 * lean;
        const bx = (nx / reach) * look.bulge * 0.9 + tx;
        const by = (ny / reach) * look.bulge * 0.9 + ty;
        const diffuse = (bx * LIGHT[0] + by * LIGHT[1] + LIGHT[2]) / Math.hypot(bx, by, 1);
        let value = 0.95 + (diffuse - LIGHT[2]) * 0.72 * S.ballShading;
        value -= (1 - smooth(0, 0.08, gap)) * 0.16 * S.ballCrease * look.crumple;  // crease line
        value -= smooth(0.7, 1, r / reach) * 0.12 * look.bulge;                     // rounder: darker at the rim
        value += (hash(px, py) - 0.5) * 0.035;                                      // paper grain
        value = Math.min(1, Math.max(0.3, value));

        // The receipt's print, turned and slipped by this facet.
        const spin = (hash(f1x + 91, f1y + seedX) - 0.5) * turn;
        const ox = px - W / 2 + (hash(f1x + seedY, f1y + 57) - 0.5) * slip;
        const oy = py - H / 2 + (hash(f1x + 23, f1y - seedY) - 0.5) * slip;
        const ink = printAt((ox * Math.cos(spin) - oy * Math.sin(spin)) / density * 2.1 + 400, (ox * Math.sin(spin) + oy * Math.cos(spin)) / density * 2.1 + 400) * 0.4 * S.ballPrint;

        data[o] = lerp(lerp(shade[0], 255, value), 62 * value, ink);
        data[o + 1] = lerp(lerp(shade[1], 255, value), 56 * value, ink);
        data[o + 2] = lerp(lerp(shade[2], 255, value), 74 * value, ink);
        data[o + 3] = 255 * (1 - smooth(reach - fade, reach, r));
      }
    }
    ctx.putImageData(image, 0, 0);
  };

  // Each receipt's three canvases are painted when first needed (or shortly
  // after the page settles), and again whenever their size or the look changes.
  let lookVersion = 0;
  const ensurePainted = (canvas) => {
    const key = `${lookVersion}:${canvas.dataset.w}x${canvas.dataset.h}`;
    if (canvas.dataset.painted === key || !canvas.dataset.w) return;
    canvas.dataset.painted = key;
    paintCrumple(canvas, canvas.dataset.stage, Number(canvas.dataset.id), Number(canvas.dataset.w), Number(canvas.dataset.h));
  };
  const crumpleCanvases = (index) => ['a', 'b', 'c']
    .map((stage, k) => `<canvas class="crumple__${stage}" data-stage="${stage}" data-id="${index * 3 + k + 1}"></canvas>`).join('');

  // Falling paper balls are drawn in a layer that covers the whole screen, so
  // they drop out of the panel, in front of the next section and off the
  // bottom of the screen.
  const fallLayer = document.createElement('div');
  fallLayer.className = 'fall-layer';
  fallLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fallLayer);

  const blank = sarah.cloneNode(true); // taken before anything is styled
  const topZ = Math.max(SARAH_SLOT[4], ...OTHER_RECEIPTS.map((person) => person.slot[4]));
  const pieces = [];
  const addPiece = (receipt, [cx, top, width, rotation, z], isSarah) => {
    const el = document.createElement('div');
    el.className = isSarah ? 'piece piece--sarah' : 'piece';
    el.style.setProperty('--x', (((cx - width / 2) / COLLAGE_W) * 100).toFixed(2));
    el.style.setProperty('--y', ((top / COLLAGE_H) * 100).toFixed(2));
    el.style.setProperty('--w', ((width / COLLAGE_W) * 100).toFixed(2));
    el.style.setProperty('--z', z);
    el.style.setProperty('--r', `${rotation}deg`);
    receipt.style.setProperty('--shade', ((topZ - z) * 0.011).toFixed(3));
    el.appendChild(receipt);
    collage.appendChild(el);

    const crumple = document.createElement('div');
    crumple.className = 'crumple';
    crumple.hidden = true;
    collage.appendChild(crumple);

    pieces.push({
      el, receipt, crumple, rotation, isSarah,
      launch: null,                       // where on screen it lets go of the pile and starts to fall
      order: 0,                           // set below: its turn to leave the pile, 0 (first) to 1 (last)
      popAt: Math.floor(rand() * 3),      // frame it reappears on, coming back from below
      wait: rand(),                       // how long it waits before crumpling (share of S.staggerFrames)
      hop: -(110 + rand() * 150),         // falling: first a little hop (px/s),
      drift: (rand() - 0.5) * 200,        // some sideways drift (px/s),
      spin: (rand() - 0.5) * 800,         // and a tumble (degrees/s)
      tilt: (rand() - 0.5) * 26,
    });
  };
  blank.classList.remove('receipt--sarah');
  blank.removeAttribute('aria-label');
  addPiece(blank, SARAH_SLOT, true);
  OTHER_RECEIPTS.forEach((person) => addPiece(receiptFor(person), person.slot, false));
  const sarahPiece = pieces[0];
  const others = pieces.slice(1);
  pieces.forEach((piece, i) => { piece.crumple.innerHTML = crumpleCanvases(i); });
  // Paint whatever is out of date, one canvas at a time so the page never stalls.
  let paintTimer;
  const paintSoon = () => {
    clearTimeout(paintTimer);
    const next = () => {
      const stale = [...track.querySelectorAll('.crumple canvas'), ...fallLayer.querySelectorAll('canvas')]
        .find((canvas) => canvas.dataset.w && canvas.dataset.painted !== `${lookVersion}:${canvas.dataset.w}x${canvas.dataset.h}`);
      if (!stale) return;
      ensurePainted(stale);
      paintTimer = setTimeout(next, 30);
    };
    paintTimer = setTimeout(next, 400);
  };
  const styleCrumples = () => [collage, fallLayer].forEach((el) => el.style.setProperty('--ball-shadow', S.ballShadow));
  styleCrumples();
  // Deal the others out one after another, lowest in the pile first.
  [...others].sort((a, b) => a.el.style.getPropertyValue('--z') - b.el.style.getPropertyValue('--z'))
    .forEach((piece, i) => { piece.order = i / (others.length - 1); });

  // ---- The model: four numbers, each stepped towards its target at S.fps ----
  const POP_FRAMES = 4;
  const framesFor = (seconds) => Math.max(1, Math.round(seconds * S.fps));
  // Frames a ball needs to clear the screen from anywhere on it, hop included.
  const fallFrames = () => {
    const up = 260 * S.hop;
    return Math.ceil(((up + Math.sqrt(up * up + 2 * S.gravity * (window.innerHeight + 200))) / S.gravity) * S.fps) + 1;
  };
  // Longest wait + folded, scrunched, ball + the fall.
  const crumpleFrames = () => S.staggerFrames + 3 * S.stageFrames + fallFrames();

  let unroll = 0;            // 0 = on the roll, 1 = fully out
  let move = 0;              // 0 = moment 1, 1 = moment 2
  let crumple = 0;           // frames into the crumple-and-fall (0 = flat)
  let pop = POP_FRAMES;      // frames into popping back flat
  const target = { unroll: 0, move: 0, gone: false };
  let onScreen = false;
  let previewGone = false;   // the controls panel playing the crumple on its own

  const feed = sarah.querySelector('.receipt__feed');
  const paper = sarah.querySelector('.receipt__paper');
  const roll = sarah.querySelector('.receipt__roll');

  // ---- Unroll ----
  const renderUnroll = () => {
    if (unroll >= 1) {
      if (sarah.classList.contains('is-rolled')) {
        sarah.classList.remove('is-rolled');
        feed.style.transform = '';
        paper.style.removeProperty('--hidden');
      }
      return;
    }
    const full = paper.offsetHeight;
    const view = Math.min(full, windowEl.clientHeight - (parseFloat(getComputedStyle(windowEl).paddingBottom) || 0));
    const start = Math.min(full, sarah.offsetWidth * 0.3);
    const out = lerp(start, full, 1 - Math.pow(1 - unroll, 1.6)); // px of paper off the roll
    const left = full - out;
    // The roll travels down the window; once it reaches the bottom it stays
    // there and the paper feeds upward instead.
    const shake = unroll > 0 ? (rand() - 0.5) * 2 * S.wobble : 0;
    sarah.classList.add('is-rolled');
    feed.style.transform = `translate(${shake.toFixed(1)}px, ${Math.max(0, Math.min(left, full - view)).toFixed(1)}px)`;
    paper.style.setProperty('--hidden', `${left.toFixed(1)}px`);
    roll.style.setProperty('--roll-y', `${out.toFixed(1)}px`);
    roll.style.setProperty('--roll-r', `${Math.sqrt(9 + left * 0.5).toFixed(1)}px`);
  };

  // ---- Collage (pinned only) ----
  // Where things have to travel, measured with nothing transformed.
  let geo = null;
  const centreOf = (el) => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2];
  const measure = () => {
    morph.style.transform = '';
    const rest = morph.getBoundingClientRect();    // Sarah's receipt, at rest in moment 1
    const box = collage.getBoundingClientRect();
    const [sx, sy] = centreOf(sarahPiece.el);       // her place in the collage
    geo = {
      dx: box.left + sx - (rest.left + rest.width / 2),
      dy: box.top + sy - (rest.top + rest.height / 2),
      scale: sarahPiece.el.offsetWidth / rest.width,
      from: pieces.map((piece) => { const [px, py] = centreOf(piece.el); return [sx - px, sy - py]; }),
      at: pieces.map((piece) => centreOf(piece.el)),
    };
    // Size each receipt's three crumple pictures from the receipt itself.
    pieces.forEach((piece) => {
      const w = piece.el.offsetWidth;
      const h = piece.el.offsetHeight;
      [['a', 0.98 * w, 0.6 * h], ['b', 0.86 * w, 0.33 * h], ['c', S.ballSize * w, S.ballSize * w]].forEach(([stage, sw, sh]) => {
        const canvas = piece.crumple.querySelector(`.crumple__${stage}`);
        canvas.dataset.w = Math.round(sw);
        canvas.dataset.h = Math.round(sh);
        canvas.style.width = `${Math.round(sw)}px`;
        canvas.style.height = `${Math.round(sh)}px`;
        canvas.style.left = `${Math.round(-sw / 2)}px`;
        canvas.style.top = `${Math.round(-sh / 2)}px`;
      });
    });
    paintSoon();
  };

  const renderCollage = () => {
    if (!geo) measure();
    const moving = move > 0 && move < 1 && !reducedMotion;
    const wobble = (amount) => (moving ? (rand() - 0.5) * amount * S.wobble : 0); // stop-motion imperfection
    const landing = easeInOut(clamp01(move / S.landShare));
    const landed = landing >= 1;

    // Sarah's own receipt flies to her place in the collage; once there, the
    // copy that sits in the collage (and in its stacking order) takes over.
    morph.style.transform = landing > 0
      ? `translate(${(geo.dx * landing + wobble(3)).toFixed(1)}px, ${(geo.dy * landing + wobble(3)).toFixed(1)}px) rotate(${(SARAH_SLOT[3] * landing + wobble(1.6)).toFixed(2)}deg) scale(${lerp(1, geo.scale, landing).toFixed(4)})`
      : '';
    morph.style.visibility = landed ? 'hidden' : '';

    const fallen = crumple >= crumpleFrames();
    // The others leave the pile one after another, starting as Sarah's receipt arrives.
    const firstDeal = S.landShare * 0.6;
    const dealSpread = Math.max(0, 0.98 - S.dealShare - firstDeal);
    pieces.forEach((piece, i) => {
      const dealt = piece.isSarah ? (landed ? 1 : 0) : easeOut(clamp01((move - firstDeal - piece.order * dealSpread) / S.dealShare));
      const frame = crumple - Math.round(piece.wait * S.staggerFrames); // this receipt's own frame of the crumple
      const popping = pop - piece.popAt;               // <= 0: not back yet, 1: just popped in
      const flat = dealt > 0 && frame <= 0 && popping > 0;
      const style = piece.el.style;
      style.visibility = flat ? 'visible' : 'hidden';
      if (flat) {
        const [fx, fy] = geo.from[i];
        const settling = dealt < 1;
        style.setProperty('--dx', `${(fx * (1 - dealt) + (settling ? wobble(3) : 0)).toFixed(1)}px`);
        style.setProperty('--dy', `${(fy * (1 - dealt) + (settling ? wobble(3) : 0)).toFixed(1)}px`);
        style.setProperty('--r', `${(lerp(SARAH_SLOT[3], piece.rotation, dealt) + (settling ? wobble(4) : 0) + (popping === 1 ? 4 : 0)).toFixed(2)}deg`);
        style.setProperty('--s', (lerp(0.85, 1, dealt) * (popping === 1 ? 0.92 : 1)).toFixed(3));
      }

      // Crumpled: folded, scrunched, ball, then a hop and a fall off the screen.
      const fall = Math.max(0, frame - 3 * S.stageFrames) / S.fps; // seconds spent falling
      let [x, y] = geo.at[i];
      let show = frame > 0 && !fallen;
      if (show && fall > 0) {
        // Letting go of the pile. From here the ball is drawn in the layer
        // over the whole screen, falling from where the pile was at that moment.
        if (!piece.launch) {
          const box = collage.getBoundingClientRect();
          piece.launch = [box.left + x, box.top + y, box.bottom > 0 && box.top < window.innerHeight];
          fallLayer.appendChild(piece.crumple);
        }
        [x, y, show] = piece.launch; // not shown if the pile was off screen: no balls out of nowhere
      } else if (piece.launch) {
        piece.launch = null;
        collage.appendChild(piece.crumple);
      }
      piece.crumple.hidden = !show;
      if (show) {
        const stage = Math.min(2, Math.floor((frame - 1) / S.stageFrames));
        piece.crumple.dataset.stage = 'abc'[stage];
        ensurePainted(piece.crumple.querySelector(`.crumple__${'abc'[stage]}`));
        piece.crumple.style.zIndex = 40 + i;
        piece.crumple.style.transform = `translate(${(x + piece.drift * S.drift * fall).toFixed(1)}px, ${(y + piece.hop * S.hop * fall + 0.5 * S.gravity * fall * fall).toFixed(1)}px) rotate(${(piece.rotation + piece.tilt * (stage + 1) + piece.spin * S.spin * fall).toFixed(1)}deg)`;
      }
    });
  };

  const render = () => {
    renderUnroll();
    if (pinned.matches) renderCollage();
  };

  // ---- Stepping ----
  // One frame closer to the targets. Returns true while there is more to do.
  const advance = () => {
    let busy = false;
    const wantMove = target.gone ? 1 : target.move;

    if (unroll > target.unroll) unroll = target.unroll;              // rolled back up out of sight
    else if (wantMove && unroll < 1) unroll = 1;                      // skipped ahead: no time to unroll
    else if (unroll < target.unroll) {
      unroll = reducedMotion ? 1 : Math.min(1, unroll + 1 / framesFor(S.unrollSeconds));
      busy = busy || unroll < 1;
    }

    if (target.gone && move < 1) move = 1;                            // skipped ahead
    else if (move !== wantMove) {
      const step = reducedMotion ? 1 : 1 / framesFor(S.moveSeconds);
      move = move < wantMove ? Math.min(wantMove, move + step) : Math.max(wantMove, move - step);
      busy = busy || move !== wantMove;
    }

    if (target.gone) {
      const end = crumpleFrames();
      if (crumple < end) {
        crumple = reducedMotion ? end : crumple + 1;
        busy = busy || crumple < end;
      }
    } else if (crumple > 0) {
      crumple = 0;                                                    // back up: flat again, popping in
      pop = reducedMotion ? POP_FRAMES : 0;
    }
    if (pop < POP_FRAMES) {
      pop += 1;
      busy = busy || pop < POP_FRAMES;
    }
    return busy;
  };

  let running = false;
  let lastFrame = 0;
  const loop = (now) => {
    if (now - lastFrame >= 1000 / S.fps - 4) {
      lastFrame = now;
      const busy = advance();
      render();
      if (!busy) { running = false; return; }
    }
    requestAnimationFrame(loop);
  };
  const run = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  };

  // ---- Reading the scroll position ----
  // 0 when the panel first pins, 1 when it is about to scroll away.
  const progress = () => {
    const box = track.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(panel).top) || 0;
    return (top - box.top) / Math.max(1, box.height - panel.offsetHeight);
  };
  let syncQueued = false;
  const sync = () => {
    syncQueued = false;
    const view = windowEl.getBoundingClientRect();
    const frameBox = panel.getBoundingClientRect();
    onScreen = frameBox.bottom > 0 && frameBox.top < window.innerHeight;

    // Unroll once a good part of the window is on screen; roll back up when
    // the page is scrolled back above it, so it plays again next time.
    const seen = Math.min(view.bottom, window.innerHeight) - Math.max(view.top, 0);
    let unrollTo = target.unroll;
    if (reducedMotion || seen >= Math.min(view.height, window.innerHeight) * 0.3) unrollTo = 1;
    else if (view.top >= window.innerHeight) unrollTo = 0;

    let moveTo = 0;
    let gone = false;
    if (pinned.matches) {
      const p = progress();
      // A little stickiness, so each moment starts as soon as the page moves towards it.
      moveTo = p > (target.move ? 0.5 : 0.2) ? 1 : 0;
      // Past moment 2 the page scrolls freely: the receipts crumple once it has
      // moved on by S.crumpleAfter px, and come back if it returns.
      const past = (p - MOMENT_2_AT) * (track.offsetHeight - panel.offsetHeight);
      gone = previewGone || past > S.crumpleAfter * (target.gone ? 0.4 : 1);
    }
    if (unrollTo === target.unroll && moveTo === target.move && gone === target.gone) return;
    target.unroll = unrollTo;
    target.move = moveTo;
    target.gone = gone;
    panel.classList.toggle('is-m2', moveTo === 1);
    run();
  };
  const requestSync = () => {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(sync);
  };

  // ---- Paper shifting, once a second ----
  const papers = [paper, ...pieces.map((piece) => piece.receipt.querySelector('.receipt__paper'))];
  const shiftPaper = () => {
    setTimeout(shiftPaper, Math.max(0.05, S.shiftEvery) * 1000);
    if (!onScreen || document.hidden) return;
    papers.forEach((sheet, i) => {
      const size = i === 0 ? 0.25 : 1; // Sarah's full-size receipt turns less
      sheet.style.setProperty('--jx', `${((Math.random() - 0.5) * 1.6 * S.shiftAmount).toFixed(2)}px`);
      sheet.style.setProperty('--jy', `${((Math.random() - 0.5) * 1.6 * S.shiftAmount).toFixed(2)}px`);
      sheet.style.setProperty('--jr', `${((Math.random() - 0.5) * 1.3 * size * S.shiftAmount).toFixed(2)}deg`);
      sheet.style.setProperty('--flip', S.creaseFlip && Math.random() < 0.5 ? -1 : 1);
    });
  };
  if (!reducedMotion) shiftPaper();

  // Step-by-step scrolling into and between the two moments: one swipe (wheel,
  // trackpad, key press or touch swipe) glides from the hero to moment 1, and
  // from moment 1 to moment 2 (and back the same way). The rest of that swipe,
  // including trackpad momentum, is swallowed so it can't carry past a moment.
  // From moment 2 on, the page scrolls normally: nothing snaps on the way out,
  // and coming back up it only catches on moment 2.
  const steps = () => {
    const box = track.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(panel).top) || 0;
    const start = window.scrollY + box.top - top;          // moment 1 (the panel has just pinned)
    const length = box.height - panel.offsetHeight;        // scroll spent pinned
    return [start, start + MOMENT_2_AT * length];
  };

  let animating = false;
  let locked = false;      // true from a step until a new swipe starts (its momentum is ignored)
  let glideStart = 0;
  let pendingDir = 0;      // a swipe made while gliding: taken as soon as the glide ends

  const glide = (to) => {
    locked = true;
    animating = true;
    glideStart = performance.now();
    const from = window.scrollY;
    const distance = to - from;
    const duration = reducedMotion ? 0 : 700;
    const t0 = performance.now();
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const frame = (now) => {
      const k = duration ? Math.min(1, (now - t0) / duration) : 1;
      window.scrollTo({ top: from + distance * ease(k), behavior: 'instant' });
      if (k < 1) requestAnimationFrame(frame);
      else {
        animating = false;
        if (pendingDir) {
          const dir = pendingDir;
          pendingDir = 0;
          const next = targetFor(window.scrollY, dir, dir * 100);
          if (next !== null) glide(next);
          else locked = false; // moving on past moment 2, or back up past moment 1: scroll normally
        }
      }
    };
    requestAnimationFrame(frame);
  };
  // Where one swipe in direction `dir` from scroll position `y` should go, or
  // null to let the page scroll normally.
  const targetFor = (y, dir, delta) => {
    const [s0, s1] = steps();
    if (y < s0 - 2) return dir > 0 && y + delta >= s0 ? s0 : null;      // arriving from the hero
    if (y > s1 + 2) return dir < 0 && y + delta <= s1 ? s1 : null;      // arriving from below
    if (dir > 0) return y < s1 - 2 ? s1 : null;                         // at moment 2 going down: scroll normally
    return y > s0 + 2 ? s0 : null;                                      // at moment 1 going up: scroll normally
  };
  const inside = (y) => { const [s0, s1] = steps(); return y >= s0 - 2 && y <= s1 + 2; };

  // Telling a new swipe from the momentum of the last one: momentum only ever
  // fades, so a new swipe shows up as a pause in the events or a sudden jump
  // in their size.
  let lastWheel = 0;
  const recent = [];
  window.addEventListener('wheel', (event) => {
    if (!pinned.matches || event.ctrlKey) return; // ctrlKey = pinch zoom
    const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const size = Math.abs(dy);
    const now = performance.now();
    const fresh = now - lastWheel > 160 || (size > 10 && size > 1.6 * Math.max(0, ...recent.slice(-2)));
    lastWheel = now;
    recent.push(size);
    if (recent.length > 4) recent.shift();

    if (animating) {
      // A new swipe while gliding is remembered, not lost. The first moments of
      // the swipe that started this glide are still ramping up, so skip those.
      if (fresh && now - glideStart > 300) pendingDir = Math.sign(dy);
      event.preventDefault();
      return;
    }
    if (locked) {
      if (!fresh) { event.preventDefault(); return; } // still the old swipe's momentum
      locked = false;
    }
    if (size < 1) return;
    const y = window.scrollY;
    const dir = Math.sign(dy);
    const to = targetFor(y, dir, dy);
    if (to === null) return; // scroll normally
    event.preventDefault();
    glide(to);
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (!pinned.matches || animating || event.target.closest?.('input, select, textarea, [contenteditable]')) return;
    const down = ['ArrowDown', 'PageDown', ' '].includes(event.key) && !event.shiftKey;
    const up = ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey);
    if (!down && !up) return;
    const y = window.scrollY;
    const to = targetFor(y, down ? 1 : -1, down ? window.innerHeight * 0.8 : -window.innerHeight * 0.8);
    if (to === null) return;
    event.preventDefault();
    glide(to);
  });

  // Touch (large tablets): a swipe inside the pinned stretch is one step.
  let touchY = null;
  window.addEventListener('touchstart', (event) => { touchY = event.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (event) => {
    if (!pinned.matches || touchY === null) return;
    const y = window.scrollY;
    const dir = Math.sign(touchY - event.touches[0].clientY);
    if (animating || (inside(y) && targetFor(y, dir, 0) !== null)) event.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', (event) => {
    if (!pinned.matches || touchY === null || animating) return;
    const dy = touchY - event.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) < 30 || !inside(window.scrollY)) return;
    const to = targetFor(window.scrollY, Math.sign(dy), dy);
    if (to !== null) glide(to);
  });

  // Scrollbar drags and anything else: if scrolling stops between two steps,
  // glide on to the nearer one.
  let restTimer;
  window.addEventListener('scroll', () => {
    if (animating) return;
    clearTimeout(restTimer);
    restTimer = setTimeout(() => {
      if (!pinned.matches || animating) return;
      const y = window.scrollY;
      if (!inside(y)) return;
      const pts = steps();
      if (pts.some((p) => Math.abs(p - y) <= 2)) return;
      glide(pts.reduce((a, p) => (Math.abs(p - y) < Math.abs(a - y) ? p : a)));
    }, 180);
  }, { passive: true });

  // ---- Layout changes ----
  const onLayout = () => {
    geo = null;
    if (!pinned.matches) {
      // In flow: the collage is a still picture and nothing is pinned.
      move = 0;
      crumple = 0;
      pop = POP_FRAMES;
      target.move = 0;
      target.gone = false;
      panel.classList.remove('is-m2');
      morph.style.transform = '';
      morph.style.visibility = '';
      pieces.forEach((piece) => {
        ['visibility', '--dx', '--dy', '--s'].forEach((name) => piece.el.style.removeProperty(name));
        piece.el.style.setProperty('--r', `${piece.rotation}deg`);
        piece.crumple.hidden = true;
        piece.launch = null;
        collage.appendChild(piece.crumple);
      });
    }
    sync();
    render();
  };
  window.addEventListener('scroll', requestSync, { passive: true });
  window.addEventListener('resize', onLayout);
  pinned.addEventListener('change', onLayout);
  document.fonts?.ready.then(onLayout);
  onLayout();

  // ---- Controls (open the page with ?controls in the address) ----
  // A panel for tuning RECEIPT_SETTINGS live. A design tool: visitors never see it.
  if (!new URLSearchParams(window.location.search).has('controls')) return;
  const defaults = { ...S };
  // [setting, label, min, max, step, unit]; no range = an on/off switch; 'color' = a colour picker.
  const groups = [
    ['Paper', [
      ['fps', 'Frame rate', 2, 30, 1, ' fps'],
      ['shiftEvery', 'Shift every', 0.1, 3, 0.1, ' s'],
      ['shiftAmount', 'Shift amount', 0, 4, 0.1, '×'],
      ['creaseFlip', 'Flip the creases'],
      ['wobble', 'Wobble while moving', 0, 4, 0.1, '×'],
    ]],
    ['Unroll', [
      ['unrollSeconds', 'Duration', 0.3, 8, 0.1, ' s'],
    ]],
    ['Into the pile', [
      ['moveSeconds', 'Duration', 0.3, 5, 0.1, ' s'],
      ['landShare', 'Sarah’s receipt lands by', 0.1, 1, 0.05, ''],
      ['dealShare', 'Each receipt’s slide', 0.05, 0.7, 0.05, ''],
    ]],
    ['Crumple and fall', [
      ['crumpleAfter', 'Starts after scrolling', 0, 400, 10, ' px'],
      ['stageFrames', 'Frames per drawing', 1, 6, 1, ''],
      ['staggerFrames', 'Stagger', 0, 8, 1, ' frames'],
      ['gravity', 'Gravity', 300, 9000, 100, ''],
      ['hop', 'Hop', 0, 4, 0.1, '×'],
      ['drift', 'Sideways drift', 0, 4, 0.1, '×'],
      ['spin', 'Spin', 0, 4, 0.1, '×'],
      ['ballSize', 'Ball size', 0.3, 1.4, 0.05, '×'],
    ]],
    ['Crumple look', [
      ['ballFacets', 'Facets', 3, 22, 1, ''],
      ['ballRough', 'Rough outline', 0, 0.4, 0.01, ''],
      ['ballShading', 'Light and shade', 0, 2.5, 0.05, '×'],
      ['ballSoft', 'Soft folds', 0, 1, 0.05, ''],
      ['ballCrease', 'Crease lines', 0, 3, 0.1, '×'],
      ['ballPrint', 'Print', 0, 2, 0.05, '×'],
      ['ballShade', 'Shadow colour', 'color'],
      ['ballShadow', 'Shadow', 0, 0.7, 0.02, ''],
    ]],
  ];
  const tune = document.createElement('aside');
  tune.className = 'tune';
  tune.setAttribute('aria-label', 'Receipt animation controls');
  tune.innerHTML = `
    <button class="tune__title" type="button" aria-expanded="true">Receipt controls</button>
    <div class="tune__body">
      ${groups.map(([title, rows]) => `
        <fieldset class="tune__group">
          <legend>${title}</legend>
          ${title === 'Crumple look' ? '<div class="tune__preview" title="Folded, scrunched, ball"></div>' : ''}
          ${rows.map(([key, label, min, max, step]) => (typeof min !== 'number'
    ? `<label class="tune__row tune__row--switch"><span>${label}</span><input type="${min === 'color' ? 'color' : 'checkbox'}" data-key="${key}"></label>`
    : `<label class="tune__row"><span>${label}</span><output data-out="${key}"></output><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}"></label>`)).join('')}
        </fieldset>`).join('')}
      <div class="tune__actions">
        <button type="button" data-do="unroll">Replay unroll</button>
        <button type="button" data-do="crumple">Play crumple</button>
        <button type="button" data-do="reset">Reset</button>
        <button type="button" data-do="copy">Copy values</button>
      </div>
    </div>`;
  document.body.appendChild(tune);

  const units = Object.fromEntries(groups.flatMap(([, rows]) => rows.map(([key, , , , , unit]) => [key, unit || ''])));
  const show = () => {
    tune.querySelectorAll('[data-key]').forEach((input) => {
      const value = S[input.dataset.key];
      if (input.type === 'checkbox') input.checked = value;
      else if (input.type === 'color') input.value = value;
      else {
        input.value = value;
        tune.querySelector(`[data-out="${input.dataset.key}"]`).textContent = `${value}${units[input.dataset.key]}`;
      }
    });
  };
  const preview = tune.querySelector('.tune__preview');
  preview.innerHTML = crumpleCanvases(100);
  [[30, 86], [44, 56], [72, 72]].forEach(([w, h], k) => {
    const canvas = preview.children[k];
    canvas.dataset.w = w;
    canvas.dataset.h = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  });
  const apply = () => {
    lookVersion += 1;                                   // repaint everything with the new look
    [...preview.children].forEach(ensurePainted);       // the three pictures, as they look now
    preview.style.setProperty('--ball-shadow', S.ballShadow);
    styleCrumples();
    geo = null; // sizes may have changed (ball size)
    show();
    render();
    paintSoon();
  };
  tune.addEventListener('input', (event) => {
    const input = event.target.closest('[data-key]');
    if (!input) return;
    S[input.dataset.key] = input.type === 'checkbox' ? input.checked : input.type === 'color' ? input.value : Number(input.value);
    apply();
  });
  tune.querySelector('.tune__title').addEventListener('click', (event) => {
    const open = tune.classList.toggle('is-closed') === false;
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  let previewTimer;
  tune.querySelector('.tune__actions').addEventListener('click', (event) => {
    const action = event.target.dataset.do;
    if (action === 'unroll') {
      // Back to moment 1 if need be, then roll the receipt up and let it go again.
      if (pinned.matches) window.scrollTo({ top: steps()[0], behavior: 'instant' });
      else windowEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      sync();
      move = 0;
      unroll = 0;
      target.unroll = 1;
      run();
    }
    if (action === 'crumple' && pinned.matches) {
      // At moment 2: crumple and fall, then put the receipts back.
      const atMoment2 = Math.abs(window.scrollY - steps()[1]) < 4;
      if (!atMoment2) window.scrollTo({ top: steps()[1], behavior: 'instant' });
      clearTimeout(previewTimer);
      previewGone = false;
      sync();
      previewTimer = setTimeout(() => {
        previewGone = true;
        sync();
        previewTimer = setTimeout(() => { previewGone = false; sync(); }, (crumpleFrames() / S.fps) * 1000 + 700);
      }, atMoment2 ? 0 : S.moveSeconds * 1000 + 500);
    }
    if (action === 'reset') {
      Object.assign(S, defaults);
      apply();
    }
    if (action === 'copy') {
      const text = `const RECEIPT_SETTINGS = ${JSON.stringify(S, null, 2).replace(/"(\w+)":/g, '$1:')};`;
      const done = () => { event.target.textContent = 'Copied'; setTimeout(() => { event.target.textContent = 'Copy values'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => window.prompt('Copy these values:', text));
      else window.prompt('Copy these values:', text);
    }
  });
  apply();
})();

// Section 3 card: fades up smoothly (styles.css) once most of it is on screen,
// and resets when it drops back below the screen, so it plays again.
(() => {
  const card = document.querySelector('.signal-card');
  if (!card || !document.documentElement.classList.contains('js-reveal')) return;
  new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= 0.45) card.classList.add('is-visible');
    else if (!entry.isIntersecting && entry.boundingClientRect.top > 0) card.classList.remove('is-visible');
  }, { threshold: [0, 0.45] }).observe(card);
})();

// Whitepaper page carousel: arrows, a page counter and a slow autoplay that
// pauses while the visitor hovers, focuses or has scrolled the pages themselves.
(() => {
  const carousel = document.querySelector('.wp-carousel');
  if (!carousel) return;
  const trackEl = carousel.querySelector('.wp-carousel__track');
  const slides = [...trackEl.children];
  const card = carousel.closest('.whitepaper');
  const current = card.querySelector('[data-current]');
  const total = card.querySelector('[data-total]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  total.textContent = slides.length;

  const index = () => {
    const left = trackEl.scrollLeft;
    let best = 0;
    slides.forEach((slide, i) => {
      if (Math.abs(slide.offsetLeft - trackEl.offsetLeft - left) < Math.abs(slides[best].offsetLeft - trackEl.offsetLeft - left)) best = i;
    });
    // At the very end of the row the last page may not reach the start edge.
    if (left + trackEl.clientWidth >= trackEl.scrollWidth - 2) best = slides.length - 1;
    return best;
  };
  const go = (i) => {
    const next = (i + slides.length) % slides.length;
    trackEl.scrollTo({ left: slides[next].offsetLeft - trackEl.offsetLeft });
  };

  card.querySelectorAll('.wp-carousel__btn').forEach((btn) => {
    btn.addEventListener('click', () => go(index() + Number(btn.dataset.dir)));
  });
  trackEl.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(index() + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(index() - 1); }
  });
  let settle;
  trackEl.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => { current.textContent = index() + 1; }, 60);
  }, { passive: true });

  if (reducedMotion) return;
  let paused = false;
  let onScreen = false;
  card.addEventListener('pointerenter', () => { paused = true; });
  card.addEventListener('pointerleave', () => { paused = false; });
  card.addEventListener('focusin', () => { paused = true; });
  card.addEventListener('focusout', () => { paused = false; });
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0.4 }).observe(card);
  setInterval(() => {
    if (!paused && onScreen && !document.hidden) go(index() + 1);
  }, 4500);
})();

// Cost of menopause calculator.
// The Excel model "Cost of menopause: Sword vs traditional cost" (Client Model
// and Assumptions sheets), formula for formula. The comments name the cell
// each line stands for.
// The Assumptions sheet. Not shown on the page: change the model here.
const CALCULATOR_ASSUMPTIONS = {
  specialtyVisits: 1500, // Path A: specialty visits (6 specialties x $250)
  initialVisit: 250,     // Path A: initial visit and labs
  followUps: 600,        // Path A: follow-up visits (4 visits)
  pelvicFloor: 900,      // Path A: external pelvic floor sessions (6 x $150)
  swordAso: 900,         // Path B: Sword price per woman, ASO (to confirm)
  swordInsured: 900,     // Path B: Sword price per woman, fully insured (to confirm)
  share45: 0.17,         // women 45+ as share of eligible lives (default)
  share40: 0.05,         // women 40-44 as share of eligible lives (default)
  seekLow: 0.076,        // share of women who seek care, low case
  seekBase: 0.117,       // share of women who seek care, base case
  seekHigh: 0.15,        // share of women who seek care, high case
  swordUse: 1,           // share of care-seeking women who use Sword
};

(() => {
  const form = document.querySelector('#calc-inputs');
  if (!form) return;
  const section = form.closest('.calc');
  const field = (id) => section.querySelector(`#${id}`);
  const funding = field('calc-funding');
  const lives = field('calc-lives');
  const livesRange = field('calc-lives-range');
  const slider = section.querySelector('.calc__slider');
  const women40 = field('calc-women-40');
  const women45 = field('calc-women-45');
  const included = field('calc-included');

  // Excel number formats: #,##0   $#,##0   0.0%
  const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pct1 = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Round the way Excel does: on the decimal value, not on the binary
  // fraction behind it.
  const round = (value, digits) => {
    const tidy = Number(value.toPrecision(15));
    if (!Number.isFinite(tidy) || Math.abs(tidy) < 1e-6) return 0;
    return Number(`${Math.round(Number(`${tidy}e${digits}`))}e-${digits}`);
  };
  const FORMAT = {
    savingsPct: (v) => pct1.format(round(v, 3)),
    costToday: (v) => usd.format(round(v, 0)),
    costSword: (v) => usd.format(round(v, 0)),
    savings: (v) => usd.format(round(v, 0)),
  };

  // A whole number typed with or without commas. Blank (or no digits) = null.
  const wholeNumber = (input) => {
    const digits = input.value.replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  };

  // `input`: { funding, lives, women40, women45, included }; women counts are null when blank.
  // `a`: the assumptions. Returns the low, base and high cases.
  const calculate = (input, a) => {
    const pathA = a.specialtyVisits + a.initialVisit + a.followUps + a.pelvicFloor;            // Assumptions!B9
    const counts = [input.women40, input.women45].filter((n) => n !== null);
    const women = counts.length === 0
      ? input.lives * (a.share45 + a.share40)
      : counts.reduce((sum, n) => sum + n, 0);                                                // B13:D13
    const pathB = input.funding === 'ASO' ? a.swordAso : a.swordInsured;                      // B24:D24
    const scenario = (seekShare) => {
      const share = input.included === 'All women in age bands' ? 1 : seekShare;              // row 14
      const includedWomen = women * share;                                                     // row 15
      const costToday = includedWomen * pathA;                                                 // row 19
      const swordUsers = includedWomen * a.swordUse;                                           // row 23
      const costSword = swordUsers * pathB + (includedWomen - swordUsers) * pathA;             // row 25
      const savings = costToday - costSword;                                                   // row 26
      return {
        women, share, included: includedWomen, pathA, costToday,
        perLife: input.lives === 0 ? 0 : costToday / input.lives,                              // row 20
        swordUsers, pathB, costSword, savings,
        savingsPct: costToday === 0 ? 0 : savings / costToday,                                 // row 27
      };
    };
    return { low: scenario(a.seekLow), base: scenario(a.seekBase), high: scenario(a.seekHigh) };
  };

  const outputs = [...section.querySelectorAll('[data-calc]')];

  const update = () => {
    const a = CALCULATOR_ASSUMPTIONS;
    const input = {
      funding: funding.value,
      lives: wholeNumber(lives) ?? 0,
      women40: wholeNumber(women40),
      women45: wholeNumber(women45),
      included: included.value,
    };
    const model = calculate(input, a);
    outputs.forEach((el) => {
      el.textContent = FORMAT[el.dataset.calc](model[el.dataset.case || 'base'][el.dataset.calc]);
    });

    // The filled part of the slider's track, up to the thumb.
    const min = Number(livesRange.min);
    const max = Number(livesRange.max);
    slider.style.setProperty('--fill', (((Number(livesRange.value) - min) / (max - min)) * 100).toFixed(2));
    // What a blank women count stands for.
    women40.placeholder = `Default: ${count.format(round(input.lives * a.share40, 0))}`;
    women45.placeholder = `Default: ${count.format(round(input.lives * a.share45, 0))}`;

  };

  // Whole-number fields: tidy the commas once the visitor has finished typing.
  const tidy = (input, blankAllowed) => {
    const value = wholeNumber(input);
    input.value = value === null ? (blankAllowed ? '' : '0') : count.format(value);
  };
  lives.addEventListener('change', () => tidy(lives, false));
  [women40, women45].forEach((input) => input.addEventListener('change', () => tidy(input, true)));
  // The slider and the typed number are the same value. Each one moves the
  // other, but the slider is never written to while it is the one being used:
  // some browsers drop the drag when a script sets its value.
  livesRange.addEventListener('input', () => { lives.value = count.format(Number(livesRange.value)); });
  lives.addEventListener('input', () => { livesRange.value = wholeNumber(lives) ?? 0; }); // stops at the slider's ends

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
})();

// Navbar: switch its frosted bar on once the page has scrolled a little.
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', update, { passive: true });
  update();
})();

// FAQ: slide answers open and shut instead of snapping.
(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.faq__item').forEach((item) => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('.faq__answer');
    if (!summary || !answer || !answer.animate) return;
    let running = null;

    summary.addEventListener('click', (event) => {
      if (reducedMotion) return; // native open/close, no animation
      event.preventDefault();
      const opening = !item.open || item.classList.contains('is-closing');

      // Where the answer is right now: mid-animation if a previous click is
      // still playing (so a quick second click reverses smoothly), otherwise
      // fully open or fully shut.
      const style = getComputedStyle(answer);
      const current = running
        ? { height: style.height, paddingBottom: style.paddingBottom, opacity: style.opacity }
        : null;
      if (running) running.cancel();

      item.classList.toggle('is-open', opening);
      item.classList.toggle('is-closing', !opening);
      item.open = true; // keep the answer rendered while it animates

      const full = { height: `${answer.scrollHeight}px`, paddingBottom: getComputedStyle(answer).paddingBottom, opacity: 1 };
      const shut = { height: '0px', paddingBottom: '0px', opacity: 0 };
      running = answer.animate([current || (opening ? shut : full), opening ? full : shut], {
        duration: 380,
        easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)',
      });
      running.onfinish = () => {
        running = null;
        if (!opening) {
          item.open = false;
          item.classList.remove('is-closing');
        }
      };
    });
  });
})();
