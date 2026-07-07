import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { createSqlJsDatabase } from '@mgmt/storage';

export const createCompanionSqlJsDatabase = () => createSqlJsDatabase(initSqlJs, wasmUrl);
