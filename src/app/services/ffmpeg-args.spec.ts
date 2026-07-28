import {
  buildSegmentsPlan,
  buildTrimPlan,
  extensionOf,
  normalizeSegments,
  TrimInput,
  TrimOptions,
} from './ffmpeg-args';

const MP4: TrimInput = { ext: 'mp4', mimeType: 'video/mp4' };
const WEBM: TrimInput = { ext: 'webm', mimeType: 'video/webm' };

/** Convenience: plan for MP4 input, 10s→30s, plus overrides. */
function plan(overrides: Partial<TrimOptions> = {}, input: TrimInput = MP4) {
  return buildTrimPlan(input, {
    startSeconds: 10,
    endSeconds: 30,
    ...overrides,
  });
}

describe('buildTrimPlan', () => {
  // W1-026: default video export = fast stream copy, container kept.
  it('uses stream copy and keeps the container by default', () => {
    const p = plan({}, WEBM);
    expect(p.args).toEqual([
      '-ss',
      '10',
      '-i',
      'input.webm',
      '-t',
      '20',
      '-c',
      'copy',
      'out.webm',
    ]);
    expect(p.outExt).toBe('webm');
    expect(p.mimeType).toBe('video/webm');
    expect(p.suffix).toBe('trimmed');
  });

  // W1-027: mute-only stays on the fast path.
  it('drops audio but still stream-copies video when only muted', () => {
    const p = plan({ mute: true });
    expect(p.args).toContain('-an');
    expect(p.args.join(' ')).toContain('-an -c copy');
    expect(p.outExt).toBe('mp4');
  });

  // W1-028: precise cut uses output seeking and re-encodes.
  it('uses output seeking (-ss after -i) and re-encodes for precise cut', () => {
    const p = plan({ preciseCut: true }, WEBM);
    expect(p.args.indexOf('-i')).toBeLessThan(p.args.indexOf('-ss'));
    expect(p.args).toContain('libx264');
    expect(p.outExt).toBe('mp4');
    expect(p.mimeType).toBe('video/mp4');
  });

  // W1-029: crop re-encodes to MP4 with the centered-crop filter.
  it('crops via centered-crop filter and re-encodes', () => {
    const p = plan({ aspectRatio: 16 / 9 }, WEBM);
    const vf = p.args[p.args.indexOf('-vf') + 1];
    expect(vf).toContain('crop=min(iw\\,ih*1.777778)');
    expect(vf).toContain('crop=trunc(iw/2)*2:trunc(ih/2)*2');
    expect(p.args).toContain('libx264');
    expect(p.outExt).toBe('mp4');
    expect(p.suffix).toBe('cropped');
  });

  // W1-030: resolution preset.
  it('adds an even-width scale filter for scaleHeight', () => {
    const p = plan({ scaleHeight: 720 });
    const vf = p.args[p.args.indexOf('-vf') + 1];
    expect(vf).toContain('scale=-2:720');
  });

  // W1-031: speed affects both video timing and audio tempo.
  it('pairs setpts and atempo for speed changes', () => {
    const p = plan({ speed: 2 });
    const vf = p.args[p.args.indexOf('-vf') + 1];
    const af = p.args[p.args.indexOf('-af') + 1];
    expect(vf).toContain('setpts=0.500000*PTS');
    expect(af).toContain('atempo=2.000');
  });

  // W1-032: speed clamps to the atempo-friendly range.
  it('clamps speed to [0.5, 2]', () => {
    const slow = plan({ speed: 0.25 });
    const fast = plan({ speed: 10 });
    expect(slow.args[slow.args.indexOf('-af') + 1]).toContain('atempo=0.500');
    expect(fast.args[fast.args.indexOf('-af') + 1]).toContain('atempo=2.000');
  });

  // W1-033: volume gain re-encodes.
  it('applies volume gain via -af and re-encodes to MP4', () => {
    const p = plan({ volume: 1.5 }, WEBM);
    expect(p.args[p.args.indexOf('-af') + 1]).toBe('volume=1.50');
    expect(p.outExt).toBe('mp4');
  });

  // W1-034: default volume keeps the copy path.
  it('keeps the copy path at volume 1', () => {
    const p = plan({ volume: 1 });
    expect(p.args.join(' ')).toContain('-c copy');
  });

  // W1-035: mute wins over volume.
  it('ignores volume when muted', () => {
    const p = plan({ volume: 1.5, mute: true });
    expect(p.args).toContain('-an');
    expect(p.args.join(' ')).not.toContain('volume=');
  });

  // W1-036/W1-037/W1-038: rotation/flip filters.
  it('maps cw90 to transpose=1', () => {
    const vf = ((p) => p.args[p.args.indexOf('-vf') + 1])(
      plan({ rotate: 'cw90' })
    );
    expect(vf).toContain('transpose=1');
  });

  it('maps cw180 to a double transpose', () => {
    const vf = ((p) => p.args[p.args.indexOf('-vf') + 1])(
      plan({ rotate: 'cw180' })
    );
    expect(vf).toContain('transpose=1,transpose=1');
  });

  it('maps hflip and vflip directly', () => {
    const h = plan({ rotate: 'hflip' });
    const v = plan({ rotate: 'vflip' });
    expect(h.args[h.args.indexOf('-vf') + 1]).toContain('hflip');
    expect(v.args[v.args.indexOf('-vf') + 1]).toContain('vflip');
  });

  // W1-039: single eq component.
  it('emits only changed eq components', () => {
    const p = plan({ brightness: 0.2 });
    expect(p.args[p.args.indexOf('-vf') + 1]).toBe('eq=brightness=0.2');
  });

  // W1-040: eq clamping.
  it('clamps eq values to safe ranges', () => {
    const p = plan({ brightness: 2, contrast: 9, saturation: -5 });
    const vf = p.args[p.args.indexOf('-vf') + 1];
    expect(vf).toContain('brightness=0.5');
    expect(vf).toContain('contrast=2');
    expect(vf).toContain('saturation=0');
  });

  // W1-041: full chain order.
  it('orders the chain rotate → crop → eq → scale → setpts', () => {
    const p = plan({
      rotate: 'cw90',
      aspectRatio: 1,
      brightness: 0.1,
      scaleHeight: 480,
      speed: 1.5,
    });
    const vf = p.args[p.args.indexOf('-vf') + 1];
    const order = [
      vf.indexOf('transpose'),
      vf.indexOf('crop='),
      vf.indexOf('eq='),
      vf.indexOf('scale=-2:480'),
      vf.indexOf('setpts'),
    ];
    expect(order.every((i) => i >= 0)).toBeTrue();
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  // W1-042: audio export basics.
  it('produces MP3 with libmp3lame for audio output', () => {
    const p = plan({ output: 'audio' });
    expect(p.outExt).toBe('mp3');
    expect(p.mimeType).toBe('audio/mpeg');
    expect(p.suffix).toBe('audio');
    expect(p.args).toContain('-vn');
    expect(p.args).toContain('libmp3lame');
  });

  // W1-043: audio ignores visual options.
  it('ignores crop/rotate/scale for audio output', () => {
    const p = plan({
      output: 'audio',
      aspectRatio: 16 / 9,
      rotate: 'cw90',
      scaleHeight: 720,
    });
    expect(p.args).not.toContain('-vf');
  });

  // W1-044: audio volume.
  it('applies volume gain to MP3 export', () => {
    const p = plan({ output: 'audio', volume: 1.5 });
    expect(p.args[p.args.indexOf('-af') + 1]).toBe('volume=1.50');
  });

  // W1-045: GIF basics.
  it('produces a GIF with the fps/scale chain', () => {
    const p = plan({ output: 'gif' });
    expect(p.outExt).toBe('gif');
    expect(p.mimeType).toBe('image/gif');
    expect(p.suffix).toBe('clip');
    const vf = p.args[p.args.indexOf('-vf') + 1];
    expect(vf).toContain('fps=12');
    expect(vf).toContain('scale=480:-2:flags=lanczos');
  });

  // W1-046: GIF includes visual filters but never scaleHeight/speed.
  it('includes rotate+crop for GIF but not scaleHeight or speed', () => {
    const p = plan({
      output: 'gif',
      rotate: 'cw90',
      aspectRatio: 1,
      scaleHeight: 720,
      speed: 2,
    });
    const vf = p.args[p.args.indexOf('-vf') + 1];
    expect(vf).toContain('transpose=1');
    expect(vf).toContain('crop=');
    expect(vf).not.toContain('scale=-2:720');
    expect(vf).not.toContain('setpts');
  });

  // W1-047: range normalization.
  it('normalizes the trim range (clamp negative, min 1s, floor)', () => {
    const p = buildTrimPlan(MP4, { startSeconds: -5.9, endSeconds: -1 });
    expect(p.args[p.args.indexOf('-ss') + 1]).toBe('0');
    expect(p.args[p.args.indexOf('-t') + 1]).toBe('1');
    const q = buildTrimPlan(MP4, { startSeconds: 1.9, endSeconds: 9.9 });
    expect(q.args[q.args.indexOf('-ss') + 1]).toBe('1');
    expect(q.args[q.args.indexOf('-t') + 1]).toBe('8');
  });

  // W1-052: download suffixes.
  it('derives the download suffix per output', () => {
    expect(plan({}).suffix).toBe('trimmed');
    expect(plan({ aspectRatio: 1 }).suffix).toBe('cropped');
    expect(plan({ output: 'audio' }).suffix).toBe('audio');
    expect(plan({ output: 'gif' }).suffix).toBe('clip');
  });
});

describe('normalizeSegments', () => {
  // W1-048
  it('sorts, clamps and drops invalid segments', () => {
    expect(
      normalizeSegments([
        { start: 30, end: 40 },
        { start: -2, end: 3.9 },
        { start: 10, end: 10 },
        { start: 5, end: 1 },
      ])
    ).toEqual([
      { start: 0, end: 3 },
      { start: 30, end: 40 },
    ]);
  });
});

describe('buildSegmentsPlan', () => {
  // W1-049: overall plan shape.
  it('plans one encode per segment plus a stream-copy concat', () => {
    const p = buildSegmentsPlan(
      { ext: 'webm' },
      {
        segments: [
          { start: 10, end: 20 },
          { start: 0, end: 5 },
        ],
      }
    );
    expect(p.steps.length).toBe(2);
    expect(p.steps.map((s) => s.outputName)).toEqual([
      'seg_0.mp4',
      'seg_1.mp4',
    ]);
    expect(p.listContent).toBe("file 'seg_0.mp4'\nfile 'seg_1.mp4'");
    expect(p.concatArgs.join(' ')).toContain('-f concat -safe 0 -i concat.txt');
    expect(p.concatArgs.join(' ')).toContain('-c copy');
    expect(p.outputName).toBe('joined.mp4');
    expect(p.suffix).toBe('stitched');
    // Sorted: the 0–5 range becomes the first step.
    expect(p.steps[0].args[p.steps[0].args.indexOf('-ss') + 1]).toBe('0');
  });

  // W1-050: per-step args are frame-accurate and share filters.
  it('uses output seeking and shared filters in every step', () => {
    const p = buildSegmentsPlan(
      { ext: 'mp4' },
      {
        segments: [
          { start: 0, end: 5 },
          { start: 10, end: 20 },
        ],
        aspectRatio: 1,
        mute: true,
      }
    );
    for (const step of p.steps) {
      expect(step.args.indexOf('-i')).toBeLessThan(step.args.indexOf('-ss'));
      expect(step.args[step.args.indexOf('-vf') + 1]).toContain('crop=');
      expect(step.args).toContain('libx264');
      expect(step.args).toContain('-an');
    }
  });

  it('throws when no segment survives normalization', () => {
    expect(() =>
      buildSegmentsPlan({ ext: 'mp4' }, { segments: [{ start: 5, end: 5 }] })
    ).toThrow();
  });
});

describe('extensionOf', () => {
  // W1-051
  it('handles case, multi-dot names and missing extensions', () => {
    expect(extensionOf('video.MP4')).toBe('mp4');
    expect(extensionOf('a.b.webm')).toBe('webm');
    expect(extensionOf('noextension')).toBe('mp4');
  });
});
