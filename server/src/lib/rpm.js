/**
 * Niche RPM intelligence.
 *
 * The whole point of the product: the customer should never have to type a
 * revenue number. We estimate it. `rpm` is USD earned per 1,000 monetised
 * views for a tier-1 (US/UK/CA/AU) audience, then scaled by audience geo.
 *
 * Numbers are blended long-form YouTube Partner Program payouts. `low`/`high`
 * drive the confidence band shown in the UI.
 */

export const NICHES = [
  { id: 'finance',       label: 'Finance & Investing',    rpm: 22.0, low: 14, high: 34, cpmDemand: 'elite'  },
  { id: 'real_estate',   label: 'Real Estate',            rpm: 18.0, low: 11, high: 28, cpmDemand: 'elite'  },
  { id: 'business',      label: 'Business & Startups',    rpm: 16.5, low: 10, high: 26, cpmDemand: 'elite'  },
  { id: 'ai',            label: 'AI & Automation',        rpm: 15.0, low: 9,  high: 24, cpmDemand: 'elite'  },
  { id: 'crypto',        label: 'Crypto & Web3',          rpm: 13.5, low: 7,  high: 24, cpmDemand: 'high'   },
  { id: 'tech',          label: 'Tech & Software',        rpm: 12.0, low: 7,  high: 19, cpmDemand: 'high'   },
  { id: 'insurance',     label: 'Insurance & Legal',      rpm: 20.0, low: 12, high: 32, cpmDemand: 'elite'  },
  { id: 'luxury',        label: 'Luxury & Watches',       rpm: 9.5,  low: 6,  high: 15, cpmDemand: 'high'   },
  { id: 'self_improve',  label: 'Self-Improvement',       rpm: 7.5,  low: 4,  high: 12, cpmDemand: 'high'   },
  { id: 'true_crime',    label: 'True Crime',             rpm: 7.0,  low: 4,  high: 11, cpmDemand: 'mid'    },
  { id: 'automotive',    label: 'Automotive',             rpm: 7.0,  low: 4,  high: 11, cpmDemand: 'mid'    },
  { id: 'health',        label: 'Health & Fitness',       rpm: 8.0,  low: 4,  high: 13, cpmDemand: 'high'   },
  { id: 'education',     label: 'Education & How-To',     rpm: 9.0,  low: 5,  high: 14, cpmDemand: 'high'   },
  { id: 'news',          label: 'News & Politics',        rpm: 6.0,  low: 3,  high: 10, cpmDemand: 'mid'    },
  { id: 'travel',        label: 'Travel',                 rpm: 6.0,  low: 3,  high: 10, cpmDemand: 'mid'    },
  { id: 'beauty',        label: 'Beauty & Fashion',       rpm: 6.0,  low: 3,  high: 10, cpmDemand: 'mid'    },
  { id: 'science',       label: 'Science & Space',        rpm: 6.0,  low: 3,  high: 10, cpmDemand: 'mid'    },
  { id: 'history',       label: 'History & Documentary',  rpm: 5.5,  low: 3,  high: 9,  cpmDemand: 'mid'    },
  { id: 'food',          label: 'Food & Cooking',         rpm: 5.0,  low: 2.5,high: 8,  cpmDemand: 'mid'    },
  { id: 'lifestyle',     label: 'Lifestyle & Vlogs',      rpm: 4.5,  low: 2,  high: 7,  cpmDemand: 'mid'    },
  { id: 'sports',        label: 'Sports',                 rpm: 4.0,  low: 2,  high: 7,  cpmDemand: 'low'    },
  { id: 'gaming',        label: 'Gaming',                 rpm: 4.0,  low: 2,  high: 7,  cpmDemand: 'low'    },
  { id: 'entertainment', label: 'Entertainment',          rpm: 3.5,  low: 1.5,high: 6,  cpmDemand: 'low'    },
  { id: 'pets',          label: 'Pets & Animals',         rpm: 3.5,  low: 1.5,high: 6,  cpmDemand: 'low'    },
  { id: 'compilation',   label: 'Faceless Compilation',   rpm: 3.0,  low: 1.2,high: 5,  cpmDemand: 'low'    },
  { id: 'kids',          label: 'Kids & Family',          rpm: 3.0,  low: 1,  high: 5,  cpmDemand: 'low'    },
  { id: 'music',         label: 'Music',                  rpm: 2.5,  low: 1,  high: 4,  cpmDemand: 'low'    },
  { id: 'other',         label: 'Other',                  rpm: 5.0,  low: 2,  high: 9,  cpmDemand: 'mid'    },
];

export const AUDIENCE_TIERS = [
  { id: 'tier1',  label: 'Tier 1 — US / UK / CA / AU', multiplier: 1.0 },
  { id: 'tier2',  label: 'Tier 2 — Western Europe',    multiplier: 0.78 },
  { id: 'tier3',  label: 'Tier 3 — East EU / LATAM',   multiplier: 0.42 },
  { id: 'tier4',  label: 'Tier 4 — Asia / Africa',     multiplier: 0.28 },
  { id: 'mixed',  label: 'Mixed / Global',             multiplier: 0.68 },
];

const nicheById = new Map(NICHES.map((n) => [n.id, n]));
const tierById = new Map(AUDIENCE_TIERS.map((t) => [t.id, t]));

export function getNiche(id) {
  return nicheById.get(id) ?? nicheById.get('other');
}

export function getTier(id) {
  return tierById.get(id) ?? tierById.get('tier1');
}

/**
 * Effective RPM for an account.
 * A manual override always wins — the operator knows their real AdSense RPM.
 */
export function effectiveRpm(account) {
  if (account.rpm_override != null && Number(account.rpm_override) > 0) {
    return { rpm: Number(account.rpm_override), low: Number(account.rpm_override), high: Number(account.rpm_override), source: 'override' };
  }
  const niche = getNiche(account.niche);
  const mult = getTier(account.audience_tier).multiplier;
  // Un-monetised channels bank nothing today; we still show the potential.
  const monetisedFactor = account.monetized ? 1 : 0;
  return {
    rpm: round2(niche.rpm * mult * monetisedFactor),
    potentialRpm: round2(niche.rpm * mult),
    low: round2(niche.low * mult * monetisedFactor),
    high: round2(niche.high * mult * monetisedFactor),
    source: 'estimated',
  };
}

const round2 = (n) => Math.round(n * 100) / 100;
