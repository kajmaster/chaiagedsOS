import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from '@/store/AppStore';
import { Shell } from '@/components/Shell';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Channels } from '@/pages/Channels';
import { ChannelDetail } from '@/pages/ChannelDetail';
import { Analytics } from '@/pages/Analytics';
import { Settings } from '@/pages/Settings';

function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-brass-sheen text-lg font-bold text-ink-950">
          C
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">Loading your portfolio</span>
      </div>
    </div>
  );
}

function Routed() {
  const { user, booting } = useApp();

  if (booting) return <Booting />;
  if (!user) return <Login />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/channels/:id" element={<ChannelDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routed />
      </AppProvider>
    </BrowserRouter>
  );
}
