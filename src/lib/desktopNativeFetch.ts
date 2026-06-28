import { invoke } from '@tauri-apps/api/core';

type SyncHttpResponse = { status: number; body: string };

const headersToRecord = (headers?: HeadersInit): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((v, k) => { out[k] = v; });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[k] = v;
    return out;
  }
  return { ...headers };
};

/** Desktop sync HTTP via Rust/reqwest — bypasses WKWebView mixed-content limits on plain HTTP. */
export const desktopNativeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
  const headers = headersToRecord(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
  const body = typeof init?.body === 'string' ? init.body : init?.body != null ? String(init.body) : undefined;
  const res = await invoke<SyncHttpResponse>('sync_http_fetch', { url, method, headers, body });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
};
