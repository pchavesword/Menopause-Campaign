// Video frames: add data-video-src="<url>" (and data-video-title, its name for
// screen readers) to a .video element. The play button swaps the poster for an
// inline player and starts it, with sound, since the visitor asked for it. The
// file only starts loading then. When the video ends, the poster and the play
// button come back, ready to play it again. Without data-video-src the button
// does nothing.
document.querySelectorAll('.video').forEach((frame) => {
  const button = frame.querySelector('.play');
  const src = frame.dataset.videoSrc;
  if (!button || !src) return;
  const still = [...frame.childNodes]; // the poster and the button
  const poster = frame.querySelector('.video__poster');
  let video = null;

  button.addEventListener('click', () => {
    if (!video) {
      video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'auto';
      if (poster) video.poster = poster.currentSrc || poster.src;
      if (frame.dataset.videoTitle) video.setAttribute('aria-label', frame.dataset.videoTitle);
      video.addEventListener('ended', () => {
        const hadFocus = document.activeElement === video;
        frame.classList.remove('is-playing');
        frame.replaceChildren(...still);
        video.currentTime = 0;
        if (hadFocus) button.focus({ preventScroll: true });
      });
    }
    frame.classList.add('is-playing');
    frame.replaceChildren(video);
    video.play().catch(() => {}); // if the browser refuses, its own controls can start it
    video.focus({ preventScroll: true });
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
// The receipts: the hero and section 2
// ---------------------------------------------------------------------------
// The paper is meant to look hand-made. Everything the receipts do runs at a
// low frame rate (stop-motion), and once a second every receipt shifts a hair.
// Text, and the card in section 3, stay smooth.
//
//   intro      as the page opens, the background appears, then the title a
//              word at a time ("The hidden costs of menopause"; each word
//              simply appears). The receipt
//              unrolls in the middle of the hero, between the title's two
//              halves, then feeds upward like a till printer, taking the
//              title up and away with it, until only its end hangs down from
//              the top; the navbar and the headline, under it, fade in as it
//              gets there.
//   moment 1   that receipt comes down with the page, tears in half, and the
//              two halves come to rest side by side, so the whole year shows
//              at once. They stay there: going back up, the hero simply has
//              its receipt again.
//   moment 2   the two halves shrink into a collage, and other people's
//              receipts deal out from behind them.
//   leaving    every receipt crumples into a ball and falls out of the panel.
//
// The tear, moment 2 and "leaving" only happen where the panel is pinned
// (desktop). Elsewhere the receipt in section 2 is simply shown in two halves
// and the collage is a still picture.

// Everything about how the receipts move. Open the page with ?controls in the
// address (for example http://localhost:8080/?controls) for a panel that
// changes these live; its "Copy values" button gives this object back.
const RECEIPT_SETTINGS = {
  fps: 6,              // frames per second of everything the receipts do
  shiftEvery: 0.8,     // seconds between the paper's small shifts
  shiftAmount: 2,      // size of those shifts (1 = up to 0.8px and 0.65 degrees either way)
  creaseFlip: true,    // mirror the paper's creases at random when it shifts
  wobble: 1,           // stop-motion imperfection while receipts move (0 = none)
  edgeRough: 1,        // how uneven the long sides of the paper are, as if cut by hand (0 = ruler-straight)
  titleDelay: 0.4,     // the intro's title: seconds from the background starting to appear to the first word
  titleStagger: 0.2,   // seconds between one word and the next
  titleLastStagger: 0.5, // seconds before the last word ("menopause"): a longer pause
  titleHold: 0.8,      // seconds from the last word appearing to the receipt appearing
  unrollSeconds: 4,    // the receipt: on the roll -> hanging from the top of the hero
  unrollEase: 4,       // how the roll comes down: 1 = even speed, higher = a slower start that speeds up
  introTextAt: 0.8,    // share of the intro after which the navbar and the headline fade in
  tearTravel: 0.6,     // hero -> moment 1: the receipt coming down to where it tears (the page arrives meanwhile)
  tearSeconds: 1,      // the tear itself: tugged, ripped across, then the halves parting
  tearFps: 6,          // frames per second while it tears (it can have more drawings than the rest: try 12)
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
// Sarah's is her receipt torn in half (both halves, side by side), on top.
const SARAH_SLOT = [240, 94, 380, 0, 10];
const OTHER_RECEIPTS = [
  {
    name: 'Maria Alvarez', age: 49, id: 'MA730145528', group: '061907', plan: 'Select HMO', planId: 'HMO-26104',
    member: 240, savings: 268.35, slot: [33, 49, 96, -9, 2],
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
    member: 260, savings: 298.45, slot: [372, 262, 96, 8, 8],
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
    member: 215, savings: 247.3, slot: [108, 296, 96, 7, 9],
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
  const hero = document.querySelector('.hero');
  const stage = hero && hero.querySelector('.hero__stage');
  const slot = stage && stage.querySelector('.hero__slot');
  if (!panel || !windowEl || !morph || !sarah || !collage || !slot) return;

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

  // A clean copy of Sarah's receipt, taken before anything is styled: every
  // other receipt on the page is made from it.
  const blank = sarah.cloneNode(true);
  blank.classList.remove('receipt--sarah');
  blank.removeAttribute('aria-label');

  // A copy of Sarah's receipt, filled in with someone else's claims.
  const receiptFor = (person) => {
    const el = blank.cloneNode(true);
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

  // ---- The hero's receipt: Sarah's, without her details ----
  const heroReceipt = blank.cloneNode(true);
  heroReceipt.querySelector('.receipt__member + .receipt__rule').remove();
  heroReceipt.querySelector('.receipt__member').remove();
  heroReceipt.querySelector('.receipt__claims .receipt__heading').remove();
  const mover = document.createElement('div');
  mover.className = 'hero__mover';
  mover.style.visibility = 'hidden'; // until the intro starts
  mover.appendChild(heroReceipt);
  slot.appendChild(mover);
  const heroPaper = heroReceipt.querySelector('.receipt__paper');
  const heroRoll = heroReceipt.querySelector('.receipt__roll');

  // ---- The receipt torn in half ----
  // The two halves sit in a box 636 wide (a half is 297.39 wide, as in the
  // design); its height depends on where the receipt tears. For each half:
  // where its top left corner rests in that box and how it is turned.
  // styles.css places the halves at rest; these numbers are for moving them.
  const HALVES = {
    w: 636,
    part: 297.39,
    top: { x: 6.43, y: 28, r: -1.2 },
    bottom: { x: 330, y: 6, r: 2 },
    edge: 4.5, // how far the torn edge strays either side of the tear line, in receipt units (1/371 of its width)
  };
  const turn = (degrees) => (degrees * Math.PI) / 180;
  // The torn edge: 41 points across the paper, each -1 to 1. A slow drift plus
  // a fine jitter, the same for both halves so they fit back together.
  const EDGE = Array.from({ length: 41 }, (_, i) => {
    const coarse = i / 6;
    const drift = lerp(hash(Math.floor(coarse), 91), hash(Math.floor(coarse) + 1, 91), smooth(0, 1, coarse % 1));
    return Math.max(-1, Math.min(1, (drift - 0.5) * 1.5 + (hash(i, 92) - 0.5) * 0.9));
  });
  // `receipt` becomes the top half; a copy of it shows the bottom half.
  const makeHalves = (receipt) => {
    const copy = receipt.cloneNode(true);
    copy.classList.remove('receipt--sarah');
    copy.removeAttribute('aria-label');
    copy.setAttribute('aria-hidden', 'true');
    const halves = document.createElement('div');
    halves.className = 'halves';
    [['top', receipt], ['bottom', copy]].forEach(([kind, el]) => {
      const half = document.createElement('div');
      half.className = `half half--${kind}`;
      const clip = document.createElement('div');
      clip.className = 'half__clip';
      clip.appendChild(el);
      half.appendChild(clip);
      halves.appendChild(half);
    });
    return halves;
  };
  const sarahHalves = makeHalves(sarah);
  morph.replaceChildren(sarahHalves);
  windowEl.classList.add('is-torn');
  windowEl.parentElement.classList.add('has-halves');
  const halfEls = [...sarahHalves.querySelectorAll('.half')]; // [top, bottom]

  // Where the receipt tears, and everything that follows from it. The tear
  // runs along the gap between two visits, the one nearest the middle, so no
  // line of print is cut. `torn`, in receipt units: `at` = the tear line,
  // `long` = the whole receipt; `h` = the height of the halves' box.
  let torn = null;
  const layoutHalves = () => {
    const unit = sarah.offsetWidth / 371;
    if (!unit) return;
    const body = sarah.querySelector('.receipt__body');
    const long = sarah.querySelector('.receipt__paper').offsetHeight / unit;
    const gaps = [...sarah.querySelectorAll('.visit + .visit')].map((visit) => (body.offsetTop + visit.offsetTop) / unit);
    const at = gaps.length ? gaps.reduce((best, y) => (Math.abs(y - long / 2) < Math.abs(best - long / 2) ? y : best)) : long / 2;
    const edge = HALVES.edge;
    const shown = [at + edge, long - at + edge]; // receipt units each half shows, torn edge included
    const scale = HALVES.part / 371;             // box units per receipt unit
    const h = 6 + Math.max(...['top', 'bottom'].map((kind, i) => HALVES[kind].y
      + shown[i] * scale * Math.cos(turn(HALVES[kind].r)) + HALVES.part * Math.abs(Math.sin(turn(HALVES[kind].r)))));
    torn = { at, long, h };
    // The same torn edge on both halves: along the bottom of one, the top of the other.
    const along = (from, of) => EDGE.map((offset, i) => `${(100 - i * 2.5).toFixed(1)}% ${(((from + offset * edge) / of) * 100).toFixed(3)}%`);
    document.querySelectorAll('.halves').forEach((halves) => {
      halves.style.aspectRatio = `${HALVES.w} / ${h.toFixed(2)}`;
      ['top', 'bottom'].forEach((kind, i) => {
        const half = halves.children[i];
        half.style.setProperty('--py', ((HALVES[kind].y / h) * 100).toFixed(3));
        const clip = half.firstElementChild;
        clip.style.aspectRatio = `371 / ${shown[i].toFixed(2)}`;
        clip.style.clipPath = i === 0
          ? `polygon(0 0, 100% 0, ${along(at, shown[0]).join(', ')})`
          : `polygon(${along(edge, shown[1]).reverse().join(', ')}, 100% 100%, 0 100%)`;
      });
    });
    morph.style.setProperty('--ratio', (HALVES.w / h).toFixed(4));
  };

  // ---- Uneven sides ----
  // The paper is one picture stretched over each receipt, so its long sides
  // come out ruler-straight. Real paper cut by hand is not: here each sheet
  // is clipped to a many-sided shape whose sides stray inwards a little: a
  // long bow, a slower wander and a finer one, different for every receipt
  // and for each side. The two halves
  // of a torn receipt share one shape, so they still fit together. Distances
  // are in receipt units (1/371 of the width), so every size looks alike.
  const edgeSeeds = new WeakMap();
  let edgeSeedCount = 0;
  const wander = (at, salt) => lerp(hash(Math.floor(at), salt), hash(Math.floor(at) + 1, salt), smooth(0, 1, at % 1));
  const roughEdges = () => {
    document.querySelectorAll('.receipt__sheet').forEach((sheet) => {
      const unit = sheet.offsetWidth / 371;
      if (!unit) return; // not on the page right now
      const long = sheet.offsetHeight / unit;
      const group = sheet.closest('.halves') || sheet.closest('.receipt');
      if (!edgeSeeds.has(group)) edgeSeeds.set(group, (edgeSeedCount += 1));
      const seed = edgeSeeds.get(group) * 16;
      const key = `${seed}:${Math.round(long)}:${S.edgeRough}`;
      if (sheet.dataset.edge === key) return;
      sheet.dataset.edge = key;
      if (!S.edgeRough) {
        sheet.style.clipPath = '';
        return;
      }
      const count = Math.max(6, Math.round(long / 14));
      // How far a side strays in from the edge of the box, `y` units down it.
      const stray = (side, i) => {
        const y = (i / count) * long;
        const salt = seed + side * 4;
        return S.edgeRough * (4.8 * wander(y / 620, salt) + 2.2 * wander(y / 150, salt + 1) + 1 * wander(y / 36, salt + 2) + 0.35 * hash(i, salt + 3));
      };
      const points = [];
      for (let i = 0; i <= count; i += 1) points.push(`${((stray(0, i) / 371) * 100).toFixed(3)}% ${((i / count) * 100).toFixed(2)}%`);
      for (let i = count; i >= 0; i -= 1) points.push(`${(100 - (stray(1, i) / 371) * 100).toFixed(3)}% ${((i / count) * 100).toFixed(2)}%`);
      sheet.style.clipPath = `polygon(${points.join(', ')})`;
    });
  };

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
  addPiece(makeHalves(blank.cloneNode(true)), SARAH_SLOT, true);
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

  let unroll = 0;            // the intro: 0 = on the roll, 1 = settled in the hero
  let tear = 0;              // 0 = the hero's long receipt, 1 = torn in half in moment 1
  let move = 0;              // 0 = moment 1, 1 = moment 2
  let crumple = 0;           // frames into the crumple-and-fall (0 = flat)
  let pop = POP_FRAMES;      // frames into popping back flat
  const target = { tear: 0, move: 0, gone: false };
  let onScreen = false;
  let previewGone = false;   // the controls panel playing the crumple on its own

  // ---- Intro (the hero) ----
  //   1. the background fades in
  //   2. the title appears, a word at a time
  //   3. the receipt appears and unrolls down the hero
  //   4. the paper feeds upward and takes the title up and away with it
  //   5. the navbar and the headline fade in
  // styles.css does the fading in 1 and 5; timers switch the words on in 2;
  // `unroll` is 3 and 4.
  let introOn = false;       // the receipt has been let go
  let held = document.documentElement.classList.contains('intro-hold');
  const title = stage.querySelector('.intro-title');
  const titleWords = title ? [...title.querySelectorAll('.intro-title__word')] : [];
  let titleStarted = false;
  let titleDone = !title;    // the title has had its time on its own
  let paperReady = false;    // the paper's image has loaded
  let titleTimers = [];
  const showBackground = () => document.documentElement.classList.remove('intro-pre');
  const hideTitle = () => {
    titleTimers.forEach(clearTimeout);
    titleTimers = [];
    if (!title) return;
    title.hidden = true;
    titleWords.forEach((word) => word.classList.remove('is-on'));
    title.style.transform = '';
  };
  // Let the navbar, the hero copy and the scroll cue fade in.
  const release = () => {
    if (!held) return;
    held = false;
    document.documentElement.classList.remove('intro-hold');
  };
  const finishIntro = () => {
    unroll = 1;
    introOn = true;
    titleDone = true;
    mover.style.visibility = '';
    showBackground();
    hideTitle();
    release();
  };
  // Step 3: the receipt, once the title has had its time and the paper has loaded.
  const startIntro = () => {
    if (introOn || !titleDone || !paperReady) return;
    introOn = true;
    mover.style.visibility = '';
    render();
    run();
  };
  // Steps 1 and 2.
  const startTitle = () => {
    if (titleStarted) return;
    titleStarted = true;
    showBackground();
    if (!title || titleDone || unroll >= 1) return;
    title.hidden = false;
    // Each word simply appears, one after the other; then the receipt.
    const after = (seconds, what) => titleTimers.push(setTimeout(what, seconds * 1000));
    // The last word waits a little longer than the others.
    const last = titleWords.length - 1;
    const at = (i) => S.titleDelay + Math.min(i, Math.max(0, last - 1)) * S.titleStagger + (i === last && last > 0 ? S.titleLastStagger : 0);
    titleWords.forEach((word, i) => after(at(i), () => word.classList.add('is-on')));
    after(at(last) + S.titleHold, () => {
      titleDone = true;
      startIntro();
    });
  };
  const DOWN = 0.22; // share of the intro the roll takes to travel down the hero
  const renderIntro = () => {
    if (introOn && unroll >= S.introTextAt) release();
    if (unroll >= 1) {
      if (title && !title.hidden) hideTitle();
      if (mover.style.transform) {
        heroReceipt.classList.remove('is-rolled');
        mover.style.transform = '';
        heroPaper.style.removeProperty('--hidden');
      }
      return;
    }
    const full = heroPaper.offsetHeight;
    const width = slot.offsetWidth;
    const frame = hero.getBoundingClientRect();
    const restBottom = slot.getBoundingClientRect().bottom - frame.top;
    // Where the top of the paper starts: --paper-start in styles.css (129 of 880 on desktop).
    const start = frame.height * (parseFloat(getComputedStyle(hero).getPropertyValue('--paper-start')) || 129 / 880);
    const below = frame.height + 30;            // the roll, out of sight under the hero
    let top = start;
    let out;                                    // px of paper off the roll
    if (unroll <= DOWN) {
      // 1. In the middle: the roll travels down the hero and off its bottom edge.
      const reach = below - start;
      //    It starts slowly and speeds up (unrollEase).
      out = lerp(Math.min(reach, width * 0.3), reach, Math.pow(unroll / DOWN, S.unrollEase));
    } else {
      // 2. The paper feeds upward. The roll stays under the hero until it has
      //    given out all its paper; then the end of the receipt comes up into
      //    view and stops above the copy.
      top = lerp(start, restBottom - full, easeInOut((unroll - DOWN) / (1 - DOWN)));
      out = Math.min(full, below - top);
    }
    const left = full - out;
    const shake = unroll > 0 ? (rand() - 0.5) * 2 * S.wobble : 0;
    heroReceipt.classList.toggle('is-rolled', left > 0.5);
    heroPaper.style.setProperty('--hidden', `${left.toFixed(1)}px`);
    heroRoll.style.setProperty('--roll-y', `${out.toFixed(1)}px`);
    heroRoll.style.setProperty('--roll-r', `${Math.sqrt(9 + left * 0.5).toFixed(1)}px`);
    mover.style.transform = `translate(${shake.toFixed(1)}px, ${(top - (restBottom - full)).toFixed(1)}px)`;
    // The title rides up with the paper, frame for frame.
    if (title) title.style.transform = top < start ? `translateY(${(top - start).toFixed(1)}px)` : '';
  };

  // ---- Tear (pinned only) ----
  // While the receipt tears it keeps its own course across the screen,
  // whatever the page is doing underneath it: from where the hero's receipt
  // hangs to where the two halves rest once the panel has pinned. It only
  // ever plays forwards, and at its own frame rate (S.tearFps), which can be
  // set higher than the rest so a quick tear gets more drawings. `tear` runs through:
  //   travel  the strip comes down with the page, from the first frame, until
  //           the tear line is in the middle of the screen
  //   tug     the whole strip tilts a little: it is about to give
  //   rip     the tear starts at the right edge and runs across to the left,
  //           the two halves swinging open behind it
  //   part    the halves fly to their places, side by side, the top one
  //           first; they overshoot a touch and settle
  // `anchors` are the two ends of that course, on screen; `tearPose` is where
  // the halves are right now, on screen: [top, bottom], each { x, y, r, s }.
  let anchors = null;
  let tearPose = null;
  const TUG = 0.15;      // share of S.tearSeconds by which the strip has been tugged
  const RIP = 0.45;      // ... and by which it has ripped right across; then the halves part
  const TUG_TURN = 1.5;  // degrees the strip tilts when tugged
  const OPEN = [-7, 9];  // degrees each half has swung open once ripped across [top, bottom]
  const LAG = [0, 0.15]; // share of the parting each half waits before it sets off
  // Ease-out that goes a little past the end and comes back (`over` = how far).
  const settle = (v, over) => 1 + (over + 1) * (v - 1) ** 3 + over * (v - 1) ** 2;
  const clearTear = () => {
    halfEls.forEach((el) => ['--dx', '--dy', '--r', '--s'].forEach((name) => el.style.removeProperty(name)));
    tearPose = null;
    anchors = null;
  };
  // One stop-motion frame: work out where the halves should be.
  const poseTear = () => {
    if (!torn) layoutHalves();
    if (!anchors) {
      const from = heroReceipt.getBoundingClientRect();
      const box = morph.getBoundingClientRect();
      const frame = panel.getBoundingClientRect();
      const pinTop = parseFloat(getComputedStyle(panel).top) || 0;
      // Sarah's receipt is longer than the hero's (her details). Line the two
      // up at whichever end of the hero's receipt is inside the hero.
      const top = from.top >= hero.getBoundingClientRect().top ? from.top : from.bottom - (torn.long * from.width) / 371;
      anchors = { x: from.left, y: top, w: from.width, fx: box.left, fy: pinTop + box.top - frame.top };
    }
    const k = morph.offsetWidth / HALVES.w;       // px per box unit, at rest
    const u = anchors.w / 371;                    // px per receipt unit, in the hero
    const big = anchors.w / (HALVES.part * k);    // the halves' size in the hero, against their size at rest
    const edge = HALVES.edge;
    // 1. One long strip, as in the hero.
    const strip = [
      { x: anchors.x, y: anchors.y, r: 0, s: big },
      { x: anchors.x, y: anchors.y + (torn.at - edge) * u, r: 0, s: big },
    ];
    // 2. Still one strip, come down to where it tears. `hinge` is the left end
    //    of the tear line: in the middle of the screen, a little above centre,
    //    so the end of one half and the start of the other are both in view.
    const size = lerp(big, 1, 0.45);
    const wide = (anchors.w * size) / big;        // a half's width while it tears, px
    const hinge = [lerp(anchors.x, anchors.fx + HALVES.bottom.x * k, 0.5), Math.max(anchors.fy + HALVES.bottom.y * k + 30, window.innerHeight * 0.42)];
    // A half turned by `degrees` about the tip of the tear: the point of the
    // tear line `across` of the way along it (0 = its left end, at `hinge`;
    // 1 = its right end). `below`: px from the half's top left corner down to
    // the tear line.
    const hung = (degrees, below, across = 0) => {
      const a = turn(degrees);
      const along = across * wide;
      return {
        x: hinge[0] + along - along * Math.cos(a) + below * Math.sin(a),
        y: hinge[1] - along * Math.sin(a) - below * Math.cos(a),
        r: degrees,
        s: size,
      };
    };
    const toTear = [(torn.at * u * size) / big, (edge * u * size) / big];
    const ready = toTear.map((below) => hung(0, below));
    // 3. Ripped right across: each half hangs from the hinge, swung its own
    //    way, so the gap is widest on the right.
    const ripped = toTear.map((below, i) => hung(OPEN[i], below));
    // 4. Side by side, at rest.
    const apart = ['top', 'bottom'].map((kind) => ({ x: anchors.fx + HALVES[kind].x * k, y: anchors.fy + HALVES[kind].y * k, r: HALVES[kind].r, s: 1 }));

    const travel = S.tearTravel / (S.tearTravel + S.tearSeconds); // share of `tear` spent coming down
    const p = (tear - travel) / (1 - travel);                      // how far through the tear itself
    let pose;
    if (p <= 0) {
      // Coming down: quick off the mark.
      const t = easeOut(tear / travel);
      pose = strip.map((from, i) => ({ x: lerp(from.x, ready[i].x, t), y: lerp(from.y, ready[i].y, t), r: 0, s: lerp(from.s, size, t) }));
    } else if (p < TUG) {
      // Tugged: still one strip, tilted about the right end of the tear line.
      pose = toTear.map((below) => hung(TUG_TURN * easeOut(p / TUG), below, 1));
    } else if (p < RIP) {
      // Ripping: the tip of the tear runs from the right edge to the left,
      // and the halves swing open about it, slowly at first.
      const v = (p - TUG) / (RIP - TUG);
      pose = toTear.map((below, i) => hung(lerp(TUG_TURN, OPEN[i], v * v), below, 1 - v));
    } else {
      // Parting: off quickly, sideways a touch ahead of up and down, past
      // their places and back. The top half goes first.
      const v = (p - RIP) / (1 - RIP);
      pose = ripped.map((from, i) => {
        const t = clamp01((v - LAG[i]) / (1 - LAG[i]));
        return {
          x: lerp(from.x, apart[i].x, settle(t, 0.8)),
          y: lerp(from.y, apart[i].y, settle(t ** 1.25, 0.8)),
          r: lerp(from.r, apart[i].r, settle(t, 2)),
          s: lerp(from.s, 1, easeOut(t)),
        };
      });
    }
    const wobble = (amount) => (rand() - 0.5) * amount * S.wobble;
    tearPose = pose.map((at) => ({ x: at.x + wobble(3), y: at.y + wobble(3), r: at.r + wobble(0.8), s: at.s }));
  };
  // Every screen frame while tearing: put the halves there, wherever the page
  // has scrolled to in the meantime.
  const placeTear = () => {
    if (!tearPose) return;
    const box = morph.getBoundingClientRect();
    const k = box.width / HALVES.w;
    tearPose.forEach((pose, i) => {
      const rest = i ? HALVES.bottom : HALVES.top;
      const style = halfEls[i].style;
      style.setProperty('--dx', `${(pose.x - box.left - rest.x * k).toFixed(1)}px`);
      style.setProperty('--dy', `${(pose.y - box.top - rest.y * k).toFixed(1)}px`);
      style.setProperty('--r', `${pose.r.toFixed(2)}deg`);
      style.setProperty('--s', pose.s.toFixed(4));
    });
  };
  const renderTear = () => {
    // The hero keeps its own receipt; it only steps aside while the strip
    // that tears is on its way down. The two halves rest in section 2.
    slot.style.visibility = tear > 0 && tear < 1 ? 'hidden' : '';
    if (tear <= 0 || tear >= 1) {
      if (tearPose || anchors) clearTear();
      return;
    }
    poseTear();
    placeTear();
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
      const w = piece.el.offsetWidth * (piece.isSarah ? 0.36 : 1); // Sarah's is two halves: crumple it like one receipt
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

  // Where the pile is on screen as the receipts let go. If the page has already
  // carried it up and away (a fast scroll), it counts as no higher than a
  // little above its pinned place, so the crumpling is always in view.
  let pile = null;
  const markPile = () => {
    const box = collage.getBoundingClientRect();
    const frame = panel.getBoundingClientRect();
    const pinTop = parseFloat(getComputedStyle(panel).top) || 0;
    const pinnedTop = pinTop + box.top - frame.top;
    pile = {
      left: box.left,
      top: Math.max(box.top, pinnedTop - 160),
      show: frame.bottom > 0 && frame.top < window.innerHeight,
    };
  };

  const renderCollage = () => {
    if (!geo) measure();
    const moving = move > 0 && move < 1 && !reducedMotion;
    const wobble = (amount) => (moving ? (rand() - 0.5) * amount * S.wobble : 0); // stop-motion imperfection
    const landing = easeInOut(clamp01(move / S.landShare));
    const landed = landing >= 1;

    // Sarah's two halves fly to her place in the collage; once there, the
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
      // All of it is drawn in the layer over the whole screen, where the pile
      // was when the receipts let go (`pile`): the crumpling stays put on
      // screen, however fast the page scrolls on underneath it.
      const fall = Math.max(0, frame - 3 * S.stageFrames) / S.fps; // seconds spent falling
      let [x, y] = geo.at[i];
      let show = frame > 0 && !fallen;
      if (show) {
        if (!piece.launch) {
          if (!pile) markPile();
          piece.launch = [pile.left + x, pile.top + y, pile.show];
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
    renderIntro();
    if (pinned.matches) {
      renderTear();
      renderCollage();
    }
  };

  // ---- Stepping ----
  // One frame closer to the targets. Returns true while there is more to do.
  const advance = () => {
    let busy = false;
    const wantMove = target.gone ? 1 : target.move;

    // The intro plays once, on its own clock. Moving on down the page cuts it short.
    if (unroll < 1) {
      if (reducedMotion || (pinned.matches && (target.tear || wantMove))) finishIntro();
      else if (introOn) {
        unroll = Math.min(1, unroll + 1 / framesFor(S.unrollSeconds));
        busy = busy || unroll < 1;
      }
    }

    if (pinned.matches) {
      if (!target.tear) tear = 0;                                       // back at the hero: nothing plays in reverse
      else if (wantMove && tear < 1) tear = 1;                          // skipped ahead: no time to tear
      else if (tear < 1) {
        tear = reducedMotion ? 1 : Math.min(1, tear + 1 / Math.max(1, Math.round((S.tearTravel + S.tearSeconds) * S.tearFps)));
        busy = busy || tear < 1;
      }
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
    const tearing = pinned.matches && target.tear && tear < 1; // the tear has its own frame rate
    if (now - lastFrame >= 1000 / (tearing ? S.tearFps : S.fps) - 4) {
      lastFrame = now;
      const busy = advance();
      render();
      if (!busy) { running = false; return; }
    } else placeTear(); // between frames: keep the tearing receipt steady while the page scrolls under it
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
    const frameBox = panel.getBoundingClientRect();
    onScreen = (frameBox.bottom > 0 && frameBox.top < window.innerHeight) || hero.getBoundingClientRect().bottom > 0;

    // Scrolled on before the intro was over: finish it at once.
    if (unroll < 1 && window.scrollY > 40) {
      finishIntro();
      run();
    }

    let tearTo = 1;
    let moveTo = 0;
    let gone = false;
    if (pinned.matches) {
      // The receipt tears as the page leaves the hero for moment 1, and is
      // ready to do it again once the page is back up. A glide counts as
      // already there, so the receipt sets off with it.
      const y = animating ? glideTo : window.scrollY;
      tearTo = y > steps()[0] * (target.tear ? 0.5 : 0.2) ? 1 : 0;
      const p = progress();
      // A little stickiness, so each moment starts as soon as the page moves towards it.
      moveTo = p > (target.move ? 0.5 : 0.2) ? 1 : 0;
      // Past moment 2 the page scrolls freely: the receipts crumple once it has
      // moved on by S.crumpleAfter px, and come back if it returns.
      const past = (p - MOMENT_2_AT) * (track.offsetHeight - panel.offsetHeight);
      gone = previewGone || past > S.crumpleAfter * (target.gone ? 0.4 : 1);
    }
    if (tearTo === target.tear && moveTo === target.move && gone === target.gone) return;
    if (gone && !target.gone) markPile(); // the receipts let go here
    if (!gone) pile = null;
    target.tear = tearTo;
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
  // [what shifts, the first letter of its variables, how much it turns]. A
  // whole receipt shifts its paper (--jx, --jy, --jr); a torn one shifts its
  // two halves (--wx, --wy, --wr). The big ones turn less.
  const shifting = [
    [heroPaper, 'j', 0.25],
    ...halfEls.map((el) => [el, 'w', 0.25]),
    ...pieces.flatMap((piece) => (piece.isSarah
      ? [...piece.receipt.querySelectorAll('.half')].map((el) => [el, 'w', 0.4])
      : [[piece.receipt.querySelector('.receipt__paper'), 'j', 1]])),
  ];
  const shiftPaper = () => {
    setTimeout(shiftPaper, Math.max(0.05, S.shiftEvery) * 1000);
    if (!onScreen || document.hidden) return;
    shifting.forEach(([sheet, v, size]) => {
      sheet.style.setProperty(`--${v}x`, `${((Math.random() - 0.5) * 1.6 * S.shiftAmount).toFixed(2)}px`);
      sheet.style.setProperty(`--${v}y`, `${((Math.random() - 0.5) * 1.6 * S.shiftAmount).toFixed(2)}px`);
      sheet.style.setProperty(`--${v}r`, `${((Math.random() - 0.5) * 1.3 * size * S.shiftAmount).toFixed(2)}deg`);
      sheet.style.setProperty('--flip', S.creaseFlip && Math.random() < 0.5 ? -1 : 1);
    });
  };
  if (!reducedMotion) shiftPaper();

  // Step-by-step scrolling through the hero and the two moments: one swipe
  // (wheel, trackpad, key press or touch swipe) glides from the hero to moment
  // 1, and from moment 1 to moment 2 (and back the same way, up to the top of
  // the page). The rest of that swipe, including trackpad momentum, is
  // swallowed so it can't carry past a step. From moment 2 on, the page
  // scrolls normally: nothing snaps on the way out, and coming back up it
  // only catches on moment 2.
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
  let glideTo = 0;         // where the current glide is heading
  let pendingDir = 0;      // a swipe made while gliding: taken as soon as the glide ends

  const glide = (to) => {
    locked = true;
    animating = true;
    glideTo = to;
    glideStart = performance.now();
    sync(); // the receipts set off with the glide
    const from = window.scrollY;
    const distance = to - from;
    const duration = reducedMotion ? 0 : 700;
    const t0 = performance.now();
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const frame = (now) => {
      const k = duration ? Math.min(1, (now - t0) / duration) : 1;
      window.scrollTo({ top: from + distance * ease(k), behavior: 'instant' });
      placeTear(); // the tearing receipt holds its place on screen as the page moves
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
    if (y < s0 - 2) return dir > 0 ? s0 : (y > 2 ? 0 : null);           // in the hero: on to moment 1, or back to the top
    if (y > s1 + 2) return dir < 0 && y + delta <= s1 ? s1 : null;      // arriving from below
    if (dir > 0) return y < s1 - 2 ? s1 : null;                         // at moment 2 going down: scroll normally
    return y > s0 + 2 ? s0 : 0;                                         // back a step: to moment 1, or to the hero
  };
  const inside = (y) => y <= steps()[1] + 2;

  // Telling a new swipe from the momentum of the last one: momentum only ever
  // fades, so a new swipe shows up as a pause in the events or a sudden jump
  // in their size.
  let lastWheel = 0;
  const recent = [];
  // While a pop-up is open (the download form) the page behind it stays put.
  const modalOpen = () => document.querySelector('dialog[open]') !== null;
  window.addEventListener('wheel', (event) => {
    if (!pinned.matches || event.ctrlKey || modalOpen()) return; // ctrlKey = pinch zoom
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
    if (!pinned.matches || animating || modalOpen() || event.target.closest?.('input, select, textarea, [contenteditable]')) return;
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
    if (!pinned.matches || touchY === null || modalOpen()) return;
    const y = window.scrollY;
    const dir = Math.sign(touchY - event.touches[0].clientY);
    if (animating || (inside(y) && targetFor(y, dir, 0) !== null)) event.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', (event) => {
    if (!pinned.matches || touchY === null || animating || modalOpen()) return;
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
      const pts = [0, ...steps()];
      if (pts.some((p) => Math.abs(p - y) <= 2)) return;
      glide(pts.reduce((a, p) => (Math.abs(p - y) < Math.abs(a - y) ? p : a)));
    }, 180);
  }, { passive: true });

  // ---- Layout changes ----
  const onLayout = () => {
    geo = null;
    layoutHalves();
    roughEdges();
    if (!pinned.matches) {
      // In flow: the receipt in section 2 is simply in two halves, the collage
      // is a still picture and nothing is pinned.
      tear = 1;
      clearTear();
      slot.style.visibility = '';
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
    if (!started) {
      // Opening the page part of the way down: no tearing into place, no intro.
      started = true;
      tear = target.tear;
      if (window.scrollY > 40) finishIntro();
    }
    render();
  };
  let started = false;
  window.addEventListener('scroll', requestSync, { passive: true });
  window.addEventListener('resize', onLayout);
  pinned.addEventListener('change', onLayout);
  document.fonts?.ready.then(onLayout);
  onLayout();

  // The receipt waits for its paper to load (or a moment, whichever comes
  // first), so it never unrolls as bare text.
  const onPaper = () => {
    paperReady = true;
    startIntro();
  };
  const sheet = new Image();
  sheet.src = 'assets/receipt-paper.png';
  (sheet.decode ? sheet.decode() : Promise.reject()).then(onPaper, onPaper);
  setTimeout(onPaper, 1500);

  // The background and the title go first, once the texture and the fonts
  // have loaded (or after a moment). The title only plays with the full
  // intro: not with "reduce motion", and not when the page opens part of the
  // way down. From here on this script lets the page go, not the timer in <head>.
  clearTimeout(window.introFallback);
  if (title && held && unroll < 1) {
    const texture = hero.querySelector('.tex-bg img');
    Promise.all([
      document.fonts ? document.fonts.ready : null,
      texture && texture.decode ? texture.decode().catch(() => {}) : null,
    ]).then(startTitle, startTitle);
    setTimeout(startTitle, 1200);
  } else {
    titleDone = true;
    startTitle();
  }
  // Back to a blank hero, then the whole intro again: the small button in the
  // corner of the hero, and "Replay intro" in the controls panel.
  const replayIntro = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    sync();
    if (pinned.matches) tear = 0;
    move = 0;
    hideTitle();
    unroll = 0;
    introOn = false;
    titleStarted = false;
    titleDone = !title || reducedMotion;
    mover.style.visibility = 'hidden';
    if (!reducedMotion) {
      held = true;
      document.documentElement.classList.add('intro-pre', 'intro-hold');
    }
    render();
    setTimeout(() => {
      startTitle();
      startIntro();
    }, 80); // the blank hero is drawn first
  };
  if (!reducedMotion) {
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'intro-replay';
    again.title = 'Replay the intro';
    again.setAttribute('aria-label', 'Replay the intro');
    again.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.2v2.6h2.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    again.addEventListener('click', replayIntro);
    hero.appendChild(again);
  }

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
      ['edgeRough', 'Uneven sides', 0, 4, 0.1, '×'],
    ]],
    ['Intro', [
      ['titleDelay', 'First word after', 0, 3, 0.05, ' s'],
      ['titleStagger', 'Between words', 0, 2, 0.05, ' s'],
      ['titleLastStagger', 'Before “menopause”', 0, 3, 0.05, ' s'],
      ['titleHold', 'Receipt after last word', 0, 6, 0.1, ' s'],
      ['unrollSeconds', 'Receipt takes', 0.3, 8, 0.1, ' s'],
      ['unrollEase', 'Receipt’s slow start', 1, 4, 0.1, '×'],
      ['introTextAt', 'Headline fades in at', 0, 1, 0.05, ''],
    ]],
    ['Tear', [
      ['tearTravel', 'Comes down in', 0.1, 3, 0.1, ' s'],
      ['tearSeconds', 'Then tears in', 0.2, 5, 0.1, ' s'],
      ['tearFps', 'Frame rate', 2, 30, 1, ' fps'],
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
        <button type="button" data-do="unroll">Replay intro</button>
        <button type="button" data-do="tear">Play tear</button>
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
    roughEdges();
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
      replayIntro();
    }
    if (action === 'tear' && pinned.matches) {
      // From the hero: glide to moment 1, as one swipe would.
      window.scrollTo({ top: 0, behavior: 'instant' });
      sync();
      tear = 0;
      move = 0;
      render();
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => glide(steps()[0]), 400);
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

// "The women behind the claims": a carousel that moves side to side. The
// slides are a scroll-snapping row (styles.css), so a swipe or a sideways
// scroll works by itself; this adds the turns. The bar under the slide on
// show fills up (over --turn); when it is full the row glides on to the next
// slide, and after the last one back to the first. A click on a bar goes
// straight to that slide. The turn waits while the pointer or the keyboard
// focus is on the carousel, while it is off screen, and while the video
// plays. The video pauses when its slide moves out of view or the carousel
// leaves the screen. With "reduce motion" nothing moves on by itself.
(() => {
  const section = document.querySelector('.voices');
  if (!section) return;
  const carousel = section.querySelector('.voices__carousel');
  const track = section.querySelector('.voices__track');
  const slides = [...section.querySelectorAll('.voices__slide')];
  const bars = [...section.querySelectorAll('.voices__bar')];
  if (!carousel || !track || slides.length < 2 || bars.length !== slides.length) return;

  let current = 0;
  const pauseVideos = (except) => slides.forEach((slide) => {
    if (slide !== except) slide.querySelectorAll('video').forEach((video) => video.pause());
  });
  // Show whose turn it is: bars before it full, its own bar filling from empty.
  const mark = (index) => {
    current = index;
    pauseVideos(slides[index]);
    bars.forEach((bar, i) => {
      bar.classList.remove('is-active');
      bar.classList.toggle('is-done', i < current);
      if (i === current) bar.setAttribute('aria-current', 'true');
      else bar.removeAttribute('aria-current');
    });
    void bars[current].offsetWidth; // restart the fill, even if this bar was already the one on show
    bars[current].classList.add('is-active');
  };
  const go = (index) => {
    const next = (index + slides.length) % slides.length;
    track.scrollTo({ left: slides[next].offsetLeft - track.offsetLeft });
    mark(next);
  };
  bars.forEach((bar, i) => {
    bar.addEventListener('click', () => go(i));
    bar.querySelector('span').addEventListener('animationend', () => { if (i === current) go(current + 1); });
  });

  // Swiped or scrolled by hand: once it settles, the slide it rests on has the turn.
  let settle;
  track.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const left = track.scrollLeft;
      const nearest = slides.reduce((best, slide, i) => (
        Math.abs(slide.offsetLeft - track.offsetLeft - left) < Math.abs(slides[best].offsetLeft - track.offsetLeft - left) ? i : best), 0);
      if (nearest !== current) mark(nearest);
    }, 140);
  }, { passive: true });
  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1); }
  });

  const waiting = { pointer: false, focus: false, away: true, video: false };
  const wait = (why, on) => {
    waiting[why] = on;
    section.classList.toggle('is-paused', Object.values(waiting).some(Boolean));
  };
  carousel.addEventListener('pointerenter', () => wait('pointer', true));
  carousel.addEventListener('pointerleave', () => wait('pointer', false));
  carousel.addEventListener('focusin', () => wait('focus', true));
  carousel.addEventListener('focusout', () => wait('focus', false));
  // Media events don't bubble, so they are caught on the way down (capture).
  carousel.addEventListener('play', () => wait('video', true), true);
  carousel.addEventListener('pause', () => wait('video', false), true);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      wait('away', !entry.isIntersecting);
      if (!entry.isIntersecting) pauseVideos(null);
    }, { threshold: 0.3 }).observe(carousel);
  } else wait('away', false);

  mark(0);
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

// Download form: every "Download the guide" button opens a pop-up with a short
// form (the <dialog> at the end of index.html). The browser sends it straight
// to the HubSpot form below, the same one HubSpot's own embed would show;
// HubSpot then emails the download link. The portal and form ids are not
// secrets: they are in HubSpot's embed snippet.
//
// To try it without sending anything, add ?hubspot=mock to the address (the
// console shows what would be sent, then the thank-you appears) or
// ?hubspot=fail (the same, then the error).
const HUBSPOT_FORM = {
  portalId: '49228156',
  formId: '7c080f23-d5fd-4adf-9a3f-8916d05121ad',
  // The form's fields, by their HubSpot names. All four are required there.
  fields: ['firstname', 'lastname', 'company', 'email'],
  // Hidden fields on the form. As with HubSpot's embed, each is filled from
  // the page's address when it carries one (…?utm_source=linkedin).
  fromAddress: ['utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'form_slug'],
  // The form's consent settings in HubSpot: legitimate interest (a lead), one
  // subscription type, and the privacy line shown under the button.
  subscriptionTypeId: 3905884755,
  consentText: "By submitting to this form, you agree to Sword Health's privacy policy. You can unsubscribe from these communications at any time.",
};
(() => {
  const dialog = document.getElementById('guide-form');
  // Without <dialog> the buttons keep their plain link to the whitepaper section.
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const form = dialog.querySelector('form');
  const ask = dialog.querySelector('.guide-form__ask');
  const done = dialog.querySelector('.guide-form__done');
  const problem = dialog.querySelector('.guide-form__problem');
  const submit = dialog.querySelector('.guide-form__submit');
  const submitLabel = submit.textContent;
  const inputs = HUBSPOT_FORM.fields.map((name) => form.elements[name]);
  const mode = new URLSearchParams(window.location.search).get('hubspot'); // 'mock', 'fail' or null

  // ---- Opening and closing ----
  const reset = () => {
    form.reset();
    inputs.forEach((input) => setError(input, ''));
    problem.hidden = true;
    ask.hidden = false;
    done.hidden = true;
  };
  document.addEventListener('click', (event) => {
    const opener = event.target.closest?.('a[href="#download"]');
    if (!opener || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (dialog.open) return;
    if (!done.hidden) reset(); // sent last time: a fresh form
    // Dated today, as a receipt is.
    const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    dialog.querySelectorAll('[data-today]').forEach((el) => { el.textContent = today; });
    dialog.showModal();
  });
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  // A click on the dimmed page closes it; a drag that merely ends there (selecting text) does not.
  let pressedOutside = false;
  dialog.addEventListener('mousedown', (event) => { pressedOutside = event.target === dialog; });
  dialog.addEventListener('click', (event) => {
    if (pressedOutside && event.target === dialog) dialog.close();
    pressedOutside = false;
  });

  // ---- Checking the fields ----
  const MESSAGES = {
    firstname: 'Enter your first name.',
    lastname: 'Enter your last name.',
    company: 'Enter your company.',
    email: 'Enter your business email.',
  };
  function setError(input, message) {
    const note = document.getElementById(`${input.id}-error`);
    note.textContent = message;
    note.hidden = !message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', note.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }
  const check = (input) => {
    const value = input.value.trim();
    let message = value ? '' : MESSAGES[input.name];
    if (value && input.name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) message = 'Enter a valid email address, like name@company.com.';
    setError(input, message);
    return !message;
  };
  // Once a field has been flagged, it clears as soon as it is put right.
  inputs.forEach((input) => input.addEventListener('input', () => {
    if (input.hasAttribute('aria-invalid')) check(input);
  }));

  // ---- Sending ----
  const payload = () => {
    const fields = inputs.map((input) => ({ objectTypeId: '0-1', name: input.name, value: input.value.trim() }));
    const address = new URLSearchParams(window.location.search);
    HUBSPOT_FORM.fromAddress.forEach((name) => {
      const value = (address.get(name) || '').trim().slice(0, 200);
      if (value) fields.push({ objectTypeId: '0-1', name, value });
    });
    // HubSpot ties the submission to its analytics cookie when the page has one.
    const cookie = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]*)/);
    return {
      fields,
      context: {
        pageUri: window.location.href,
        pageName: document.title,
        ...(cookie ? { hutk: decodeURIComponent(cookie[1]) } : {}),
      },
      legalConsentOptions: {
        legitimateInterest: {
          value: true,
          subscriptionTypeId: HUBSPOT_FORM.subscriptionTypeId,
          legalBasis: 'LEAD',
          text: HUBSPOT_FORM.consentText,
        },
      },
    };
  };
  // Resolves to { ok: true } or { ok: false, types: [HubSpot's error types], detail }.
  const send = async (body) => {
    if (mode === 'mock' || mode === 'fail') {
      console.info(`[download form] ?hubspot=${mode}: nothing sent. This is what would be:`, body);
      await new Promise((resolve) => setTimeout(resolve, 600));
      return mode === 'mock' ? { ok: true } : { ok: false, types: [], detail: 'Forced failure (?hubspot=fail)' };
    }
    try {
      const response = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_FORM.portalId}/${HUBSPOT_FORM.formId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (response.ok) return { ok: true };
      // HubSpot's reply names the field and the rule it failed.
      const text = await response.text();
      let errors = [];
      try { errors = JSON.parse(text).errors || []; } catch { /* not JSON */ }
      return {
        ok: false,
        types: errors.map((error) => error.errorType || ''),
        detail: `HubSpot responded ${response.status}: ${errors.length ? errors.map((error) => `${error.errorType}: ${error.message}`).join(' | ') : text.slice(0, 300)}`,
      };
    } catch (error) {
      return { ok: false, types: [], detail: error.message || 'Network error' };
    }
  };

  let sending = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    problem.hidden = true;
    const wrong = inputs.filter((input) => !check(input));
    if (wrong.length) { wrong[0].focus(); return; }

    sending = true;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    // A bot filled in the field people cannot see: say thanks, send nothing.
    const result = form.elements.hp_note.value ? { ok: true } : await send(payload());
    sending = false;
    submit.disabled = false;
    submit.textContent = submitLabel;

    if (result.ok) {
      done.querySelector('[data-sent-to]').textContent = form.elements.email.value.trim();
      ask.hidden = true;
      done.hidden = false;
      done.focus();
      return;
    }
    console.error('[download form]', result.detail);
    if (result.types.some((type) => /EMAIL/.test(type))) {
      // HubSpot turned the address down (not valid, or not one it accepts for this form).
      setError(form.elements.email, 'Please use a valid business email address.');
      form.elements.email.focus();
    } else {
      problem.textContent = 'Something went wrong and the form was not sent. Please try again.';
      problem.hidden = false;
    }
  });
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
