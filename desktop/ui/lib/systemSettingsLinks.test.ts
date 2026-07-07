import { describe, expect, it, vi, beforeEach } from 'vitest';
import { openSystemSettings } from './systemSettingsLinks';

const execute = vi.fn();
const platform = vi.fn();
const open = vi.fn();
const alert = vi.fn();

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { create: () => ({ execute }) },
  open: (...args: unknown[]) => open(...args)
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => platform()
}));

describe('openSystemSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', alert);
  });

  it('opens macOS camera privacy pane', async () => {
    platform.mockResolvedValue('macos');
    await openSystemSettings('camera');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('opens Windows notification settings', async () => {
    platform.mockResolvedValue('windows');
    await openSystemSettings('notifications');
    expect(open).toHaveBeenCalledWith('ms-settings:notifications');
  });

  it('alerts on Linux camera with guidance', async () => {
    platform.mockResolvedValue('linux');
    await openSystemSettings('camera');
    expect(alert).toHaveBeenCalledOnce();
    expect(String(alert.mock.calls[0][0])).toContain('Linux');
  });
});
