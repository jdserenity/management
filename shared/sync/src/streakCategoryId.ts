/**
 * category_id sync rules:
 * - '' on the wire = intentional clear (store NULL locally/on server)
 * - non-empty string = set membership
 * - null / undefined / missing key on apply = keep the existing local value
 *   (old change-log rows and stale devices omit or null the field; replacing
 *   would wipe a category the user just assigned)
 */

/** null = sticky keep on server / omit; '' = intentional clear; id = assign. */
export const categoryIdForSyncBind = (categoryId: string | null | undefined): string | null =>
  categoryId == null ? null : (categoryId || '');

export const resolveIncomingCategoryId = (
  incoming: { category_id?: string | null },
  localCategoryId: string | null | undefined
): string | null => {
  if (!Object.prototype.hasOwnProperty.call(incoming, 'category_id')) return localCategoryId ?? null;
  const v = incoming.category_id;
  if (v === null || v === undefined) return localCategoryId ?? null;
  if (v === '') return null;
  return String(v);
};

/** Server ON CONFLICT SET expression: null keeps existing; '' clears; else assigns. */
export const serverCategoryIdUpsertExpression = (table = 'streak_activities'): string =>
  `category_id=CASE WHEN excluded.category_id IS NULL THEN ${table}.category_id WHEN excluded.category_id = '' THEN NULL ELSE excluded.category_id END`;
