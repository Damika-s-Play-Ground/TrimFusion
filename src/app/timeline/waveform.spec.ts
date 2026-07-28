import { peakBuckets } from './waveform';

describe('peakBuckets', () => {
  // W2-074: bucket reduction basics.
  it('returns the requested number of buckets', () => {
    const samples = new Float32Array(1000).fill(0.5);
    expect(peakBuckets(samples, 50).length).toBe(50);
  });

  it('picks the absolute peak within each bucket', () => {
    // Two buckets: quiet first half, one loud negative spike in the second.
    const samples = new Float32Array(100).fill(0.1);
    samples[75] = -0.8;
    const peaks = peakBuckets(samples, 2);
    // Normalized against the loudest bucket (0.8).
    expect(peaks[1]).toBe(1);
    expect(peaks[0]).toBeCloseTo(0.1 / 0.8, 5);
  });

  it('normalizes so the loudest bucket is 1 even for quiet audio', () => {
    const samples = new Float32Array(100).fill(0.05);
    const peaks = peakBuckets(samples, 4);
    expect(Math.max(...peaks)).toBe(1);
  });

  it('handles empty input and zero buckets', () => {
    expect(peakBuckets(new Float32Array(0), 10)).toEqual([]);
    expect(peakBuckets(new Float32Array(10), 0)).toEqual([]);
  });

  it('caps bucket count at the sample count', () => {
    const samples = new Float32Array([0.2, 0.4]);
    expect(peakBuckets(samples, 10).length).toBe(2);
  });

  it('leaves silence as zeros instead of dividing by zero', () => {
    const peaks = peakBuckets(new Float32Array(100), 4);
    expect(peaks).toEqual([0, 0, 0, 0]);
  });
});
