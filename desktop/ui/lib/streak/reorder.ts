/** Move one id up/down in an ordered list. Returns null if the move is impossible. */
export function moveIdInOrder(ids: string[], id: string, delta: number): string[] | null {
  const from = ids.indexOf(id);
  if (from < 0) return null;
  const to = from + delta;
  if (to < 0 || to >= ids.length) return null;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Insert draggedId before/at targetId (HTML5 drop-on-row). Returns null if nothing changes. */
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
