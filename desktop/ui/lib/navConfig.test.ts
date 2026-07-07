import { describe, expect, it, vi } from 'vitest';
import { companionNavItems, desktopNavItems, NAV_GO_TO_WORK, requestGoToWorkTab } from './navConfig';

describe('navConfig', () => {
  it('excludes posture on companion', () => {
    const ids = companionNavItems().map((item) => item.id);
    expect(ids).not.toContain('posture');
    expect(ids).toEqual(['daily', 'work', 'stats', 'customize', 'settings']);
  });

  it('keeps full desktop nav including posture', () => {
    expect(desktopNavItems().map((item) => item.id)).toContain('posture');
  });

  it('requestGoToWorkTab dispatches NAV_GO_TO_WORK', () => {
    const dispatch = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: dispatch });
    requestGoToWorkTab();
    expect(dispatch).toHaveBeenCalledOnce();
    expect((dispatch.mock.calls[0][0] as Event).type).toBe(NAV_GO_TO_WORK);
    vi.unstubAllGlobals();
  });
});
