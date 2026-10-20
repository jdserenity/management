import type { UserDataTable } from './userData';

/**
 * One entry in the server's numbered change log.
 * The server is the referee: it applies a patch, then records the FINAL row
 * it holds under a server-issued sequence number (`seq`). Devices pull changes
 * after their saved `seq` and apply them verbatim — they never compare device
 * clocks or merge two snapshots themselves.
 */
export type SyncChangeOp = 'upsert' | 'delete' | 'snapshot';

export interface SyncChange {
  seq: number;
  /** UserData field name (e.g. `streakLogCells`), or `__snapshot__` for a full-reload marker. */
  entity: UserDataTable | '__snapshot__';
  /** Stable key for the row (composite parts joined with U+001F), or the singleton id. */
  rowKey: string;
  op: SyncChangeOp;
  /** Final server row for `upsert`; null for `delete` / `snapshot`. */
  row: Record<string, unknown> | null;
  /** Delete-key object (shape of that table's `bindDeleteKey` input) for `delete`. */
  key?: Record<string, unknown>;
}

export interface SyncChangesResponse {
  changes: SyncChange[];
  /** Highest seq the server has handed out (0 = empty log). */
  currentSeq: number;
  /** True when `since` is older than the retained log — client must re-bootstrap from a snapshot. */
  snapshotRequired: boolean;
}

export const SYNC_SNAPSHOT_ENTITY = '__snapshot__' as const;
