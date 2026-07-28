import { Component, HostBinding, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  DomSanitizer,
  SafeResourceUrl,
  SafeUrl,
} from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  capabilityReport,
  ExportSummary,
  summarizeExport,
} from '@services/export-summary';
import {
  buildTrimPlan,
  extensionOf,
  SegmentRange,
  TrimOptions,
} from '@services/ffmpeg-args';
import {
  FfmpegTrimService,
  RotateOption,
  TrimOutput,
} from '@services/ffmpeg-trim.service';
import { messageFor, TrimError } from '@services/trim-error';

/**
 * Extracts an 11-character YouTube video ID from any common URL shape, or a
 * bare ID. Returns null when no valid ID can be found.
 *
 * Handles:
 *   - https://www.youtube.com/watch?v=ID (with extra &t=, &list=, etc.)
 *   - https://youtu.be/ID?t=30
 *   - https://www.youtube.com/shorts/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/live/ID
 *   - a bare 11-char ID
 */
export function extractVideoId(input: string): string | null {
  if (!input) {
    return null;
  }

  const raw = input.trim();
  const ID = /^[A-Za-z0-9_-]{11}$/;

  // Bare ID.
  if (ID.test(raw)) {
    return raw;
  }

  // Prepend a protocol so the URL parser accepts bare-host inputs.
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  // youtu.be/ID
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && ID.test(id) ? id : null;
  }

  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host.endsWith('.youtube.com')
  ) {
    // watch?v=ID
    const v = url.searchParams.get('v');
    if (v && ID.test(v)) {
      return v;
    }

    // /shorts/ID, /embed/ID, /live/ID, /v/ID
    const segments = url.pathname.split('/').filter(Boolean);
    const marker = segments[0];
    if (
      marker === 'shorts' ||
      marker === 'embed' ||
      marker === 'live' ||
      marker === 'v'
    ) {
      const id = segments[1];
      return id && ID.test(id) ? id : null;
    }
  }

  return null;
}

@Component({
  selector: 'app-rendering-page',
  templateUrl: './rendering-page.component.html',
  styleUrls: ['./rendering-page.component.scss'],
})
export class RenderingPageComponent implements OnDestroy {
  youtubeUrl = '';
  embedUrl = '';
  sanitizedUrl!: SafeResourceUrl;
  videoId: string | null = null;
  errorMessage = '';

  // Uploaded local video (an alternative to the YouTube preview).
  localVideoUrl: SafeUrl | null = null;
  localFileName = '';
  private localObjectUrl: string | null = null;
  private localFile: File | null = null;
  private localVideoEl: HTMLVideoElement | null = null;

  // Client-side trim (ffmpeg.wasm) state.
  trimming = false;
  trimProgress = 0;
  trimError = '';
  // Non-error status (e.g. "Export cancelled.").
  infoMessage = '';

  /** Ask the service to abort the running export. */
  cancelExport(): void {
    this.ffmpegTrim.cancel();
  }

  /** Surface a transient status: inline note + snackbar toast. */
  private notify(message: string): void {
    this.infoMessage = message;
    this.snackBar.open(message, 'OK', { duration: 5000 });
  }

  /** Warn (non-blocking) when browser storage headroom looks tight. */
  private async checkStorageHeadroom(): Promise<void> {
    try {
      if (navigator.storage?.estimate) {
        const { quota, usage } = await navigator.storage.estimate();
        if (quota && usage !== undefined && quota - usage < 200 * 1024 * 1024) {
          this.notify(
            'Browser storage headroom is low — large exports may fail.'
          );
        }
      }
    } catch {
      /* estimate() unsupported — nothing to check */
    }
  }

  /** Map a thrown export error onto the user-facing message table. */
  private handleExportError(err: unknown): void {
    if (err instanceof TrimError && err.code === 'CANCELLED') {
      this.notify(messageFor('CANCELLED'));
      return;
    }
    this.trimError =
      err instanceof TrimError
        ? messageFor(err.code)
        : messageFor('ENCODE_FAILED');
    console.error('export failed', err);
  }

  /** Non-blocking heads-up for slow/memory-heavy exports. */
  get exportWarning(): string | null {
    if (this.endSeconds - this.startSeconds > 600) {
      return (
        'Ranges over 10 minutes can be slow and memory-heavy in the ' +
        'browser — consider a shorter clip.'
      );
    }
    if (this.localFile && this.localFile.size > 500 * 1024 * 1024) {
      return 'Files over 500 MB can exhaust browser memory during export.';
    }
    return null;
  }

  // "Crop to display size" presets (value = width / height, null = keep original).
  readonly aspectPresets: { label: string; value: number | null }[] = [
    { label: 'Original (no crop)', value: null },
    { label: '16:9 — Landscape', value: 16 / 9 },
    { label: '9:16 — Vertical (Shorts/Reels)', value: 9 / 16 },
    { label: '1:1 — Square', value: 1 },
    { label: '4:5 — Portrait', value: 4 / 5 },
  ];
  selectedAspect: number | null = null;

  // "Export as" options.
  readonly outputFormats: { label: string; value: TrimOutput }[] = [
    { label: 'Video (MP4/original)', value: 'video' },
    { label: 'Audio only (MP3)', value: 'audio' },
    { label: 'Animated GIF', value: 'gif' },
  ];
  selectedOutput: TrimOutput = 'video';

  // Playback-speed presets (video export only) and mute toggle.
  readonly speedPresets: { label: string; value: number }[] = [
    { label: '0.5× (slow)', value: 0.5 },
    { label: 'Normal', value: 1 },
    { label: '1.5×', value: 1.5 },
    { label: '2× (fast)', value: 2 },
  ];
  selectedSpeed = 1;
  muteAudio = false;

  // Resolution presets (target height; null = keep original) — video export only.
  readonly scalePresets: { label: string; value: number | null }[] = [
    { label: 'Original resolution', value: null },
    { label: '1080p', value: 1080 },
    { label: '720p', value: 720 },
    { label: '480p', value: 480 },
  ];
  selectedScale: number | null = null;

  // Frame-accurate cut (re-encode) vs. fast keyframe-aligned copy.
  preciseCut = false;

  // Rotation/flip presets (visual outputs; null = none).
  readonly rotatePresets: { label: string; value: RotateOption | null }[] = [
    { label: 'No rotation', value: null },
    { label: 'Rotate 90° right', value: 'cw90' },
    { label: 'Rotate 180°', value: 'cw180' },
    { label: 'Rotate 90° left', value: 'cw270' },
    { label: 'Flip horizontal (mirror)', value: 'hflip' },
    { label: 'Flip vertical', value: 'vflip' },
  ];
  selectedRotate: RotateOption | null = null;

  // Color adjustments (ffmpeg `eq` semantics: brightness 0, contrast/saturation
  // 1 mean "unchanged"). Applied to visual outputs only.
  brightness = 0;
  contrast = 1;
  saturation = 1;

  get colorsChanged(): boolean {
    return (
      this.brightness !== 0 || this.contrast !== 1 || this.saturation !== 1
    );
  }

  resetColors(): void {
    this.brightness = 0;
    this.contrast = 1;
    this.saturation = 1;
  }

  // One-click social presets: configure the existing controls as a bundle.
  readonly socialPresets: {
    key: string;
    label: string;
    aspect: number;
    scale: number;
    maxDuration: number | null;
  }[] = [
    {
      key: 'shorts',
      label: 'Shorts / Reels / TikTok',
      aspect: 9 / 16,
      scale: 720,
      maxDuration: 60,
    },
    {
      key: 'square',
      label: 'Instagram square',
      aspect: 1,
      scale: 720,
      maxDuration: 60,
    },
    {
      key: 'youtube',
      label: 'YouTube landscape',
      aspect: 16 / 9,
      scale: 1080,
      maxDuration: null,
    },
  ];
  appliedPreset: string | null = null;

  applySocialPreset(preset: (typeof this.socialPresets)[number]): void {
    this.selectedOutput = 'video';
    this.selectedAspect = preset.aspect;
    this.selectedScale = preset.scale;
    if (preset.maxDuration !== null) {
      this.endSeconds = Math.min(
        this.endSeconds,
        this.startSeconds + preset.maxDuration
      );
      // Exact caps matter for platform limits — use the frame-accurate cut.
      this.preciseCut = true;
    }
    this.appliedPreset = preset.key;
  }

  // Audio gain, 0–2 (1 = unchanged). Not applicable to GIF or muted video.
  volumeGain = 1;

  get volumePercent(): number {
    return Math.round(this.volumeGain * 100);
  }

  // Encoding quality (x264 CRF) + output frame rate (video export).
  readonly crfPresets: { label: string; value: number }[] = [
    { label: 'High quality (larger file)', value: 18 },
    { label: 'Balanced (default)', value: 23 },
    { label: 'Smaller file (compress)', value: 28 },
  ];
  selectedCrf = 23;
  readonly fpsPresets: { label: string; value: number | null }[] = [
    { label: 'Original frame rate', value: null },
    { label: '60 fps', value: 60 },
    { label: '30 fps', value: 30 },
    { label: '24 fps (cinematic)', value: 24 },
  ];
  selectedFps: number | null = null;
  readonly encodePresets: {
    label: string;
    value: 'veryfast' | 'medium';
  }[] = [
    { label: 'Fast encode (default)', value: 'veryfast' },
    { label: 'Better compression (slower)', value: 'medium' },
  ];
  selectedEncodePreset: 'veryfast' | 'medium' = 'veryfast';

  // GIF-specific knobs.
  readonly gifFpsPresets = [8, 12, 15, 24];
  gifFps = 12;
  readonly gifWidthPresets = [320, 480, 640];
  gifWidth = 480;

  // MP3-specific knobs.
  readonly mp3BitratePresets: { label: string; value: number | null }[] = [
    { label: 'VBR high (default)', value: null },
    { label: '128 kbps', value: 128 },
    { label: '192 kbps', value: 192 },
    { label: '320 kbps', value: 320 },
  ];
  mp3Bitrate: number | null = null;
  readonly mp3SampleRatePresets: { label: string; value: number | null }[] = [
    { label: 'Original sample rate', value: null },
    { label: '44.1 kHz', value: 44100 },
    { label: '48 kHz', value: 48000 },
  ];
  mp3SampleRate: number | null = null;

  // Playback effects (video export only). Loop/boomerang stitch segments.
  readonly effectPresets: { label: string; value: string }[] = [
    { label: 'None', value: 'none' },
    { label: 'Reverse', value: 'reverse' },
    { label: 'Loop ×2', value: 'loop2' },
    { label: 'Loop ×3', value: 'loop3' },
    { label: 'Boomerang', value: 'boomerang' },
  ];
  selectedEffect = 'none';

  // Edge fades (0.5 s, video export only).
  fadeIn = false;
  fadeOut = false;

  // Split-into-N sequential clip downloads.
  readonly splitPresets = [2, 3, 4];
  splitCount = 2;

  /** Collect every active control into one ffmpeg options object. */
  private trimOptions(): TrimOptions {
    return {
      startSeconds: this.startSeconds,
      endSeconds: this.endSeconds,
      aspectRatio: this.selectedAspect,
      output: this.selectedOutput,
      speed: this.selectedSpeed,
      mute: this.muteAudio,
      scaleHeight: this.selectedScale,
      preciseCut: this.preciseCut,
      rotate: this.selectedRotate,
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
      volume: this.volumeGain,
      crf: this.selectedCrf,
      fps: this.selectedFps,
      gifFps: this.gifFps,
      gifWidth: this.gifWidth,
      encodePreset: this.selectedEncodePreset,
      mp3Bitrate: this.mp3Bitrate,
      mp3SampleRate: this.mp3SampleRate,
      reverse: this.selectedEffect === 'reverse',
      fadeIn: this.fadeIn,
      fadeOut: this.fadeOut,
    };
  }

  /** Plan for the current settings, or null before a file is loaded. */
  private currentPlan() {
    if (!this.localFile) {
      return null;
    }
    return buildTrimPlan(
      {
        ext: extensionOf(this.localFile.name),
        mimeType: this.localFile.type,
      },
      this.trimOptions()
    );
  }

  /** The exact ffmpeg command the current settings produce (education/debug). */
  get commandPreview(): string {
    const plan = this.currentPlan();
    return plan ? `ffmpeg ${plan.args.join(' ')}` : '';
  }

  // Source dimensions captured from the player's metadata.
  private localVideoWidth: number | null = null;
  private localVideoHeight: number | null = null;
  private localDuration: number | null = null;

  /** Live recap of what the current settings will produce. */
  get exportSummary(): ExportSummary | null {
    const plan = this.currentPlan();
    if (!plan) {
      return null;
    }
    return summarizeExport(
      this.trimOptions(),
      {
        width: this.localVideoWidth,
        height: this.localVideoHeight,
        durationSeconds: this.localDuration,
        fileSizeBytes: this.localFile?.size ?? null,
      },
      plan.args.includes('libx264')
    );
  }

  formatBytes(bytes: number | null): string {
    if (bytes === null) {
      return '?';
    }
    return bytes >= 1_000_000
      ? `${(bytes / 1_000_000).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1000))} KB`;
  }

  /** Copy settings + command + browser capabilities for bug reports. */
  async copyDiagnostics(): Promise<void> {
    const payload = {
      settings: this.trimOptions(),
      command: this.commandPreview,
      capabilities: capabilityReport(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      this.notify('Diagnostics copied to the clipboard.');
    } catch {
      this.trimError = 'Could not access the clipboard.';
    }
  }

  // Light/dark theme (persisted). Dark is the default.
  theme: 'dark' | 'light' = 'dark';

  @HostBinding('class.tf-light') get isLightTheme(): boolean {
    return this.theme === 'light';
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('tf-theme', this.theme);
    } catch {
      /* ignore storage errors (e.g. private mode) */
    }
  }

  // Trim range, in seconds. For an uploaded file this is set from the real
  // video duration; for YouTube it defaults to a 10-minute window until
  // duration detection lands (ROADMAP P0).
  maxSeconds = 600;
  startSeconds = 0;
  endSeconds = 60;

  constructor(
    private sanitizer: DomSanitizer,
    private router: Router,
    private ffmpegTrim: FfmpegTrimService,
    private snackBar: MatSnackBar
  ) {
    try {
      const saved = localStorage.getItem('tf-theme');
      if (saved === 'light' || saved === 'dark') {
        this.theme = saved;
      }
    } catch {
      /* ignore storage errors */
    }
  }

  ngOnDestroy(): void {
    this.revokeLocalUrl();
  }

  private revokeLocalUrl(): void {
    if (this.localObjectUrl) {
      URL.revokeObjectURL(this.localObjectUrl);
      this.localObjectUrl = null;
    }
  }

  /** Handle "Upload your own video": preview a locally-selected file. */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('video/')) {
      this.errorMessage = `Please choose a video file — that looks like "${
        file.type || 'an unknown type'
      }".`;
      return;
    }

    // Switch to local-file mode: drop any YouTube preview.
    this.errorMessage = '';
    this.trimError = '';
    this.embedUrl = '';
    this.videoId = null;

    this.revokeLocalUrl();
    this.localFile = file;
    this.localObjectUrl = URL.createObjectURL(file);
    this.localVideoUrl = this.sanitizer.bypassSecurityTrustUrl(
      this.localObjectUrl
    );
    this.localFileName = file.name;
  }

  /** Trigger a browser download for a produced blob. */
  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Trim the uploaded video client-side (ffmpeg.wasm) and download the clip. */
  async trimAndDownload(): Promise<void> {
    if (!this.localFile || this.trimming) {
      return;
    }
    if (this.endSeconds <= this.startSeconds) {
      this.trimError = messageFor('INVALID_INPUT');
      return;
    }
    this.trimming = true;
    this.trimProgress = 0;
    this.trimError = '';
    this.infoMessage = '';
    void this.checkStorageHeadroom();
    try {
      const startedAt = performance.now();
      const onProgress = (percent: number) => (this.trimProgress = percent);
      // Loop/boomerang effects are built by stitching segments.
      const stitched =
        this.selectedOutput === 'video' &&
        ['loop2', 'loop3', 'boomerang'].includes(this.selectedEffect);
      let result: { blob: Blob; fileName: string };
      if (stitched) {
        const range = { start: this.startSeconds, end: this.endSeconds };
        const segments: SegmentRange[] =
          this.selectedEffect === 'boomerang'
            ? [range, { ...range, reverse: true }]
            : Array(this.selectedEffect === 'loop3' ? 3 : 2).fill(range);
        result = await this.ffmpegTrim.trimSegments(this.localFile, {
          ...this.trimOptions(),
          segments,
          onProgress,
        });
      } else {
        result = await this.ffmpegTrim.trim(this.localFile, {
          ...this.trimOptions(),
          onProgress,
        });
      }
      this.downloadBlob(result.blob, result.fileName);
      const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
      const dims = this.exportSummary;
      this.notify(
        `Downloaded ${result.fileName} — ` +
          `${this.formatBytes(result.blob.size)} in ${seconds} s` +
          (dims?.outWidth && dims.outHeight
            ? `, ${dims.outWidth}×${dims.outHeight}`
            : '') +
          '.'
      );
    } catch (err) {
      this.handleExportError(err);
    } finally {
      this.trimming = false;
    }
  }

  /** Save the exact frame at the trim start as a PNG (ffmpeg-precise). */
  async exportFrameExact(): Promise<void> {
    if (!this.localFile || this.trimming) {
      return;
    }
    this.trimming = true;
    this.trimProgress = 0;
    this.trimError = '';
    try {
      const { blob, fileName } = await this.ffmpegTrim.exportFrame(
        this.localFile,
        this.startSeconds,
        (percent) => (this.trimProgress = percent)
      );
      this.downloadBlob(blob, fileName);
    } catch (err) {
      this.handleExportError(err);
    } finally {
      this.trimming = false;
    }
  }

  /** Split the selected range into N equal clips, downloaded sequentially. */
  async splitAndDownload(): Promise<void> {
    if (!this.localFile || this.trimming) {
      return;
    }
    const total = this.endSeconds - this.startSeconds;
    if (total < this.splitCount) {
      this.trimError = 'Range is too short to split into that many clips.';
      return;
    }
    this.trimming = true;
    this.trimProgress = 0;
    this.trimError = '';
    try {
      const step = Math.floor(total / this.splitCount);
      for (let i = 0; i < this.splitCount; i++) {
        const start = this.startSeconds + i * step;
        const end = i === this.splitCount - 1 ? this.endSeconds : start + step;
        const { blob, fileName } = await this.ffmpegTrim.trim(this.localFile, {
          ...this.trimOptions(),
          startSeconds: start,
          endSeconds: end,
          output: 'video',
          onProgress: (percent) => (this.trimProgress = percent),
        });
        this.downloadBlob(
          blob,
          fileName.replace(/(\.[^.]+)$/, `-part${i + 1}$1`)
        );
      }
    } catch (err) {
      this.handleExportError(err);
    } finally {
      this.trimming = false;
    }
  }

  // Multi-segment stitching: keep-ranges collected from the slider.
  segments: { start: number; end: number }[] = [];

  addSegment(): void {
    if (this.endSeconds <= this.startSeconds) {
      return;
    }
    this.segments.push({ start: this.startSeconds, end: this.endSeconds });
  }

  removeSegment(index: number): void {
    this.segments.splice(index, 1);
  }

  clearSegments(): void {
    this.segments = [];
  }

  get segmentsTotalSeconds(): number {
    return this.segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  }

  /** Export all collected segments as one stitched MP4 and download it. */
  async exportSegments(): Promise<void> {
    if (!this.localFile || this.trimming || this.segments.length < 2) {
      return;
    }
    this.trimming = true;
    this.trimProgress = 0;
    this.trimError = '';
    try {
      const { blob, fileName } = await this.ffmpegTrim.trimSegments(
        this.localFile,
        {
          ...this.trimOptions(),
          segments: this.segments,
          onProgress: (percent) => (this.trimProgress = percent),
        }
      );
      this.downloadBlob(blob, fileName);
    } catch (err) {
      this.handleExportError(err);
    } finally {
      this.trimming = false;
    }
  }

  /** Once the uploaded video's metadata loads, size the trim range to it. */
  onLocalMetadata(video: HTMLVideoElement): void {
    this.localVideoEl = video;
    this.localVideoWidth = video.videoWidth || null;
    this.localVideoHeight = video.videoHeight || null;
    const duration = Math.floor(video.duration || 0);
    this.localDuration = duration > 0 ? duration : null;
    if (duration > 0) {
      this.maxSeconds = duration;
      this.startSeconds = 0;
      this.endSeconds = Math.min(60, duration);
    } else {
      // Metadata didn't yield a usable duration (corrupt/odd container).
      this.errorMessage =
        "Couldn't read this video's duration — the file may be damaged or " +
        'in an unusual container. Exporting may still work.';
    }
  }

  /** The <video> element failed to decode the file (codec unsupported). */
  onPreviewError(): void {
    this.errorMessage =
      "Your browser can't preview this codec. The editor below still " +
      'works, and exporting may still succeed (ffmpeg supports more ' +
      'formats than the player).';
  }

  /**
   * Capture the frame currently shown in the uploaded-video player and save it
   * as a PNG. Runs entirely on a canvas — no ffmpeg needed. Scrub the player to
   * the desired moment first.
   */
  grabFrame(): void {
    const video = this.localVideoEl;
    if (!video || !video.videoWidth || !video.videoHeight) {
      this.trimError =
        'Load a video and let it show a frame before grabbing a still.';
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const base = (this.localFileName || 'frame').replace(/\.[^.]+$/, '');
      const stamp = Math.floor(video.currentTime);
      link.href = url;
      link.download = `${base}-frame-${stamp}s.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  extractVideoId(url: string): string | null {
    return extractVideoId(url);
  }

  loadVideo() {
    const videoId = this.extractVideoId(this.youtubeUrl);

    if (!videoId) {
      this.videoId = null;
      this.embedUrl = '';
      this.errorMessage =
        'Could not find a valid YouTube video in that link. Paste a URL like ' +
        'https://youtu.be/dQw4w9WgXcQ or https://www.youtube.com/watch?v=dQw4w9WgXcQ.';
      return;
    }

    this.errorMessage = '';
    this.videoId = videoId;
    this.updatePreview();
  }

  /**
   * Rebuild the embedded iframe URL for the current video and trim range.
   * `?start=&end=` makes the YouTube player begin at `start` and stop at
   * `end` (both in whole seconds).
   */
  updatePreview() {
    if (!this.videoId) {
      return;
    }
    const start = Math.floor(this.startSeconds);
    const end = Math.floor(this.endSeconds);
    this.embedUrl =
      `https://www.youtube.com/embed/${this.videoId}` +
      `?start=${start}&end=${end}&rel=0`;
    this.sanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.embedUrl
    );
  }

  /** Keep start < end, then refresh the preview (called on slider drag-end). */
  onRangeChange() {
    if (this.startSeconds >= this.endSeconds) {
      this.endSeconds = Math.min(this.startSeconds + 1, this.maxSeconds);
    }
    this.updatePreview();
  }

  /** Format a number of seconds as HH:MM:SS (or MM:SS under an hour). */
  formatTime = (value: number): string => {
    const total = Math.max(0, Math.floor(value));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  cropVideo() {
    this.openOnYouTube();
  }

  /**
   * NOTE: real client-side trimming is not implemented yet (see ROADMAP P1).
   * Until then this opens the source video on YouTube rather than pretending
   * to produce a trimmed download.
   */
  openOnYouTube() {
    if (!this.youtubeUrl) {
      return;
    }
    const link = document.createElement('a');
    link.href = this.youtubeUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.click();
  }
}
