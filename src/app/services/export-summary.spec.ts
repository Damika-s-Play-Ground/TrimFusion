import { summarizeExport, MediaMeta } from './export-summary';

const META: MediaMeta = {
  width: 1920,
  height: 1080,
  durationSeconds: 100,
  fileSizeBytes: 100_000_000,
};

describe('summarizeExport', () => {
  // W1-094: duration follows speed.
  it('reports the post-speed output duration', () => {
    const s = summarizeExport(
      { startSeconds: 10, endSeconds: 30, speed: 2 },
      META,
      true
    );
    expect(s.outDurationSeconds).toBe(10);
    expect(s.chips).toContain('2× speed');
  });

  // W1-095: dimensions follow rotate + crop + scale.
  it('derives output dimensions from rotate, crop and scale', () => {
    const s = summarizeExport(
      {
        startSeconds: 0,
        endSeconds: 10,
        rotate: 'cw90',
        aspectRatio: 1,
        scaleHeight: 480,
      },
      META,
      true
    );
    // 1920x1080 rotated -> 1080x1920, square crop -> 1080x1080, scaled -> 480p.
    expect(s.outHeight).toBe(480);
    expect(s.outWidth).toBe(480);
  });

  // W1-093: copy path estimates proportionally from the source file.
  it('estimates copy-path size proportionally to the clipped range', () => {
    const s = summarizeExport({ startSeconds: 0, endSeconds: 25 }, META, false);
    expect(s.estimatedBytes).toBe(25_000_000);
    expect(s.chips).toContain('Original format (fast copy)');
  });

  it('shrinks the re-encode estimate for higher CRF (compression)', () => {
    const base = summarizeExport(
      { startSeconds: 0, endSeconds: 60 },
      META,
      true
    );
    const small = summarizeExport(
      { startSeconds: 0, endSeconds: 60, crf: 29 },
      META,
      true
    );
    expect(small.estimatedBytes).toBeLessThan(base.estimatedBytes as number);
    expect(small.chips).toContain('compressed');
  });

  it('summarizes audio exports without dimensions', () => {
    const s = summarizeExport(
      { startSeconds: 0, endSeconds: 60, output: 'audio', mp3Bitrate: 320 },
      META,
      true
    );
    expect(s.outWidth).toBeNull();
    expect(s.chips[0]).toBe('MP3 320 kbps');
    expect(s.estimatedBytes).toBe((320_000 / 8) * 60);
  });
});
