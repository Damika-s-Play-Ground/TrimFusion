import {
  DEFAULT_STATE,
  EditorState,
  parseState,
  serializeState,
} from './url-state';

describe('url-state', () => {
  // W2-077: round-trip.
  it('round-trips a non-default state', () => {
    const state: EditorState = {
      ...DEFAULT_STATE,
      start: 10,
      end: 42,
      output: 'gif',
      aspect: 1,
      rotate: 'cw90',
      brightness: 0.2,
      speed: 2,
      mute: true,
      gifFps: 15,
      effect: 'boomerang',
      fadeIn: true,
    };
    const parsed = parseState(serializeState(state));
    expect(parsed['start']).toBe(10);
    expect(parsed['end']).toBe(42);
    expect(parsed['output']).toBe('gif');
    expect(parsed['aspect']).toBe(1);
    expect(parsed['rotate']).toBe('cw90');
    expect(parsed['brightness']).toBe(0.2);
    expect(parsed['speed']).toBe(2);
    expect(parsed['mute']).toBeTrue();
    expect(parsed['gifFps']).toBe(15);
    expect(parsed['effect']).toBe('boomerang');
    expect(parsed['fadeIn']).toBeTrue();
  });

  it('serializes the default state to an empty string', () => {
    expect(serializeState({ ...DEFAULT_STATE })).toBe('');
  });

  it('ignores unknown keys and garbage values', () => {
    const parsed = parseState('#zz=1&s=abc&sp=NaN&o=exe');
    expect(parsed['start']).toBeUndefined();
    expect(parsed['speed']).toBeUndefined();
    expect(parsed['output']).toBeUndefined();
  });

  it('drops invalid enum values but keeps valid siblings', () => {
    const parsed = parseState('r=diagonal&fx=boomerang&ep=ultrafast');
    expect(parsed['rotate']).toBeUndefined();
    expect(parsed['effect']).toBe('boomerang');
    expect(parsed['encodePreset']).toBeUndefined();
  });

  it('parses partial fragments', () => {
    const parsed = parseState('s=5&e=25');
    expect(parsed).toEqual({ start: 5, end: 25 });
  });
});
