import type {
  Account,
  AccountDetail,
  AudienceTier,
  ChannelLookup,
  Credentials,
  Niche,
  PortfolioSummary,
  TimelinePoint,
  User,
} from './types';

/**
 * In dev, Vite proxies /api to the local server. In production, VITE_API_URL
 * points at the Render service. Netlify redirects also proxy /api, so an
 * unset VITE_API_URL still works when both are deployed together.
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_KEY = 'chai.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = (isJson && (body as any)?.error) || 'Something went wrong. Please try again.';
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(message, res.status, (body as any)?.code);
  }
  return body as T;
}

const post = <T>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) });
const patch = <T>(p: string, body: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T>(p: string) => request<T>(p, { method: 'DELETE' });

export interface PortfolioResponse {
  accounts: Account[];
  summary: PortfolioSummary;
  timeline: TimelinePoint[];
  syncAvailable: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
  demo?: boolean;
}

export const api = {
  health: () => request<{ ok: boolean; database: string; youtubeSync: boolean }>('/health'),
  meta: () => request<{ niches: Niche[]; audienceTiers: AudienceTier[]; syncAvailable: boolean }>('/meta'),

  register: (payload: { email: string; password: string; name?: string }) => post<AuthResponse>('/auth/register', payload),
  login: (payload: { email: string; password: string }) => post<AuthResponse>('/auth/login', payload),
  demo: () => post<AuthResponse>('/auth/demo'),
  me: () => request<{ user: User }>('/auth/me'),
  updateMe: (payload: { name?: string; currency?: string }) => patch<{ user: User }>('/auth/me', payload),

  portfolio: () => request<PortfolioResponse>('/accounts'),
  account: (id: string) => request<{ account: AccountDetail }>(`/accounts/${id}`),
  revealCredentials: (id: string) => post<{ credentials: Credentials }>(`/accounts/${id}/credentials`),

  lookupChannel: (query: string) => post<ChannelLookup>('/accounts/lookup', { query }),
  createAccount: (payload: Record<string, unknown>) => post<{ account: AccountDetail }>('/accounts', payload),
  updateAccount: (id: string, payload: Record<string, unknown>) => patch<{ account: AccountDetail }>(`/accounts/${id}`, payload),
  deleteAccount: (id: string) => del<{ ok: boolean }>(`/accounts/${id}`),

  syncAccount: (id: string) => post<{ account: AccountDetail; sync: { added: number; updated: number; channel: string } }>(`/accounts/${id}/sync`),
  syncAll: () => post<PortfolioResponse & { results: { nickname: string; ok: boolean; error?: string }[] }>('/accounts/sync-all'),

  addVideo: (id: string, payload: Record<string, unknown>) => post<{ account: AccountDetail }>(`/accounts/${id}/videos`, payload),
  updateVideo: (id: string, videoId: string, payload: Record<string, unknown>) =>
    patch<{ account: AccountDetail }>(`/accounts/${id}/videos/${videoId}`, payload),
  deleteVideo: (id: string, videoId: string) => del<{ account: AccountDetail }>(`/accounts/${id}/videos/${videoId}`),
  bulkCost: (id: string, cost: number, onlyEmpty: boolean) => post<{ account: AccountDetail }>(`/accounts/${id}/videos/bulk-cost`, { cost, onlyEmpty }),

  addPayout: (id: string, payload: { period: string; amount: number; note?: string }) =>
    post<{ account: AccountDetail }>(`/accounts/${id}/payouts`, payload),
  deletePayout: (id: string, payoutId: string) => del<{ account: AccountDetail }>(`/accounts/${id}/payouts/${payoutId}`),

  exportUrl: () => `${BASE}/api/export.csv`,
  downloadCsv: async () => {
    const res = await fetch(`${BASE}/api/export.csv`, { headers: { authorization: `Bearer ${tokenStore.get()}` } });
    if (!res.ok) throw new ApiError('Export failed.', res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chai-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
