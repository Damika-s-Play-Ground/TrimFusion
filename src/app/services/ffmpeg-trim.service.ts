import { Injectable, NgZone } from '@angular/core';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  buildFramePlan,
  buildSegmentsPlan,
  buildTrimPlan,
  extensionOf,
  SegmentsOptions,
  TrimOptions,
} from './ffmpeg-args';
import { classifyError, TrimError } from './trim-error';

export type { RotateOption, TrimOutput } from './ffmpeg-args';

/** Progress callback shared by all export operations. */
type ProgressFn = (percent: number) => void;

/**
 * Client-side video trimming via ffmpeg.wasm.
 *
 * Uses the SINGLE-THREADED core loaded from a CDN. The single-threaded core
 * does not use SharedArrayBuffer, so it works without cross-origin isolation
 * (COOP/COEP) — important because GitHub Pages cannot set those headers.
 * Loading core/wasm/worker as blob URLs also sidesteps cross-origin worker
 * restrictions and Angular's worker bundling.
 *
 * All command derivation lives in the pure module `ffmpeg-args.ts` (unit-
 * tested in CI); this service only loads wasm, moves bytes and reports
 * progress.
 */
@Injectable({ providedIn: 'root' })
export class FfmpegTrimService {
  private ffmpeg: FFmpeg | null = null;
  private loadPromise: Promise<void> | null = null;
  // Current progress sink. The ffmpeg 'progress' handler is registered once,
  // so multi-exec operations (segments + concat) re-point this per step.
  private progressCb: ProgressFn | null = null;

  // Set while the user has requested cancellation of the running export.
  private cancelRequested = false;

  // Pinned versions (kept in sync with package.json's @ffmpeg/ffmpeg).
  private static readonly FFMPEG_VERSION = '0.12.15';
  private static readonly CORE_VERSION = '0.12.6';
  private static readonly WORKER_FILE = '814.ffmpeg.js';
  // Primary + fallback CDNs for the ~30 MB core download.
  private static readonly CDN_BASES = [
    'https://unpkg.com',
    'https://cdn.jsdelivr.net/npm',
  ];
  private static readonly LOAD_TIMEOUT_MS = 60_000;

  constructor(private zone: NgZone) {}

  /**
   * Cancel the running export: terminates the wasm worker (the only way to
   * stop ffmpeg.wasm mid-exec) and forces a fresh engine load next time.
   */
  cancel(): void {
    if (!this.ffmpeg) {
      return;
    }
    this.cancelRequested = true;
    try {
      this.ffmpeg.terminate();
    } catch {
      /* ignore */
    }
    this.ffmpeg = null;
    this.loadPromise = null;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new TrimError('LOAD_FAILED', 'Timed out loading the engine.')
            ),
          ms
        )
      ),
    ]);
  }

  private async loadFrom(cdn: string, ffmpeg: FFmpeg): Promise<void> {
    const coreBase = `${cdn}/@ffmpeg/core@${FfmpegTrimService.CORE_VERSION}/dist/umd`;
    const workerURL = `${cdn}/@ffmpeg/ffmpeg@${FfmpegTrimService.FFMPEG_VERSION}/dist/umd/${FfmpegTrimService.WORKER_FILE}`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(
        `${coreBase}/ffmpeg-core.wasm`,
        'application/wasm'
      ),
      classWorkerURL: await toBlobURL(workerURL, 'text/javascript'),
    });
  }

  /**
   * Lazily download + initialize ffmpeg.wasm (once). Tries each CDN in turn
   * (retry + fallback) with a timeout; resets state on failure so a later
   * call can retry cleanly.
   */
  private async ensureLoaded(onProgress?: ProgressFn): Promise<FFmpeg> {
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

    this.loadPromise = (async () => {
      let lastError: unknown;
      for (const cdn of FfmpegTrimService.CDN_BASES) {
        try {
          await this.withTimeout(
            this.loadFrom(cdn, ffmpeg),
            FfmpegTrimService.LOAD_TIMEOUT_MS
          );
          return;
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError instanceof TrimError
        ? lastError
        : new TrimError('LOAD_FAILED', String(lastError));
    })();

    try {
      await this.loadPromise;
    } catch (err) {
      // Allow a clean retry on the next call.
      this.ffmpeg = null;
      this.loadPromise = null;
      throw err instanceof TrimError ? err : new TrimError('LOAD_FAILED');
    }
    return ffmpeg;
  }

  /** Best-effort removal of virtual-FS files. */
  private async cleanup(ffmpeg: FFmpeg, names: string[]): Promise<void> {
    for (const name of names) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        /* ignore */
      }
    }
  }

  /** Download-name stem for a produced file. */
  private baseNameOf(file: File): string {
    return file.name.replace(/\.[^.]+$/, '') || 'video';
  }

  /**
   * Trim `file` to the [startSeconds, endSeconds) range and return the result
   * as a Blob. See `buildTrimPlan` for the copy-vs-re-encode rules.
   */
  async trim(
    file: File,
    options: TrimOptions & { onProgress?: ProgressFn }
  ): Promise<{ blob: Blob; fileName: string }> {
    this.cancelRequested = false;
    const plan = buildTrimPlan(
      { ext: extensionOf(file.name), mimeType: file.type },
      options
    );

    const ffmpeg = await this.ensureLoaded(options.onProgress);
    try {
      await ffmpeg.writeFile(plan.inputName, await fetchFile(file));
      await ffmpeg.exec(plan.args);
      const data = await ffmpeg.readFile(plan.outputName);
      // data is a Uint8Array; wrap its buffer in a Blob.
      const blob = new Blob([(data as Uint8Array).buffer], {
        type: plan.mimeType,
      });
      return {
        blob,
        fileName: `${this.baseNameOf(file)}-${plan.suffix}.${plan.outExt}`,
      };
    } catch (err) {
      throw classifyError(err, this.cancelRequested);
    } finally {
      await this.cleanup(ffmpeg, [plan.inputName, plan.outputName]);
    }
  }

  /**
   * Export multiple [start, end) second-ranges of `file` as ONE stitched MP4.
   * See `buildSegmentsPlan` for the per-segment + concat strategy. Progress
   * is reported across all steps.
   */
  async trimSegments(
    file: File,
    options: SegmentsOptions & { onProgress?: ProgressFn }
  ): Promise<{ blob: Blob; fileName: string }> {
    this.cancelRequested = false;
    const { onProgress } = options;
    const plan = buildSegmentsPlan({ ext: extensionOf(file.name) }, options);

    const ffmpeg = await this.ensureLoaded(onProgress);
    await ffmpeg.writeFile(plan.inputName, await fetchFile(file));

    // Segment encodes + the (fast) concat step share the progress bar.
    const totalSteps = plan.steps.length + 1;
    const stepProgress = (step: number): ProgressFn | null =>
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
      for (let i = 0; i < plan.steps.length; i++) {
        this.progressCb = stepProgress(i);
        await ffmpeg.exec(plan.steps[i].args);
      }

      await ffmpeg.writeFile(plan.listName, plan.listContent);
      this.progressCb = stepProgress(plan.steps.length);
      await ffmpeg.exec(plan.concatArgs);

      const data = await ffmpeg.readFile(plan.outputName);
      const blob = new Blob([(data as Uint8Array).buffer], {
        type: plan.mimeType,
      });
      if (onProgress) {
        onProgress(100);
      }
      return {
        blob,
        fileName: `${this.baseNameOf(file)}-${plan.suffix}.${plan.outExt}`,
      };
    } catch (err) {
      throw classifyError(err, this.cancelRequested);
    } finally {
      await this.cleanup(ffmpeg, [
        plan.inputName,
        plan.listName,
        plan.outputName,
        ...plan.steps.map((s) => s.outputName),
      ]);
    }
  }

  /** Extract the exact frame at `timeSeconds` as a PNG via ffmpeg. */
  async exportFrame(
    file: File,
    timeSeconds: number,
    onProgress?: ProgressFn
  ): Promise<{ blob: Blob; fileName: string }> {
    this.cancelRequested = false;
    const plan = buildFramePlan({ ext: extensionOf(file.name) }, timeSeconds);
    const ffmpeg = await this.ensureLoaded(onProgress);
    try {
      await ffmpeg.writeFile(plan.inputName, await fetchFile(file));
      await ffmpeg.exec(plan.args);
      const data = await ffmpeg.readFile(plan.outputName);
      const blob = new Blob([(data as Uint8Array).buffer], {
        type: plan.mimeType,
      });
      return {
        blob,
        fileName: `${this.baseNameOf(file)}-${plan.suffix}.${plan.outExt}`,
      };
    } catch (err) {
      throw classifyError(err, this.cancelRequested);
    } finally {
      await this.cleanup(ffmpeg, [plan.inputName, plan.outputName]);
    }
  }
}
