/** Pure keyboard-shortcut map: key → editor action. */

export type ShortcutAction =
  | 'playPause'
  | 'setIn'
  | 'setOut'
  | 'shuttleBack'
  | 'pause'
  | 'shuttleForward'
  | 'seekBack'
  | 'seekForward'
  | 'frameBack'
  | 'frameForward'
  | 'muteToggle'
  | 'zoomIn'
  | 'zoomOut'
  | 'addSegment'
  | 'export'
  | 'cheatSheet';

export const SHORTCUT_MAP: Record<string, ShortcutAction> = {
  ' ': 'playPause',
  i: 'setIn',
  o: 'setOut',
  j: 'shuttleBack',
  k: 'pause',
  l: 'shuttleForward',
  arrowleft: 'seekBack',
  arrowright: 'seekForward',
  ',': 'frameBack',
  '.': 'frameForward',
  m: 'muteToggle',
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  s: 'addSegment',
  e: 'export',
  '?': 'cheatSheet',
};

export function actionForKey(key: string): ShortcutAction | null {
  return SHORTCUT_MAP[key.toLowerCase()] ?? null;
}

/** True when the event target is a place where the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) {
    return false;
  }
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    !!el.isContentEditable
  );
}
