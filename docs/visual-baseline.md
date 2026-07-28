# Visual-regression baseline (manual capture list)

Screenshots to (re)capture after visual changes — the manual baseline until
automated visual testing lands (needs an interactive browser; headless capture
is disk-prohibitive on the dev machine, so this list is the Wave-2 deliverable).

Capture at 1280×800 (desktop), 480×800 (mobile), in BOTH themes:

| # | State | How to reach it |
|---|-------|-----------------|
| 1 | Empty state | Fresh load, no media |
| 2 | YouTube preview | Paste a valid YouTube URL → Load |
| 3 | Editor idle | Upload a short MP4 (filmstrip + waveform visible) |
| 4 | Timeline zoomed | Zoom 4×, pan mid-clip, segments present |
| 5 | Segments + overlap warning | Add 3 ranges incl. an overlap |
| 6 | Controls expanded | All four sections open |
| 7 | Live preview active | Crop 9:16 + brightness up + rotate 90° |
| 8 | Compare original | Same as 7 with compare toggled |
| 9 | Export in progress | Long clip export (stage label + cancel visible) |
| 10 | Success recap + summary chips | After a small export |
| 11 | Error state | Export an invalid range / cancel mid-run |
| 12 | Cheat-sheet | ? overlay open |

Store captures under `docs/baseline/<date>/` (git-ignored if large); compare
by eye or with an image-diff tool before/after visual PRs.
