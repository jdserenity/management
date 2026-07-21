export type RowBox = { id: string; top: number; bottom: number };

/**
 * Where the dragged row should sit among the *other* rows (0 = before first other,
 * others.length = after last). Uses midpoints so crossing half a row flips the slot.
 * `rows` must be in current visual order; safe to re-measure every move if the DOM
 * order is not changing during the drag.
 */
export function findInsertIndex(clientY: number, rows: RowBox[], draggedId: string): number {
  const others = rows.filter((r) => r.id !== draggedId);
  for (let i = 0; i < others.length; i++) {
    const mid = (others[i]!.top + others[i]!.bottom) / 2;
    if (clientY < mid) return i;
  }
  return others.length;
}

/** Place draggedId at insertIndex among the non-dragged ids. Null if unchanged. */
export function moveIdToInsertIndex(ids: string[], draggedId: string, insertIndex: number): string[] | null {
  const from = ids.indexOf(draggedId);
  if (from < 0) return null;
  const without = ids.filter((id) => id !== draggedId);
  const clamped = Math.max(0, Math.min(insertIndex, without.length));
  const next = [...without.slice(0, clamped), draggedId, ...without.slice(clamped)];
  if (next.length === ids.length && next.every((id, i) => id === ids[i])) return null;
  return next;
}
