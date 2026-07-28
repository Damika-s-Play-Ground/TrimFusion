# Changelog

All notable user-facing changes to TrimFusion. Full per-run engineering
history lives in [ROADMAP.md](./ROADMAP.md); program tracking in
[PLAN-NEXTLEVEL.md](./PLAN-NEXTLEVEL.md).

## [1.0.0] — 2026-07-28

First full release: from a static mock to a client-side video studio.

### Core

- Real in-browser trimming via ffmpeg.wasm — no uploads, no backend; fast
  lossless stream-copy when possible, MP4/H.264 re-encode when needed
- Robust YouTube URL parsing + validation with live preview (preview-only;
  editing works on uploaded local files)
- Range slider with time readouts, upload support, live export progress

### Editing toolkit

- Crop to display sizes (16:9, 9:16, 1:1, 4:5) with centered crop
- Export as MP4 (or original container), MP3 audio, or animated GIF
- Playback speed 0.5×–2×, mute, volume gain 0–200%
- Rotate/flip (90°/180°/270°, mirror, vertical)
- Brightness / contrast / saturation color filters
- Resolution presets (1080p/720p/480p), frame-rate control (60/30/24)
- Quality control (CRF high/balanced/compress) + encode-speed preset
- Frame-accurate "precise cut", effects (reverse, loop ×2/×3, boomerang),
  0.5 s edge fades
- Multi-segment stitching: mark multiple ranges, export one joined clip
- GIF fps/width controls; MP3 bitrate/sample-rate options
- Frame grab (canvas + ffmpeg-exact PNG), split range into N clips
- Social quick presets (Shorts/Reels/TikTok, Instagram square, YouTube)
- Live export summary (settings chips, output dimensions, size estimate),
  success recap with real size + encode time, ffmpeg command preview,
  copy-diagnostics

### Experience & platform

- Next-level dark redesign + persisted light/dark theme toggle, themed 404
- Cancel export; typed error messages with actionable guidance; CDN
  retry/fallback for the engine; memory guardrail warnings
- Accessibility lint enforced; a11y labels/roles throughout
- CI (format/lint/test/build + bundle budget), 70 unit tests, live deploy
  to GitHub Pages
