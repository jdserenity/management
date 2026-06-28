import { normalizeApiUrl } from './apiUrl';
import { HttpSyncClient } from './httpClient';
import { MemorySyncClient } from './memoryClient';
import type { SyncClient, SyncDeviceRole } from './types';

export interface CreateSyncClientOptions {
  role: SyncDeviceRole;
  apiUrl?: string;
  apiToken?: string;
  deviceId?: string;
  memoryBusKey?: string;
}

export const createSyncClient = (options: CreateSyncClientOptions): SyncClient => {
  const url = normalizeApiUrl(options.apiUrl);
  const token = options.apiToken?.trim();
  if (url && token) {
    if (import.meta.env?.DEV) console.info(`[sync] HTTP client → ${url}`);
    return new HttpSyncClient({
      baseUrl: url,
      token,
      role: options.role,
      deviceId: options.deviceId
    });
  }
  if (import.meta.env?.DEV) {
    console.warn(
      '[sync] server URL or token missing — using in-memory bus only (other apps will not see updates).'
    );
  }
  return new MemorySyncClient(options.memoryBusKey ?? 'default', {
    role: options.role,
    deviceId: options.deviceId
  });
};
