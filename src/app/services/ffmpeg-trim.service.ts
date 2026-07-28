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

  // Pinned versions (kept in sync with package.json's @ffmpeg/ffmpeg).
  private static readonly FFMPEG_VERSION = '0.12.15';
  private static readonly CORE_VERSION = '0.12.6';
  private static readonly WORKER_FILE = '814.ffmpeg.js';

  constructor(private zone: NgZone) {}

  /** Lazily download + initialize ffmpeg.wasm (once). */
  private async ensureLoaded(
    onProgress?: (percent: number) => void
  ): Promise<FFmpeg> {
    if (this.ffmpeg && this.loadPromise) {
      await this.loadPromise;
      return this.ffmpeg;
    }

    const ffmpeg = new FFmpeg();
    this.ffmpeg = ffmpeg;

    ffmpeg.on('progress', ({ progress }) => {
      if (onProgress) {
        // ffmpeg fires this from a worker, outside Angular's zone.
        this.zone.run(() =>
          onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))))
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
    // Color adjustments (visual outputs; ffmpeg `eq` defaults are 0/1/1).
    const brightness = Math.min(0.5, Math.max(-0.5, options.brightness ?? 0));
    const contrast = Math.min(2, Math.max(0.5, options.contrast ?? 1));
    const saturation = Math.min(3, Math.max(0, options.saturation ?? 1));
    const eqParts: string[] = [];
    if (brightness !== 0) eqParts.push(`brightness=${brightness}`);
    if (contrast !== 1) eqParts.push(`contrast=${contrast}`);
    if (saturation !== 1) eqParts.push(`saturation=${saturation}`);
    const colorFilter =
      output !== 'audio' && eqParts.length ? `eq=${eqParts.join(':')}` : null;
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
      // Any filter/speed/precise option forces an MP4/H.264 re-encode.
      outExt =
        crop || speed !== 1 || scaleHeight || precise || rotate || colorFilter
          ? 'mp4'
          : inExt;
    }
    const videoReencoded =
      crop ||
      speed !== 1 ||
      !!scaleHeight ||
      precise ||
      !!rotate ||
      !!colorFilter;
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
      args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2');
    } else if (output === 'gif') {
      const filters = [
        ...(rotate ? [ROTATE_FILTERS[rotate]] : []),
        ...(crop ? [this.cropToAspectFilter(aspectRatio as number)] : []),
        ...(colorFilter ? [colorFilter] : []),
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
        !!colorFilter;
      if (needsReencode) {
        const vfilters: string[] = [];
        if (rotate) {
          vfilters.push(ROTATE_FILTERS[rotate]);
        }
        if (crop) {
          vfilters.push(this.cropToAspectFilter(aspectRatio as number));
        }
        if (colorFilter) {
          vfilters.push(colorFilter);
        }
        if (scaleHeight) {
          // -2 keeps the aspect ratio with an even width (libx264-safe).
          vfilters.push(`scale=-2:${scaleHeight}`);
        }
        if (changeSpeed) {
          vfilters.push(`setpts=${(1 / speed).toFixed(6)}*PTS`);
        }
        if (vfilters.length) {
          args.push('-vf', vfilters.join(','));
        }
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23');
        if (mute) {
          args.push('-an');
        } else {
          if (changeSpeed) {
            args.push('-af', `atempo=${speed.toFixed(3)}`);
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
}
