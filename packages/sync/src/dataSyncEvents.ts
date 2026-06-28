/** Dispatched after a successful pull/merge so UI can reload from SQLite. */
export const DATA_SYNC_REFRESH_EVENT = 'mgmt-data-sync-refresh';

export const dispatchDataSyncRefresh = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DATA_SYNC_REFRESH_EVENT));
  window.dispatchEvent(new Event('mgmt-companion-data-refresh'));
};
