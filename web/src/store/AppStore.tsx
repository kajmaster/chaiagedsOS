import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, tokenStore } from '@/lib/api';
import type { Account, AudienceTier, Niche, PortfolioSummary, TimelinePoint, User } from '@/lib/types';

interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: 'success' | 'error' | 'info';
}

interface AppState {
  user: User | null;
  booting: boolean;
  accounts: Account[];
  summary: PortfolioSummary | null;
  timeline: TimelinePoint[];
  niches: Niche[];
  audienceTiers: AudienceTier[];
  syncAvailable: boolean;
  exactRevenueAvailable: boolean;
  loadingPortfolio: boolean;
  toasts: Toast[];

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  startDemo: () => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  syncAll: () => Promise<void>;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setUser: (u: User) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [audienceTiers, setAudienceTiers] = useState<AudienceTier[]>([]);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [exactRevenueAvailable, setExactRevenueAvailable] = useState(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    setLoadingPortfolio(true);
    try {
      const data = await api.portfolio();
      setAccounts(data.accounts);
      setSummary(data.summary);
      setTimeline(data.timeline);
      setSyncAvailable(data.syncAvailable);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        tokenStore.clear();
        setUser(null);
      } else {
        toast({ title: 'Could not load your portfolio', detail: (err as Error).message, tone: 'error' });
      }
    } finally {
      setLoadingPortfolio(false);
    }
  }, [toast]);

  const bootstrap = useCallback(async () => {
    try {
      const meta = await api.meta();
      setNiches(meta.niches);
      setAudienceTiers(meta.audienceTiers);
      setSyncAvailable(meta.syncAvailable);
      setExactRevenueAvailable(Boolean(meta.exactRevenueAvailable));
    } catch {
      /* meta is decorative on the login screen; ignore failures there */
    }

    if (!tokenStore.get()) {
      setBooting(false);
      return;
    }
    try {
      const { user: me } = await api.me();
      setUser(me);
      await refresh();
    } catch {
      tokenStore.clear();
    } finally {
      setBooting(false);
    }
  }, [refresh]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const adopt = useCallback(
    async (res: { token: string; user: User }) => {
      tokenStore.set(res.token);
      setUser(res.user);
      await refresh();
    },
    [refresh]
  );

  const login = useCallback(async (email: string, password: string) => adopt(await api.login({ email, password })), [adopt]);

  const register = useCallback(
    async (email: string, password: string, name?: string) => adopt(await api.register({ email, password, name })),
    [adopt]
  );

  const startDemo = useCallback(async () => {
    const res = await api.demo();
    await adopt(res);
  }, [adopt]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setAccounts([]);
    setSummary(null);
    setTimeline([]);
  }, []);

  const syncAll = useCallback(async () => {
    try {
      const data = await api.syncAll();
      setAccounts(data.accounts);
      setSummary(data.summary);
      setTimeline(data.timeline);
      const failed = data.results.filter((r) => !r.ok);
      toast({
        title: `Synced ${data.results.length - failed.length} of ${data.results.length} channels`,
        detail: failed.length ? `${failed[0].nickname}: ${failed[0].error}` : 'Live stats pulled from YouTube.',
        tone: failed.length ? 'info' : 'success',
      });
    } catch (err) {
      toast({ title: 'Sync failed', detail: (err as Error).message, tone: 'error' });
    }
  }, [toast]);

  const value = useMemo<AppState>(
    () => ({
      user,
      booting,
      accounts,
      summary,
      timeline,
      niches,
      audienceTiers,
      syncAvailable,
      exactRevenueAvailable,
      loadingPortfolio,
      toasts,
      login,
      register,
      startDemo,
      logout,
      refresh,
      syncAll,
      toast,
      dismissToast,
      setUser,
    }),
    [
      user, booting, accounts, summary, timeline, niches, audienceTiers, syncAvailable,
      loadingPortfolio, toasts, login, register, startDemo, logout, refresh, syncAll, toast, dismissToast,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
