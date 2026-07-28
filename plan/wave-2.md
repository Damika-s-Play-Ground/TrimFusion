# Wave 2 — Timeline pro (100 items)

_Expansion of PLAN-NEXTLEVEL.md §2.3 Wave 2. Allocation: E2×50 (timeline &
preview), E7×20 (keyboard & power-user), E13×15 (tests), E11×15 (polish, incl.
W1-075 carried in as W2-086). Same pipeline: batch, gate, tick, push._

Pure logic (window math, parsers, peak buckets, shortcut map, undo stack, URL
state) goes in small `src/app/services/*` or `src/app/timeline/*` modules WITH
specs; DOM work stays thin.

## E2 — Timeline & preview (50)

- [x] W2-001 `TimelineComponent` scaffold: extract the timeline zone (slider + readouts) from rendering-page into `src/app/timeline/`
- [x] W2-002 Filmstrip util: capture N thumbnails via hidden-video canvas seeks (async generator, cancellable)
- [x] W2-003 Filmstrip strip rendered under the slider
- [x] W2-004 Filmstrip regenerates on new file; cached per object URL
- [x] W2-005 Filmstrip loading skeleton state
- [x] W2-006 Waveform: decode audio to PCM via OfflineAudioContext (util)
- [x] W2-007 Waveform peaks: min/max bucket reduction (pure + spec)
- [x] W2-008 Waveform canvas strip under the filmstrip
- [x] W2-009 Waveform fallback when the file has no audio track
- [x] W2-010 Zoom state (1×/2×/4×/8×) + pure visible-window math (pure + spec)
- [x] W2-011 Zoomed viewport horizontal pan/scroll
- [x] W2-012 Zoom controls in UI (buttons + current level)
- [x] W2-013 Snap-to-second toggle (pure rounding helper)
- [x] W2-014 Playhead marker synced to the player's currentTime
- [x] W2-015 Click on timeline seeks the player
- [x] W2-016 In/out markers rendered at start/end positions
- [x] W2-017 "Set in/out at playhead" buttons
- [x] W2-018 Segment blocks rendered on the timeline from the segments list
- [x] W2-019 Segment block selection/highlight
- [x] W2-020 Drag segment edges to resize (pointer events)
- [x] W2-021 Drag segment body to move
- [x] W2-022 Reorder segments (up/down controls in the list)
- [x] W2-023 Overlap detection + merge helper (pure + spec)
- [x] W2-024 Segment-total indicator vs platform caps (60 s Shorts etc.)
- [x] W2-025 Per-segment preview (seek + play just that range)
- [x] W2-026 Live crop overlay on the player (CSS mask for chosen aspect)
- [x] W2-027 Live color preview via CSS filter mapping (brightness/contrast/saturate)
- [x] W2-028 Preview-effects toggle (live preview on/off)
- [ ] W2-029 Before/after comparison toggle for color preview
- [x] W2-030 Rotate preview via CSS transform
- [x] W2-031 Mirror/flip preview via CSS transform
- [ ] W2-032 Speed preview: sync video.playbackRate to the speed control
- [ ] W2-033 Mute preview: sync video.muted
- [ ] W2-034 Volume preview: sync video.volume
- [ ] W2-035 Hover tooltip with time on the timeline
- [ ] W2-036 Current-time / total-duration readout row
- [ ] W2-037 Frame-step buttons (±1 frame ≈ 1/30 s)
- [ ] W2-038 Jump-to-start / jump-to-end buttons
- [ ] W2-039 Editable numeric time inputs for start/end (validated)
- [ ] W2-040 Time-string parser "m:ss(.t)" → seconds (pure + spec)
- [ ] W2-041 Nudge buttons ±1 s on start/end
- [ ] W2-042 "Use full video" one-click range reset
- [x] W2-043 Keyboard operability for timeline markers (arrows when focused)
- [ ] W2-044 Timeline ARIA roles/labels pass
- [ ] W2-045 Respect prefers-reduced-motion in timeline animations
- [ ] W2-046 Persist zoom/snap preferences (localStorage)
- [ ] W2-047 Filmstrip thumbnail count adapts to container width
- [ ] W2-048 Debounce helper for heavy preview recomputes (pure + spec)
- [ ] W2-049 Timeline empty/loading state polish
- [ ] W2-050 Timeline architecture note in README (how the pieces fit)

## E7 — Keyboard & power-user (20)

- [ ] W2-051 Shortcut service scaffold: global keydown, ignores form fields
- [ ] W2-052 Space = play/pause
- [ ] W2-053 I / O = set in/out at playhead
- [ ] W2-054 J / K / L = shuttle back / pause / forward
- [ ] W2-055 Arrow keys seek ±1 s (Shift = ±5 s)
- [ ] W2-056 , / . = frame step
- [ ] W2-057 M = mute toggle
- [ ] W2-058 + / − = timeline zoom
- [ ] W2-059 S = add current range as segment
- [ ] W2-060 E = start export
- [ ] W2-061 ? = open the shortcut cheat-sheet
- [ ] W2-062 Cheat-sheet overlay (esc closes, focus handled)
- [ ] W2-063 Shortcut map as a pure module (key → action table) + spec
- [ ] W2-064 preventDefault audit so shortcuts don't fight the browser
- [ ] W2-065 Shortcuts on/off toggle in the UI
- [ ] W2-066 Persist the shortcuts preference
- [ ] W2-067 Undo/redo stack for control state (pure + spec)
- [ ] W2-068 Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z wired to undo/redo
- [ ] W2-069 Serialize settings state into a shareable URL fragment
- [ ] W2-070 Parse/apply URL settings on load (round-trip with 069)

## E13 — Tests (15)

- [x] W2-071 Spec: zoom visible-window math
- [x] W2-072 Spec: overlap detection/merge
- [ ] W2-073 Spec: time-string parser edge cases
- [x] W2-074 Spec: waveform peak bucketing
- [ ] W2-075 Spec: shortcut map completeness + no duplicate bindings
- [ ] W2-076 Spec: undo/redo stack behavior
- [ ] W2-077 Spec: URL settings round-trip
- [ ] W2-078 Spec: debounce helper timing (fakeAsync)
- [ ] W2-079 Component spec: timeline renders segment blocks
- [ ] W2-080 Component spec: numeric time inputs validate/clamp
- [ ] W2-081 Component spec: cheat-sheet opens and closes
- [ ] W2-082 Spec: preview sync mapping (rate/muted/volume values)
- [ ] W2-083 Spec: responsive thumbnail-count function
- [x] W2-084 Spec: snap rounding helper
- [ ] W2-085 Coverage report noted in ROADMAP (services ≥80% statements)

## E11 — Polish (15)

- [ ] W2-086 Extract `ExportControlsComponent` (carried from W1-075; do it as part of the section restructure)
- [ ] W2-087 Collapsible control sections: Basics / Visual / Audio / Advanced
- [ ] W2-088 Sticky export button on small screens
- [ ] W2-089 Extract design tokens (spacing/typography scale) in SCSS
- [ ] W2-090 Focus-visible states for every interactive element
- [ ] W2-091 Empty-state (no file loaded) content polish
- [ ] W2-092 Engine-download skeleton/indicator (first export)
- [ ] W2-093 Progress bar stage labels (loading engine / encoding / stitching)
- [ ] W2-094 Replace emoji theme toggle with inline SVG icons
- [ ] W2-095 Button hover/active micro-interaction audit
- [ ] W2-096 Consistent select/checkbox visual pass
- [ ] W2-097 ≤480 px layout audit (controls stack, no overflow)
- [ ] W2-098 Larger touch targets for timeline handles on mobile
- [ ] W2-099 DEFER-FRIENDLY: visual-regression baseline doc (manual screenshots list)
- [ ] W2-100 Wave-2 exit: retro + metrics + generate plan/wave-3.md
