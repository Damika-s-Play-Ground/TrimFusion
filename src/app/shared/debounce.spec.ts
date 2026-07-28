import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  // W2-078: timing behavior.
  it('delays the call until the wait elapses', () => {
    const spy = jasmine.createSpy('fn');
    const d = debounce(spy, 100);
    d();
    expect(spy).not.toHaveBeenCalled();
    jasmine.clock().tick(101);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('coalesces bursts and keeps the latest arguments', () => {
    const spy = jasmine.createSpy('fn');
    const d = debounce(spy, 100);
    d('a');
    jasmine.clock().tick(50);
    d('b');
    jasmine.clock().tick(50);
    d('c');
    jasmine.clock().tick(101);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('c');
  });

  it('cancel prevents the pending call', () => {
    const spy = jasmine.createSpy('fn');
    const d = debounce(spy, 100);
    d();
    d.cancel();
    jasmine.clock().tick(200);
    expect(spy).not.toHaveBeenCalled();
  });
});
