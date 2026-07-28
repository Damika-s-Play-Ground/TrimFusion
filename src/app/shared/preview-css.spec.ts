import {
  cropOverlayRect,
  playbackSync,
  previewFilter,
  previewTransform,
  stackPreviewFilter,
} from './preview-css';

describe('previewFilter', () => {
  it('maps only changed values into CSS filter functions', () => {
    expect(previewFilter(0, 1, 1)).toBe('none');
    expect(previewFilter(0.2, 1, 1)).toBe('brightness(1.20)');
    expect(previewFilter(0, 1.5, 0.5)).toBe('contrast(1.50) saturate(0.50)');
  });
});

describe('previewTransform', () => {
  it('maps rotations (scaled quarter turns) and flips', () => {
    expect(previewTransform(null)).toBe('none');
    expect(previewTransform('cw90')).toBe('rotate(90deg) scale(0.5625)');
    expect(previewTransform('cw180')).toBe('rotate(180deg)');
    expect(previewTransform('cw270')).toBe('rotate(-90deg) scale(0.5625)');
    expect(previewTransform('hflip')).toBe('scaleX(-1)');
    expect(previewTransform('vflip')).toBe('scaleY(-1)');
  });
});

describe('stackPreviewFilter', () => {
  // W3-065: approximable subset maps to CSS; export-only entries drop out.
  it('maps approximable filters and skips unknown keys', () => {
    expect(
      stackPreviewFilter([
        { key: 'grayscale' },
        { key: 'nonexistent' },
        { key: 'invert' },
      ])
    ).toEqual(['grayscale(1)', 'invert(1)']);
  });

  it('returns empty for empty stacks', () => {
    expect(stackPreviewFilter([])).toEqual([]);
    expect(stackPreviewFilter(null)).toEqual([]);
  });
});

describe('playbackSync', () => {
  // W2-082: preview sync mapping.
  it('returns neutral values when preview is disabled', () => {
    expect(playbackSync({ speed: 2, mute: true, volume: 0.2 }, false)).toEqual({
      playbackRate: 1,
      muted: false,
      volume: 1,
    });
  });

  it('maps speed/mute/volume through with clamps', () => {
    expect(playbackSync({ speed: 1.5, mute: true, volume: 0.4 }, true)).toEqual(
      { playbackRate: 1.5, muted: true, volume: 0.4 }
    );
    expect(playbackSync({ speed: 8 }, true).playbackRate).toBe(2);
  });

  it('caps volume preview at 1 (boosts only apply at export)', () => {
    expect(playbackSync({ volume: 2 }, true).volume).toBe(1);
  });
});

describe('cropOverlayRect', () => {
  it('centers a square crop over a 16:9 video filling the box', () => {
    const r = cropOverlayRect(1920, 1080, 1);
    // Content fills the box; square crop is 9 units wide in a 16-unit box.
    expect(r?.width).toBeCloseTo((9 / 16) * 100, 3);
    expect(r?.height).toBeCloseTo(100, 3);
    expect(r?.left).toBeCloseTo(((16 - 9) / 2 / 16) * 100, 3);
    expect(r?.top).toBeCloseTo(0, 3);
  });

  it('accounts for pillarboxed portrait videos', () => {
    const r = cropOverlayRect(1080, 1920, 9 / 16);
    // Portrait video occupies a 5.0625-unit-wide column; crop = whole column.
    expect(r?.height).toBeCloseTo(100, 3);
    expect(r?.width).toBeCloseTo(((9 * (9 / 16)) / 16) * 100, 3);
  });

  it('returns null without dimensions or aspect', () => {
    expect(cropOverlayRect(0, 1080, 1)).toBeNull();
    expect(cropOverlayRect(1920, 1080, 0)).toBeNull();
  });
});
