import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { desktopNativeFetch } from './desktopNativeFetch';

describe('desktopNativeFetch', () => {
  beforeEach(() => { vi.mocked(invoke).mockReset(); });

  it('POSTs via sync_http_fetch and returns a Response', async () => {
    vi.mocked(invoke).mockResolvedValue({ status: 200, body: '{"ok":true}' });
    const res = await desktopNativeFetch('http://100.93.97.83:8787/v1/data', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: '{"data":{}}'
    });
    expect(invoke).toHaveBeenCalledWith('sync_http_fetch', {
      url: 'http://100.93.97.83:8787/v1/data',
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: '{"data":{}}'
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
