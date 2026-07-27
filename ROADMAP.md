# TrimFusion Roadmap

Turning TrimFusion from a static Angular 16 mock into a genuinely working, polished,
deployable YouTube/video trimmer. Work happens on the `nextlevel` branch, one small
complete slice per run. `npm run build` must pass before every commit.

## Current state (observed baseline)

- `extractVideoId()` just does `url.split('=')` and takes the last segment — breaks on
  `youtu.be/ID`, `/shorts/ID`, `/embed/ID`, `?v=ID&t=...`, playlists, and bare IDs.
- No validation / inline error on bad URLs.
- Range slider is a hardcoded `mat-slider min=200 max=500` — **not** bound to any model
  and **not** wired to the embed preview. Start/end labels are empty disabled inputs.
- `downloadVideo()` is fake: it opens the original YouTube URL in a new tab. No real trim.
- `download-page` and `not-found-page` exist but are mostly static.
- Deps include `jquery`, `admin-lte`, `ion-rangeslider`, `bootstrap` — likely unused JS.
- Folder/route typo: `rending-page` should be `rendering-page`.
- No tests for parsing/trim logic, no lint/prettier, no CI, no deploy.

---

## P0 — Fix what exists (highest priority)

- [ ] Robust `extractVideoId()`: handle `youtu.be/ID`, `/shorts/ID`, `/embed/ID`,
      `watch?v=ID`, extra params (`&t=`, `&list=`), playlists, and bare 11-char IDs.
      Return null on failure. Pure function, unit-testable.
- [ ] Inline validation + error message when the URL is invalid (no silent bad embeds).
- [ ] Wire the range slider start/end to the YouTube embed preview via
      `?start=<sec>&end=<sec>` and reload the iframe on change.
- [ ] Show HH:MM:SS labels for start/end instead of empty disabled inputs.
- [ ] Gate/label the fake `downloadVideo()` clearly (it currently just opens YouTube) —
      relabel as "Open on YouTube" or disable until real trim (P1) lands.
- [ ] Slider max should reflect real video duration (fallback to a sane default until
      duration is known via the YouTube Player API).

## P1 — Real client-side trimming (no backend)

- [ ] Add "Upload your own video" input (local file).
- [ ] Integrate `@ffmpeg/ffmpeg` (ffmpeg.wasm) to trim the uploaded file client-side.
      NOTE: heavy dep — lightest viable setup, lazy-loaded. Keep YouTube as preview only.
- [ ] Real downloadable trimmed clip + progress bar during ffmpeg processing.

## P2 — UX / a11y polish

- [ ] Responsive layout (mobile-friendly video + slider).
- [ ] Loading + error states throughout.
- [ ] Keyboard navigation + ARIA labels on controls.
- [ ] Empty states.
- [ ] Dark mode.
- [ ] Favicon / branding polish.

## P3 — Health

- [ ] Add prettier + eslint config + scripts.
- [ ] Real unit tests for `extractVideoId` and trim/time logic.
- [ ] GitHub Actions CI (build + test).
- [ ] Prune unused deps (jquery, admin-lte, ion-rangeslider if unused).
- [ ] Fix `rending-page` → `rendering-page` typo (folder, component, route refs).
- [ ] Refresh README with real screenshots + accurate feature list.

## P4 — Deploy

- [ ] Static build to GitHub Pages or Vercel.
- [ ] Live demo link in README.

---

## Changelog (per run)

- _init_: Created ROADMAP.md from priorities; documented observed baseline. Branch
  `nextlevel` created from `main`. Next up: P0 robust `extractVideoId` + validation.
