/** Insert draggedId at targetId's index. Returns null if nothing changes. */
export function moveIdBefore(ids: string[], draggedId: string, targetId: string): string[] | null {
  if (draggedId === targetId) return null;
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}

export type RowBox = { id: string; top: number; bottom: number };

/** Which row the pointer Y is over (for grip drag). Falls back to nearest end. */
export function findDropTargetId(clientY: number, rows: RowBox[]): string | null {
  if (rows.length === 0) return null;
  for (const row of rows) {
    if (clientY >= row.top && clientY < row.bottom) return row.id;
  }
  if (clientY < rows[0]!.top) return rows[0]!.id;
  return rows[rows.length - 1]!.id;
}
