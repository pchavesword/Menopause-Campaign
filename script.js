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

// Hero + receipt interactions.
// Desktop scroll story (the hero and section 2 are position: sticky there):
//   1. section 2 slides over the pinned hero, which blurs (--cover 0 -> 1);
//   2. once the receipt lines up with "Meet Sarah" the "click to flip" cue shows;
//      and the receipt unrolls from its paper roll as this happens;
//   3. section 2 stays pinned for --pin px of scrolling, and the receipt flips
//      a quarter of the way through (and flips back when scrolling up).
// Everywhere: click the receipt or the cue to flip it; the copy beside it swaps.
(() => {
  const intro = document.querySelector('.intro');
  const hero = document.querySelector('.hero');
  const panel = document.querySelector('.sarah');
  const eob = document.querySelector('.eob');
  if (!intro || !hero || !panel || !eob) return;

  const card = eob.querySelector('.eob__card');
  const cue = eob.querySelector('.eob__cue');
  const front = eob.querySelector('.eob__face--front');
  const back = eob.querySelector('.eob__face--back');
  const copy = document.querySelector('.sarah__outro-copy');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FLIP_AT = 0.25; // fraction of the pinned scroll at which the receipt flips

  // ---- Flip ----
  let flipped = false;
  let swapTimer;

  const showCopy = (side) => {
    if (!copy) return;
    const swap = () => {
      copy.querySelectorAll('.sarah__outro-side').forEach((el) => { el.hidden = el.dataset.side !== side; });
      copy.classList.remove('is-swapping');
    };
    clearTimeout(swapTimer);
    if (reducedMotion) return swap();
    copy.classList.add('is-swapping'); // fade out, swap, fade back in
    swapTimer = setTimeout(swap, 250);
  };

  const setFlipped = (next) => {
    if (next === flipped) return;
    flipped = next;
    eob.classList.toggle('is-flipped', flipped);
    cue.setAttribute('aria-pressed', String(flipped));
    front.toggleAttribute('inert', flipped);
    front.setAttribute('aria-hidden', String(flipped));
    back.toggleAttribute('inert', !flipped);
    back.setAttribute('aria-hidden', String(!flipped));
    showCopy(flipped ? 'back' : 'front');
  };
  card.addEventListener('click', () => setFlipped(!flipped));
  cue.addEventListener('click', () => setFlipped(!flipped));

  // ---- Paper roll ----
  // Build the 3D roll: a ring of flat strips. Each strip knows its angle (--a),
  // how far round the roll it sits (--arc, radians) and how shaded it is.
  const roll = eob.querySelector('.eob__roll');
  const SEGMENTS = 24;
  if (roll && !reducedMotion) {
    roll.insertAdjacentHTML('beforeend', '<div class="eob__roll-shadow"></div><div class="eob__roll-contact"></div>');
    for (let i = 0; i < SEGMENTS; i += 1) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const facingDown = Math.max(0, -Math.sin(angle)); // light comes from above
      const turnedAway = 1 - Math.max(0, Math.cos(angle));
      const strip = document.createElement('div');
      strip.className = 'eob__roll-strip';
      strip.style.setProperty('--a', `${((angle * 180) / Math.PI).toFixed(2)}deg`);
      strip.style.setProperty('--arc', angle.toFixed(4));
      strip.style.setProperty('--shade', (0.03 + 0.1 * turnedAway + 0.3 * facingDown).toFixed(3));
      roll.appendChild(strip);
    }
  }

  // Unroll `length` px of the receipt (out of `full`) and size the roll to the
  // paper still wound on it.
  const START = 0.33;       // share of the receipt already unrolled at the start
  const THICKNESS = 3.2;    // how fast the roll thins as paper leaves it
  const setUnroll = (length, full) => {
    if (!roll || reducedMotion) return;
    const left = Math.max(0, full - length);
    if (left < 0.5) {
      eob.classList.remove('is-rolled');
      eob.style.removeProperty('--unroll');
      eob.style.removeProperty('--roll-r');
      return;
    }
    eob.classList.add('is-rolled');
    eob.style.setProperty('--unroll', `${length.toFixed(1)}px`);
    eob.style.setProperty('--roll-r', `${Math.sqrt(4 + (left * THICKNESS) / Math.PI).toFixed(2)}px`);
    eob.style.setProperty('--roll-o', Math.min(1, left / 30).toFixed(2)); // fades as the last of it unwinds
  };

  // ---- Scroll: blur, unroll, cue, scroll-flip ----
  let queued = false;
  let pastFlipPoint = false;

  const update = () => {
    queued = false;
    if (getComputedStyle(hero).position !== 'sticky') {
      // Tablet and mobile: nothing is pinned, the cue is always visible.
      hero.style.removeProperty('--cover');
      eob.classList.remove('is-aligned');
      pastFlipPoint = false;
      // The receipt unrolls as it travels up the screen: the roll stays about
      // 80% of the way down the viewport until the paper runs out.
      const box = eob.getBoundingClientRect();
      setUnroll(Math.min(box.height, Math.max(box.height * START, window.innerHeight * 0.8 - box.top)), box.height);
      return;
    }
    const h = hero.getBoundingClientRect();
    const gap = 10; // space between the two panels
    const cover = Math.min(1, Math.max(0, (h.bottom + gap - panel.getBoundingClientRect().top) / (h.height + gap)));
    hero.style.setProperty('--cover', cover.toFixed(3));
    eob.classList.toggle('is-aligned', cover > 0.995);
    // Unrolls while section 2 slides over the hero; fully out once they line up.
    const full = eob.offsetHeight;
    setUnroll(full * (START + (1 - START) * cover), full);

    // How far through the pinned stretch we are (0 = just pinned, 1 = released).
    const pin = parseFloat(getComputedStyle(intro).getPropertyValue('--pin')) || 0;
    const stickyTop = parseFloat(getComputedStyle(panel).top) || 0;
    const scrolledPastPin = stickyTop - (intro.getBoundingClientRect().top + hero.offsetHeight + gap);
    const past = pin > 0 && scrolledPastPin / pin >= FLIP_AT;
    if (past !== pastFlipPoint) {
      pastFlipPoint = past;
      setFlipped(past); // down past the flip point: show the back; back up: show the front
    }
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();

  // ---- Floating tilt that follows the mouse (mouse/trackpad only) ----
  if (reducedMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const tilt = eob.querySelector('.eob__tilt');
  eob.addEventListener('pointermove', (event) => {
    const box = eob.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;  // -0.5 (left) to 0.5 (right)
    const y = (event.clientY - box.top) / box.height - 0.5;  // -0.5 (top) to 0.5 (bottom)
    eob.classList.add('is-tilting');
    tilt.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
    tilt.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    tilt.style.setProperty('--tx', `${(x * 12).toFixed(1)}px`);
    tilt.style.setProperty('--ty', `${(y * 12).toFixed(1)}px`);
  });
  eob.addEventListener('pointerleave', () => {
    eob.classList.remove('is-tilting'); // ease back to rest
    ['--rx', '--ry', '--tx', '--ty'].forEach((name) => tilt.style.removeProperty(name));
  });
})();
