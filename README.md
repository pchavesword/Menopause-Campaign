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

Restructured on branch `bruno/updates` from the Figma frame "lp-lg v2" in the section "Receipt > Card Experiment". Sections in order, with the class to search for:

1. Navbar — `.site-header` (fixed, always on top)
2. Hero (centred title) — `.hero`
3. Meet Sarah + her receipt, then "Sarah isn't alone" stats and a collage of other people's receipts — `.sarah`, receipt is `.receipt`, collage is `.collage`
4. One intake, one care team, one record + Sarah's card — `.connected`, card is `.signal-card`
5. Meet Sword Women's Health + four points — `.meet`
6. Cost of menopause calculator — `.calc`
7. What changes when someone connects the dots (four stats) — `.outcomes`
8. The women behind the claims (quotes + member video) — `.voices`
9. Whitepaper feature with page preview — `.whitepaper` (anchor `#download`)
10. Everything in one place (two resource cards) — `.resources`
11. FAQ — `.faq`
12. Closing CTA — `.closing`
13. Footer — `.footer`

Layout tokens are CSS variables at the top of `styles.css` (`--edge`, `--gutter`, `--section-gap`, colours, fonts). The desktop design width is 1440px; panels are 1420px wide with a 70px inner gutter (1280px of content). Every section is separated by the same gap, `--section-gap` (120px on desktop).

## Interactions

All of these live in `script.js`; the matching styles are commented in `styles.css`.

- **Hero:** fills the screen; the scroll indicator (`.scroll-cue`) sits at the bottom centre and links to section 2.
- **Section 2, two moments:** on desktop (1024px wide and 720px tall or more) `.sarah-track` is a tall wrapper and the `.sarah` panel sticks under the navbar. Scrolling moves in steps into and between the two moments: one swipe (wheel, trackpad, arrow/page keys or a touch swipe) glides from the hero to moment 1 and from moment 1 to moment 2, and back the same way. From moment 2 on the page scrolls normally: nothing snaps on the way out, and coming back up it only catches on moment 2. The rest of that swipe, including trackpad momentum, is ignored; a new swipe is recognised straight away (a pause in the wheel events, or a sudden jump in their size), and a swipe made mid-glide is remembered and taken when the glide ends. If scrolling stops between the two moments (for example after dragging the scrollbar) it glides to the nearer one. `MOMENT_2_AT` in `script.js` sets where moment 2 rests, `--pin-length` in `styles.css` how much scrolling the pinned stretch takes. Smaller screens show both moments one after the other. The pinned layout needs `script.js`, so its CSS only applies under the `js` class (set in `<head>`).
- **Receipts (section 2):** the paper is meant to look hand-made, so everything the receipts do runs in stop-motion (8 frames a second), and once a second every receipt shifts a hair and its creases flip. Text and the card in section 3 stay smooth. Every number behind this lives in `RECEIPT_SETTINGS` at the top of the receipts code in `script.js`.
  - *Controls panel:* open the page with `?controls` in the address (for example `http://localhost:8080/?controls`) for a panel that changes those settings live, replays the unroll and the crumple, and copies the current values so they can be pasted back into `RECEIPT_SETTINGS`. It is a design tool: without `?controls` it is never built.
  - *Unroll:* Sarah's receipt starts on a roll, unrolls down the panel, then feeds upward like a till printer and rests on its claims summary. It plays when the receipt comes into view and resets when the page is scrolled back above it.
  - *Collage (moment 2, desktop):* her receipt shrinks into `.collage` and the other receipts deal out around it. The other receipts are copies of hers filled in from `OTHER_RECEIPTS` in `script.js` (invented people and claims, illustrative, too small to read); each entry's `slot` places it in the collage.
  - *Crumple (leaving moment 2, desktop):* as soon as the page scrolls about 70px past moment 2, every receipt is swapped for three pictures of itself crumpled (folded, scrunched, ball). `paintCrumple` paints them on canvases, pixel by pixel: the sheet is broken into irregular facets, each lit from the top left and carrying the receipt's print at its own angle. Their look is set by the `ball…` values in `RECEIPT_SETTINGS`, and the controls panel shows a live preview. The crumpled receipt then hops and falls off the bottom of the screen. Once a receipt is a ball it moves into `.fall-layer`, a layer over the whole screen, so the panel's edge doesn't clip it and it passes in front of the next section. It plays on its own clock while the page keeps scrolling. Scrolling back to moment 2, the receipts pop back flat.
  - On phones and tablets the receipt unrolls inside `.receipt-window` and the collage is a still picture. With "reduce motion" everything is static.
  - The receipt is sized in `--u` (1/371 of its width), so the same markup draws Sarah's and the small ones.
- **Sarah's card (section 3):** `.signal-card` fades up from below, slowly and smoothly, once most of it is on screen, and resets when it drops back below the screen. `--k` scales the card (the Marketing Kit card is 280px wide; it is shown at 1.25).
- **Whitepaper carousel:** `.wp-carousel` is a scroll-snapping row of pages with arrows, a page counter and a slow autoplay (paused on hover or focus). Pages 2–4 reuse page 1 until real page images exist.
- **Calculator:** the Excel model "Cost of menopause: Sword vs traditional cost", rebuilt field for field. Client inputs (eligible lives, women included in the cost, optional women counts, funding type) recalculate the headline numbers live (base case, with its low and high range). The assumptions (Path A visit costs, Sword price, population shares, share who seek care, share who use Sword) are not shown on the page: they are the `CALCULATOR_ASSUMPTIONS` object in `script.js`. The formulas are in `calculate()` right below it, with the Excel cell each one stands for in a comment.
- **Scroll fade-ins:** elements marked `data-reveal` fade in themselves; `data-reveal="children"` fades direct children in sequence.
- **Navbar blur:** a frosted bar behind the navbar switches on once the page has scrolled (`.site-header.is-scrolled`).
- **FAQ:** native `<details>` elements, all closed by default; answers slide open and the plus icon rotates into an x.
- **Video frames:** add `data-video-src="<url>"` to a `.video` element and its play button swaps the poster for an inline player. Without it the button does nothing.
- **Reduced motion:** visitors with "reduce motion" enabled get no fade-ins, no carousel autoplay, and section 2 switches moments without the in-between.

The old hero/receipt scroll story (sticky receipt, 3D paper roll, living paper, flip) was removed in the restructure; the unroll came back in a simpler, stop-motion form (see "Receipts" above). The original is still on `main`.

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
