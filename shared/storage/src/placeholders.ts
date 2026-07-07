/** Tauri SQL uses $1, $2; sql.js and libsql use ? */
export const toQuestionPlaceholders = (query: string): string =>
  query.replace(/\$(\d+)/g, '?');
