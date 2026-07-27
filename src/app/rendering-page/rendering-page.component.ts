import { Component, OnDestroy } from '@angular/core';
import {
  DomSanitizer,
  SafeResourceUrl,
  SafeUrl,
} from '@angular/platform-browser';
import { Router } from '@angular/router';
import { FfmpegTrimService, TrimOutput } from '../services/ffmpeg-trim.service';

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
  youtubeUrl: string = '';
  embedUrl: string = '';
  sanitizedUrl!: SafeResourceUrl;
  videoId: string | null = null;
  errorMessage: string = '';

  // Uploaded local video (an alternative to the YouTube preview).
  localVideoUrl: SafeUrl | null = null;
  localFileName: string = '';
  private localObjectUrl: string | null = null;
  private localFile: File | null = null;
  private localVideoEl: HTMLVideoElement | null = null;

  // Client-side trim (ffmpeg.wasm) state.
  trimming: boolean = false;
  trimProgress: number = 0;
  trimError: string = '';

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

  // Trim range, in seconds. For an uploaded file this is set from the real
  // video duration; for YouTube it defaults to a 10-minute window until
  // duration detection lands (ROADMAP P0).
  maxSeconds: number = 600;
  startSeconds: number = 0;
  endSeconds: number = 60;

  constructor(
    private sanitizer: DomSanitizer,
    private router: Router,
    private ffmpegTrim: FfmpegTrimService
  ) {}

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
      this.errorMessage = 'Please choose a video file.';
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

  /** Trim the uploaded video client-side (ffmpeg.wasm) and download the clip. */
  async trimAndDownload(): Promise<void> {
    if (!this.localFile || this.trimming) {
      return;
    }
    this.trimming = true;
    this.trimProgress = 0;
    this.trimError = '';
    try {
      const { blob, fileName } = await this.ffmpegTrim.trim(this.localFile, {
        startSeconds: this.startSeconds,
        endSeconds: this.endSeconds,
        aspectRatio: this.selectedAspect,
        output: this.selectedOutput,
        onProgress: (percent) => (this.trimProgress = percent),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.trimError =
        'Trimming failed. This runs entirely in your browser and can be ' +
        'memory-heavy for large files — try a shorter range or smaller file.';
      console.error('ffmpeg trim failed', err);
    } finally {
      this.trimming = false;
    }
  }

  /** Once the uploaded video's metadata loads, size the trim range to it. */
  onLocalMetadata(video: HTMLVideoElement): void {
    this.localVideoEl = video;
    const duration = Math.floor(video.duration || 0);
    if (duration > 0) {
      this.maxSeconds = duration;
      this.startSeconds = 0;
      this.endSeconds = Math.min(60, duration);
    }
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
