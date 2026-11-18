# The hidden cost of menopause — landing page

Handoff notes for whoever continues this work. Everything here reflects the state of `main` at the time of writing.

- **Live site:** https://menopause-campaign.vercel.app/
- **Design source:** Figma file "B2B Campaigns" — https://www.figma.com/design/2RfmlnlEy3BjXeBntYMkIa/B2B-Campaigns (page "↪ Landing Page")
- **What it is:** a single-page B2B campaign landing page for Sword Women's Health, built from the desktop Figma design and made responsive for tablet and mobile.

## Stack

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

| File | What it holds |
|---|---|
| `index.html` | All markup and copy (one page). |
| `styles.css` | All styles. Mobile-first; breakpoints at 640, 760 and 1024px. |
| `script.js` | All behaviour (see "Interactions" below). |
| `assets/` | Images and icons exported from Figma, plus self-hosted fonts in `assets/fonts/`. |

To work on it, open `index.html` in a browser. A local server is nicer (fonts preload cleanly), for example:

```bash
python3 -m http.server 8080
```

## Deployment

Vercel is connected to this GitHub repository. Every push to `main` deploys to production automatically; there is no build command and no output directory (framework preset "Other", root `./`).

If the repository is transferred to another GitHub account, the Vercel project's Git connection will need to be re-linked (or the project re-imported at vercel.com/new) before pushes deploy again.

## Page structure

Sections in order, with the class to search for:

1. Navbar — `.site-header` (fixed, always on top)
2. Hero — `.hero`
3. Meet Sarah + receipt — `.sarah`, receipt is `.eob`
4. Film + "How many Sarahs" band — `.film`
5. Sizing the problem (three stats) — `.stats`
6. Meet Sword Women's Health + four points — `.meet`
7. 81% outcome — `.outcome`
8. The economics — `.econ`
9. Everything in one place (two resource cards) — `.resources`
10. The women behind the claims (quotes + member video) — `.voices`
11. Five questions — `.questions`
12. FAQ — `.faq`
13. Closing CTA — `.closing`
14. Footer — `.footer`

Layout tokens are CSS variables at the top of `styles.css` (`--edge`, `--gutter`, `--section-gap`, colours, fonts). The desktop design width is 1280px; panels are 1260px wide with a 70px inner gutter.

## Interactions

All of these live in `script.js`; the matching styles are commented in `styles.css`.

### Hero and receipt (desktop, 1024px and wider)

This is the most involved part. The variables are on `.intro` in the desktop media query of `styles.css`.

1. The hero scrolls away normally. The receipt (`.eob`) is `position: sticky` inside a tall track (`.eob-track`), so it holds its place on screen while the pink section rises.
2. While that happens the receipt **unrolls** from a 3D paper roll (`.eob__roll`). It starts a third unrolled (`START` in `script.js`) and is fully out when the pink section reaches the top.
3. The receipt comes to rest level with the "MEET SARAH" label (`--eob-rest: 70px`, the same as the section's top padding).
4. The pink section is `position: sticky` and stays pinned for `--pin` (400px) of scrolling. A quarter of the way through (`FLIP_AT`), the receipt **flips in one go** to its purple back, and the copy beside it swaps. Scrolling back up flips it back.
5. After the pinned stretch everything scrolls on.

On tablet and mobile nothing is pinned: the receipt unrolls as it travels up the screen and flips once it has fully unrolled and moved a further 120px.

### Receipt details

- **Flip:** driven by a damped spring (`STIFFNESS`, `DAMPING`), not a CSS transition, so reversing mid-turn is smooth. It only flips with scroll; clicking the receipt does nothing.
- **Living paper:** the receipt is cut into 16 horizontal strips (`STRIPS`), each a clipped copy of the sheet, bent in 3D every frame for a curl, a gusting breeze and a swing on scroll. The original two faces stay in the DOM, invisible, for screen readers.
- **Hover:** the receipt tilts and drifts with the mouse (mouse/trackpad only).
- **Copy swap:** `.sarah__outro-copy` holds a front and a back text block; the back one shows when the receipt is flipped.
- **"Click to flip" cue:** built and working but switched off. The button `.eob__cue` in `index.html` has a `hidden` attribute; remove it to bring the cue back (it then appears once the receipt is aligned, and clicking it flips the receipt).

### Everything else

- **Scroll fade-ins:** elements marked `data-reveal` fade in themselves; `data-reveal="children"` fades direct children in sequence.
- **Navbar blur:** a frosted bar behind the navbar switches on once the page has scrolled (`.site-header.is-scrolled`).
- **FAQ:** native `<details>` elements, all closed by default; answers slide open and the plus icon rotates into an x.
- **Video frames:** add `data-video-src="<url>"` to a `.video` element and its play button swaps the poster for an inline player. Without it the button does nothing.
- **Reduced motion:** visitors with "reduce motion" enabled get a static page: no fade-ins, no unroll, no paper movement, instant flip.

## Known gaps and open items

- **Placeholder links.** Every button and the three social icons point to in-page anchors (`#`, `#download`, `#contact`, `#learn-more`, `#webinar`). Real URLs are still needed.
- **Videos.** Neither video has a source yet, so both play buttons are inert.
- **Poster weight.** `assets/video-eob.png` is a 2.1 MB PNG straight from Figma; convert it to WebP or JPEG.
- **Navbar crowding.** When the pink section is pinned, the logo sits about 8px above "MEET SARAH" and the navbar button ends 5px above the receipt. Moving `--eob-rest` (and with it the section's top padding) down to around 110px would clear it.
- **Logo over dark video.** The navbar logo is black and hard to read when the dark film section passes under it.
- **Pause before the flip.** The 400px pinned stretch means the page appears to hold still briefly before the receipt flips. Removing the pin was tried and reverted; shortening `--pin` or lowering `FLIP_AT` are the levers.
- **Firefox spacing.** Text is trimmed to cap height with CSS `text-box`, which Firefox doesn't support, so spacing is slightly looser there. Nothing breaks.
- **Testing.** Checked in Chromium at desktop, tablet and phone widths. Not tested on real phones, Safari or Firefox; the continuous paper animation is the part most worth checking on older devices.
- **Duplicate asset.** `assets/logo.svg` (footer) and `assets/logo1.svg` (navbar) are two exports of the same logo; one could replace the other.

## Figma

- The original desktop design is the frame "lp-lg v2" in the section "Original Design".
- The section "Coded version (from live site)" holds the page as built, exported back into Figma: a 1280px desktop frame, a 375px mobile frame, and the receipt's back side. Those layers are positioned absolutely (no auto layout) and reflect the page at the time of export, so they will drift as the code changes.

## History

The commit log is the detailed record; each commit message describes one user-facing change. In order, the main steps were: initial responsive build, scroll fade-ins, hero/receipt scroll interaction, fixed navbar, receipt flip with back side, scroll-triggered flip, paper unroll, living-paper effect, FAQ copy and animation, restyled CTAs.
