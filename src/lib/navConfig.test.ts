import { describe, expect, it } from 'vitest';
import { companionNavItems, desktopNavItems } from './navConfig';

describe('navConfig', () => {
  it('excludes posture on companion', () => {
    const ids = companionNavItems().map((item) => item.id);
    expect(ids).not.toContain('posture');
    expect(ids).toEqual(['daily', 'work', 'stats', 'customize', 'settings']);
  });

  it('keeps full desktop nav including posture', () => {
    expect(desktopNavItems().map((item) => item.id)).toContain('posture');
  });
});
