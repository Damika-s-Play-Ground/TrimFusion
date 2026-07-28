/**
 * Pure mappings from export settings to CSS live-preview values. These are
 * approximations for instant feedback — ffmpeg remains the source of truth
 * at export time (eq brightness is additive; CSS brightness() multiplies,
 * so we map b → 1+b, which tracks well within the ±0.5 clamp).
 */

import { FILTER_DEFS, FilterEntry, RotateOption } from '@services/ffmpeg-args';

export function previewFilter(
  brightness: number,
  contrast: number,
  saturation: number
): string {
  const parts: string[] = [];
  if (brightness !== 0) {
    parts.push(`brightness(${(1 + brightness).toFixed(2)})`);
  }
  if (contrast !== 1) {
    parts.push(`contrast(${contrast.toFixed(2)})`);
  }
  if (saturation !== 1) {
    parts.push(`saturate(${saturation.toFixed(2)})`);
  }
  return parts.length ? parts.join(' ') : 'none';
}

/**
 * CSS transform matching a rotate/flip choice. Quarter turns also scale by
 * 9/16 so the rotated frame stays inside the 16:9 contain box.
 */
export function previewTransform(rotate: RotateOption | null): string {
  switch (rotate) {
    case 'cw90':
      return 'rotate(90deg) scale(0.5625)';
    case 'cw180':
      return 'rotate(180deg)';
    case 'cw270':
      return 'rotate(-90deg) scale(0.5625)';
    case 'hflip':
      return 'scaleX(-1)';
    case 'vflip':
      return 'scaleY(-1)';
    default:
      return 'none';
  }
}

/**
 * CSS approximations for the stack entries that have one (W3-006).
 * Export-only filters contribute nothing here — the UI badges them.
 */
export function stackPreviewFilter(
  filters: FilterEntry[] | undefined | null
): string[] {
  if (!filters?.length) {
    return [];
  }
  const out: string[] = [];
  for (const entry of filters) {
    const def = FILTER_DEFS[entry.key];
    if (!def?.css) {
      continue;
    }
    const intensity = Math.min(
      1,
      Math.max(0, entry.intensity ?? def.defaultIntensity)
    );
    out.push(def.css(intensity));
  }
  return out;
}

export interface PlaybackSync {
  playbackRate: number;
  muted: boolean;
  volume: number;
}

/**
 * Player-property sync for the speed/mute/volume controls. The element's
 * volume caps at 1.0, so gains above 100% preview at full volume (the boost
 * only applies in the export — documented limitation).
 */
export function playbackSync(
  opts: { speed?: number; mute?: boolean; volume?: number },
  enabled: boolean
): PlaybackSync {
  if (!enabled) {
    return { playbackRate: 1, muted: false, volume: 1 };
  }
  return {
    playbackRate: Math.min(2, Math.max(0.5, opts.speed ?? 1)),
    muted: !!opts.mute,
    volume: Math.min(1, Math.max(0, opts.volume ?? 1)),
  };
}

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Percent rect of the centered crop region inside a 16:9 player box showing
 * a `videoW`×`videoH` video with object-fit: contain.
 */
export function cropOverlayRect(
  videoW: number,
  videoH: number,
  cropAspect: number
): OverlayRect | null {
  if (!videoW || !videoH || !cropAspect || cropAspect <= 0) {
    return null;
  }
  const BOX_W = 16;
  const BOX_H = 9;
  const videoAspect = videoW / videoH;
  // Video content area inside the contain box (16:9 units).
  let contentW: number;
  let contentH: number;
  if (videoAspect >= BOX_W / BOX_H) {
    contentW = BOX_W;
    contentH = BOX_W / videoAspect;
  } else {
    contentH = BOX_H;
    contentW = BOX_H * videoAspect;
  }
  // Centered crop of the requested aspect within the content area.
  const cropH = Math.min(contentH, contentW / cropAspect);
  const cropW = cropH * cropAspect;
  return {
    left: ((BOX_W - cropW) / 2 / BOX_W) * 100,
    top: ((BOX_H - cropH) / 2 / BOX_H) * 100,
    width: (cropW / BOX_W) * 100,
    height: (cropH / BOX_H) * 100,
  };
}
