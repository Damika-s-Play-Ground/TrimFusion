/**
 * Pure mappings from export settings to CSS live-preview values. These are
 * approximations for instant feedback — ffmpeg remains the source of truth
 * at export time (eq brightness is additive; CSS brightness() multiplies,
 * so we map b → 1+b, which tracks well within the ±0.5 clamp).
 */

import { RotateOption } from '@services/ffmpeg-args';

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
