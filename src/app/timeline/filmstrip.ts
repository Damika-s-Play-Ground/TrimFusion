/**
 * Filmstrip capture: seeks a detached <video> through the clip and draws
 * evenly-spaced thumbnails onto a canvas. Cancellable, because the user can
 * swap files while a capture is still running.
 */

/** Evenly-spaced sample times (bucket centers) across a duration. */
export function thumbTimes(durationSeconds: number, count: number): number[] {
  if (!isFinite(durationSeconds) || durationSeconds <= 0 || count <= 0) {
    return [];
  }
  return Array.from(
    { length: count },
    (_, i) => ((i + 0.5) / count) * durationSeconds
  );
}

export interface FilmstripHandle {
  promise: Promise<string[]>;
  cancel(): void;
}

function once(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve) =>
    target.addEventListener(event, () => resolve(), { once: true })
  );
}

/**
 * Capture `count` JPEG data-URL thumbnails from a video object URL.
 * Resolves with the frames captured so far if cancelled mid-run.
 */
export function captureFilmstrip(
  objectUrl: string,
  count: number,
  thumbWidth = 96
): FilmstripHandle {
  let cancelled = false;
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = objectUrl;

  const promise = (async () => {
    try {
      await once(video, 'loadedmetadata');
      const times = thumbTimes(video.duration, count);
      if (!times.length) {
        return [];
      }
      const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
      const canvas = document.createElement('canvas');
      canvas.width = thumbWidth;
      canvas.height = Math.max(2, Math.round(thumbWidth / aspect));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return [];
      }
      const frames: string[] = [];
      for (const t of times) {
        if (cancelled) {
          break;
        }
        video.currentTime = Math.min(t, Math.max(0, video.duration - 0.05));
        await once(video, 'seeked');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.6));
      }
      return frames;
    } finally {
      // Release the element's reference to the blob.
      video.removeAttribute('src');
      video.load();
    }
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}
