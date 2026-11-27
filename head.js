// Runs in <head>, before the page is drawn, so nothing flashes into view and
// then hides again. It is a file, not an inline script, so that the Content
// Security Policy in vercel.json can allow scripts from this site only.
(function () {
  var root = document.documentElement;
  // `js`: layouts that need script.js (the pinned section 2) only apply with it.
  root.classList.add('js');
  // Scroll fade-ins and the hero intro, only where they can actually run.
  // The intro: the background appears, then the title a word at a time, then
  // the receipt plays, then the navbar and the headline fade in. `intro-pre`
  // hides the background, `intro-hold` the navbar and the headline.
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('js-reveal', 'intro-pre', 'intro-hold');
  }
  // Safety nets. script.js clears both timers as it takes over. If it never
  // runs, or stops part of the way through, after 4 seconds the page shows
  // everything as a plain page instead of staying hidden.
  window.introFallback = setTimeout(function () { root.classList.remove('intro-pre', 'intro-hold'); }, 4000);
  window.scriptFallback = setTimeout(function () { root.classList.remove('js', 'js-reveal', 'intro-pre', 'intro-hold'); }, 4000);
})();
