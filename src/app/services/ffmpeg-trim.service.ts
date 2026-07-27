import { Injectable, NgZone } from '@angular/core';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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
      onProgress?: (percent: number) => void;
    }
  ): Promise<{ blob: Blob; fileName: string }> {
    const { startSeconds, endSeconds, aspectRatio, onProgress } = options;
    const start = Math.max(0, Math.floor(startSeconds));
    const duration = Math.max(1, Math.floor(endSeconds) - start);
    const crop = aspectRatio && aspectRatio > 0;

    const inExt = this.extensionOf(file.name);
    const outExt = crop ? 'mp4' : inExt;
    const inputName = `input.${inExt}`;
    const outputName = `trimmed.${outExt}`;

    const ffmpeg = await this.ensureLoaded(onProgress);

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const args = [
      '-ss',
      String(start),
      '-i',
      inputName,
      '-t',
      String(duration),
    ];
    if (crop) {
      args.push(
        '-vf',
        this.cropToAspectFilter(aspectRatio as number),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart'
      );
    } else {
      args.push('-c', 'copy');
    }
    args.push(outputName);
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    // data is a Uint8Array; wrap its buffer in a Blob.
    const blob = new Blob([(data as Uint8Array).buffer], {
      type: crop ? 'video/mp4' : file.type || 'video/mp4',
    });

    // Best-effort cleanup of the virtual FS.
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {
      /* ignore */
    }

    const base = file.name.replace(/\.[^.]+$/, '') || 'video';
    const suffix = crop ? 'cropped' : 'trimmed';
    return { blob, fileName: `${base}-${suffix}.${outExt}` };
  }
}
