import { describe, expect, it, vi } from 'vitest';
import { installNoZoom, isMultiTouchZoom, preventDefault } from './installNoZoom';

describe('installNoZoom', () => {
  it('preventDefault stops the browser default (the zoom)', () => {
    const e = { preventDefault: vi.fn() } as unknown as Event;
    preventDefault(e);
    expect((e.preventDefault as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('isMultiTouchZoom only matches two-or-more-finger touches', () => {
    expect(isMultiTouchZoom({ touches: [{}] } as unknown as TouchEvent)).toBe(false);
    expect(isMultiTouchZoom({ touches: [{}, {}] } as unknown as TouchEvent)).toBe(true);
  });

  it('registers gesture, multi-touch, wheel and keyboard zoom blockers on the target', () => {
    const target = new EventTarget();
    const addSpy = vi.spyOn(target, 'addEventListener');
    installNoZoom(target as unknown as Document);
    const types = addSpy.mock.calls.map((c) => c[0]);
    expect(types).toEqual(expect.arrayContaining(['gesturestart', 'gesturechange', 'touchmove', 'wheel', 'keydown']));
  });

  it('blocks a gesturestart event (iOS pinch) but lets a one-finger touchmove through', () => {
    const target = new EventTarget();
    installNoZoom(target as unknown as Document);
    const gesture = new Event('gesturestart', { cancelable: true });
    target.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);

    const scroll = new Event('touchmove', { cancelable: true }) as TouchEvent;
    Object.defineProperty(scroll, 'touches', { value: [{}] });
    target.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
  });
});
