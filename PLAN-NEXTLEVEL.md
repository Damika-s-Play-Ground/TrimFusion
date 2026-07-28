# TrimFusion — Next-Level Program Plan

_Commissioned 2026-07-28. Goal: evolve TrimFusion from a polished client-side
trimmer into a full in-browser video studio via ~1000 tracked features/fixes,
delivered continuously in small, verified, pushed increments._

This plan has two parts, in priority order:

1. **The delivery pipeline** — the standing process by which every change is
   implemented, tested, and pushed to remote. This exists first; features flow
   through it.
2. **The program** — 18 epics totalling exactly 1000 items, sequenced into 10
   waves of ~100, with the expansion/tracking mechanism that turns epic budgets
   into concrete per-wave checklists.

---

## Part 1 — The delivery pipeline (implement → test → push, forever)

### 1.1 Ground rules (unchanged from the loop era, now codified)

- **Branch:** all work lands on `main`. No PRs unless explicitly requested.
- **One slice per iteration:** the smallest complete, user-visible (or
  test-visible) unit. A slice is never left half-done in the tree.
- **The tree is never broken:** every commit passed all gates at commit time.
- **Traceability:** every commit references its item ID (e.g. `W1-023`) from
  the active wave checklist; ROADMAP.md carries a one-line changelog per run.

### 1.2 The per-change loop (the inner loop, ~5–30 min per item)

```
pick item from plan/wave-N.md (topmost unchecked, smallest-complete)
  → implement (code + template + styles + any test)
  → npm run format          (prettier, auto)
  → npm run lint            (eslint incl. a11y rules — must be 0 errors)
  → npm run build           (must pass; watch bundle size vs budget)
  → npm run test:ci         (must pass; REQUIRED whenever logic touched)
  → update plan/wave-N.md checkbox + ROADMAP changelog line
  → git commit (message references item ID) → git push origin main
  → GitHub Actions auto-deploys to GitHub Pages
```

- **If any gate fails:** fix within the iteration or `git checkout -- .` and
  re-scope the item smaller. Never commit red.
- **Disk discipline (standing, machine at ~98%):** no dev-server/screenshot
  verification by default; end every session with
  `rm -rf dist .angular node_modules/.cache`.

### 1.3 The per-wave loop (the outer loop, every ~100 items)

1. **Expand:** at wave start, expand the wave's epic allocations into
   `plan/wave-N.md` — a numbered checklist (`W<N>-001` …) of concrete,
   slice-sized items drawn from the epic catalog below.
2. **Execute:** run the inner loop over the checklist (autonomous `/loop`
   sessions or interactive sessions — same gates either way).
3. **Verify:** wave exit requires: all items checked or explicitly deferred
   (with reason), gates green, bundle size within budget (≤2.6 MB initial
   until the perf epic reduces it), and **one manual in-browser QA pass** of
   the wave's user-facing changes on the live site (the only step a human or
   a browser-driving session must do — ffmpeg paths can't run headless).
4. **Retro line:** one paragraph in ROADMAP.md: what shipped, what was
   deferred and why, measurements (bundle size, test count).

### 1.4 Test strategy that scales with the program

- Today: 18 unit tests. Target: **+100 tests over the program** (Epic 13),
  growing alongside features — pure functions (parsers, filter-builders,
  normalizers) get unit tests in the same slice that changes them.
- ffmpeg arg-building becomes a **pure, exported function** early in Wave 1 so
  the entire command matrix (formats × filters × options) is unit-testable
  without wasm — this single refactor makes ~80% of the "untestable" surface
  testable in CI.
- E2E: a small Playwright smoke (load page, upload fixture, export tiny clip)
  runs **in CI only** (GitHub Actions has disk/Chrome), not locally.

### 1.5 Cadence options (user picks per session)

- `/loop 5m <builder prompt>` — autonomous, as before, now driven by
  `plan/wave-N.md` instead of ROADMAP P-sections.
- Interactive sessions — same pipeline, human steering item choice.
- CI is the backstop either way: `.github/workflows` runs
  format-check/lint/test/build on every push; deploy on green.

---

## Part 2 — The program: 18 epics, 1000 items, 10 waves

### 2.1 How counting works (honesty clause)

Items are deliberately slice-sized — an individual filter, shortcut, locale,
test, or fix each counts as one item, because each flows through the full
pipeline independently. The epic catalog below fixes each epic's **budget**;
the concrete per-item lists are generated at wave start (§1.3.1) so they can
reflect what the codebase looks like by then. Budgets are firm; item wording
is not fixed years ahead.

### 2.2 Epic catalog (budgets sum to exactly 1000)

| #  | Epic                                   | Items | Representative contents |
|----|----------------------------------------|------:|-------------------------|
| 1  | Core editing engine (ffmpeg)           |    90 | pure arg-builder refactor; two-pass encode option; CRF/bitrate control; fps control; lossless-cut mode; chapter split; reverse; loop N×; boomerang; fade in/out; crossfade between segments; still-image intro/outro; watermark overlay; text overlay (drawtext + bundled font); PiP compose; audio-only concat; per-segment options; cancel mid-export; wasm memory guardrails; retry-on-OOM with downscale suggestion |
| 2  | Timeline & preview UX                  |    80 | filmstrip thumbnails (canvas); waveform strip (WebAudio); zoomable timeline; snap-to-second/keyframe; draggable segment blocks; reorder segments; per-segment preview; playhead sync with slider; in/out markers on player; live crop overlay preview; live color-filter CSS preview; before/after toggle |
| 3  | Export & format matrix                 |    70 | WebM/VP9 export; ProRes-proxy; AV1 (feature-detect); MP3 bitrate presets; WAV/FLAC/OGG/M4A; GIF fps+width controls; APNG; WebP animation; poster JPEG/PNG/WebP; burst frame export (N stills); filename template editor; container passthrough matrix tests |
| 4  | Filters & effects library              |   100 | preset LUT-style looks (10+); grayscale; sepia; invert; vignette; blur/sharpen; denoise; deband; gamma/exposure/temperature/tint; hue rotate; per-filter intensity; filter stacking UI with reorder; saved custom looks (localStorage); film-grain; stabilize (deshake); auto-levels |
| 5  | Audio toolkit                          |    60 | fade in/out; normalize (loudnorm); compressor; bass/treble EQ; channel ops (mono/stereo/swap); audio replace from second file; background-music mix with ducking; silence detection/trim; per-segment audio gain; waveform-accurate audio trim |
| 6  | Social & platform presets              |    40 | per-platform bundles (YouTube/Shorts/Reels/TikTok/X/LinkedIn/IG feed+story/Pinterest); platform duration/size validators; safe-area overlays (9:16 UI chrome); caption-space padding; preset manager (save/edit/share via URL) |
| 7  | Keyboard & power-user                  |    50 | full shortcut map (I/O/space/arrows/J-K-L); shortcut cheat-sheet overlay; frame-step keys; numeric time entry; jump-to-time; undo/redo for control state; command palette; URL-encoded session state (shareable settings links) |
| 8  | Accessibility                          |    60 | full keyboard operability audit; focus-visible states; screen-reader flow labels/landmarks; aria-live progress announcements; reduced-motion mode; high-contrast theme; font-size scaling; color-blind-safe accents; WCAG 2.2 AA checklist item-by-item |
| 9  | i18n / l10n                            |    40 | Angular i18n scaffolding; extraction pass; locales: en, si, ta, es, fr, de, pt, hi, ja, zh; RTL readiness; locale-aware number/time formats; language switcher |
| 10 | PWA, offline & performance             |    60 | @angular/pwa install; offline app shell; cache ffmpeg core (~30 MB) in Cache Storage; install prompt UX; bundle diet (drop admin-lte/jQuery remnants, tree-shake Material); route-level code split; lazy-load ffmpeg service; Lighthouse ≥90 all categories; Core Web Vitals budget in CI |
| 11 | Visual design system & themes          |    50 | design tokens file; spacing/typography scale cleanup; component polish pass (cards, selects, sliders, buttons); micro-interactions; empty states; skeleton loaders; more themes (midnight/sunrise/OLED-black); theme editor; consistent iconography (replace emoji toggles) |
| 12 | Onboarding, help & docs                |    40 | first-run tour; inline tips; "what can this do" gallery with sample clips; FAQ page; privacy explainer (everything stays in-browser); README overhaul with GIF demos; CONTRIBUTING.md; architecture doc |
| 13 | Test suite expansion                   |   100 | unit tests for every pure module (parser, filter-builders, normalizers, presets, formatters ×~60); component tests for each control group (×~25); Playwright CI smoke (×~10 scenarios); visual-regression snapshots (×5) |
| 14 | Tooling, CI/CD & DX                    |    50 | strict TypeScript; eslint strict + import-order; commit-lint; bundle-size CI gate; Lighthouse CI; dependabot config; issue/PR templates; release tagging + CHANGELOG automation; source-map-explorer report; npm script consolidation |
| 15 | Error handling & resilience            |    40 | typed error taxonomy; user-facing error messages per failure class; ffmpeg OOM detection + guidance; unsupported-codec detection with clear messaging; CDN-load fallback (second CDN for ffmpeg core); global error boundary + toast system; input-file validation (size/type/duration caps with overrides) |
| 16 | Privacy & security hardening           |    25 | CSP meta tags; SRI where applicable; dependency audit fixes; remove all inline event handlers; sanitize filename inputs; document zero-upload guarantee; license audit |
| 17 | Diagnostics (local-only)               |    15 | opt-in local perf HUD (encode fps, memory); export-settings recap dialog (the old "export summary" item); copy-diagnostics button for bug reports; wasm capability report (SAB, threads, memory) |
| 18 | Session & project management           |    30 | recent-files list (metadata only); saved projects (settings+segments) in IndexedDB; project export/import as JSON; auto-restore last session; named presets for full control state |
|    | **Total**                              | **1000** | |

### 2.3 Wave sequencing (10 waves × ~100 items)

Each wave mixes epics so every wave ships user-visible value + tests + health:

| Wave | Theme | Primary epic draws (approx.) |
|------|-------|------------------------------|
| 1 | Foundations that unlock testability | E1 pure arg-builder + cancel/guardrails (25), E13 tests for it (30), E14 strict TS/CI gates (20), E15 error taxonomy (15), E17 export recap (10) |
| 2 | Timeline pro | E2 filmstrip/zoom/segment blocks (50), E7 shortcuts core (20), E13 (15), E11 polish (15) |
| 3 | Filters I + live preview | E4 first 40 filters + stacking UI, E2 live CSS preview (15), E13 (25), E11 (20) |
| 4 | Audio studio | E5 all 60, E13 (20), E15 (20) |
| 5 | Export matrix | E3 all 70, E13 (20), E16 (10) |
| 6 | PWA + performance | E10 all 60, E14 Lighthouse CI (15), E11 (25) |
| 7 | Filters II + power-user | E4 remaining 60, E7 remaining 30, E17 (5), E18 start (5) |
| 8 | Accessibility + i18n | E8 all 60, E9 all 40 |
| 9 | Social/platform + projects | E6 all 40, E18 remaining 25, E12 (35) |
| 10 | Hardening + docs + closeout | E16 remaining 15, E15 remaining 5, E14 remaining 15, E12 remaining 5, E13 remaining (10), E1 remaining (50 spread of engine features) |

Waves 1–3 are sequenced for leverage: the arg-builder refactor (W1) makes the
huge filter/export epics cheaply testable; timeline blocks (W2) are the
substrate for filter preview (W3) and audio waveform (W4).

### 2.4 Constraints the plan respects

- **Client-only forever** (GitHub Pages): no backend features; YouTube videos
  remain preview-only (CORS — cannot be downloaded/processed client-side;
  editing operates on uploaded/local files).
- **ffmpeg.wasm single-threaded core** (no COOP/COEP on Pages): heavy encodes
  are slow; the plan compensates with guardrails, cancel, downscale hints
  (E1/E15) rather than pretending otherwise.
- **~30 MB ffmpeg core from CDN**: cached via PWA in Wave 6; dual-CDN fallback
  in E15.
- **Disk-constrained dev machine**: pipeline forbids artifact accumulation;
  heavy verification happens in CI/live-site QA, not locally.

### 2.5 Definition of done (program level)

- 1000 items checked or explicitly deferred-with-reason across `plan/wave-*.md`
- ≥118 tests green in CI; Playwright smoke green
- Lighthouse ≥90 across categories on the live site
- WCAG 2.2 AA checklist complete
- Bundle ≤2.0 MB initial (post-diet) with ffmpeg lazy-loaded
- README/docs current; CHANGELOG generated; all waves retro'd in ROADMAP.md

---

## How to start

1. Generate `plan/wave-1.md` (100 concrete items per §2.3 Wave 1).
2. Restart the builder loop pointed at it, e.g.:
   `/loop 5m Work through plan/wave-1.md top-to-bottom, one item per run, full
   gates (format/lint/build/test), commit+push each item with its W1-ID, tick
   the checkbox, disk-safe.`
3. At ~100 items, run the wave-exit QA + retro, then expand Wave 2.
