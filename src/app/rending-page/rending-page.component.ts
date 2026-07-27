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
  selector: 'app-rending-page',
  templateUrl: './rending-page.component.html',
  styleUrls: ['./rending-page.component.scss'],
})
export class RendingPageComponent {
  value = [30000, 70000];
  youtubeUrl: string = '';
  embedUrl: string = '';
  sanitizedUrl!: SafeResourceUrl;
  startThumb: number = 0;
  endThumb: number = 100;
  videoId: string | null = null;
  errorMessage: string = '';

  constructor(private sanitizer: DomSanitizer, private router: Router) {}

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

    // Construct the embed URL using the video ID.
    this.embedUrl = 'https://www.youtube.com/embed/' + videoId;

    // Sanitize the URL to embed the YouTube video.
    this.sanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.embedUrl
    );
  }

  formatLabel(value: number): string {
    if (value >= 1000) {
      return Math.round(value / 1000) + 'k';
    }

    return `${value}`;
  }

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
