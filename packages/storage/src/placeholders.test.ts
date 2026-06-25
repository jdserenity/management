import { describe, expect, it } from 'vitest';
import { toQuestionPlaceholders } from './placeholders';

describe('toQuestionPlaceholders', () => {
  it('rewrites $n binds to ? for sql.js/libsql', () => {
    expect(toQuestionPlaceholders('SELECT * FROM app_kv WHERE key = $1 LIMIT 1')).toBe(
      'SELECT * FROM app_kv WHERE key = ? LIMIT 1'
    );
    expect(toQuestionPlaceholders('INSERT INTO t (a,b) VALUES ($1, $2)')).toBe('INSERT INTO t (a,b) VALUES (?, ?)');
  });
});
