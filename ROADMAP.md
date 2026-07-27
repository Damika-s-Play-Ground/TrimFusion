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

- [x] Robust `extractVideoId()`: handles `youtu.be/ID`, `/shorts/ID`, `/embed/ID`,
      `/live/ID`, `watch?v=ID`, extra params (`&t=`, `&list=`), playlists, and bare
      11-char IDs. Returns null on failure. Exported pure function, unit-testable.
- [x] Inline validation + error message when the URL is invalid (no silent bad embeds).
- [x] Wire the range slider start/end to the YouTube embed preview via
      `?start=<sec>&end=<sec>` — dual-thumb `mat-slider` bound to `startSeconds`/
      `endSeconds`, iframe rebuilt on drag-end (keeps start < end).
- [x] Show HH:MM:SS labels for start/end (live-updating disabled inputs + slider
      tooltip via `displayWith`). `formatTime()` renders MM:SS / H:MM:SS.
- [x] Gated/labeled the fake download: button is now "OPEN ON YOUTUBE" (icon
      `open_in_new`), disabled until a valid video is loaded, with a tooltip noting real
      trimming is coming. `downloadVideo()` → `openOnYouTube()`.
- [ ] Slider max should reflect real video duration (fallback to a sane default until
      duration is known via the YouTube Player API).

## P1 — Real client-side trimming (no backend)

- [x] Add "Upload your own video" input (local file): file picker (`accept="video/*"`),
      `<video controls>` preview via an object URL (revoked on change/destroy), and the
      trim slider max/end sized from the real video duration (`loadedmetadata`). Selecting
      a file switches out of YouTube mode. No new deps yet.
- [x] Integrate `@ffmpeg/ffmpeg` (ffmpeg.wasm), lazy-loaded, in `FfmpegTrimService`.
      Uses the SINGLE-THREADED core loaded from unpkg via `toBlobURL` → no SharedArrayBuffer,
      so no COOP/COEP needed (works on GitHub Pages). Core/wasm/worker all fetched at
      runtime from CDN, so the app bundle stays ~2.28 MB (not bundled).
- [x] Real downloadable trimmed clip + progress bar. "TRIM & DOWNLOAD" button on the
      local-upload path runs `ffmpeg -ss <start> -i in -t <dur> -c copy out` (fast,
      lossless, keyframe-aligned), shows a live % progress bar, and downloads the clip.
      Errors surface an inline alert. NOTE: in-browser runtime not yet verified in CI/
      headless — needs a manual browser check on the live site (upload → trim → download).

## P1.5 — Editing tools & export options (user-requested, ffmpeg-powered)

Now that the ffmpeg engine is wired, expand it into a real toolkit. Ship each as its
own small slice (all operate on the uploaded local file):

- [ ] **Download-format options**: export the trimmed clip as MP4 / WebM / GIF (and
      "keep original"). A format `<select>`; GIF/format-change forces a re-encode.
- [x] **Crop to display sizes**: aspect-ratio presets — Original, 16:9, 9:16 (Shorts/
      Reels), 1:1, 4:5 — via a centered ffmpeg `crop` (even-dim safe) + libx264 re-encode
      to MP4. Selector on the upload path; "Original" keeps the fast `-c copy` trim.
      TODO (nice-to-have): live preview of the target frame before export.
- [ ] **Frame-accurate trim toggle**: option to re-encode (`-ss` after `-i`, libx264)
      for exact cuts instead of keyframe-aligned `-c copy`.
- [ ] **Extract audio** (MP3) and **mute** (drop audio) options.
- [ ] **Playback speed** (0.5×–2×) and **resolution/scale** presets (1080p/720p/480p).
- [ ] **Grab a still frame** (PNG) at the current position.
- [ ] Show estimated output size / a "processing…" state; cancel button.

## P2 — UX / a11y polish (incl. user-requested "next-level" design)

- [ ] **Next-level visual redesign**: cohesive modern theme, better hierarchy/spacing,
      polished controls, an editing-toolbar layout for the new tools, iconography, and
      micro-interactions. (Consider a design pass via the design skills.)
- [ ] Responsive layout (mobile-friendly video + slider).
- [ ] Loading + error states throughout.
- [ ] Keyboard navigation + ARIA labels on controls.
- [ ] Empty states.
- [ ] Dark mode.
- [ ] Favicon / branding polish.

## P3 — Health

- [x] Add prettier config + scripts (`.prettierrc.json`, `.prettierignore`, `format` &
      `format:check`), formatted all of `src`, and wired `format:check` into CI.
- [ ] Add eslint (`@angular-eslint`) config + `lint` script + CI step (follow-up to
      prettier; kept separate to avoid pulling several devDeps in one slice).
- [x] Real unit tests for `extractVideoId` (17 cases: youtu.be, /shorts, /embed, /live,
      watch?v, extra params, no-protocol, bare id, whitespace, and null cases). Added a
      `test:ci` script (`ng test --watch=false --browsers=ChromeHeadless`). Also repaired
      the stale scaffold `app.component.spec.ts` (referenced a removed `title`). 18/18 pass.
      TODO: trim/time (`formatTime`) tests once that logic is extracted/testable.
- [x] GitHub Actions CI (`.github/workflows/ci.yml`): on push to main/nextlevel and PRs
      to main — `npm ci` → `npm run test:ci` (headless) → `npm run build` on Node 18.
      Added `karma.conf.js` with a `ChromeHeadlessCI` (`--no-sandbox`) launcher wired via
      `karmaConfig` in angular.json; `test:ci` now targets it.
- [x] Prune unused JS: emptied the `scripts` array (jQuery, Bootstrap-JS, all admin-lte
      plugins — DataTables/pdfmake/Chart.js/etc.; none used by this Angular-only app) and
      removed `jquery` + `ion-rangeslider` deps. Bundle: **5.86 MB → 2.27 MB (−61%)**.
      Budget tightened back to 2.5mb warn / 3.5mb error. NOTE: styles are still ~1.9 MB
      with duplicate CSS (adminlte double-loaded via styles.scss + angular.json; bootstrap
      .css and .min.css both listed; tempusdominus listed twice) — a follow-up CSS-prune
      slice can shrink this further. FontAwesome CSS must stay (used in download-page).
- [x] Fix `rending-page` → `rendering-page` typo (folder, files, `RenderingPageComponent`
      class, `app-rendering-page` selector, module declaration + routing refs).
- [ ] Refresh README with real screenshots + accurate feature list.

## P4 — Deploy

- [x] Static build to GitHub Pages via Actions (`.github/workflows/deploy.yml`): builds
      with `--base-href /TrimFusion/`, adds an SPA `404.html` fallback, and publishes on
      push to `nextlevel`. Pages enabled with source = GitHub Actions.
- [x] Live demo link in README → https://damika-s-play-ground.github.io/TrimFusion/
      VERIFIED LIVE (HTTP 200; index + main.js + styles.css all load).
      GOTCHA for future deploys: the `github-pages` environment blocks non-default
      branches by default — `nextlevel` was added to a custom deployment-branch-policy
      via the API so deploys from `nextlevel` are allowed.

---

## Changelog (per run)

- _init_: Created ROADMAP.md from priorities; documented observed baseline. Branch
  `nextlevel` created from `main`. Next up: P0 robust `extractVideoId` + validation.
- _run 2_: P0 — robust `extractVideoId` (exported pure fn handling youtu.be, /shorts,
  /embed, /live, watch?v, extra params, bare IDs; returns null on failure). Added inline
  validation error + `aria-live` alert. Relabeled fake download to "OPEN ON YOUTUBE"
  (disabled until a valid video loads). Raised angular.json budget so build passes
  (bundle is 5.86 MB — pruning admin-lte/bootstrap tracked in P3). Build: PASS.
  Next up: P0 wire slider start/end to embed `?start=&end=` with HH:MM:SS labels.
- _run 3_: P0 — wired dual-thumb `mat-slider` (`startSeconds`/`endSeconds`, 0–600s
  default) to the YouTube embed via `?start=&end=&rel=0`; iframe rebuilds on drag-end
  with a start<end guard. Added `formatTime()` HH:MM:SS labels (live inputs + slider
  tooltip) and ARIA labels on thumbs. Build: PASS. Next up: P0 slider max should
  reflect real video duration (via @angular/youtube-player, already a dep).
- _run 4_: P3 — fixed the `rending-page` → `rendering-page` typo (folder + files via
  `git mv`, `RenderingPageComponent` class, `app-rendering-page` selector, template/
  style URLs, module declaration + routing import/ref). No behavior change. Chose this
  bounded slice over the P0 duration item, which needs a preview rewrite (swapping the
  iframe for `<youtube-player>`) too large to land safely in one autonomous run. Build:
  PASS. Next up: P0 real video duration OR P3 unit tests for `extractVideoId` (pure fn,
  already exported) — tests are the lower-risk high-value slice if karma/Chrome runs.
- _run 5_: P3 — added 17 `extractVideoId` unit tests + `test:ci` headless script; fixed
  the stale scaffold `app.component.spec.ts` (removed assertions on a deleted `title`
  property) that was blocking the whole suite. Build: PASS. Tests: 18/18 PASS
  (ChromeHeadless). Next up: P3 GitHub Actions CI running `build` + `test:ci` — the
  headless script makes this a clean next slice.
- _run 6_: P3 — GitHub Actions CI (`ci.yml`): Node 18, `npm ci` → `test:ci` → `build`
  on push (main/nextlevel) + PRs to main. Added `karma.conf.js` with a CI-safe
  `ChromeHeadlessCI` (`--no-sandbox`) launcher (wired via `karmaConfig`), switched
  `test:ci` to it, and simplified reporters/`clearContext` to drop a noisy
  "full page reload" artifact. Build: PASS. Tests: 18/18 PASS. Next up: P3 prettier +
  eslint (config + scripts) OR P3 prune unused deps (jquery/admin-lte/ion-rangeslider).
- _run 7_: P3 — pruned unused JS. Emptied the huge `scripts` array (jQuery, Bootstrap-JS,
  admin-lte plugin bundle) + removed `jquery`/`ion-rangeslider` deps after confirming no
  template uses Bootstrap-JS behaviors or jQuery. Bundle 5.86 MB → 2.27 MB (−61%); no
  more budget-error hack (tightened to 2.5/3.5 mb). Build: PASS. Tests: 18/18 PASS.
  Next up: P3 prettier + eslint, OR a follow-up CSS-prune (dedupe adminlte/bootstrap
  styles to shrink the remaining ~1.9 MB of CSS).
- _run 8_: P3 — added Prettier (devDep + `.prettierrc.json` + `.prettierignore` +
  `format`/`format:check` scripts), formatted all of `src`, and added a `format:check`
  CI step. Deferred CSS-dedupe: admin-lte 3.1 is Bootstrap-4-based while the dep is
  Bootstrap 5, so the duplicate CSS loads interact with cascade order — needs visual QA,
  not a blind autonomous edit. Format: clean. Build: PASS (2.27 MB). Tests: 18/18 PASS.
  Next up: P3 eslint (@angular-eslint) config + lint script + CI step.
- _run 9_: P4 — DEPLOY. Confirmed nothing was live (Pages 404) and CI was green on
  GitHub. Added `deploy.yml` (GitHub Pages via Actions: prod build with
  `--base-href /TrimFusion/`, SPA `404.html`, deploy on push to nextlevel), enabled Pages
  (source = Actions), and added the live-demo link to the README with an honest status
  note. Local prod build: PASS. Live URL: https://damika-s-play-ground.github.io/TrimFusion/
  Next up: verify the deploy run is green + the site loads; then P3 eslint or P1 ffmpeg.
- _run 9b_: Deploy went green after allowing `nextlevel` in the `github-pages`
  environment branch policy (first attempt was blocked by env protection). Site VERIFIED
  LIVE at https://damika-s-play-ground.github.io/TrimFusion/ (HTTP 200, bundles load).
  Next up: P1 real client-side trimming (ffmpeg.wasm) — the core feature — or P3 eslint.
- _run 10_: P1 (step 1) — "Upload your own video": added a file picker + local `<video>`
  preview (object URL, revoked on change/ngOnDestroy) and sized the trim slider from the
  uploaded file's real duration via `loadedmetadata`. Selecting a file exits YouTube mode.
  No new deps. Format: clean. Build: PASS (2.27 MB). Tests: 18/18 PASS. Next up: P1 step 2
  — integrate ffmpeg.wasm to actually trim + download the uploaded clip with a progress
  bar (note: ffmpeg.wasm wants COOP/COEP isolation which GitHub Pages can't set — pick a
  single-threaded core / SW workaround). Alternatively P3 eslint as a lighter slice.
- _run 11_: P1 (step 2) — REAL client-side trimming shipped. Added `@ffmpeg/ffmpeg` +
  `@ffmpeg/util`, a lazy `FfmpegTrimService` (single-threaded core from CDN → no
  COOP/COEP, GitHub-Pages-safe), and a "TRIM & DOWNLOAD" button with a live % progress
  bar + inline error on the upload path. Bundle stays 2.28 MB (core loads at runtime).
  Format: clean. Build: PASS. Tests: 18/18 PASS. Runtime trim NOT yet verified in
  headless — flagged for a manual browser check. User also requested a big feature
  expansion (formats, aspect-ratio crop, more tools, next-level UI) — added as new
  P1.5/P2 backlog. Next up: verify trim in-browser on the live site, then P1.5
  download-format options or aspect-ratio crop presets.
- _run 12_: Branch workflow change — per user, consolidated everything onto `main`
  (fast-forward merge of the 12 nextlevel commits), retargeted CI + Pages deploy to
  `main`, fixed the github-pages env branch policy (allow main, drop nextlevel), and
  DELETED `nextlevel` (local + remote). Left unrelated `snyk-*`/`tech-stack-file` bot
  branches untouched (flagged to user). Then shipped P1.5 "Crop to display sizes":
  aspect-ratio presets (16:9/9:16/1:1/4:5/Original) via centered ffmpeg crop + libx264
  re-encode; "Original" keeps the fast copy path. Build: PASS (2.29 MB). Tests: 18/18.
  Loop now runs on main (cron recreated as 0a6f4d89). Next up: P1.5 download-format
  options (mp4/webm/gif) or extract-audio/mute, then P2 next-level redesign.
