/**
 * Shareable editor-settings state: serialize the control values into a URL
 * fragment and parse them back (tolerantly) on load. Also the snapshot type
 * for undo/redo. Files never travel in links — settings only.
 */

import { RotateOption, TrimOutput } from '@services/ffmpeg-args';

export interface EditorState {
  start: number;
  end: number;
  output: TrimOutput;
  aspect: number | null;
  rotate: RotateOption | null;
  brightness: number;
  contrast: number;
  saturation: number;
  speed: number;
  mute: boolean;
  volume: number;
  scale: number | null;
  precise: boolean;
  crf: number;
  fps: number | null;
  encodePreset: 'veryfast' | 'medium';
  gifFps: number;
  gifWidth: number;
  mp3Bitrate: number | null;
  mp3SampleRate: number | null;
  effect: string;
  fadeIn: boolean;
  fadeOut: boolean;
}

export const DEFAULT_STATE: EditorState = {
  start: 0,
  end: 60,
  output: 'video',
  aspect: null,
  rotate: null,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  speed: 1,
  mute: false,
  volume: 1,
  scale: null,
  precise: false,
  crf: 23,
  fps: null,
  encodePreset: 'veryfast',
  gifFps: 12,
  gifWidth: 480,
  mp3Bitrate: null,
  mp3SampleRate: null,
  effect: 'none',
  fadeIn: false,
  fadeOut: false,
};

const OUTPUTS: TrimOutput[] = ['video', 'audio', 'gif'];
const ROTATES: RotateOption[] = ['cw90', 'cw180', 'cw270', 'hflip', 'vflip'];
const EFFECTS = ['none', 'reverse', 'loop2', 'loop3', 'boomerang'];
const PRESETS = ['veryfast', 'medium'];

/** Compact key per field (stable — links live in the wild). */
const KEYS: Record<keyof EditorState, string> = {
  start: 's',
  end: 'e',
  output: 'o',
  aspect: 'a',
  rotate: 'r',
  brightness: 'b',
  contrast: 'c',
  saturation: 'sat',
  speed: 'sp',
  mute: 'm',
  volume: 'v',
  scale: 'sc',
  precise: 'p',
  crf: 'q',
  fps: 'f',
  encodePreset: 'ep',
  gifFps: 'gf',
  gifWidth: 'gw',
  mp3Bitrate: 'mb',
  mp3SampleRate: 'mr',
  effect: 'fx',
  fadeIn: 'fi',
  fadeOut: 'fo',
};

/** Fragment params (no leading '#'); only non-default values are included. */
export function serializeState(state: EditorState): string {
  const params = new URLSearchParams();
  for (const field of Object.keys(KEYS) as (keyof EditorState)[]) {
    const value = state[field];
    const fallback = DEFAULT_STATE[field];
    if (value === fallback || value === null) {
      continue;
    }
    if (typeof value === 'boolean') {
      params.set(KEYS[field], '1');
    } else if (typeof value === 'number') {
      params.set(KEYS[field], String(Math.round(value * 10000) / 10000));
    } else {
      params.set(KEYS[field], String(value));
    }
  }
  return params.toString();
}

/** Tolerant parse: unknown keys ignored, bad numbers/enums dropped. */
export function parseState(fragment: string): Partial<EditorState> {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const out: Partial<EditorState> = {};
  const num = (key: string): number | null => {
    const raw = params.get(key);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return isFinite(value) ? value : null;
  };
  const bool = (key: string): boolean | null =>
    params.has(key) ? params.get(key) === '1' : null;

  const setNum = (field: keyof EditorState, key: string) => {
    const value = num(key);
    if (value !== null) {
      (out as Record<string, unknown>)[field] = value;
    }
  };
  const setBool = (field: keyof EditorState, key: string) => {
    const value = bool(key);
    if (value !== null) {
      (out as Record<string, unknown>)[field] = value;
    }
  };

  setNum('start', 's');
  setNum('end', 'e');
  setNum('aspect', 'a');
  setNum('brightness', 'b');
  setNum('contrast', 'c');
  setNum('saturation', 'sat');
  setNum('speed', 'sp');
  setNum('volume', 'v');
  setNum('scale', 'sc');
  setNum('crf', 'q');
  setNum('fps', 'f');
  setNum('gifFps', 'gf');
  setNum('gifWidth', 'gw');
  setNum('mp3Bitrate', 'mb');
  setNum('mp3SampleRate', 'mr');
  setBool('mute', 'm');
  setBool('precise', 'p');
  setBool('fadeIn', 'fi');
  setBool('fadeOut', 'fo');

  const output = params.get('o');
  if (output && OUTPUTS.includes(output as TrimOutput)) {
    out.output = output as TrimOutput;
  }
  const rotate = params.get('r');
  if (rotate && ROTATES.includes(rotate as RotateOption)) {
    out.rotate = rotate as RotateOption;
  }
  const effect = params.get('fx');
  if (effect && EFFECTS.includes(effect)) {
    out.effect = effect;
  }
  const preset = params.get('ep');
  if (preset && PRESETS.includes(preset)) {
    out.encodePreset = preset as 'veryfast' | 'medium';
  }
  return out;
}
