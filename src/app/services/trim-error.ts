/** Typed failure taxonomy for ffmpeg operations (pure, unit-testable). */

export type TrimErrorCode =
  'LOAD_FAILED' | 'ENCODE_FAILED' | 'OOM' | 'CANCELLED' | 'INVALID_INPUT';

export class TrimError extends Error {
  constructor(
    public readonly code: TrimErrorCode,
    message?: string
  ) {
    super(message ?? code);
    this.name = 'TrimError';
  }
}

/** User-facing message per failure class. */
export function messageFor(code: TrimErrorCode): string {
  switch (code) {
    case 'LOAD_FAILED':
      return (
        "Couldn't load the in-browser video engine (network/CDN issue). " +
        'Check your connection and try again.'
      );
    case 'OOM':
      return (
        'The browser ran out of memory while processing. Try a shorter ' +
        'range, a lower resolution, or the "Smaller file" quality.'
      );
    case 'CANCELLED':
      return 'Export cancelled.';
    case 'INVALID_INPUT':
      return 'That selection isn’t valid — check the trim range and file.';
    case 'ENCODE_FAILED':
      return (
        'Processing failed. The file’s codec may be unsupported — MP4 or ' +
        'WebM inputs work best. Everything runs locally in your browser.'
      );
  }
}

/** Classify an arbitrary thrown value into a TrimError. */
export function classifyError(err: unknown, cancelled: boolean): TrimError {
  if (err instanceof TrimError) {
    return err;
  }
  if (cancelled) {
    return new TrimError('CANCELLED');
  }
  const msg = String((err as Error | undefined)?.message ?? err ?? '');
  if (/\babort\b|out of memory|\bOOM\b|allocat/i.test(msg)) {
    return new TrimError('OOM', msg);
  }
  return new TrimError('ENCODE_FAILED', msg);
}
