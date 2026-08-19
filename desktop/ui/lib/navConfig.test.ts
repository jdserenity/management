import { describe, expect, it, vi } from 'vitest';
import { FEATURE_POSTURE, FEATURE_WORK } from './features';
import { companionNavItems, desktopNavItems, NAV_GO_TO_WORK, requestGoToWorkTab } from './navConfig';

describe('navConfig', () => {
  it('desktop nav is daily → stats → customize → settings while Work and Posture are parked', () => {
    expect(desktopNavItems().map((item) => item.id)).toEqual(['daily', 'stats', 'customize', 'settings']);
  });

  it('companion nav matches desktop minus posture and follows Work switch', () => {
    const ids = companionNavItems().map((item) => item.id);
    expect(ids).not.toContain('posture');
    expect(ids.includes('work')).toBe(FEATURE_WORK);
    expect(ids).toEqual(['daily', 'stats', 'customize', 'settings']);
  });

  it('desktop nav includes work and posture only when those switches are on', () => {
    const ids = desktopNavItems().map((item) => item.id);
    expect(ids.includes('work')).toBe(FEATURE_WORK);
    expect(ids.includes('posture')).toBe(FEATURE_POSTURE);
  });

  it('requestGoToWorkTab is a no-op when Work is parked', () => {
    const dispatch = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: dispatch });
    requestGoToWorkTab();
    if (FEATURE_WORK) {
      expect(dispatch).toHaveBeenCalledOnce();
      expect((dispatch.mock.calls[0][0] as Event).type).toBe(NAV_GO_TO_WORK);
    } else {
      expect(dispatch).not.toHaveBeenCalled();
    }
    vi.unstubAllGlobals();
  });
});
