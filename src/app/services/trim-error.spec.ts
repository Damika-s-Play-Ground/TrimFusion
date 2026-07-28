import {
  classifyError,
  messageFor,
  TrimError,
  TrimErrorCode,
} from './trim-error';

describe('TrimError taxonomy', () => {
  const CODES: TrimErrorCode[] = [
    'LOAD_FAILED',
    'ENCODE_FAILED',
    'OOM',
    'CANCELLED',
    'INVALID_INPUT',
  ];

  it('has a distinct user-facing message for every code', () => {
    const messages = CODES.map((c) => messageFor(c));
    expect(messages.every((m) => m.length > 10)).toBeTrue();
    expect(new Set(messages).size).toBe(CODES.length);
  });

  it('carries its code and a default message', () => {
    const err = new TrimError('OOM');
    expect(err.code).toBe('OOM');
    expect(err.name).toBe('TrimError');
    expect(err.message).toBe('OOM');
  });

  it('passes TrimErrors through classification unchanged', () => {
    const original = new TrimError('LOAD_FAILED', 'cdn down');
    expect(classifyError(original, false)).toBe(original);
  });

  it('classifies anything as CANCELLED when a cancel was requested', () => {
    expect(classifyError(new Error('called exit'), true).code).toBe(
      'CANCELLED'
    );
  });

  it('detects out-of-memory failures from the message', () => {
    expect(classifyError(new Error('abort(OOM)'), false).code).toBe('OOM');
    expect(classifyError(new Error('Cannot allocate memory'), false).code).toBe(
      'OOM'
    );
  });

  it('falls back to ENCODE_FAILED for unknown errors', () => {
    expect(classifyError(new Error('boom'), false).code).toBe('ENCODE_FAILED');
    expect(classifyError('string error', false).code).toBe('ENCODE_FAILED');
  });
});
