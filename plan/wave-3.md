# Wave 3 — Filters I + preview depth (100 items)

_Expansion of PLAN-NEXTLEVEL.md §2.3 Wave 3. Allocation: E4×40 (filter
framework + first filters), E2×15 (preview/timeline depth — the plan's "live
CSS preview" draw was pulled forward into Wave 2, so this draws the next E2
items instead), E13×25 (specs), E11×20 (themes & polish). Same pipeline:
batch, gate, tick, push._

Architecture rule for E4: a filter STACK — `filters: {key, intensity}[]` —
lives in ffmpeg-args.ts with one snippet builder per filter (pure, spec'd),
composed into the existing vfilter chain after `eq`; the UI renders the stack
with add/remove/reorder/intensity; preview-css maps stack entries to CSS
filter approximations where one exists (else the preview badge says
"export-only").

## E4 — Filter framework & first filters (40)

- [x] W3-001 Engine: `filters` stack option in TrimOptions + FILTER_DEFS registry (key → snippet builder, intensity range, CSS approx flag)
- [x] W3-002 Engine: stack composed into the vfilter chain (after eq, before scale); segments plan too
- [x] W3-003 UI: "Filters" section — add-filter select + stacked list (remove)
- [x] W3-004 UI: reorder stack entries (↑/↓)
- [x] W3-005 UI: per-filter intensity slider (when the def declares a range)
- [ ] W3-006 Preview: stack → CSS filter chain mapping in preview-css (approximable subset)
- [ ] W3-007 Preview: "export-only" badge for non-approximable filters
- [ ] W3-008 Filter: grayscale (`hue=s=0`; CSS grayscale)
- [ ] W3-009 Filter: sepia (colorchannelmixer preset; CSS sepia)
- [ ] W3-010 Filter: invert (`negate`; CSS invert)
- [ ] W3-011 Filter: vignette (intensity → angle; export-only)
- [ ] W3-012 Filter: blur (`boxblur` intensity; CSS blur approx)
- [ ] W3-013 Filter: sharpen (`unsharp` intensity; export-only)
- [ ] W3-014 Filter: denoise (`hqdn3d`; export-only)
- [ ] W3-015 Filter: gamma (eq gamma; export-only)
- [ ] W3-016 Filter: exposure (`exposure` filter; export-only)
- [ ] W3-017 Filter: color temperature (colortemperature; export-only)
- [ ] W3-018 Filter: tint (colorbalance preset; export-only)
- [ ] W3-019 Filter: hue rotate (`hue=h=`; CSS hue-rotate)
- [ ] W3-020 Filter: posterize (`elbg`/lutyuv approx; export-only)
- [ ] W3-021 Filter: film grain (`noise` intensity; export-only)
- [ ] W3-022 Filter: pixelate (scale-down-up trick; export-only)
- [ ] W3-023 Filter: edge glow (`edgedetect` blend; export-only)
- [ ] W3-024 Look preset: Cinematic teal-orange (curves)
- [ ] W3-025 Look preset: Vintage fade (curves + grain)
- [ ] W3-026 Look preset: Noir (grayscale + contrast + vignette)
- [ ] W3-027 Look preset: Vivid pop (saturation + contrast)
- [ ] W3-028 Look preset: Cool blue (colorbalance)
- [ ] W3-029 Look preset: Warm sunset (colorbalance)
- [ ] W3-030 Look preset: Dreamy soft (blur blend + brightness)
- [ ] W3-031 Look preset: Matrix green (colorchannelmixer)
- [ ] W3-032 Look preset: Bleach bypass (desat + contrast)
- [ ] W3-033 Look preset: VHS (noise + chroma shift approx)
- [ ] W3-034 Looks: preset row applies a canned stack (one click, editable after)
- [ ] W3-035 Saved custom looks: name + save current stack to localStorage
- [ ] W3-036 Saved looks: apply/delete UI
- [ ] W3-037 Stack chip in export summary ("3 filters") + command preview reflects stack
- [ ] W3-038 Stack serialized into URL settings state (share/undo round-trip)
- [ ] W3-039 Auto-levels one-shot (normalize filter; export-only)
- [ ] W3-040 Filters section a11y pass (labels, order announcements)

## E2 — Preview & timeline depth (15)

- [ ] W3-041 Hover-scrub: filmstrip hover shows the nearest thumbnail enlarged
- [ ] W3-042 Marker time labels on in/out markers (tiny badges)
- [ ] W3-043 Selection shading between in/out on the strips
- [ ] W3-044 Waveform dims outside the selected range
- [ ] W3-045 Segment blocks show duration on hover (title)
- [ ] W3-046 Double-click timeline sets in-point (single = seek)
- [ ] W3-047 Playhead time bubble while scrubbing
- [ ] W3-048 Keyboard [ / ] jump between segment boundaries
- [ ] W3-049 Zoom follows the playhead when it exits the window (auto-pan)
- [ ] W3-050 Timeline remembers per-file view (zoom/pan) within the session
- [ ] W3-051 Loop-selection playback toggle (plays start→end repeatedly)
- [ ] W3-052 Segment color coding (per-index hue)
- [ ] W3-053 Snap indicator flash when a drag snaps
- [ ] W3-054 Trim-range duration badge under the slider
- [ ] W3-055 Reduced-motion + a11y pass over the new preview affordances

## E13 — Specs (25)

- [ ] W3-056 Spec: FILTER_DEFS registry completeness (every key builds a snippet)
- [x] W3-057 Spec: stack composes in order after eq
- [ ] W3-058 Spec: intensity clamps per filter def
- [ ] W3-059 Spec: grayscale/sepia/invert snippets
- [ ] W3-060 Spec: blur/sharpen/denoise snippets + intensity mapping
- [ ] W3-061 Spec: gamma/exposure/temperature/tint snippets
- [ ] W3-062 Spec: hue-rotate/posterize/grain/pixelate snippets
- [ ] W3-063 Spec: each look preset expands to its expected stack
- [ ] W3-064 Spec: stack ↔ URL state round-trip
- [ ] W3-065 Spec: stack ↔ CSS preview mapping (approximable subset + badge flags)
- [ ] W3-066 Spec: segments plan carries the stack into every step
- [ ] W3-067 Spec: saved-looks serialization (name collision, delete)
- [ ] W3-068 Spec: summary chip counts filters
- [ ] W3-069 Spec: auto-levels snippet
- [ ] W3-070 Spec: filter + existing options ordering (rotate→crop→eq→stack→scale→fps→setpts)
- [ ] W3-071 Component spec: filter section add/remove/reorder DOM
- [ ] W3-072 Component spec: look preset click applies stack
- [ ] W3-073 Spec: hover-scrub index math (pure)
- [ ] W3-074 Spec: auto-pan window math
- [ ] W3-075 Spec: segment-boundary jump order
- [ ] W3-076 Spec: selection shading geometry (pure)
- [ ] W3-077 Spec: loop-playback boundary conditions
- [ ] W3-078 Spec: per-index segment hue function
- [ ] W3-079 Spec: duration badge formatting
- [ ] W3-080 Coverage re-check: pure modules stay ≥80% (note in ROADMAP)

## E11 — Themes & polish (20)

- [ ] W3-081 Theme: Midnight (near-black blue) via token mixin + picker
- [ ] W3-082 Theme: Sunrise (warm light) via token mixin
- [ ] W3-083 Theme: OLED black (true black, high contrast)
- [ ] W3-084 Theme picker replaces the binary toggle (menu of 5)
- [ ] W3-085 Persist theme choice (extend existing storage key)
- [ ] W3-086 Meta theme-color follows the active theme
- [ ] W3-087 Favicon refresh (brand gradient mark, SVG + ICO)
- [ ] W3-088 Card/section spacing rhythm pass using the space tokens
- [ ] W3-089 Summary chips styled as real chips (tokens)
- [ ] W3-090 Progress bar gradient + stage label styling polish
- [ ] W3-091 Segment list rows: hover affordances + kbd focus order
- [ ] W3-092 Export buttons: primary/secondary hierarchy pass
- [ ] W3-093 Snackbar theming (matches active theme)
- [ ] W3-094 Details sections: chevron rotation affordance
- [ ] W3-095 Scrollbar styling (subtle, theme-aware)
- [ ] W3-096 Print/reader-mode sanity (content readable, controls hidden)
- [ ] W3-097 404 page: align to token system
- [ ] W3-098 README feature table refresh (filters + themes)
- [ ] W3-099 CHANGELOG 1.1.0 entry (Waves 2–3 user-facing summary)
- [ ] W3-100 Wave-3 exit: retro + metrics + generate plan/wave-4.md
