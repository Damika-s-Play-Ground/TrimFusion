/**
 * Pure ffmpeg command derivation for TrimFusion.
 *
 * Everything in this module is stateless and wasm-free, so the full option
 * matrix (outputs × filters × toggles) is unit-testable in CI. The service
 * layer (ffmpeg-trim.service.ts) owns wasm loading, virtual-FS IO and
 * progress reporting; it simply executes the plans produced here.
 */

/** What the trim operation should produce. */
export type TrimOutput = 'video' | 'audio' | 'gif';

export type RotateOption = 'cw90' | 'cw180' | 'cw270' | 'hflip' | 'vflip';

/** ffmpeg filter snippets for each rotation/flip option. */
const ROTATE_FILTERS: Record<RotateOption, string> = {
  cw90: 'transpose=1',
  cw180: 'transpose=1,transpose=1',
  cw270: 'transpose=2',
  hflip: 'hflip',
  vflip: 'vflip',
};

export interface TrimOptions {
  startSeconds: number;
  endSeconds: number;
  aspectRatio?: number | null;
  output?: TrimOutput;
  speed?: number;
  mute?: boolean;
  scaleHeight?: number | null;
  preciseCut?: boolean;
  rotate?: RotateOption | null;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  volume?: number;
}

export interface TrimInput {
  /** Lowercase input extension, e.g. "mp4" (see extensionOf). */
  ext: string;
  /** Input MIME type as reported by the File; may be empty. */
  mimeType: string;
}

export interface TrimPlan {
  inputName: string;
  outputName: string;
  outExt: string;
  mimeType: string;
  /** Filename suffix for the produced download (trimmed/cropped/audio/clip). */
  suffix: string;
  /** Complete ffmpeg argv, including input and output names. */
  args: string[];
}

/** Derive a lowercase file extension (e.g. "mp4") from a filename. */
export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : 'mp4';
}

/**
 * Centered-crop video filter that reshapes any input to the target aspect
 * ratio `r` (= width / height), then trims to even dimensions (libx264
 * requires that). Commas inside min() are escaped so ffmpeg's filtergraph
 * parser doesn't treat them as filter separators.
 */
function cropToAspectFilter(r: number): string {
  const R = r.toFixed(6);
  return (
    `crop=min(iw\\,ih*${R}):min(ih\\,iw/${R}),` +
    `crop=trunc(iw/2)*2:trunc(ih/2)*2`
  );
}

/** Clamped `eq=` color filter, or null when all values are defaults. */
function buildEqFilter(opts: {
  brightness?: number;
  contrast?: number;
  saturation?: number;
}): string | null {
  const brightness = Math.min(0.5, Math.max(-0.5, opts.brightness ?? 0));
  const contrast = Math.min(2, Math.max(0.5, opts.contrast ?? 1));
  const saturation = Math.min(3, Math.max(0, opts.saturation ?? 1));
  const parts: string[] = [];
  if (brightness !== 0) parts.push(`brightness=${brightness}`);
  if (contrast !== 1) parts.push(`contrast=${contrast}`);
  if (saturation !== 1) parts.push(`saturation=${saturation}`);
  return parts.length ? `eq=${parts.join(':')}` : null;
}

/** Video filter chain: rotate → crop → color → scale → speed. */
function buildVideoFilters(opts: {
  rotate: RotateOption | null;
  cropAspect: number | null;
  colorFilter: string | null;
  scaleHeight: number | null;
  speed: number;
}): string[] {
  const filters: string[] = [];
  if (opts.rotate) {
    filters.push(ROTATE_FILTERS[opts.rotate]);
  }
  if (opts.cropAspect) {
    filters.push(cropToAspectFilter(opts.cropAspect));
  }
  if (opts.colorFilter) {
    filters.push(opts.colorFilter);
  }
  if (opts.scaleHeight) {
    // -2 keeps the aspect ratio with an even width (libx264-safe).
    filters.push(`scale=-2:${opts.scaleHeight}`);
  }
  if (opts.speed !== 1) {
    filters.push(`setpts=${(1 / opts.speed).toFixed(6)}*PTS`);
  }
  return filters;
}

/** Audio filter chain: tempo + gain (pass volume 1 for "unchanged"). */
function buildAudioFilters(speed: number, volume: number): string[] {
  const filters: string[] = [];
  if (speed !== 1) {
    filters.push(`atempo=${speed.toFixed(3)}`);
  }
  if (volume !== 1) {
    filters.push(`volume=${volume.toFixed(2)}`);
  }
  return filters;
}

/**
 * Derive the complete single-range export plan (argv, output name, MIME,
 * download suffix) from the input's ext/MIME and the requested options.
 *
 * - No visual/audio changes: keyframe-aligned stream copy in the source
 *   container (fast, lossless).
 * - Any filter/speed/volume/precise option: MP4/H.264+AAC re-encode.
 */
export function buildTrimPlan(
  input: TrimInput,
  options: TrimOptions
): TrimPlan {
  const { startSeconds, endSeconds, aspectRatio } = options;
  const output: TrimOutput = options.output ?? 'video';
  // Frame-accurate cut (video export only): re-encode with output seeking
  // instead of keyframe-aligned stream copy.
  const precise = output === 'video' && !!options.preciseCut;
  // Speed (video export only); clamp to ffmpeg's atempo-friendly range.
  const speed = Math.min(2, Math.max(0.5, options.speed ?? 1));
  const mute = !!options.mute;
  // Target height for downscaling (video export only); null = keep original.
  const scaleHeight =
    output === 'video' && options.scaleHeight && options.scaleHeight > 0
      ? Math.round(options.scaleHeight)
      : null;
  // Rotation/flip applies to visual outputs only.
  const rotate: RotateOption | null =
    output !== 'audio' && options.rotate ? options.rotate : null;
  // Color adjustments (visual outputs only).
  const colorFilter = output !== 'audio' ? buildEqFilter(options) : null;
  // Audio gain (1 = unchanged); irrelevant for GIF and for muted video.
  const volume = Math.min(2, Math.max(0, options.volume ?? 1));
  const volumeChanged = output !== 'gif' && !mute && volume !== 1;
  const start = Math.max(0, Math.floor(startSeconds));
  const duration = Math.max(1, Math.floor(endSeconds) - start);
  // Cropping only applies to visual outputs.
  const crop = output !== 'audio' && !!aspectRatio && aspectRatio > 0;

  let outExt: string;
  if (output === 'audio') {
    outExt = 'mp3';
  } else if (output === 'gif') {
    outExt = 'gif';
  } else {
    // Any filter/speed/precise/volume option forces an MP4/H.264 re-encode
    // (audio can't be safely re-encoded in an arbitrary source container).
    outExt =
      crop ||
      speed !== 1 ||
      scaleHeight ||
      precise ||
      rotate ||
      colorFilter ||
      volumeChanged
        ? 'mp4'
        : input.ext;
  }
  const videoReencoded =
    crop ||
    speed !== 1 ||
    !!scaleHeight ||
    precise ||
    !!rotate ||
    !!colorFilter ||
    volumeChanged;
  const mimeByOutput: Record<TrimOutput, string> = {
    video: videoReencoded ? 'video/mp4' : input.mimeType || 'video/mp4',
    audio: 'audio/mpeg',
    gif: 'image/gif',
  };
  const inputName = `input.${input.ext}`;
  const outputName = `out.${outExt}`;

  // Fast seek (-ss before -i) is keyframe-aligned; precise cut uses output
  // seeking (-ss after -i) so the clip starts exactly on `start`.
  const args = precise
    ? ['-i', inputName, '-ss', String(start), '-t', String(duration)]
    : ['-ss', String(start), '-i', inputName, '-t', String(duration)];
  if (output === 'audio') {
    // Strip video, encode audio to MP3.
    if (volumeChanged) {
      args.push('-af', `volume=${volume.toFixed(2)}`);
    }
    args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2');
  } else if (output === 'gif') {
    const filters = [
      ...buildVideoFilters({
        rotate,
        cropAspect: crop ? (aspectRatio as number) : null,
        colorFilter,
        scaleHeight: null,
        speed: 1,
      }),
      'fps=12',
      'scale=480:-2:flags=lanczos',
    ].join(',');
    args.push('-vf', filters);
  } else {
    // Video output. Re-encode only when we must; otherwise a fast, lossless
    // stream copy.
    const needsReencode = videoReencoded;
    if (needsReencode) {
      const vfilters = buildVideoFilters({
        rotate,
        cropAspect: crop ? (aspectRatio as number) : null,
        colorFilter,
        scaleHeight,
        speed,
      });
      if (vfilters.length) {
        args.push('-vf', vfilters.join(','));
      }
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23');
      if (mute) {
        args.push('-an');
      } else {
        const afilters = buildAudioFilters(speed, volumeChanged ? volume : 1);
        if (afilters.length) {
          args.push('-af', afilters.join(','));
        }
        args.push('-c:a', 'aac');
      }
      args.push('-movflags', '+faststart');
    } else if (mute) {
      // Drop audio, copy the video stream (fast).
      args.push('-an', '-c', 'copy');
    } else {
      // Fast, lossless stream copy.
      args.push('-c', 'copy');
    }
  }
  args.push(outputName);

  let suffix: string;
  if (output === 'audio') {
    suffix = 'audio';
  } else if (output === 'gif') {
    suffix = 'clip';
  } else {
    suffix = crop ? 'cropped' : 'trimmed';
  }

  return {
    inputName,
    outputName,
    outExt,
    mimeType: mimeByOutput[output],
    suffix,
    args,
  };
}

export interface SegmentRange {
  start: number;
  end: number;
}

/** Floor to whole seconds, clamp negatives, drop empty ranges, sort. */
export function normalizeSegments(segments: SegmentRange[]): SegmentRange[] {
  return segments
    .map((s) => ({
      start: Math.max(0, Math.floor(s.start)),
      end: Math.floor(s.end),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
}

export interface SegmentsOptions {
  segments: SegmentRange[];
  aspectRatio?: number | null;
  speed?: number;
  mute?: boolean;
  scaleHeight?: number | null;
  rotate?: RotateOption | null;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  volume?: number;
}

export interface SegmentStep {
  args: string[];
  outputName: string;
}

export interface SegmentsPlan {
  inputName: string;
  /** One frame-accurate encode per segment, in playback order. */
  steps: SegmentStep[];
  listName: string;
  listContent: string;
  /** Concat-demuxer stream-copy join of all steps' outputs. */
  concatArgs: string[];
  outputName: string;
  outExt: 'mp4';
  mimeType: 'video/mp4';
  suffix: 'stitched';
}

/**
 * Derive the multi-segment stitch plan: per-segment output-seeking encodes
 * with identical settings, then a concat-demuxer stream-copy join (safe
 * because every piece shares codecs/parameters).
 *
 * Throws when no segment survives normalization.
 */
export function buildSegmentsPlan(
  input: { ext: string },
  options: SegmentsOptions
): SegmentsPlan {
  const segments = normalizeSegments(options.segments);
  if (!segments.length) {
    throw new Error('No valid segments to export.');
  }

  const speed = Math.min(2, Math.max(0.5, options.speed ?? 1));
  const mute = !!options.mute;
  const volume = Math.min(2, Math.max(0, options.volume ?? 1));
  const vfilters = buildVideoFilters({
    rotate: options.rotate ?? null,
    cropAspect:
      options.aspectRatio && options.aspectRatio > 0
        ? options.aspectRatio
        : null,
    colorFilter: buildEqFilter(options),
    scaleHeight:
      options.scaleHeight && options.scaleHeight > 0
        ? Math.round(options.scaleHeight)
        : null,
    speed,
  });
  const afilters = buildAudioFilters(speed, mute ? 1 : volume);

  const inputName = `input.${input.ext}`;
  const steps: SegmentStep[] = segments.map((seg, i) => {
    const segName = `seg_${i}.mp4`;
    const args = [
      '-i',
      inputName,
      '-ss',
      String(seg.start),
      '-t',
      String(seg.end - seg.start),
    ];
    if (vfilters.length) {
      args.push('-vf', vfilters.join(','));
    }
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23');
    if (mute) {
      args.push('-an');
    } else {
      if (afilters.length) {
        args.push('-af', afilters.join(','));
      }
      args.push('-c:a', 'aac');
    }
    args.push(segName);
    return { args, outputName: segName };
  });

  const listName = 'concat.txt';
  const outputName = 'joined.mp4';
  return {
    inputName,
    steps,
    listName,
    listContent: steps.map((s) => `file '${s.outputName}'`).join('\n'),
    concatArgs: [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listName,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputName,
    ],
    outputName,
    outExt: 'mp4',
    mimeType: 'video/mp4',
    suffix: 'stitched',
  };
}
