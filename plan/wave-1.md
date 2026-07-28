# Wave 1 — Foundations that unlock testability (100 items)

_Expansion of PLAN-NEXTLEVEL.md §2.3 Wave 1. Allocation: E1×25, E13×30, E14×20,
E15×15, E17×10. Execute top-to-bottom, smallest-complete batches; every commit
references its W1-IDs; gates (format/lint/build/test) before every commit._

## E1 — Engine foundations (25)

- [x] W1-001 Extract pure `buildTrimPlan()` into `src/app/services/ffmpeg-args.ts` (args/outExt/mime/suffix derivation, zero service state)
- [x] W1-002 Extract pure `normalizeSegments()` + `buildSegmentsPlan()` (per-segment steps + concat list/args) into the same module
- [x] W1-003 Rewire `FfmpegTrimService.trim()` onto `buildTrimPlan()` (service = load/IO/progress only)
- [x] W1-004 Rewire `trimSegments()` onto `buildSegmentsPlan()`
- [ ] W1-005 Quality control: CRF select (High 18 / Balanced 23 / Small 28) for re-encoded video
- [ ] W1-006 FPS control for video export (Original/60/30/24)
- [ ] W1-007 FPS control for GIF export (8/12/15/24)
- [ ] W1-008 GIF width control (320/480/640)
- [ ] W1-009 Cancel mid-export (ffmpeg.terminate + service re-init + Cancel button)
- [ ] W1-010 Duration guardrail: warn (non-blocking) when export range > 10 min
- [ ] W1-011 File-size guardrail: warn when input > 500 MB
- [ ] W1-012 OOM detection: catch wasm abort → friendly "try lower resolution/shorter range" message
- [ ] W1-013 Reverse-video option (`reverse`/`areverse`)
- [ ] W1-014 Loop ×2/×3 option (concat same segment)
- [ ] W1-015 Boomerang option (forward + reversed concat)
- [ ] W1-016 Video fade-in option (`fade=t=in`)
- [ ] W1-017 Video fade-out option (computed from range duration)
- [ ] W1-018 Audio fades tied to video fades (`afade`)
- [ ] W1-019 Encode-speed preset option (veryfast/medium)
- [ ] W1-020 MP3 bitrate presets (128/192/320 kbps)
- [ ] W1-021 MP3 sample-rate option (44.1/48 kHz)
- [ ] W1-022 Poster-frame export: first frame of range as PNG via ffmpeg
- [ ] W1-023 Split-into-N-clips export (sequential downloads)
- [ ] W1-024 Frame-at-exact-time export via ffmpeg (complements canvas grab)
- [ ] W1-025 Command preview: show the generated ffmpeg command in the UI (collapsible)

## E13 — Test suite for the pure engine (30)

- [x] W1-026 Spec scaffold `ffmpeg-args.spec.ts` + default-video case → stream copy, container kept
- [x] W1-027 Test: mute-only video → `-an -c copy`
- [x] W1-028 Test: precise cut → `-ss` after `-i`, MP4 re-encode
- [x] W1-029 Test: crop → crop filter + libx264 + MP4 out
- [x] W1-030 Test: scaleHeight → `scale=-2:<h>`
- [x] W1-031 Test: speed → `setpts` + `atempo` pair
- [x] W1-032 Test: speed clamps (0.25→0.5, 4→2)
- [x] W1-033 Test: volume ≠ 1 → `-af volume=` + MP4 re-encode
- [x] W1-034 Test: volume 1 → stays on copy path
- [x] W1-035 Test: mute+volume → `-an`, no volume filter
- [x] W1-036 Test: rotate cw90 → `transpose=1`
- [x] W1-037 Test: rotate cw180 → double transpose
- [x] W1-038 Test: hflip / vflip filters
- [x] W1-039 Test: eq brightness-only filter string
- [x] W1-040 Test: eq clamping (out-of-range values)
- [x] W1-041 Test: full chain order rotate→crop→eq→scale→setpts
- [x] W1-042 Test: audio output → mp3/-vn/libmp3lame + audio/mpeg mime
- [x] W1-043 Test: audio output ignores crop/rotate/scale
- [x] W1-044 Test: audio + volume → `-af volume=`
- [x] W1-045 Test: gif output → fps/scale chain + image/gif mime
- [x] W1-046 Test: gif includes rotate+crop but never scaleHeight/speed
- [x] W1-047 Test: start/end normalization (negative→0, min duration 1, floor)
- [x] W1-048 Test: `normalizeSegments` sorts, drops invalid, clamps
- [x] W1-049 Test: segments plan — N steps, concat list content, concat args, `-stitched` suffix
- [x] W1-050 Test: segment steps use output seeking + shared filters
- [x] W1-051 Test: extensionOf edge cases (no ext, uppercase, multi-dot)
- [x] W1-052 Test: suffix naming (trimmed/cropped/audio/clip/stitched)
- [ ] W1-053 Test: CRF option maps to `-crf` values (after W1-005)
- [ ] W1-054 Test: fps option maps to `fps=` / `-r` (after W1-006/007)
- [ ] W1-055 Test: fade options produce fade/afade args (after W1-016..018)

## E14 — Strict TS, CI & DX (20)

- [ ] W1-056 Enable TypeScript `strict: true` + fix fallout
- [ ] W1-057 Enable Angular strict templates + fix fallout
- [ ] W1-058 ESLint import-order rule + autofix pass
- [ ] W1-059 ESLint no-console (allow warn/error) + cleanup
- [ ] W1-060 `format:check` script + CI step (fail on unformatted)
- [ ] W1-061 CI bundle-size budget assertion (fail > 2.6 MB initial)
- [ ] W1-062 CI: also run on pull_request events
- [ ] W1-063 `npm run verify` = format:check + lint + test:ci + build
- [ ] W1-064 package.json `engines` (node >=18)
- [ ] W1-065 .editorconfig
- [ ] W1-066 dependabot.yml (npm weekly)
- [ ] W1-067 Issue template (bug + feature)
- [ ] W1-068 PR template with gate checklist
- [ ] W1-069 Seed CHANGELOG.md from ROADMAP run history
- [ ] W1-070 VERSION file + tag v1.0.0
- [ ] W1-071 README: program section linking PLAN-NEXTLEVEL + wave files
- [ ] W1-072 build:stats script + bundle-analysis doc note
- [ ] W1-073 tsconfig path alias `@services/*`
- [ ] W1-074 ESLint max-lines warning on components (flag oversized rendering-page)
- [ ] W1-075 Extract export-controls into `ExportControlsComponent` (shrink rendering-page)

## E15 — Error taxonomy & resilience (15)

- [ ] W1-076 `TrimError` class with typed codes (LOAD_FAILED/ENCODE_FAILED/OOM/CANCELLED/INVALID_INPUT)
- [ ] W1-077 Service throws typed errors everywhere
- [ ] W1-078 Component maps error codes → specific friendly messages
- [ ] W1-079 CDN load: retry once on failure
- [ ] W1-080 CDN fallback (unpkg → jsdelivr) for core/wasm/worker
- [ ] W1-081 Load timeout (60 s) with actionable message
- [ ] W1-082 Cancel path yields CANCELLED (info, not error, in UI)
- [ ] W1-083 Better invalid-file-type message (what was detected vs expected)
- [ ] W1-084 Empty/zero-length range validation before export
- [ ] W1-085 Material snackbar/toast for transient statuses (done/cancelled/failed)
- [ ] W1-086 Global ErrorHandler with contextual console logging
- [ ] W1-087 `navigator.storage.estimate()` headroom check before heavy exports
- [ ] W1-088 Handle metadata-load failure (duration NaN) gracefully
- [ ] W1-089 Detect codec-unsupported-in-preview and explain (export may still work)
- [ ] W1-090 Unit tests for error mapping table

## E17 — Export recap & diagnostics (10)

- [ ] W1-091 Export-summary model (derive active settings snapshot)
- [ ] W1-092 Summary chip row above export button (format/crop/res/speed/volume/precise)
- [ ] W1-093 Rough output-size estimate heuristic in summary
- [ ] W1-094 Duration-after-speed readout in summary
- [ ] W1-095 Output-dimensions estimate from video metadata + crop/scale
- [ ] W1-096 Success recap ("Downloaded name.mp4 — 0:42, 720p, 4.1 MB")
- [ ] W1-097 Copy-settings-to-clipboard button (diagnostics)
- [ ] W1-098 wasm capability report util (SAB/threads/memory) in diagnostics
- [ ] W1-099 Encode wall-time measured + shown in success recap
- [ ] W1-100 Wave-1 exit: retro in ROADMAP, metrics (bundle, test count), generate plan/wave-2.md
