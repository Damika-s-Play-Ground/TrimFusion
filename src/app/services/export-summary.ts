/**
 * Pure export-summary derivation: human-readable setting chips, output
 * dimensions/duration, and a rough size estimate. Unit-testable; the
 * component feeds it the current options + media metadata.
 */

import { TrimOptions } from './ffmpeg-args';

export interface MediaMeta {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
}

export interface ExportSummary {
  chips: string[];
  outDurationSeconds: number;
  outWidth: number | null;
  outHeight: number | null;
  /** Rough estimate; null when there's no basis for one. */
  estimatedBytes: number | null;
}

const EVEN = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Derive the summary. `reencoded` should reflect the actual plan (the
 * component checks the generated args for libx264).
 */
export function summarizeExport(
  options: TrimOptions,
  meta: MediaMeta,
  reencoded: boolean
): ExportSummary {
  const output = options.output ?? 'video';
  const speed =
    output === 'video' ? Math.min(2, Math.max(0.5, options.speed ?? 1)) : 1;
  const start = Math.max(0, Math.floor(options.startSeconds));
  const duration = Math.max(1, Math.floor(options.endSeconds) - start);
  const outDurationSeconds = duration / speed;

  // ── Output dimensions ────────────────────────────────────────────────────
  let outWidth: number | null = meta.width;
  let outHeight: number | null = meta.height;
  const rotated = options.rotate === 'cw90' || options.rotate === 'cw270';
  if (outWidth && outHeight && rotated && output !== 'audio') {
    [outWidth, outHeight] = [outHeight, outWidth];
  }
  const aspect = options.aspectRatio ?? null;
  if (outWidth && outHeight && aspect && aspect > 0 && output !== 'audio') {
    const cw = Math.min(outWidth, outHeight * aspect);
    const ch = Math.min(outHeight, outWidth / aspect);
    outWidth = EVEN(cw);
    outHeight = EVEN(ch);
  }
  if (output === 'video' && options.scaleHeight && outWidth && outHeight) {
    const h = Math.round(options.scaleHeight);
    outWidth = EVEN((outWidth * h) / outHeight);
    outHeight = h;
  }
  if (output === 'gif' && outWidth && outHeight) {
    const w = Math.round(options.gifWidth ?? 480);
    outHeight = EVEN((outHeight * w) / outWidth);
    outWidth = w;
  }
  if (output === 'audio') {
    outWidth = null;
    outHeight = null;
  }

  // ── Chips ────────────────────────────────────────────────────────────────
  const chips: string[] = [];
  if (output === 'audio') {
    chips.push(`MP3${options.mp3Bitrate ? ` ${options.mp3Bitrate} kbps` : ''}`);
  } else if (output === 'gif') {
    chips.push(
      `GIF ${Math.round(options.gifWidth ?? 480)}px @${Math.round(
        options.gifFps ?? 12
      )} fps`
    );
  } else {
    chips.push(reencoded ? 'MP4 (re-encode)' : 'Original format (fast copy)');
  }
  if (aspect && aspect > 0 && output !== 'audio') {
    chips.push(`crop ${aspect.toFixed(2)}`);
  }
  if (output === 'video' && options.scaleHeight) {
    chips.push(`${Math.round(options.scaleHeight)}p`);
  }
  if (output === 'video' && options.fps) {
    chips.push(`${Math.round(options.fps)} fps`);
  }
  if (speed !== 1) {
    chips.push(`${speed}× speed`);
  }
  if (options.mute && output === 'video') {
    chips.push('muted');
  } else if (options.volume && options.volume !== 1 && output !== 'gif') {
    chips.push(`volume ${Math.round(options.volume * 100)}%`);
  }
  if (options.preciseCut && output === 'video') {
    chips.push('precise cut');
  }
  if (output === 'video' && (options.fadeIn || options.fadeOut)) {
    chips.push(
      options.fadeIn && options.fadeOut
        ? 'fade in/out'
        : options.fadeIn
          ? 'fade in'
          : 'fade out'
    );
  }
  if (output === 'video' && options.reverse) {
    chips.push('reversed');
  }
  if (output === 'video' && options.crf && options.crf !== 23) {
    chips.push(options.crf > 23 ? 'compressed' : 'high quality');
  }

  // ── Size estimate ────────────────────────────────────────────────────────
  let estimatedBytes: number | null = null;
  const crf = Math.round(Math.min(30, Math.max(16, options.crf ?? 23)));
  if (output === 'audio') {
    const kbps = options.mp3Bitrate ?? 190;
    estimatedBytes = ((kbps * 1000) / 8) * duration;
  } else if (output === 'gif') {
    const w = Math.round(options.gifWidth ?? 480);
    const f = Math.round(options.gifFps ?? 12);
    estimatedBytes = 500_000 * (w / 480) ** 2 * (f / 12) * duration;
  } else if (!reencoded) {
    if (
      meta.fileSizeBytes &&
      meta.durationSeconds &&
      meta.durationSeconds > 0
    ) {
      estimatedBytes = meta.fileSizeBytes * (duration / meta.durationSeconds);
    }
  } else {
    const h = outHeight ?? meta.height ?? 720;
    // ~4 Mbps for 1080p at CRF 23; halve roughly every +6 CRF.
    const videoBps = 4_000_000 * (h / 1080) ** 2 * 2 ** ((23 - crf) / 6);
    const audioBps = options.mute ? 0 : 128_000;
    estimatedBytes = ((videoBps + audioBps) / 8) * outDurationSeconds;
  }

  return { chips, outDurationSeconds, outWidth, outHeight, estimatedBytes };
}

/** Local wasm/browser capability snapshot (for diagnostics copy). */
export function capabilityReport(): Record<string, unknown> {
  return {
    crossOriginIsolated:
      typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hardwareConcurrency:
      typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : null,
    deviceMemoryGB:
      typeof navigator !== 'undefined'
        ? ((navigator as unknown as { deviceMemory?: number }).deviceMemory ??
          null)
        : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}
