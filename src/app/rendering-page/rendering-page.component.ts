import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

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
export class RenderingPageComponent {
  youtubeUrl: string = '';
  embedUrl: string = '';
  sanitizedUrl!: SafeResourceUrl;
  videoId: string | null = null;
  errorMessage: string = '';

  // Trim range, in seconds. Until real video-duration detection lands
  // (ROADMAP P0), the slider spans a default 10-minute window.
  maxSeconds: number = 600;
  startSeconds: number = 0;
  endSeconds: number = 60;

  constructor(
    private sanitizer: DomSanitizer,
    private router: Router
  ) {}

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
