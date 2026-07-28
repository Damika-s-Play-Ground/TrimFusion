/** Pure timeline-zoom math: visible window, panning, snapping. */

export interface ZoomWindow {
  from: number;
  to: number;
}

export const ZOOM_LEVELS = [1, 2, 4, 8] as const;

/**
 * Visible window for a zoom level, centered on `focus` and clamped to
 * [0, duration]. Zoom ≤ 1 shows the whole clip.
 */
export function zoomWindow(
  duration: number,
  zoom: number,
  focus: number
): ZoomWindow {
  if (duration <= 0 || zoom <= 1) {
    return { from: 0, to: Math.max(0, duration) };
  }
  const span = duration / zoom;
  const from = Math.max(0, Math.min(focus - span / 2, duration - span));
  return { from, to: from + span };
}

/** Shift a window by `deltaSeconds`, clamped to the clip; span preserved. */
export function panWindow(
  window: ZoomWindow,
  deltaSeconds: number,
  duration: number
): ZoomWindow {
  const span = window.to - window.from;
  const from = Math.max(
    0,
    Math.min(window.from + deltaSeconds, duration - span)
  );
  return { from, to: from + span };
}

/** Round to whole seconds when snapping is enabled. */
export function snapSeconds(value: number, snap: boolean): number {
  return snap ? Math.round(value) : value;
}
