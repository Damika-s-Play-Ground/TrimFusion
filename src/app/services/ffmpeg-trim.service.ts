import { Injectable, NgZone } from '@angular/core';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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

/**
 * Client-side video trimming via ffmpeg.wasm.
 *
 * Uses the SINGLE-THREADED core loaded from a CDN. The single-threaded core
 * does not use SharedArrayBuffer, so it works without cross-origin isolation
 * (COOP/COEP) — important because GitHub Pages cannot set those headers.
 * Loading core/wasm/worker as blob URLs also sidesteps cross-origin worker
 * restrictions and Angular's worker bundling.
 */
@Injectable({ providedIn: 'root' })
export class FfmpegTrimService {
  private ffmpeg: FFmpeg | null = null;
  private loadPromise: Promise<void> | null = null;
  // Current progress sink. The ffmpeg 'progress' handler is registered once,
  // so multi-exec operations (segments + concat) re-point this per step.
  private progressCb: ((percent: number) => void) | null = null;

  // Pinned versions (kept in sync with package.json's @ffmpeg/ffmpeg).
  private static readonly FFMPEG_VERSION = '0.12.15';
  private static readonly CORE_VERSION = '0.12.6';
  private static readonly WORKER_FILE = '814.ffmpeg.js';

  constructor(private zone: NgZone) {}

  /** Lazily download + initialize ffmpeg.wasm (once). */
  private async ensureLoaded(
    onProgress?: (percent: number) => void
  ): Promise<FFmpeg> {
    this.progressCb = onProgress ?? null;
    if (this.ffmpeg && this.loadPromise) {
      await this.loadPromise;
      return this.ffmpeg;
    }

    const ffmpeg = new FFmpeg();
    this.ffmpeg = ffmpeg;

    ffmpeg.on('progress', ({ progress }) => {
      const cb = this.progressCb;
      if (cb) {
        // ffmpeg fires this from a worker, outside Angular's zone.
        this.zone.run(() =>
          cb(Math.max(0, Math.min(100, Math.round(progress * 100))))
        );
      }
    });

    const coreBase = `https://unpkg.com/@ffmpeg/core@${FfmpegTrimService.CORE_VERSION}/dist/umd`;
    const workerURL = `https://unpkg.com/@ffmpeg/ffmpeg@${FfmpegTrimService.FFMPEG_VERSION}/dist/umd/${FfmpegTrimService.WORKER_FILE}`;

    this.loadPromise = (async () => {
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${coreBase}/ffmpeg-core.js`,
          'text/javascript'
        ),
        wasmURL: await toBlobURL(
          `${coreBase}/ffmpeg-core.wasm`,
          'application/wasm'
        ),
        classWorkerURL: await toBlobURL(workerURL, 'text/javascript'),
      });
    })();

    await this.loadPromise;
    return ffmpeg;
  }

  /** Derive a lowercase file extension (e.g. "mp4") from a filename. */
  private extensionOf(name: string): string {
    const match = /\.([a-z0-9]+)$/i.exec(name);
    return match ? match[1].toLowerCase() : 'mp4';
  }

  /**
   * Centered-crop video filter that reshapes any input to the target aspect
   * ratio `r` (= width / height), then trims to even dimensions (libx264
   * requires that). Commas inside min() are escaped so ffmpeg's filtergraph
   * parser doesn't treat them as filter separators.
   */
  private cropToAspectFilter(r: number): string {
    const R = r.toFixed(6);
    return (
      `crop=min(iw\\,ih*${R}):min(ih\\,iw/${R}),` +
      `crop=trunc(iw/2)*2:trunc(ih/2)*2`
    );
  }

  /** Clamped `eq=` color filter, or null when all values are defaults. */
  private buildEqFilter(opts: {
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
  private buildVideoFilters(opts: {
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
      filters.push(this.cropToAspectFilter(opts.cropAspect));
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
  private buildAudioFilters(speed: number, volume: number): string[] {
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
   * Trim `file` to the [startSeconds, endSeconds) range and return the result
   * as a Blob.
   *
   * - Without `aspectRatio`: stream copy (`-c copy`) — fast and lossless; cuts
   *   land on the nearest keyframe and the input container is kept.
   * - With `aspectRatio`: centered-crop to that ratio and re-encode (libx264 /
   *   aac, MP4 output) — used for the "crop to display size" presets.
   */
  async trim(
    file: File,
    options: {
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
      onProgress?: (percent: number) => void;
    }
  ): Promise<{ blob: Blob; fileName: string }> {
    const { startSeconds, endSeconds, aspectRatio, onProgress } = options;
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
    const colorFilter = output !== 'audio' ? this.buildEqFilter(options) : null;
    // Audio gain (1 = unchanged); irrelevant for GIF and for muted video.
    const volume = Math.min(2, Math.max(0, options.volume ?? 1));
    const volumeChanged = output !== 'gif' && !mute && volume !== 1;
    const start = Math.max(0, Math.floor(startSeconds));
    const duration = Math.max(1, Math.floor(endSeconds) - start);
    // Cropping only applies to visual outputs.
    const crop = output !== 'audio' && !!aspectRatio && aspectRatio > 0;

    const inExt = this.extensionOf(file.name);
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
          : inExt;
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
      video: videoReencoded ? 'video/mp4' : file.type || 'video/mp4',
      audio: 'audio/mpeg',
      gif: 'image/gif',
    };
    const inputName = `input.${inExt}`;
    const outputName = `out.${outExt}`;

    const ffmpeg = await this.ensureLoaded(onProgress);

    await ffmpeg.writeFile(inputName, await fetchFile(file));

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
        ...this.buildVideoFilters({
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
      // Video output. Re-encode only when we must (crop or speed change);
      // otherwise a fast, lossless stream copy.
      const changeSpeed = speed !== 1;
      const needsReencode =
        crop ||
        changeSpeed ||
        !!scaleHeight ||
        precise ||
        !!rotate ||
        !!colorFilter ||
        volumeChanged;
      if (needsReencode) {
        const vfilters = this.buildVideoFilters({
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
          const afilters = this.buildAudioFilters(
            speed,
            volumeChanged ? volume : 1
          );
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
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    // data is a Uint8Array; wrap its buffer in a Blob.
    const blob = new Blob([(data as Uint8Array).buffer], {
      type: mimeByOutput[output],
    });

    // Best-effort cleanup of the virtual FS.
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {
      /* ignore */
    }

    const base = file.name.replace(/\.[^.]+$/, '') || 'video';
    let suffix: string;
    if (output === 'audio') {
      suffix = 'audio';
    } else if (output === 'gif') {
      suffix = 'clip';
    } else {
      suffix = crop ? 'cropped' : 'trimmed';
    }
    return { blob, fileName: `${base}-${suffix}.${outExt}` };
  }

  /**
   * Export multiple [start, end) second-ranges of `file` as ONE stitched MP4.
   *
   * Each segment is cut with output seeking (frame-accurate) and re-encoded
   * with identical settings (libx264/aac), then the pieces are joined with
   * the concat demuxer using stream copy — safe because every segment shares
   * the same codecs and parameters. Progress is reported across all steps.
   */
  async trimSegments(
    file: File,
    options: {
      segments: { start: number; end: number }[];
      aspectRatio?: number | null;
      speed?: number;
      mute?: boolean;
      scaleHeight?: number | null;
      rotate?: RotateOption | null;
      brightness?: number;
      contrast?: number;
      saturation?: number;
      volume?: number;
      onProgress?: (percent: number) => void;
    }
  ): Promise<{ blob: Blob; fileName: string }> {
    const { onProgress } = options;
    const segments = options.segments
      .map((s) => ({
        start: Math.max(0, Math.floor(s.start)),
        end: Math.floor(s.end),
      }))
      .filter((s) => s.end > s.start)
      .sort((a, b) => a.start - b.start);
    if (!segments.length) {
      throw new Error('No valid segments to export.');
    }

    const speed = Math.min(2, Math.max(0.5, options.speed ?? 1));
    const mute = !!options.mute;
    const volume = Math.min(2, Math.max(0, options.volume ?? 1));
    const vfilters = this.buildVideoFilters({
      rotate: options.rotate ?? null,
      cropAspect:
        options.aspectRatio && options.aspectRatio > 0
          ? options.aspectRatio
          : null,
      colorFilter: this.buildEqFilter(options),
      scaleHeight:
        options.scaleHeight && options.scaleHeight > 0
          ? Math.round(options.scaleHeight)
          : null,
      speed,
    });
    const afilters = this.buildAudioFilters(speed, mute ? 1 : volume);

    const ffmpeg = await this.ensureLoaded(onProgress);
    const inputName = `input.${this.extensionOf(file.name)}`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const listName = 'concat.txt';
    const outputName = 'joined.mp4';
    const segNames: string[] = [];
    // Segment encodes + the (fast) concat step share the progress bar.
    const totalSteps = segments.length + 1;
    const stepProgress = (step: number) =>
      onProgress
        ? (p: number) =>
            onProgress(
              Math.max(
                0,
                Math.min(100, Math.round(((step + p / 100) / totalSteps) * 100))
              )
            )
        : null;

    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        this.progressCb = stepProgress(i);
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
        await ffmpeg.exec(args);
        segNames.push(segName);
      }

      await ffmpeg.writeFile(
        listName,
        segNames.map((n) => `file '${n}'`).join('\n')
      );
      this.progressCb = stepProgress(segments.length);
      await ffmpeg.exec([
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
      ]);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([(data as Uint8Array).buffer], {
        type: 'video/mp4',
      });
      if (onProgress) {
        onProgress(100);
      }
      const base = file.name.replace(/\.[^.]+$/, '') || 'video';
      return { blob, fileName: `${base}-stitched.mp4` };
    } finally {
      // Best-effort cleanup of the virtual FS (also on failure).
      for (const name of [inputName, listName, outputName, ...segNames]) {
        try {
          await ffmpeg.deleteFile(name);
        } catch {
          /* ignore */
        }
      }
    }
  }
}
