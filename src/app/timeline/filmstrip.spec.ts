import { thumbCountForWidth, thumbTimes } from './filmstrip';

describe('thumbCountForWidth', () => {
  // W2-083: responsive thumbnail count.
  it('scales with width inside the 6-24 band', () => {
    expect(thumbCountForWidth(720)).toBe(10);
    expect(thumbCountForWidth(360)).toBe(6);
    expect(thumbCountForWidth(2400)).toBe(24);
  });

  it('falls back to 10 for unusable widths', () => {
    expect(thumbCountForWidth(0)).toBe(10);
    expect(thumbCountForWidth(NaN)).toBe(10);
  });
});

describe('thumbTimes', () => {
  it('samples bucket centers across the duration', () => {
    expect(thumbTimes(100, 4)).toEqual([12.5, 37.5, 62.5, 87.5]);
  });

  it('returns empty for invalid durations or counts', () => {
    expect(thumbTimes(0, 5)).toEqual([]);
    expect(thumbTimes(100, 0)).toEqual([]);
  });
});
