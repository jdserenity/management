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
  const url = options.apiUrl?.trim();
  const token = options.apiToken?.trim();
  if (url && token) {
    return new HttpSyncClient({
      baseUrl: url,
      token,
      role: options.role,
      deviceId: options.deviceId
    });
  }
  return new MemorySyncClient(options.memoryBusKey ?? 'default', {
    role: options.role,
    deviceId: options.deviceId
  });
};
