import { extractVideoId } from './rendering-page.component';

const ID = 'dQw4w9WgXcQ';

describe('extractVideoId', () => {
  it('parses a standard watch URL', () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('parses a watch URL with extra params (&t, &list)', () => {
    expect(
      extractVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`)
    ).toBe(ID);
  });

  it('parses a watch URL where v is not the first param', () => {
    expect(
      extractVideoId(`https://www.youtube.com/watch?list=PL123&v=${ID}`)
    ).toBe(ID);
  });

  it('parses a youtu.be short link', () => {
    expect(extractVideoId(`https://youtu.be/${ID}`)).toBe(ID);
  });

  it('parses a youtu.be link with a timestamp', () => {
    expect(extractVideoId(`https://youtu.be/${ID}?t=30`)).toBe(ID);
  });

  it('parses a /shorts/ URL', () => {
    expect(extractVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it('parses an /embed/ URL', () => {
    expect(extractVideoId(`https://www.youtube.com/embed/${ID}?rel=0`)).toBe(ID);
  });

  it('parses a /live/ URL', () => {
    expect(extractVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
  });

  it('parses an m.youtube.com URL', () => {
    expect(extractVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('parses a URL without a protocol', () => {
    expect(extractVideoId(`youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('accepts a bare 11-character ID', () => {
    expect(extractVideoId(ID)).toBe(ID);
  });

  it('trims surrounding whitespace', () => {
    expect(extractVideoId(`  https://youtu.be/${ID}  `)).toBe(ID);
  });

  it('returns null for an empty string', () => {
    expect(extractVideoId('')).toBeNull();
  });

  it('returns null for a non-YouTube URL', () => {
    expect(extractVideoId('https://vimeo.com/123456789')).toBeNull();
  });

  it('returns null for a YouTube URL with no video id', () => {
    expect(extractVideoId('https://www.youtube.com/feed/subscriptions')).toBeNull();
  });

  it('returns null for a too-short id', () => {
    expect(extractVideoId('https://youtu.be/abc')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(extractVideoId('not a url at all')).toBeNull();
  });
});
