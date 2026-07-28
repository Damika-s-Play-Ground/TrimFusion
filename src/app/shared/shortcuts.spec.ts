import {
  actionForKey,
  isTypingTarget,
  SHORTCUT_MAP,
  ShortcutAction,
} from './shortcuts';

describe('SHORTCUT_MAP', () => {
  const ALL_ACTIONS: ShortcutAction[] = [
    'playPause',
    'setIn',
    'setOut',
    'shuttleBack',
    'pause',
    'shuttleForward',
    'seekBack',
    'seekForward',
    'frameBack',
    'frameForward',
    'muteToggle',
    'zoomIn',
    'zoomOut',
    'addSegment',
    'export',
    'cheatSheet',
  ];

  // W2-075: completeness — every editor action has a binding.
  it('binds every editor action at least once', () => {
    const bound = new Set(Object.values(SHORTCUT_MAP));
    for (const action of ALL_ACTIONS) {
      expect(bound.has(action)).withContext(action).toBeTrue();
    }
  });

  // W2-075: no accidental duplicates (only + and = share zoomIn).
  it('has no accidental duplicate bindings', () => {
    const keysByAction = new Map<string, string[]>();
    for (const [key, action] of Object.entries(SHORTCUT_MAP)) {
      keysByAction.set(action, [...(keysByAction.get(action) ?? []), key]);
    }
    for (const [action, keys] of keysByAction) {
      if (action === 'zoomIn') {
        expect([...keys].sort()).toEqual(['+', '=']);
      } else {
        expect(keys.length).withContext(action).toBe(1);
      }
    }
  });

  it('resolves keys case-insensitively and unknown keys to null', () => {
    expect(actionForKey('I')).toBe('setIn');
    expect(actionForKey('ArrowLeft')).toBe('seekBack');
    expect(actionForKey('q')).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('detects form fields and contenteditable', () => {
    expect(isTypingTarget(document.createElement('input'))).toBeTrue();
    expect(isTypingTarget(document.createElement('textarea'))).toBeTrue();
    expect(isTypingTarget(document.createElement('select'))).toBeTrue();
    expect(isTypingTarget(document.createElement('div'))).toBeFalse();
    expect(isTypingTarget(null)).toBeFalse();
  });
});
