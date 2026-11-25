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
2. Hero: the end of the receipt hangs down from the top, the copy is centred under it in the lower half — `.hero`, receipt in `.hero__stage`
3. Meet Sarah + her receipt (torn in half, `.halves`), then "The problem" stats and a collage of other people's receipts — `.sarah`, receipt is `.receipt`, collage is `.collage`
4. One intake, one care team, one record + Sarah's card: a full-screen stretch with the texture on the right, not clipped to the section — `.connected`, card is `.signal-card`
5. Meet Sword Women's Health: one wide panel, copy and two points on the left, the app and the Bloom pod on the right — `.meet`, `.meet__card`
6. Cost of menopause calculator — `.calc`
7. What changes when someone connects the dots (four stats) — `.outcomes`
8. The women behind the claims: a side-to-side carousel (a quote beside the member video, then two quotes on their own) — `.voices`
9. Whitepaper feature with page preview — `.whitepaper` (anchor `#download`)
10. Everything in one place (two resource cards) — `.resources`
11. FAQ — `.faq`
12. Closing CTA — `.closing`
13. Footer — `.footer`

**Design tokens.** The top of `styles.css` holds the page's design tokens as CSS variables, with the same names and 1440px values as the Figma variables (collection "Menopause LP") and text styles ("Menopause LP/..."). Change a value in both places together.

- **Type:** `--display-2xl` to `--display-xs` (Lora: 80, 64, 56, 40, 28, 20), `--body-l` to `--body-xs` (Figtree: 18, 16, 14, 12), `--label-m` (button labels: 15, SemiBold capitals) and `--label-s` (eyebrows: 12, capitals with 5% tracking). The larger display sizes are clamps that shrink on small screens; the top value is the design's.
- **Spacing:** `--layout-*` places sections (page margin 20, panel gap 20, content inset 80, section gap 120, section gap after "Meet Sword Women's Health" 180, column gap 24), `--stack-*` is vertical rhythm inside a section (48, 32, 24, 16, 8) and `--inset-*` is padding (panel 40, card 32, row 24). Gaps and paddings on the page use these tokens; the exceptions are the pinned section 2, the hero, the name chip beside "Meet" and the 20px side padding on phones.
- **Radius:** `--radius-control` 8 (FAQ rows), `--radius-panel` 16, `--radius-feature` 32.
- **Buttons:** one `.btn`, 43px high (padding 16/20, 4px corners, no border), in two looks: the default (black, pure black on hover) is Figma's Button/Primary and `.btn--secondary` (frosted off-white, solid on hover) is Button/Secondary. Phones up to 400px wide get a smaller button in the header so it fits beside the logo. The whitepaper's arrows (`.wp-carousel__btn`) are Figma's "carousel controls": the Secondary look on 36px circles.
- **Kept outside the tokens:** the receipts, Sarah's card and the calculator keep their own sizes; `--edge`, `--gutter` and `--inset` are layout helpers derived from the tokens.

The desktop design width is 1440px; the wide panels (hero, section 2, section 3, closing) are 1400px wide; every section from section 3 down starts its content 100px in (`--inset`), 1240px of content. Sections are separated by `--layout-section-gap` (120px on desktop) down to "Meet Sword Women's Health", and by the roomier `--layout-section-gap-lg` (180px) after it. The footer has 20px under it.

## Interactions

All of these live in `script.js`; the matching styles are commented in `styles.css`.

- **Hero:** fills the screen; the scroll indicator (`.scroll-cue`) sits at the bottom centre and links to section 2.
- **Section 2, two moments:** on desktop (1024px wide and 720px tall or more) `.sarah-track` is a tall wrapper and the `.sarah` panel sticks under the navbar. Scrolling moves in steps through the hero and the two moments: one swipe (wheel, trackpad, arrow/page keys or a touch swipe) glides from the hero to moment 1 and from moment 1 to moment 2, and back the same way, up to the top of the page. From moment 2 on the page scrolls normally: nothing snaps on the way out, and coming back up it only catches on moment 2. The rest of that swipe, including trackpad momentum, is ignored; a new swipe is recognised straight away (a pause in the wheel events, or a sudden jump in their size), and a swipe made mid-glide is remembered and taken when the glide ends. If scrolling stops between two steps (for example after dragging the scrollbar) it glides to the nearer one. `MOMENT_2_AT` in `script.js` sets where moment 2 rests, `--pin-length` in `styles.css` how much scrolling the pinned stretch takes. Smaller screens show both moments one after the other. The pinned layout needs `script.js`, so its CSS only applies under the `js` class (set in `<head>`).
- **Receipts (hero and section 2):** the paper is meant to look hand-made, so everything the receipts do runs in stop-motion (8 frames a second), and once a second every receipt shifts a hair and its creases flip. Text and the card in section 3 stay smooth. Every number behind this lives in `RECEIPT_SETTINGS` at the top of the receipts code in `script.js`.
  - *Controls panel:* open the page with `?controls` in the address (for example `http://localhost:8080/?controls`) for a panel that changes those settings live, replays the intro, the tear and the crumple, and copies the current values so they can be pasted back into `RECEIPT_SETTINGS`. It is a design tool: without `?controls` it is never built.
  - *Uneven sides:* the paper is one picture stretched over each receipt, so its long sides would be ruler-straight. `roughEdges` in `script.js` clips every sheet (`.receipt__sheet`) to a shape whose sides stray inwards a little, as if cut by hand: a long bow plus two finer wanders, different for each receipt and each side, the same for the two halves of a torn one. `edgeRough` scales it (0 = straight). The outline stays put when the creases flip.
  - *Intro (hero):* as the page opens, five things happen in order. (1) The hero's background fades in (the `intro-pre` class, set in `<head>`, hides it until `script.js` lets it go). (2) The title, "The hidden costs of menopause" (`.intro-title` in `.hero__stage`, decorative and hidden from assistive technology; the page's `h1` is still the headline), appears a word at a time (`titleDelay`, `titleStagger`, and `titleLastStagger` for the longer pause before "menopause"): each word simply switches on, with no fade. On desktop it sits either side of where the receipt will be, "The hidden / costs" on the left and "of / menopause" one line lower on the right; on phones and tablets it is two centred lines just above the paper. (3) After `titleHold` the receipt (Sarah's, without her details; `script.js` copies it into `.hero__slot`) appears on a roll in the middle of the hero and unrolls down past the bottom edge, slowly at first and then faster (`unrollEase`) (`--paper-start` in `styles.css` is where its top starts). (4) The paper feeds upward like a till printer, at the same size, and the title rides up and out of the hero with it, until only the receipt's end hangs down from the top (`--end` in `styles.css` sets how far down; the copy starts just under it). (5) The navbar, the hero copy and the scroll cue, held back by the `intro-hold` class (also set in `<head>`), fade in near the end (`introTextAt`), once the paper has cleared them. It plays once per visit; scrolling on cuts it short, and opening the page part of the way down, or with "reduce motion", skips it. A small, faint round button in the bottom left corner of the hero (`.intro-replay`, added by `script.js`) plays it again from the start. A timer in `<head>` shows the page after 4 seconds if `script.js` never takes over.
  - *Tear (hero to moment 1, desktop):* gliding from the hero to moment 1, that receipt tears in half and the halves come to rest side by side (`.halves`, built by `makeHalves`; `HALVES` holds the geometry). The tear runs along the gap between two visits, the one nearest the middle, so no print is cut (`layoutHalves` works it out and gives both halves the same ragged edge). From the first frame the strip comes down with the page until the tear line is in the middle of the screen (`tearTravel`). Then, in `tearSeconds`: the strip is tugged (it tilts a little), the tear starts at the right edge and runs across to the left with the halves swinging open behind it, and the halves fly to their places side by side, the top one first, overshooting a touch before they settle. The tear has its own frame rate (`tearFps`, 6 like the paper for now; a higher value gives a quick tear more drawings). While it tears it keeps its own course across the screen, whatever the page is scrolling underneath. It only plays forwards: the two halves stay in section 2, and going back up the hero simply has its receipt again (and tears again on the next way down).
  - *Collage (moment 2, desktop):* the two halves shrink into `.collage` and the other receipts deal out from behind them. The other receipts are copies of hers filled in from `OTHER_RECEIPTS` in `script.js` (invented people and claims, illustrative, too small to read); each entry's `slot` places it in the collage.
  - *Crumple (leaving moment 2, desktop):* as soon as the page scrolls about 70px past moment 2, every receipt is swapped for three pictures of itself crumpled (folded, scrunched, ball). `paintCrumple` paints them on canvases, pixel by pixel: the sheet is broken into irregular facets, each lit from the top left and carrying the receipt's print at its own angle. Their look is set by the `ball…` values in `RECEIPT_SETTINGS`, and the controls panel shows a live preview. The crumpled receipt then hops and falls off the bottom of the screen. From its first crumpled drawing each receipt is in `.fall-layer`, a layer fixed over the whole screen, placed where the pile was when the receipts let go: the crumpling stays put on screen however fast the page scrolls on, the panel's edge doesn't clip it and it passes in front of the next section. It plays on its own clock while the page keeps scrolling. Scrolling back to moment 2, the receipts pop back flat.
  - On phones and tablets the hero plays the same intro, the receipt in section 2 is simply shown in two halves and the collage is a still picture. With "reduce motion" everything is static. Without `script.js` the hero has no receipt and section 2 shows the plain receipt through `.receipt-window`.
  - The receipt is sized in `--u` (1/371 of its width), so the same markup draws Sarah's and the small ones.
- **Sarah's card (section 3):** `.signal-card` fades up from below, slowly and smoothly, once most of it is on screen, and resets when it drops back below the screen. `--k` scales the card's type (the Marketing Kit's sizes, shown at 1.25, and at 1.05 on a phone); the card is 368px wide. It reads top to bottom as one record: Sarah's name and age beside the colour logo (`assets/logo-color.svg`), her reasons for visit as one quiet line of text, the "All in one plan" block (the tinted one, with the ticks), then a summary set like the totals of a receipt.
- **Meet card (section 4):** the background is `assets/meet-bg.jpg`; the phones and the pod are one picture, `assets/meet-visual.png`, exported from the design at 2x with a transparent background.
- **Section 3 texture:** `.connected .tex-bg` sits behind the page (`z-index: -1`) and is only cut off at the edges of the screen, so the blurred texture runs on above and below the section instead of stopping at a frame.
- **Quotes (section 7):** `.voices__track` is a scroll-snapping row of three slides, so it can be swiped or scrolled sideways without any script. `script.js` adds the turns: the bar under the slide on show fills up over `--turn` (7s, in `styles.css`), then the row glides on to the next slide, and after the last one back to the first; a click on a bar goes straight to that slide. It waits while the pointer or the focus is on the carousel, while it is off screen, and while the video plays. With "reduce motion" nothing moves on by itself.
- **Whitepaper carousel:** `.wp-carousel` is a scroll-snapping row of pages with arrows, a page counter and a slow autoplay (paused on hover or focus). Pages 2–4 reuse page 1 until real page images exist.
- **Calculator:** the Excel model "Cost of menopause: Sword vs traditional cost", rebuilt field for field. Client inputs (eligible lives, women included in the cost, optional women counts, funding type) recalculate the headline numbers live (base case, with its low and high range). The assumptions (Path A visit costs, Sword price, population shares, share who seek care, share who use Sword) are not shown on the page: they are the `CALCULATOR_ASSUMPTIONS` object in `script.js`. The formulas are in `calculate()` right below it, with the Excel cell each one stands for in a comment.
- **Download form:** every "Download the guide" button (`a[href="#download"]`) opens a pop-up, the `<dialog id="guide-form">` at the end of `index.html`. It is our own form, not HubSpot's embed: `script.js` posts it from the browser to `https://api.hsforms.com/submissions/v3/integration/submit/{portal}/{form}` for the HubSpot form "Download the report" (ids in `HUBSPOT_FORM`; they are public, the same ones as in HubSpot's embed snippet), and HubSpot then emails the download link. The fields (first name, last name, company, business email, all required), the button label and the privacy line are that form's; if the form changes in HubSpot, change them here too, because HubSpot rejects a submission that misses a required field and silently drops a field the form does not have. The form's hidden fields (`utm_campaign`, `utm_content`, `utm_medium`, `utm_source`, `form_slug`) are filled from the page address when it carries them, as HubSpot's embed does. Consent is sent as the form is set up in HubSpot: legitimate interest, subscription type `3905884755`. A hidden honeypot field (`hp_note`) is the only spam check. To try the pop-up without sending anything, add `?hubspot=mock` to the address (the console shows what would be sent, then the thank-you appears) or `?hubspot=fail` (then the error appears). It is drawn as one of the page's receipts (`.guide-form` in `styles.css`): the receipts' paper (`assets/receipt-paper.png`, shown at its natural proportions), sides cut a little unevenly (a fixed `clip-path`), a perforated end (a `mask`; `--bite` sets the size), a centred header with today's date over a rule, dashed lines to write on in place of boxes, and the receipts' barcode. It arrives in four frames, like the rest of the paper. While the form is open the page behind does not scroll. Without `<dialog>` support or without `script.js` the buttons simply jump to the whitepaper section.
- **Scroll fade-ins:** elements marked `data-reveal` fade in themselves; `data-reveal="children"` fades direct children in sequence.
- **Navbar blur:** a frosted bar behind the navbar switches on once the page has scrolled (`.site-header.is-scrolled`).
- **FAQ:** native `<details>` elements, all closed by default; answers slide open and the circled plus becomes a circled minus.
- **Video frames:** add `data-video-src="<url>"` (and `data-video-title`, its name for screen readers) to a `.video` element. Its play button swaps the poster for an inline player and starts it with sound; the file only starts loading then. When the video ends, the poster and the play button come back. Without `data-video-src` the button does nothing.
- **Member video (section 7):** `assets/video-dollie.mp4` (1920 × 1080, 63 s, 32 MB, subtitles burned in), poster `assets/video-dollie.jpg`. The frame is 16:9, the film's own shape, so its titles and subtitles are never cut off. While it plays the quotes carousel holds its turn; it pauses when its slide moves out of view or the carousel leaves the screen. The local preview server (`python3 -m http.server`) does not answer byte-range requests, so on localhost Safari will not play the video and Chrome cannot skip ahead to a part that has not loaded yet; Vercel answers them, so the deployed page is fine.
- **Reduced motion:** visitors with "reduce motion" enabled get no fade-ins, no carousel autoplay, and section 2 switches moments without the in-between.

The old hero/receipt scroll story (sticky receipt, 3D paper roll, living paper, flip) was removed in the restructure; the unroll came back in a simpler, stop-motion form (see "Receipts" above). The original is still on `main`.

## Known gaps and open items

- **Placeholder links.** "Download the guide" opens the download form (see Interactions). Every other button and the three social icons still point to in-page anchors (`#`, `#contact`, `#learn-more`, `#webinar`). Real URLs are still needed.
- **Videos.** The member video plays (section 7); any other `.video` frame still has no source, so its play button is inert.
- **Poster weight.** `assets/video-eob.png` is a 2.1 MB PNG straight from Figma; convert it to WebP or JPEG.
- **Navbar crowding.** When the pink section is pinned, the logo sits about 8px above "MEET SARAH" and the navbar button ends 5px above the receipt. Moving `--eob-rest` (and with it the section's top padding) down to around 110px would clear it.
- **Logo over dark video.** The navbar logo is black and hard to read when the dark film section passes under it.
- **Pause before the flip.** The 400px pinned stretch means the page appears to hold still briefly before the receipt flips. Removing the pin was tried and reverted; shortening `--pin` or lowering `FLIP_AT` are the levers.
- **Firefox spacing.** Text is trimmed to cap height with CSS `text-box`, which Firefox doesn't support, so spacing is slightly looser there. Nothing breaks.
- **Testing.** Checked in Chromium at desktop, tablet and phone widths. Not tested on real phones, Safari or Firefox; the continuous paper animation is the part most worth checking on older devices.
- **Duplicate asset.** `assets/logo.svg` (footer) and `assets/logo1.svg` (navbar) are two exports of the same logo; one could replace the other.

## Figma

- The original desktop design is the frame "lp-lg v2" in the section "Original Design".
- The section "The Hidden Costs of Menopause — v4 (1440)" holds the current page frame ("lp-lg v3"), the board "Menopause LP / Foundations and components" (type scale, spacing, radius, colour roles) and the `Button` and `carousel controls` main components. The page frame uses those text styles, variables and Button instances.
- The section "Coded version (from live site)" holds the page as built, exported back into Figma: a 1280px desktop frame, a 375px mobile frame, and the receipt's back side. Those layers are positioned absolutely (no auto layout) and reflect the page at the time of export, so they will drift as the code changes.

## History

The commit log is the detailed record; each commit message describes one user-facing change. In order, the main steps were: initial responsive build, scroll fade-ins, hero/receipt scroll interaction, fixed navbar, receipt flip with back side, scroll-triggered flip, paper unroll, living-paper effect, FAQ copy and animation, restyled CTAs.
