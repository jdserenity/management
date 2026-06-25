declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  export interface Database {
    run(sql: string, params?: (string | number | null)[]): void;
    prepare(sql: string): Statement;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    export(): Uint8Array;
    getRowsModified(): number;
    close(): void;
  }
  export interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }
  export type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  const initSqlJs: InitSqlJs;
  export default initSqlJs;
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
