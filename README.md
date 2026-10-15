# matthewlaujh.com

Static source for [matthewlaujh.com](https://matthewlaujh.com), migrated off Cargo (Cargo 2) to
Cloudflare Pages. A 60-line Node script turns the page data in `src/` into plain HTML in `public/`.

```
src/
  site.json            title, description, homepage, nav order
  pages/<slug>.json    one file per page: title, content (Cargo HTML), local CSS, backdrop, images
  pinned/nav.json      the pinned-top "Nav" page (project list, desktop only)
  pinned/info.json     the pinned-bottom "Info" page (email, desktop only)
  css/cargo-base.css   Cargo's engine stylesheet exactly as it was served with the site
  css/stylesheet.css   the site's own Cargo stylesheet (fonts, type, layout presets)
  css/site.css         glue: backdrop/wallpaper/menu styles that Cargo injected from JS
  js/site.js           viewport base unit (Cargo formula), mobile switch, mobile menu
  js/backdrops.js      WebGL slit-scan backdrop + wallpaper slideshow, no dependencies
  fonts/               Austin News Deck + Atlas Grotesk (your own uploads from Cargo)
  img/                 images (see "Images" below)
  favicon.ico
build.js               src -> public
scripts/fetch-assets.sh  downloads all 129 images from Cargo's CDN into src/img
scripts/assets.json      CDN url -> local filename map used by that script
public/                generated output, what Cloudflare serves (committed so Pages needs no build)
```

## Build

```
node build.js        # regenerates public/
npx serve public     # or: python3 -m http.server -d public 8080
```

Each page becomes `public/<slug>.html`; Cloudflare Pages serves it at `/<slug>` (clean URLs), exactly
the URLs Cargo used. `/Front-Page` 301s to `/` (`public/_redirects`).

## Images (one-time step)

The 128 project images + GIFs (~120 MB; some GIFs are 10–17 MB, exactly what Cargo served) are
not in the repo yet. Fetch them once from Cargo's CDN, then rebuild:

```
./scripts/fetch-assets.sh
node build.js
```

Only `src/img/` needs the files; `build.js` copies them into `public/img/`. Run this before you
take the Cargo site down — the script reads from `freight.cargo.site`.

## Deploy to Cloudflare Pages

1. Push to GitHub/GitLab.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build settings: Framework preset **None**, build command **`node build.js`** (or leave empty —
   `public/` is committed), build output directory **`public`**.
4. Add the custom domain `matthewlaujh.com`, then move DNS from Cargo to Cloudflare.

## What was ported, and how

- **Typography & layout**: Cargo's base unit — `html { font-size: N% }` computed from the viewport
  (`min(w,h) × weight / 100`, weight 9 → 19 as the window gets taller than wide, mobile_zoom 25) —
  is reproduced in `site.js`, so every `rem` lands on the same pixel size as on Cargo.
- **Grid**: Cargo's `[grid-row] / [grid-col] / [grid-pad] / [grid-gutter]` system comes from
  `cargo-base.css` unchanged; `body.mobile [grid-responsive] [grid-col]` stacks columns under 770px.
- **Pinned Nav / Info**: fixed overlays on desktop, removed on mobile (Cargo's `exclude_mobile`).
  On mobile the ☰ button opens the Front Page as a full-screen menu, as Cargo did.
- **Slit-scan backdrop** (Front Page, About, mobile menu): same shader and motion code as Cargo's
  PIXI plugin, re-implemented in raw WebGL. Settings live in each page JSON under `backdrop.settings`
  (vertical, 8 scan cycles, wiggle 10, speed 50, mouse + scroll interaction).
- **Wallpaper backdrop** (every project page): fading slideshow of the page's images, "contain"
  scaling inside a 12.5%-of-the-short-side margin, white background under a 50% black overlay,
  10 s per slide, 0.5 s cross-fade, hover-to-reveal arrows. Settings in each page JSON.
- **Current-page link** in the nav is bold (`.page a.active`), as on Cargo.
- **Dead link kept as-is**: "Affective Communication Research (2021-2022)" in the nav pointed to
  a page that 404s on Cargo too. Create `src/pages/Affective-Communication-Research-2021-2022-Ongoing-Project.json`
  if you want it to resolve.
- **Not ported**: Cargo's in-page (AJAX) navigation — links are normal page loads now; Cargo's
  proprietary icon font (the ☰ is an inline SVG); the iA Writer Quattro face that only the unused
  thumbnail/caption styles referenced.

## Editing content

Edit the `content` HTML in a page JSON (it is the HTML Cargo stored), or add a new page JSON with
`slug`, `title`, `content`, `images`, `backdrop`, then `node build.js`. Add a link to it in
`src/pinned/nav.json` and `src/pages/Front-Page.json`.
