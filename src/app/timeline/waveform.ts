/**
 * Audio waveform for the timeline: decode the file's audio track and reduce
 * it to per-bucket peaks. The reduction is pure (unit-tested); decoding is
 * the thin DOM layer and resolves null when the file has no decodable audio.
 */

/**
 * Reduce samples to `bucketCount` peak values, normalized to 0..1 against
 * the loudest bucket (so quiet tracks still show their shape).
 */
export function peakBuckets(
  samples: ArrayLike<number>,
  bucketCount: number
): number[] {
  const total = samples.length;
  if (!total || bucketCount <= 0) {
    return [];
  }
  const buckets = Math.min(bucketCount, total);
  const size = total / buckets;
  const peaks = new Array<number>(buckets);
  for (let b = 0; b < buckets; b++) {
    const startIdx = Math.floor(b * size);
    const endIdx = Math.min(
      total,
      Math.max(startIdx + 1, Math.floor((b + 1) * size))
    );
    let peak = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) {
        peak = v;
      }
    }
    peaks[b] = peak;
  }
  const max = Math.max(...peaks);
  return max > 0 ? peaks.map((p) => p / max) : peaks;
}

/**
 * Decode the audio track of a media file and return normalized peaks, or
 * null when there is no decodable audio (video-only files, odd codecs).
 */
export async function decodePeaks(
  file: Blob,
  bucketCount: number
): Promise<number[] | null> {
  try {
    const buffer = await file.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const audio = await ctx.decodeAudioData(buffer);
      if (!audio.numberOfChannels || !audio.length) {
        return null;
      }
      const peaks = peakBuckets(audio.getChannelData(0), bucketCount);
      return peaks.length ? peaks : null;
    } finally {
      void ctx.close();
    }
  } catch {
    return null;
  }
}
