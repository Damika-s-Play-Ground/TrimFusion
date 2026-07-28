import { panWindow, snapSeconds, zoomWindow } from './zoom';

describe('zoomWindow', () => {
  // W2-071: visible-window math.
  it('shows the whole clip at zoom 1', () => {
    expect(zoomWindow(120, 1, 60)).toEqual({ from: 0, to: 120 });
  });

  it('centers a duration/zoom span on the focus point', () => {
    expect(zoomWindow(120, 4, 60)).toEqual({ from: 45, to: 75 });
  });

  it('clamps at the clip edges', () => {
    expect(zoomWindow(120, 4, 2)).toEqual({ from: 0, to: 30 });
    expect(zoomWindow(120, 4, 119)).toEqual({ from: 90, to: 120 });
  });

  it('handles zero/invalid durations', () => {
    expect(zoomWindow(0, 4, 10)).toEqual({ from: 0, to: 0 });
  });
});

describe('panWindow', () => {
  it('shifts while preserving the span', () => {
    expect(panWindow({ from: 30, to: 60 }, 10, 120)).toEqual({
      from: 40,
      to: 70,
    });
  });

  it('clamps panning at both ends', () => {
    expect(panWindow({ from: 5, to: 35 }, -50, 120).from).toBe(0);
    expect(panWindow({ from: 80, to: 110 }, 50, 120).to).toBe(120);
  });
});

describe('snapSeconds', () => {
  // W2-084: snap rounding helper.
  it('rounds when snapping and passes through when not', () => {
    expect(snapSeconds(12.6, true)).toBe(13);
    expect(snapSeconds(12.4, true)).toBe(12);
    expect(snapSeconds(12.6, false)).toBe(12.6);
  });
});
