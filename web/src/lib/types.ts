export type Tone = 'emerald' | 'amber' | 'rose' | 'slate';

export interface Health {
  key: 'scaling' | 'profitable' | 'recovering' | 'nearing' | 'bleeding' | 'pending' | 'idle';
  label: string;
  tone: Tone;
}

export interface Rpm {
  rpm: number;
  potentialRpm?: number;
  low: number;
  high: number;
  source: 'override' | 'estimated';
}

export interface AccountMetrics {
  spark: number[];
  rpm: Rpm;
  nicheLabel: string;
  tierLabel: string;
  monthsHeld: number;

  revenue: number;
  estimatedRevenue: number;
  payoutRevenue: number;
  revenueSource: 'actual' | 'estimated';

  acquisitionCost: number;
  productionCost: number;
  overheadCost: number;
  totalCost: number;

  profit: number;
  roi: number | null;
  margin: number | null;

  recentRevenue: number;
  recentCost: number;
  netCashflow30d: number;
  isCashflowing: boolean;
  isProfitable: boolean;

  breakevenPct: number;
  amountToBreakeven: number;
  monthsToBreakeven: number | null;

  videoCount: number;
  totalViews: number;
  avgViews: number;
  avgCostPerVideo: number;
  revenuePerVideo: number;

  health: Health;
}

export interface Credentials {
  username: string | null;
  email: string | null;
  password: string | null;
  twoFactor: string | null;
  recoveryEmail: string | null;
}

export interface Account {
  id: string;
  nickname: string;
  niche: string;
  nicheLabel: string;
  audienceTier: string;
  audienceTierLabel: string;
  status: 'active' | 'warming' | 'paused' | 'sold' | 'banned';

  channelUrl: string | null;
  channelId: string | null;
  handle: string | null;
  thumbnail: string | null;

  accountCreatedAt: string | null;
  acquiredAt: string | null;
  acquisitionCost: number;
  monthlyCost: number;

  subscribers: number;
  totalViews: number;
  videoCount: number;

  monetized: boolean;
  rpmOverride: number | null;

  notes: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;

  credentials: Credentials;
  metrics: AccountMetrics;
}

export interface Video {
  id: string;
  accountId: string;
  ytVideoId: string | null;
  title: string;
  thumbnail: string | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  cost: number;
  revenue: number;
  estimatedRevenue: number;
  revenueIsActual: boolean;
  profit: number;
  roi: number | null;
  cpv: number | null;
  ageDays: number | null;
  source: string;
}

export interface Payout {
  id: string;
  period: string;
  amount: number;
  note: string | null;
}

export interface AccountDetail extends Account {
  videos: Video[];
  payouts: Payout[];
}

export interface PortfolioSummary {
  accounts: number;
  activeAccounts: number;
  revenue: number;
  cost: number;
  profit: number;
  roi: number | null;
  margin: number | null;
  netCashflow30d: number;
  invested: number;
  production: number;
  overhead: number;
  subscribers: number;
  views: number;
  videos: number;
  profitableCount: number;
  cashflowingCount: number;
  bleedingCount: number;
  breakevenPct: number;
  bestPerformer: { id: string; nickname: string; profit: number } | null;
  worstPerformer: { id: string; nickname: string; profit: number } | null;
}

export interface TimelinePoint {
  key: string;
  label: string;
  year: number;
  revenue: number;
  cost: number;
  profit: number;
  views: number;
}

export interface Niche {
  id: string;
  label: string;
  rpm: number;
  low: number;
  high: number;
  cpmDemand: 'elite' | 'high' | 'mid' | 'low';
}

export interface AudienceTier {
  id: string;
  label: string;
  multiplier: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  isDemo: boolean;
  currency: string;
  createdAt: string;
}

export interface ChannelPreview {
  channelId: string;
  title: string;
  handle: string | null;
  description: string;
  thumbnail: string | null;
  country: string | null;
  publishedAt: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  url: string;
}
