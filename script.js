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
