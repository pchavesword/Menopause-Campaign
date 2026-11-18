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

// Hero blur: on desktop the hero is pinned while section 2 slides over it.
// --cover goes from 0 (section 2 just below the hero) to 1 (hero fully covered)
// and drives the blur in styles.css.
(() => {
  const hero = document.querySelector('.hero');
  const cover = document.querySelector('.sarah');
  if (!hero || !cover || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let queued = false;
  const update = () => {
    queued = false;
    if (getComputedStyle(hero).position !== 'sticky') {
      hero.style.removeProperty('--cover'); // tablet and mobile: no pinning, no blur
      return;
    }
    const h = hero.getBoundingClientRect();
    const gap = 10; // space between the two panels
    const progress = (h.bottom + gap - cover.getBoundingClientRect().top) / (h.height + gap);
    hero.style.setProperty('--cover', Math.min(1, Math.max(0, progress)).toFixed(3));
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();

// Receipt: click to flip, swap the copy beside it, and float with the mouse.
(() => {
  const eob = document.querySelector('.eob');
  if (!eob) return;
  const card = eob.querySelector('.eob__card');
  const cue = eob.querySelector('.eob__cue');
  const front = eob.querySelector('.eob__face--front');
  const back = eob.querySelector('.eob__face--back');
  const copy = document.querySelector('.sarah__outro-copy');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  const flip = () => {
    flipped = !flipped;
    eob.classList.toggle('is-flipped', flipped);
    cue.setAttribute('aria-pressed', String(flipped));
    front.toggleAttribute('inert', flipped);
    front.setAttribute('aria-hidden', String(flipped));
    back.toggleAttribute('inert', !flipped);
    back.setAttribute('aria-hidden', String(!flipped));
    showCopy(flipped ? 'back' : 'front');
  };
  card.addEventListener('click', flip);
  cue.addEventListener('click', flip);

  // Floating tilt that follows the mouse (mouse/trackpad only).
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
