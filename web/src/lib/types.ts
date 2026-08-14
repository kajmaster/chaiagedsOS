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

  costModel: 'flat' | 'per_minute';
  costPerMinute: number;
  totalMinutes: number;

  videoCount: number;
  totalViews: number;
  avgViews: number;
  avgCostPerVideo: number;
  revenuePerVideo: number;

  health: Health;
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
  costModel: 'flat' | 'per_minute';
  costPerMinute: number;

  notes: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;

  metrics: AccountMetrics;
}

export interface Video {
  id: string;
  accountId: string;
  ytVideoId: string | null;
  title: string;
  thumbnail: string | null;
  publishedAt: string | null;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  cost: number;
  minuteCost: number;
  extraCost: number;
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

export interface NicheSlice {
  niche: string;
  label: string;
  benchmarkRpm: number;
  revenue: number;
  cost: number;
  profit: number;
  views: number;
  accounts: number;
  videos: number;
  share: number;
  effectiveRpm: number;
}

export interface LeaderRow {
  id: string;
  nickname: string;
  nicheLabel: string;
  thumbnail: string | null;
  revenue: number;
  profit: number;
  roi: number | null;
  rpm: number;
  health: Health;
}

export interface AnalyticsResponse {
  range: { key: string; label: string; months: number };
  ranges: { id: string; label: string }[];
  kpis: {
    revenue: number;
    cost: number;
    profit: number;
    roi: number | null;
    margin: number | null;
    blendedRpm: number;
    views: number;
    accounts: number;
    activeAccounts: number;
    videos: number;
    subscribers: number;
    lifetimeRevenue: number;
    lifetimeCost: number;
    lifetimeProfit: number;
    lifetimeRoi: number | null;
  };
  timeline: TimelinePoint[];
  nicheMix: NicheSlice[];
  health: (Health & { count: number })[];
  leaders: { best: LeaderRow[]; worst: LeaderRow[] };
}

export interface ChannelEstimate {
  niche: string;
  nicheLabel: string;
  audienceTier: string;
  tierLabel: string;
  rpm: number;
  rpmRange: { low: number; high: number };
  avgViewsPerVideo: number;
  perVideo: { low: number; mid: number; high: number };
  lifetime: { low: number; mid: number; high: number };
  assumptions: { monetisedShare: number; note: string };
}

export interface ChannelSuggestion {
  niche: string;
  audienceTier: string;
  confident: boolean;
}

export interface ChannelLookup {
  channel: ChannelPreview;
  suggestion: ChannelSuggestion;
  estimate: ChannelEstimate;
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
