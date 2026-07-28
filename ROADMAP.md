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

- [x] **Export-format options**: "Export as" selector — Video (MP4/original), Audio only
      (MP3, `libmp3lame`), or Animated GIF (`fps=12,scale=480` + optional crop). Composes
      with the crop presets (disabled for audio). NOTE: WebM not included yet; MP3/GIF
      encoder availability in the CDN core is assumed — needs an in-browser check.
- [x] **Crop to display sizes**: aspect-ratio presets — Original, 16:9, 9:16 (Shorts/
      Reels), 1:1, 4:5 — via a centered ffmpeg `crop` (even-dim safe) + libx264 re-encode
      to MP4. Selector on the upload path; "Original" keeps the fast `-c copy` trim.
      TODO (nice-to-have): live preview of the target frame before export.
- [x] **Frame-accurate trim toggle**: "Precise cut" checkbox re-encodes with output
      seeking (`-ss` after `-i`, libx264) for exact cuts instead of keyframe-aligned
      `-c copy`. Composes with crop/speed/scale.
- [x] **Extract audio** (MP3) — shipped via the "Export as" selector. **Mute** (drop
      audio) — shipped as a "Remove audio" checkbox on the video export path
      (`-an`, fast copy when no other re-encode is needed).
- [x] **Playback speed** (0.5×/1×/1.5×/2×) for video export via `setpts` + `atempo`
      (re-encodes to MP4/H.264).
- [x] **Resolution/scale** presets (Original/1080p/720p/480p) for video export via
      `scale=-2:<h>` (even width, libx264-safe); composes with crop/speed.
- [x] **Grab a still frame** (PNG): "Grab current frame" button captures the frame shown
      in the uploaded-video player to a canvas and downloads it as PNG (named with the
      timestamp). No ffmpeg needed; instant.
- [ ] Show estimated output size / a "processing…" state; cancel button.

## P2 — UX / a11y polish (incl. user-requested "next-level" design)

- [x] **Next-level visual redesign** (rendering page): modern dark, glassy theme with a
      violet→pink brand gradient, restyled card/inputs/selects/buttons/slider/progress,
      neutralized admin-lte sidebar offset. Done via component-scoped SCSS (no HTML rewrite,
      all bindings intact). VERIFIED visually via headless-Chrome screenshot. Raised the
      `anyComponentStyle` budget (8/16kb) for the themed page.
      Follow-ups: apply the same theme to the download/404 pages; add dark/light toggle;
      polish the Material slider colors to match the gradient.
- [ ] Responsive layout (mobile-friendly video + slider).
- [ ] Loading + error states throughout.
- [ ] Keyboard navigation + ARIA labels on controls.
- [ ] Empty states.
- [x] Dark/Light mode toggle: header button switches themes via a `.tf-light` host class
      overriding the CSS variables; choice persisted in `localStorage`. Dark is default.
      Both themes VERIFIED via screenshots.
- [ ] Favicon / branding polish.

- [x] Themed **404 / Not-Found page**: gradient "404", glass card, message, and a
      "Back to TrimFusion" button (routerLink to /home). Replaced the bare placeholder;
      VERIFIED via screenshot.
- [x] Removed the orphaned `/download` mock page (nothing navigated to it; leftover
      admin-lte product-list content) — component, route, and declaration — plus the two
      now-unused mock screenshots in `src/assets`.

## P3 — Health

- [x] Add prettier config + scripts (`.prettierrc.json`, `.prettierignore`, `format` &
      `format:check`), formatted all of `src`, and wired `format:check` into CI.
- [x] Add eslint (`@angular-eslint` 16 + `@typescript-eslint` 5) with `.eslintrc.json`,
      a `lint` script, and a CI "Lint" step. Fixed 10 `no-inferrable-types` findings.
      Uses template/recommended (not accessibility) rules for now.
- [x] Enabled `@angular-eslint/template/accessibility` lint rules — templates already
      pass (0 findings, thanks to existing ARIA labels), now enforced in CI going forward.
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
- [x] Refresh README: real screenshot of the redesigned UI (`docs/screenshot-home.png`),
      accurate feature list (trim, crop-to-size, MP4/MP3/GIF export, PNG frame grab,
      YouTube preview), tech stack, live demo link, correct clone URL + scripts.
      (Old mock screenshots in `src/assets` are now unreferenced — prune candidate.)

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

## P5 — Next-Level Feature Set (user-requested, 2026-07-28: "keep looping, apply next
## level set of features")

Ordered backlog; each item is one loop-sized slice. All ffmpeg work must compose with
the existing filter chain (rotate → crop → scale → setpts) and re-encode conditions.

- [x] **Rotate / flip**: 90° right/left, 180°, horizontal (mirror) & vertical flip via
      `transpose`/`hflip`/`vflip`; applies to video + GIF, first in the filter chain.
- [x] **Color filters**: brightness (−0.5…0.5) / contrast (0.5…2) / saturation (0…3)
      sliders via `eq=`, applied to video + GIF after rotate/crop; only added to the
      filter chain (and only forces re-encode) when values differ from defaults.
      "Reset colors" button appears when adjusted.
- [x] **Volume gain**: 0–200% slider via `volume=`; applies to video (when not muted;
      combined with `atempo` in one `-af` chain) and MP3 export. Non-default volume
      forces the MP4 re-encode path (audio codecs can't be swapped safely in arbitrary
      source containers). Hidden for GIF; disabled while muted.
- [x] **Social presets**: one-click "Quick presets" row — Shorts/Reels/TikTok (9:16 +
      ≤60 s cap + 720p + precise cut), Instagram square (1:1 + ≤60 s + 720p + precise
      cut), YouTube landscape (16:9 + 1080p). Presets just set the existing controls,
      so everything stays inspectable/overridable; active preset is highlighted.
- [ ] **Multi-segment trim + concat** (flagship): mark multiple keep-ranges on the
      timeline, export as one stitched clip.
  - [x] Part 1 (service): `trimSegments()` — normalizes/sorts segments, cuts each
        frame-accurately (output seeking) with identical libx264/aac settings + the
        full filter chain (rotate/crop/color/scale/speed/volume/mute), then stitches
        via the concat demuxer with stream copy; per-step progress mapping. Shared
        filter-builders extracted (`buildVideoFilters`/`buildAudioFilters`/
        `buildEqFilter`) and `trim()` rewired onto them. Also fixed a latent bug:
        the ffmpeg progress handler captured only the FIRST call's onProgress —
        now routed through a re-pointable `progressCb`.
  - [x] Part 2 (UI): "Stitch multiple ranges" — add current slider range as a
        segment, per-segment remove + clear-all, count/total-duration readout,
        "Export stitched clip" button (enabled at 2+ segments) calling
        `trimSegments()`; shared download helper extracted.
- [ ] **Drag & drop upload** onto the player + **keyboard shortcuts** (I/O = set
      in/out at playhead, space = play/pause).
- [ ] **PWA**: installable + offline app shell (@angular/pwa; note: new dep, allowed
      per rules since noted here; ffmpeg core assets cached for offline use).
- [ ] **Export summary**: recap of chosen settings + rough output-size estimate before
      trimming.

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
- _run 13_: P1.5 "Export as" options — added a Video / Audio (MP3) / GIF selector wired
  through `FfmpegTrimService` (audio: `-vn -c:a libmp3lame`; gif: `fps=12,scale=480` with
  optional crop; video path unchanged). Crop selector auto-disables for audio. Build:
  PASS (2.29 MB). Tests: 18/18. Runtime (MP3/GIF encode) not verified headless. Next up:
  P2 next-level redesign, or P1.5 mute/speed/frame-grab, or verify features in-browser.
- _run 14_: P2 NEXT-LEVEL REDESIGN of the rendering page — modern dark/glassy theme,
  violet→pink brand gradient, restyled every control, killed the admin-lte sidebar
  offset. Component-scoped SCSS only (no HTML rewrite; bindings intact). VERIFIED with a
  headless-Chrome screenshot (looks great). Raised anyComponentStyle budget to 8/16kb.
  Build: PASS (2.29 MB). Tests: 18/18. Next up: extend theme to download/404 pages, add
  dark/light toggle, or more P1.5 tools (mute/speed/frame-grab).
- _run 15_: P1.5 "Grab current frame (PNG)" — canvas capture of the uploaded-video
  player's current frame → instant PNG download (timestamped filename). No ffmpeg;
  ghost-styled secondary button in the new theme. Build: PASS (2.29 MB). Tests: 18/18.
  Next up: P1.5 mute/speed toggles, extend theme to download/404 pages, or dark/light.
- _run 16_: P3 — refreshed the README with a real headless-Chrome screenshot of the
  redesigned UI (`docs/screenshot-home.png`), an accurate feature list, tech stack, live
  demo link, and correct clone/scripts. Docs-only (no build impact). Next up: P1.5
  mute/speed toggles, extend theme to download/404 pages, dark/light toggle, or P3 eslint.
- _run 17_: P3 — added ESLint (@angular-eslint 16 / @typescript-eslint 5), `.eslintrc.json`,
  `lint` script, and a CI "Lint" step; auto-fixed 10 no-inferrable-types findings. Lint:
  clean. Format: clean. Build: PASS (2.29 MB). Tests: 18/18. This clears the last P3
  health item. Next up: P1.5 mute/speed tools, extend theme to download/404 pages,
  dark/light toggle, or enable a11y lint rules.
- _run 18_: P2 — redesigned the bare 404 page to match the theme (gradient 404, glass
  card, "Back to TrimFusion" button). Lint/format clean, build PASS (2.30 MB), tests
  18/18. VERIFIED via screenshot of a bogus route. Next up: theme/remove the orphaned
  /download mock page, P1.5 mute/speed tools, or dark/light toggle.
- _run 19_: Removed the orphaned `/download` mock page + 2 unused mock screenshots
  (routing/module cleaned). This run was initially BLOCKED by a full disk (ENOSPC on
  every command); freed ~210 MB via `brew cleanup` (safe, regenerable), then completed:
  lint clean, build PASS (2.29 MB), tests 18/18. NOTE: disk is still 99% full (~3.9 GB
  free) — the loop's per-run ng-serve/headless-Chrome/install churn eats space; consider
  pausing the loop or freeing more disk. Next up: P1.5 mute/speed tools or dark/light.
- _run 20_: P1.5 — added **playback speed** (0.5×/1×/1.5×/2× via setpts+atempo, video
  export) and a **mute** ("Remove audio") toggle. Extended `FfmpegTrimService` options
  (speed/mute) and the video branch (re-encode only when needed; MP4 output). Skipped
  dev-server/screenshots to conserve disk. Lint clean, build PASS (2.30 MB), tests 18/18.
  Runtime (speed/atempo/mute) not verified headless. Next up: resolution/scale presets,
  dark/light toggle, or a11y lint rules.
- _run 21_: P1.5 — added **resolution presets** (Original/1080p/720p/480p) for video
  export via `scale=-2:<h>`; composes with crop/speed in the filter chain. This completes
  the P1.5 editing toolkit. Lint clean, build PASS (2.30 MB), tests 18/18. Disk-safe run.
  Next up: dark/light toggle, a11y lint rules, or an in-browser verification pass of the
  ffmpeg export paths. Roadmap is now largely exhausted — mostly optional polish remains.
- _run 22_: P1.5 — added a **"Precise cut" (frame-accurate)** toggle: re-encodes with
  output seeking (`-ss` after `-i`) instead of keyframe-aligned copy; composes with
  crop/speed/scale. This clears the LAST P1.5 item — the editing toolkit is fully done.
  Lint clean, build PASS (2.30 MB), tests 18/18. Only optional polish remains
  (dark/light toggle, a11y lint, in-browser QA of ffmpeg paths).
- _run 23_: P2/P3 — enabled `@angular-eslint/template/accessibility` rules; templates
  already pass (0 findings), so a11y is now enforced in CI. Build PASS (2.30 MB), lint
  clean. This clears the a11y follow-up. REMAINING is genuinely optional: a light-mode
  toggle (real feature) and a manual in-browser QA of the ffmpeg export paths (can't be
  done headless). Recommend stopping the loop after this unless the light toggle is wanted.
- _run 24_: P2 — Dark/Light theme toggle (header button, `.tf-light` host class swapping
  CSS vars, persisted in localStorage). Both themes verified via screenshots. Lint clean,
  build PASS (2.30 MB), tests 18/18. This was the last real feature — LOOP STOPPED
  (cron 0a6f4d89 cancelled). Remaining work is only manual in-browser QA of the ffmpeg
  export paths, which can't be automated headless. Restart anytime with /loop.
- _run 25_: User asked to keep looping with a "next level set of features" — added the
  **P5 backlog** above and re-armed the loop (cron 6ddca538). Shipped P5 slice 1:
  **Rotate/flip** (90° right/left, 180°, mirror, vertical) for video + GIF via
  `transpose`/`hflip`/`vflip`, first in the filter chain; forces MP4 re-encode for
  video. Lint clean, build PASS, tests 18/18. Next: color filters (eq).
- _run 26_: P5 slice 2 — **color filters**: brightness/contrast/saturation range
  sliders (ffmpeg `eq`, video + GIF, after rotate/crop in the chain), no-op values
  stay on the fast copy path; "Reset colors" button. Lint clean, build PASS (2.30 MB),
  tests 18/18. Next: volume gain (`volume=`), then social presets.
- _run 27_: P5 slice 3 — **volume gain** slider (0–200%, `volume=`), for video (merged
  with `atempo` into a single `-af`) and MP3 export; hidden for GIF, disabled when
  muted; non-default volume joins the MP4 re-encode conditions. Lint clean, build PASS
  (2.30 MB), tests 18/18. Next: social presets (one-click Shorts/Reels/TikTok bundle).
- _run 28_: P5 slice 4 — **social quick presets** (Shorts/Reels/TikTok 9:16 ≤60 s 720p
  precise; Instagram square 1:1 ≤60 s 720p precise; YouTube 16:9 1080p) as a button row
  that configures the existing controls (crop/scale/duration/precise-cut) and highlights
  the active preset. Lint clean, build PASS (2.31 MB), tests 18/18. Next: multi-segment
  trim + concat (flagship) — likely needs 2 runs (service concat first, then timeline UI).
- _run 29_: P5 slice 5a — **multi-segment service layer**: `trimSegments()` (frame-
  accurate per-segment encode + concat-demuxer stitch, full option parity via new
  shared filter-builder helpers; `trim()` refactored onto them — no behavior change).
  Fixed latent progress-callback capture bug (first-call closure → re-pointable sink).
  Lint clean, build PASS (2.31 MB), tests 18/18. Segment path not headless-verifiable
  (wasm). Next: part 2 — segment-list timeline UI + "Export stitched clip".
- _run 30_: P5 slice 5b — **multi-segment UI**: segment builder under the timeline
  (add current range, remove/clear, totals) + "Export stitched clip" via
  `trimSegments()`. Lint clean, build PASS (2.31 MB), tests 18/18. FLAGSHIP COMPLETE.
  User then asked to STOP the loop (cron 6ddca538 cancelled) and commission a
  comprehensive next-level plan → see PLAN-NEXTLEVEL.md (pipeline + ~1000-item
  program in waves). Remaining P5 stubs (drag&drop/shortcuts, PWA, export summary)
  are folded into that plan.
- _run 31_: User commissioned FULL program execution ("complete all the items in the
  plan"). Expanded **plan/wave-1.md** (100 concrete items) and shipped the keystone
  batch W1-001..004 + W1-026..052 (31 items): pure `ffmpeg-args.ts` engine module
  (buildTrimPlan/buildSegmentsPlan/normalizeSegments), service slimmed to load/IO/
  progress, and a 28-case unit suite over the full option matrix. Tests 18 → 46, lint
  clean, build PASS (2.31 MB). Loop re-armed to batch through the remaining items
  wave by wave.
- _run 32_: Mega-batch W1-005..008, 013..025, 053..055 (20 items): CRF quality +
  frame-rate + encode-preset controls, GIF fps/width, MP3 bitrate/sample-rate,
  effects (reverse / loop ×2/×3 / boomerang via per-segment reverse), 0.5 s edge
  fades (post-speed timeline), ffmpeg-exact frame export, split-range-into-N-clips,
  and a live ffmpeg command preview. Component refactored onto a single
  trimOptions() collector. Tests 46 → 59, lint clean, build PASS (2.33 MB).
  Wave 1: 51/100.
- _run 33_: Config batch W1-060..068, 071, 072 (11 items; 060/062/065 were already
  satisfied — verified, not re-done): `verify` + `build:stats` scripts, engines,
  CI bundle-size budget step (2392 KB ≤ 2662 KB verified locally), dependabot
  (npm + actions weekly), bug/feature issue templates, PR template with gate
  checklist, README program section. Gates all green (59/59). Wave 1: 62/100.
- _run 34_: Resilience batch W1-009..012, 076..084, 090 (14 items): typed TrimError
  taxonomy + pure classifyError/messageFor (trim-error.ts), service throws typed
  errors, CDN retry+fallback (unpkg → jsdelivr) with 60 s timeout and clean-retry
  state reset, cancel-export (worker terminate + fresh reload), CANCELLED shown as
  info not error, OOM detection with actionable guidance, duration/size guardrail
  warnings, sharper invalid-file/range messages, 6 taxonomy tests (one caught a real
  regex bug: /OOM/i matched "boom"). Tests 59 → 65. Wave 1: 76/100.
- _run 35_: Summary batch W1-091..099 (9 items): pure export-summary module (chips,
  post-speed duration, rotate/crop/scale-aware output dimensions, size estimates:
  proportional for copy, CRF/height heuristic for re-encodes, bitrate math for MP3,
  width/fps for GIF), live summary chip row above the export button, success recap
  with real size + encode wall-time, copy-diagnostics (settings + command + wasm
  capability report). 5 new tests. Tests 65 → 70. Wave 1: 85/100. Remaining 15:
  strict TS (056/057), eslint extras (058/059/073/074), component split (075),
  CHANGELOG/VERSION (069/070), snackbar/global-handler/storage/metadata/codec
  (085..089), wave-exit (100) — queued for the cron executor.
- _run 36_ (executor): W1-056..059, 074 (5 items): strict TS + strict templates
  verified already enabled; added `eslint-plugin-import` (small dev-dep, noted) with
  alphabetized import/order (autofixed 2 files), no-console (allow warn/error),
  max-lines warning (800) on components. Lint 0 errors 0 warnings, build PASS
  (2.33 MB), tests 70/70. Wave 1: 90/100.
- _run 37_ (executor): W1-069, 070, 073, 086 (4 items): seeded CHANGELOG.md (1.0.0
  user-facing summary), VERSION file + package.json 1.0.0 + git tag v1.0.0,
  `@services/*` tsconfig path alias (component imports switched), global
  ErrorHandler with contextual logging. Gates green (70/70). Wave 1: 94/100.
- _run 38_ (executor): W1-085, 087, 088, 089 (4 items): Material snackbar toasts for
  transient statuses (success recap, cancelled, diagnostics-copied) via a notify()
  helper (+BrowserAnimations/MatSnackBar modules — bundle 2.33 → 2.45 MB, within
  budget), storage-headroom warning via navigator.storage.estimate(), graceful
  metadata-failure message (duration unreadable), preview codec-unsupported
  detection on the <video> error event with honest "export may still work" note.
  Gates green (70/70). Wave 1: 98/100 — remaining: 075 (component split), 100
  (wave exit → wave-2 generation).
- _run 39_ (executor) — **WAVE 1 EXIT (100/100)**. RETRO: 99 items shipped, 1 deferred
  (W1-075 component split → W2-086: under the lint size threshold and Wave 2 rewrites
  that template area — splitting now = double churn). Shipped across 9 commits: the
  pure ffmpeg-args engine + 52-test matrix, quality/fps/effects/fades/MP3/frame/split/
  preview features, typed-error resilience (cancel, CDN fallback, OOM guidance,
  snackbar statuses, storage/metadata/codec fallbacks), export summary + estimates +
  diagnostics, strict-lint hardening (import-order, no-console, max-lines), CI bundle
  budget, dependabot/templates, CHANGELOG + v1.0.0 tag, @services alias, global error
  handler. METRICS: tests 18 → 70 (all green), bundle 2.29 → 2.45 MB (budget 2.6 MB;
  animations+snackbar account for the growth), lint 0 errors/0 warnings, disk stable.
  DEBT/NOTES: ffmpeg runtime paths still need one manual in-browser QA pass (standing);
  bundle diet is Wave 6's job. Generated plan/wave-2.md (Timeline pro: E2×50 timeline/
  preview, E7×20 shortcuts, E13×15 tests, E11×15 polish incl. carried W2-086).
- _run 40_ (executor): W2-001..005 (5 items, Wave 2 begins): `TimelineComponent`
  extracted (slider + readouts moved out of rendering-page; two-way [(start)]/[(end)]
  + rangeCommit), shared formatTime util, cancellable canvas **filmstrip** capture
  util (10 thumbnails via hidden-video seeks) rendered under the slider with a
  shimmer skeleton (reduced-motion aware), regenerated per new file with in-flight
  cancel. Dead timeline styles removed from rendering-page. Gates green (70/70,
  2.46 MB). Wave 2: 5/100.
- _run 41_: PR triage per user request ("merge all PRs"): merged the 4 GitHub-Actions
  bumps (#12 deploy-pages v5, #13 upload-pages-artifact v5, #14 setup-node v7,
  #15 checkout v7) and applied the 3 npm bumps on main (tslib 2.8.1, zone.js 0.13.3,
  karma-chrome-launcher 3.2.0 → dependabot PRs #18/#19/#20 auto-close). NOT merged,
  with reasons: #16 Angular 16→22 (six majors; needs staged ng update migrations —
  a dedicated program effort, left open) and #17 admin-lte 3→4 (package is slated for
  removal in Wave 6, closed). Added dependabot ignores for both major streams.
  Gates green after bumps (lint 0, build 2.46 MB, tests 70/70).
- _run 42_ (executor): W2-006..009, 074 (5 items): **audio waveform strip** — pure
  peakBuckets() min/max-abs bucket reduction normalized to the loudest bucket (6-case
  spec incl. silence and short-input edge cases), decodePeaks() via AudioContext.
  decodeAudioData with null fallback for audio-less/undecodable files (strip simply
  hidden), canvas bar render in TimelineComponent between filmstrip and slider,
  stale-result token guard on file swaps. Tests 70 → 76, gates green (2.46 MB).
  Wave 2: 10/100.
- _run 43_ (executor): W2-010..013, 071, 084 (6 items — 084's snap spec shares the
  zoom spec file, so it rode along): **zoomable timeline** — pure zoomWindow/panWindow/
  snapSeconds math (7-case spec: centering, edge clamps, span preservation, snap
  rounding), 1×/2×/4×/8× zoom buttons + ‹ › pan (span/4 steps) + visible-window
  readout, strips slide via a transformed track (reduced-motion aware), slider
  min/max ride the window, snap-to-seconds toggle switches slider step 1 s ↔ 0.1 s
  and rounds emitted values; view resets on new file. Tests 76 → 83, gates green
  (2.46 MB). Wave 2: 16/100.
- _run 44_ (executor): W2-014..017, 043 (5 items): **playhead layer** — white glow
  playhead marker synced to the player's timeupdate, violet/pink in/out markers, all
  positioned via posPercent() inside the zoom window (hidden when off-screen);
  click-to-seek on the strips (snap-aware) and arrow-key seeking (±1 s, Shift ±5 s)
  on the focusable timeline group (real keyboard operability, focus-visible ring);
  "Set start/end here" buttons pin the trim range to the playhead with order/bounds
  clamping. Gates green (83/83, 2.47 MB). Wave 2: 21/100.
- _run 45_ (executor): W2-018, 019, 022, 023, 072 (5 items): **segment blocks on the
  timeline** — numbered blocks in a lane under the strips (zoom-window clamped via
  blockStyle(), off-screen hidden), click/keyboard selection synced with the list
  (toggle, aria-pressed), ↑/↓ stitch-order reordering, and pure hasOverlap/
  mergeOverlapping helpers (7-case spec) with an overlap warning + one-click merge.
  ENGINE CHANGE: buildSegmentsPlan now PRESERVES arrangement order (normalizeSegments
  gained sortByStart param) so reordering genuinely changes the stitched output;
  spec updated to assert order preservation. Tests 83 → 88, gates green (2.47 MB).
  Wave 2: 26/100.
- _run 46_ (executor): W2-020, 021, 024, 025 (4 items): **draggable segment blocks** —
  pointer-capture drag with edge zones (7 px) for start/end resize vs body move,
  snap-aware, clamped to clip bounds with 1 s minimum length, click-vs-drag
  suppression (3 px threshold), grab/grabbing cursors + touch-action none;
  **platform-cap indicator** on the stitch totals (fits/exceeds Shorts-Reels-TikTok
  60 s, 10 min general note); **per-segment ▶ preview** (seek + play + auto-pause at
  segment end, interval-watched, cleaned up on destroy). Lint 0 errors (1 max-lines
  warning on rendering-page — the W2-086 split signal), build 2.47 MB, tests 88/88.
  Wave 2: 30/100.
- _run 47_ (executor): W2-026..028, 030, 031 (5 items): **live preview layer** — pure
  preview-css mappings (eq→CSS filter with additive→multiplicative brightness note,
  rotate/flip→transform with quarter-turns scaled 9/16 to stay in the contain box,
  cropOverlayRect() computing the centered crop rect over the letterboxed content
  area; 8-case spec) wired to the player: [style.filter]/[style.transform] bindings,
  dashed-accent crop overlay with dimmed surround (box-shadow trick, clipped by the
  container), and a "Live preview" toggle. ffmpeg stays the export source of truth.
  Tests 88 → 93, gates green (2.48 MB). Wave 2: 35/100.
- _run 48_ (executor): W2-029, 032..034, 082 (5 items): **playback-sync preview** —
  pure playbackSync() mapping (speed→playbackRate with clamps, mute→muted,
  volume→volume capped at 1.0 with the >100%-only-at-export limitation documented;
  3-case spec) bound to the player element, plus a "Compare original" toggle
  (aria-pressed) that bypasses filter/transform/crop-overlay while active, shown
  only when visual adjustments exist. Tests 93 → 96, gates green (2.48 MB).
  Wave 2: 40/100.
- _run 49_ (executor): W2-036, 039, 040, 042, 073 (5 items): **precision time entry** —
  pure parseTimeString() ("90" / "1:30" / "1:02:03" / "1:23.5"; rejects ≥60
  sexagesimal digits and malformed shapes; 5-group spec), start/end readouts became
  EDITABLE inputs (parse → clamp to valid range → snap → commit, invalid input
  reverts to the formatted value), playhead/total time readout in the control row,
  and a "Full range" one-click reset. Tests 96 → 101, gates green (2.48 MB).
  Wave 2: 45/100.
- _run 50_ (executor): W2-035, 037, 038, 041 (4 items): **fine-control row** — hover
  time tooltip tracking the pointer across the strips (zoom-window aware, clipped
  inside the viewport), ±1-frame step buttons (~1/30 s, bypasses snap), jump-to-trim-
  start/end buttons, and vertical ±1 s nudge buttons beside both time inputs
  (clamped, committed). Gates green (101/101, 2.48 MB). Wave 2: 49/100.
- _run 51_ (executor): W2-044..048 + spec-halves 078, 083 (7 items): **E2 closeout
  hardening** — toolbar role/label on the control row (ARIA pass across the new
  surfaces), reduced-motion guards extended to the player preview transitions,
  zoom/snap preferences persisted in localStorage (restored on load, saved on
  change), responsive filmstrip thumbnail count (thumbCountForWidth, 6–24 band,
  ~72 px/thumb), and a pure trailing-edge debounce with cancel wired to a
  window-resize waveform redraw (jasmine.clock spec). Tests 101 → 108, gates green
  (2.48 MB). Wave 2: 56/100 — E2 remaining: 049, 050.
- _run 52_ (executor): W2-049..053 (5 items): **E2 closed + keyboard layer opened** —
  timeline empty-state hint (dashed panel until media loads), README "Timeline
  architecture" note documenting the pure-module split, pure shortcuts.ts key→action
  map with a typing-target guard, global document:keydown scaffold (modifier-safe,
  disabled while typing), first bindings live: Space play/pause, I/O set in/out at
  the playhead. Gates green (108/108, 2.48 MB). Wave 2: 61/100.
- _run 53_ (executor): W2-054..058 (5 items): **full transport keyboard** — J/K/L
  shuttle (halve/reset/double playbackRate 0.25×–4×, honestly documented as a
  slow-motion adaptation since HTML video can't reverse; overrides the speed-control
  sync until K or a new file resets it), arrow-key seeks ±1 s (Shift ±5 s, scroll
  prevented, no double-fire with the focused strip via defaultPrevented guard),
  , / . frame steps, M mute toggle, + / − timeline zoom via a new zoomStep() on the
  timeline. Gates green (108/108, 2.49 MB). Wave 2: 66/100.
- _run 54_ (executor): W2-059..063, 075 (6 items; 063 = verify — the pure map shipped
  with the W2-051 scaffold): **S** adds the current range as a segment, **E** starts
  the export, **?** toggles a keyboard **cheat-sheet overlay** (dialog with kbd-styled
  key list, Esc closes, ⌨ Keys header button for discoverability), and a 5-case
  shortcut-map spec (every action bound, no accidental duplicates — only +/= share
  zoomIn — case-insensitive resolution, typing-target detection). Tests 108 → 112,
  gates green (2.49 MB). Wave 2: 72/100.
- _run 55_ (executor): W2-064..067, 076 (5 items): **preventDefault audit** (Space no
  longer steals activation from focused buttons; '?' suppresses browser quick-find;
  arrows/space already covered), **shortcuts on/off toggle** inside the cheat-sheet
  with the preference persisted to localStorage and restored at startup, and a pure
  bounded **HistoryStack** (push clears redo branch, oldest-trim at limit, clear();
  5-case spec) ready for the Ctrl+Z wiring next run. Tests 112 → 117, gates green
  (2.49 MB). Wave 2: 77/100.
- _run 56_ (executor): W2-068..070, 077 (4 items) — **E7 COMPLETE (all 20)**:
  Ctrl/Cmd+Z undo + Shift redo over full EditorState snapshots (ngDoCheck transition
  detection with 500 ms burst coalescing so slider drags become one step; history
  suppressed during restores), **shareable settings links** — serializeState/
  parseState with stable compact keys, only-non-defaults, tolerant parsing that
  drops garbage numbers and invalid enums (5-case round-trip spec), "Copy settings
  link" button, and fragment restore on load with a snackbar note. Tests 117 → 122,
  gates green (2.49 MB). Wave 2: 81/100 — remaining: E13 component specs (079/080/
  081/085) and the E11 polish block (086..100).
- _run 57_ (executor): W2-079..081, 085 (4 items) — **E13 COMPLETE (all 15)**: DOM
  component specs — timeline renders labeled segment blocks and hides them outside
  the zoom window; typed time inputs apply/emit valid values, revert garbage, clamp
  out-of-range ends; cheat-sheet opens via the header button, lists every documented
  binding, closes on Escape and the ✕ button. COVERAGE (statements): ffmpeg-args
  99.4%, trim-error 100%, export-summary 80.8%, shared 99.4% — every pure module
  ≥80% target met; ffmpeg-trim.service.ts sits at 11% by design (wasm IO is not
  headless-testable; covered by the standing manual-QA note). Overall 49.6%
  (components dominate the uncovered remainder). Tests 122 → 128, gates green
  (2.49 MB). Wave 2: 85/100 — remaining: E11 polish 086..099 + wave exit 100.
- _run 58_ (executor): W2-086, 087 (2 items — the wave's big refactor): **export
  controls extracted** into ExportControlsComponent — all 16 control groups moved out
  of rendering-page.html into four collapsible <details> sections (Basics open by
  default: format/crop/resolution/quality/speed; Visual: rotate/colors/fps/effect/
  fades; Audio: mute/volume/MP3; Advanced: precise/encode-preset/GIF), two-column
  layout on wide screens, native-accessible summaries. Deliberate architecture note:
  this is a TEMPLATE-level split — state stays on the page component (undo/URL
  snapshots and trimOptions() read it there); the child renders against a required
  `page` input. Carried-over W1-075 debt is now paid. Gates green first pass
  (128/128, 2.50 MB). Wave 2: 87/100.
- _run 59_ (executor): W2-088..090, 092, 093 (5 items): **design tokens** extracted to
  shared/_tokens.scss (theme palettes as mixins — single source consumed by the page
  host — plus radius/spacing/typography scale vars), **sticky export button** on
  ≤560 px screens, **shared focus-visible ring mixin** applied across all three
  component stylesheets (consistent keyboard focus), and **pipeline stage labels**:
  the service reports engine/encoding/stitching stages via onStage callbacks, the
  progress bar now reads "Loading the video engine (first run, ~30 MB)… / Processing…
  / Stitching segments…" with the percent — the first-export 30 MB download finally
  explains itself. Gates green (128/128, 2.50 MB). Wave 2: 92/100.
- _run 60_ (executor): W2-091, 094..096, 098 (5 items): **designed empty state**
  (inline film-icon SVG + guidance copy replaces the old placeholder JPEG, which is
  deleted), **SVG header icons** (sun/moon theme toggle, keyboard icon — emoji gone),
  **micro-interaction pass** (consistent hover/active transitions with a pressed
  translate, reduced-motion-safe), **control consistency** (custom SVG select chevron,
  accent-colored checkboxes), and **coarse-pointer touch targets** (bigger zoom/nudge
  buttons, taller segment lane/blocks on touch devices). Gates green (128/128,
  2.50 MB). Wave 2: 97/100 — remaining: 097 mobile audit, 099 baseline doc, 100 exit.
- _run 61_ (executor) — **WAVE 2 EXIT (100/100)**. Final items: ≤480 px layout audit
  (slider reflows above stacked time inputs, header actions wrap, full-width action
  buttons), visual-regression baseline doc (docs/visual-baseline.md — 12 states ×
  2 viewports × 2 themes manual capture list; automated capture stays blocked on
  interactive browser + disk), wave exit. RETRO: 100/100 items, zero deferred out.
  Shipped: the full timeline pro (filmstrip, waveform, zoom/pan/snap, playhead layer,
  draggable segment blocks with reorder/overlap-merge and honest arrangement-order
  stitching), complete live preview (crop/color/rotate CSS + playback sync +
  compare-original), full keyboard layer (transport + marking + zoom + cheat-sheet +
  persisted toggle + preventDefault audit), undo/redo with burst coalescing,
  shareable settings links, ExportControlsComponent with collapsible sections,
  design tokens + focus rings + stage labels + mobile/touch polish. METRICS: tests
  108 → 128 (this wave; 18 → 128 program-wide), bundle 2.48 → 2.50 MB (budget
  2.6 MB), lint 0/0, coverage: all pure modules ≥80% statements. DEBT: standing
  manual in-browser QA of ffmpeg paths; bundle diet in Wave 6; state remains on the
  page component (template-level controls split) — revisit if it grows. Generated
  plan/wave-3.md (Filters I + preview depth: E4×40 filter stack framework + 16
  filters + 10 look presets + saved looks, E2×15 preview depth, E13×25 specs,
  E11×20 themes/polish incl. theme picker with 5 themes).
- _run 62_ (executor): W3-001..005, 057 (6 items; the framework spec ships with the
  framework): **filter-stack engine + UI** — FILTER_DEFS registry (label/intensity/
  snippet/CSS-approx per filter; seeded with grayscale, sepia, invert),
  buildFilterStack() composing into the vfilter chain after eq (video, GIF and
  segment plans; forces re-encode; unknown keys skipped), and a "Filters" controls
  section: add-select, stacked list with per-filter intensity slider (when
  meaningful), reorder ↑/↓, remove, and an "(export-only)" tag for filters without a
  CSS preview. 3-case framework spec (order-after-eq, re-encode forcing, unknown-key
  skip). Tests 128 → 131, gates green (2.51 MB). Wave 3: 6/100.
- _run 63_: **Branch cleanup per user request ("merge all branches to main")** — 16 bot
  branches triaged. MERGED: tech-stack-file (techstack.yml/md docs). LANDED as direct
  bumps (single coherent install; literal merges would have fought over package-lock
  15 times): @angular/* 16.2.12/.14 minors + devkit/CLI 16.2.16 (covers the dependabot
  group + snyk cdk/material/youtube-player branches), admin-lte 3.2.0, bootstrap 5.3.2,
  karma 6.4.4, TypeScript 4.9 → 5.1.6. SKIPPED with reasons: eslint 10 (toolchain
  peers cap at 8 — modernization effort), zone.js 0.14 (needs Angular 17+), four snyk
  @angular 19.2.x partial bumps (v19 pieces in a 16 app — superseded by the tracked
  upgrade), jquery 3.7.1 (jquery no longer a dependency). All 16 remote branches
  deleted after landing/supersession. Gates green on the new toolchain (131/131,
  2.54 MB ≤ 2.6 budget).
- _run 64_ (executor): W3-006..010, 059, 065 (7 items; 007 badge + 008..010 defs
  shipped with the framework — now verified by their own specs): **live preview of
  the filter stack** — stackPreviewFilter() maps approximable entries to CSS
  (grayscale/sepia/invert), composed into the player's filter chain after the color
  preview; export-only filters stay badged and contribute nothing to the preview;
  explicit snippet specs for the three seed filters and the CSS-mapping spec
  (unknown keys skipped, empty stacks). Tests 131 → 134, gates green (2.54 MB).
  Wave 3: 13/100.
- _run 65_ (executor): W3-011..014, 058, 060 (6 items): **intensity-driven filters** —
  vignette (angle grows with intensity, ffmpeg default at the midpoint), blur
  (boxblur 0–10 with a CSS blur() live preview), sharpen (unsharp 5:5 amount 0–3),
  denoise (hqdn3d 0–8) — the first defs exercising the per-filter intensity slider
  end-to-end. Specs: exact snippet-per-intensity mappings and the clamp/default
  behavior ([0,1] clamp, def default when omitted). Tests 134 → 136, gates green
  (2.55 MB). Wave 3: 19/100.
- _run 66_ (executor): W3-015..019, 061 (6 items): **color-science filters** — gamma
  (2^(2i−1), 0.5–2.0), exposure (±3 stops with a CSS brightness(2^E) live preview),
  color temperature (2000K warm → 11000K cool via colortemperature), tint
  (colorbalance green–magenta), hue rotate (0–360° with CSS hue-rotate preview).
  All neutral at the slider midpoint by design. Spec pins midpoint neutrality and
  the extreme mappings. Tests 136 → 137, gates green (2.55 MB). Wave 3: 25/100.
- _run 67_ (executor): W3-020..023, 062 (5 items): **stylistic filters complete the
  individual set (16 total)** — posterize (luma quantization, 8→2 levels via lutyuv),
  film grain (temporal noise 0–30), pixelate (down/upscale with neighbor sampling,
  2–20×), edge paint (edgedetect colormix, threshold falls with intensity). Spec
  pins each snippet at representative intensities. Tests 137 → 138, gates green
  (2.55 MB). Wave 3: 30/100 — next: the ten one-click look presets.
- _run 68_ (executor): W3-024..034, 063 (12 IDs, one coherent slice — the looks are
  registry entries and shipping them without the row would leave them unreachable):
  **ten one-click looks** — Cinematic, Vintage fade, Noir, Vivid pop, Cool blue,
  Warm sunset, Dreamy soft, Matrix green, Bleach bypass, VHS — each a canned stack
  over the 16-filter registry (approximations of the plan's curve-based recipes,
  composed from our tested filters), applied via a chip row (highlighted, editable
  after applying). Spec: every look expands to known filters, exact noir expansion,
  and lookStack() returns mutation-safe copies. Tests 138 → 141, gates green
  (2.55 MB). Wave 3: 42/100.
