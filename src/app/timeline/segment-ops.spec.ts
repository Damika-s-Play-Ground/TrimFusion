import { hasOverlap, mergeOverlapping } from './segment-ops';

describe('hasOverlap', () => {
  // W2-072: overlap detection.
  it('detects overlapping ranges regardless of input order', () => {
    expect(
      hasOverlap([
        { start: 20, end: 40 },
        { start: 0, end: 25 },
      ])
    ).toBeTrue();
  });

  it('treats touching edges and gaps as non-overlapping', () => {
    expect(
      hasOverlap([
        { start: 0, end: 10 },
        { start: 10, end: 20 },
        { start: 25, end: 30 },
      ])
    ).toBeFalse();
    expect(hasOverlap([])).toBeFalse();
  });
});

describe('mergeOverlapping', () => {
  it('merges overlapping and touching ranges', () => {
    expect(
      mergeOverlapping([
        { start: 15, end: 25 },
        { start: 0, end: 10 },
        { start: 10, end: 16 },
      ])
    ).toEqual([{ start: 0, end: 25 }]);
  });

  it('keeps disjoint ranges separate (chronologically)', () => {
    expect(
      mergeOverlapping([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
      ])
    ).toEqual([
      { start: 0, end: 10 },
      { start: 30, end: 40 },
    ]);
  });

  it('extends into contained ranges correctly', () => {
    expect(
      mergeOverlapping([
        { start: 0, end: 50 },
        { start: 10, end: 20 },
      ])
    ).toEqual([{ start: 0, end: 50 }]);
  });
});
