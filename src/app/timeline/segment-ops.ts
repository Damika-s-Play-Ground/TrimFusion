/** Pure helpers for the segment list: overlap detection and merging. */

export interface PlainRange {
  start: number;
  end: number;
}

/** True when any two ranges overlap (touching edges don't count). */
export function hasOverlap(segments: PlainRange[]): boolean {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      return true;
    }
  }
  return false;
}

/**
 * Merge overlapping/touching ranges into a minimal chronological set.
 * (Used by the "merge overlaps" action; deliberately discards arrangement
 * order, since overlapping pieces have no meaningful sequence.)
 */
export function mergeOverlapping(segments: PlainRange[]): PlainRange[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: PlainRange[] = [];
  for (const seg of sorted) {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ start: seg.start, end: seg.end });
    }
  }
  return merged;
}
