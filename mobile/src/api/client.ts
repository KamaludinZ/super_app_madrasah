import { API_URL, REQUEST_TIMEOUT_MS } from '@/config';

export type ErrorDetail = { error_type?: string; message?: string; validation?: unknown; [k: string]: unknown };

export class ApiError extends Error {
  status: number;
  detail: ErrorDetail | string | null;
  /** true bila gagal karena jaringan/timeout (bukan jawaban server). */
  network: boolean;

  constructor(message: string, status: number, detail: ErrorDetail | string | null = null, network = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.network = network;
  }

  get errorType(): string | undefined {
    return typeof this.detail === 'object' && this.detail ? this.detail.error_type : undefined;
  }
}

export const isNetworkError = (e: unknown) => e instanceof ApiError && e.network;

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (t: string | null) => { authToken = t; };
export const getAuthToken = () => authToken;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

/** Pesan ramah dari field `detail` respons API (string atau objek {message}). */
export function errorMessage(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  if (e instanceof ApiError) {
    if (e.network) return e.message;
    if (typeof e.detail === 'string' && e.detail) return e.detail;
    if (e.detail && typeof e.detail === 'object') {
      if (typeof e.detail.message === 'string') return e.detail.message;
      if (Array.isArray((e.detail as any))) {
        const first = (e.detail as any)[0];
        if (first?.msg) return `${first.loc?.slice(-1)[0] ?? ''}: ${first.msg}`.trim();
      }
    }
    return e.message || fallback;
  }
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
  timeoutMs?: number;
  /** Jangan panggil handler 401 (dipakai saat proses login/pemulihan sesi). */
  silent401?: boolean;
};

export function buildQuery(q?: Options['query']): string {
  if (!q) return '';
  const parts = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Permintaan ke API: Authorization Bearer, timeout 15 dtk, error dari field `detail`. */
export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const token = opts.token === undefined ? authToken : opts.token;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${buildQuery(opts.query)}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    const timedOut = e?.name === 'AbortError';
    throw new ApiError(
      timedOut ? 'Server tidak merespons (15 detik). Periksa koneksi Anda.' : 'Tidak dapat terhubung ke server. Periksa koneksi internet.',
      0, null, true,
    );
  }
  clearTimeout(timer);

  const text = await res.text();
  let json: any = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  if (res.status === 401 && !opts.silent401) onUnauthorized?.();
  if (!res.ok) {
    const detail = json?.detail ?? (text ? text.slice(0, 300) : null);
    const msg = typeof detail === 'string' ? detail : detail?.message || `Permintaan gagal (${res.status})`;
    throw new ApiError(msg, res.status, detail);
  }
  return json as T;
}
