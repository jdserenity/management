import { createSyncClient, type SyncClient } from '@mgmt/sync';

const DEVICE_ID_KEY = 'mgmt_companion_device_id_v1';

export const getOrCreateCompanionDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `companion-${Date.now()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `companion-${Date.now()}`;
  }
};

export const createCompanionSyncClient = (): SyncClient =>
  createSyncClient({
    role: 'leader',
    apiUrl: import.meta.env.VITE_SYNC_API_URL,
    apiToken: import.meta.env.VITE_SYNC_API_TOKEN,
    deviceId: getOrCreateCompanionDeviceId(),
    memoryBusKey: 'mgmt-companion-local'
  });
