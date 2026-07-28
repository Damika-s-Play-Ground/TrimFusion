import { parseTimeString } from './parse-time';

describe('parseTimeString', () => {
  // W2-073: edge cases.
  it('parses plain seconds', () => {
    expect(parseTimeString('90')).toBe(90);
    expect(parseTimeString(' 42 ')).toBe(42);
  });

  it('parses m:ss and h:mm:ss', () => {
    expect(parseTimeString('1:30')).toBe(90);
    expect(parseTimeString('1:02:03')).toBe(3723);
  });

  it('parses fractional seconds', () => {
    expect(parseTimeString('1:23.5')).toBe(83.5);
    expect(parseTimeString('0.25')).toBe(0.25);
  });

  it('rejects sexagesimal digits over 59', () => {
    expect(parseTimeString('1:75')).toBeNull();
    expect(parseTimeString('1:60:00')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseTimeString('')).toBeNull();
    expect(parseTimeString('abc')).toBeNull();
    expect(parseTimeString('1:2:3:4')).toBeNull();
    expect(parseTimeString('-5')).toBeNull();
    expect(parseTimeString('1:.5')).toBeNull();
  });
});
