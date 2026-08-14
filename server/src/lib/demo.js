/**
 * Demo workspace generator.
 *
 * Powers the "See it with live data" button on the login screen. Produces a
 * believable 8-channel portfolio: winners, a break-even grinder, a money pit
 * and a channel still waiting on monetisation — so a prospect immediately sees
 * what the product tells them.
 */
import { newId, encrypt } from './crypto.js';
import { getNiche, getTier } from './rpm.js';

const DAY = 86_400_000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

/** Small seeded PRNG so the demo looks identical on every load. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TITLES = {
  finance: ['How I Turned $1,000 Into $47,000 (Full Breakdown)', 'The 7 Dividend Stocks Quietly Printing Money in 2026', 'Why the S&P 500 Is About to Do Something Strange', 'I Tracked Every Dollar for 90 Days — Here\'s the Truth', 'The Roth IRA Mistake That Costs You $312,000', 'Warren Buffett Just Sold. Here\'s What He Bought.', 'Compound Interest Explained in 8 Minutes', 'The Index Fund Nobody Talks About'],
  ai: ['This AI Agent Replaced My Entire Team', 'I Built a $12k/mo Business With 3 Prompts', 'The AI Tool Stack Every Solo Founder Needs', 'GPT vs Claude vs Gemini — Real-World Test', 'Automate Your Whole Business in One Weekend', 'The Prompt That Changed How I Work', 'Why 90% of AI Startups Will Die', '10 AI Workflows That Actually Save Time'],
  true_crime: ['The Case That Went Cold for 31 Years', 'The Witness Everyone Ignored', 'He Confessed. Then the Tape Vanished.', 'The Disappearance at Mile Marker 42', 'A Small Town. Two Detectives. One Lie.', 'The Letter That Solved Everything', 'Nobody Checked the Basement', 'The Alibi That Fell Apart on Camera'],
  gaming: ['I Survived 100 Days in Hardcore Mode', 'The Glitch That Broke the Speedrun Record', 'Ranking Every Boss From Easy to Impossible', 'This Update Changed Everything', 'Building the Ultimate Base', 'Pro Players React to My Gameplay', 'The Secret Ending Nobody Found', '24 Hours in the Hardest Difficulty'],
  health: ['The 12-Minute Routine That Replaced My Gym', 'What 30 Days of Zone 2 Cardio Did to Me', 'The Protein Myth Nobody Corrects', 'Sleep Like an Athlete — 5 Rules', 'I Quit Sugar for 60 Days', 'The Only 4 Exercises You Need', 'Why Your Warm-Up Is Wrong', 'Longevity: What the Data Actually Says'],
  business: ['How This $40M Company Started in a Garage', 'The Pricing Change That Doubled Revenue', 'Why Your Offer Isn\'t Converting', '7 Systems Every 7-Figure Business Runs', 'I Analysed 100 Failed Startups', 'The Cold Email That Landed a $250k Deal', 'Hiring Your First 5 People', 'The Margin Trap Killing Your Growth'],
  history: ['The Empire That Vanished in 40 Years', 'The Map That Redrew the World', 'What Really Happened at the Border', 'The Forgotten Engineer Who Built a Nation', 'A Single Decision That Changed a Century', 'The Ship That Never Came Home', 'The Treaty Nobody Read', 'Rome\'s Last Good Year'],
  compilation: ['Satisfying Restorations You Can\'t Look Away From', 'Oddly Calming Machines at Work', '20 Minutes of Perfect Craftsmanship', 'The Most Precise Cuts Ever Filmed', 'Relaxing Process Videos for Focus', 'Industrial Machines Doing Their Job', 'Perfect Loops Compilation', 'Deep Work Background Visuals'],
};

/*
 * Calibrated against the real metrics engine, not eyeballed. The portfolio
 * lands around +47% ROI with five channels profitable and three needing
 * attention. Both failure modes matter for a sales demo: numbers that are too
 * bad make the product look broken, and numbers that are too good make it look
 * fake. Production costs here are what outsourced content actually costs
 * (roughly $300–500 a video for scripted finance, ~$70 for gaming).
 */
const BLUEPRINTS = [
  { nickname: 'Wealth Vault', niche: 'finance',     tier: 'tier1', seed: 11, acq: 2800, monthly: 480, videos: 22, baseViews: 28000,  growth: 1.08, costPerVideo: 340, monetized: 1, aged: 2018, subs: 52000,  payouts: true },
  { nickname: 'AI Leverage',  niche: 'ai',          tier: 'tier1', seed: 23, acq: 2200, monthly: 400, videos: 18, baseViews: 32000,  growth: 1.11, costPerVideo: 300, monetized: 1, aged: 2019, subs: 44000,  payouts: true },
  { nickname: 'Cold Files',   niche: 'true_crime',  tier: 'tier1', seed: 37, acq: 1900, monthly: 380, videos: 16, baseViews: 115000, growth: 1.05, costPerVideo: 300, monetized: 1, aged: 2017, subs: 118000, payouts: false },
  { nickname: 'Iron Habit',   niche: 'health',      tier: 'mixed', seed: 41, acq: 700,  monthly: 150, videos: 20, baseViews: 34000,  growth: 1.02, costPerVideo: 85,  monetized: 1, aged: 2020, subs: 38000,  payouts: false },
  { nickname: 'Margin Notes', niche: 'business',    tier: 'tier1', seed: 53, acq: 1600, monthly: 260, videos: 10, baseViews: 16000,  growth: 1.01, costPerVideo: 220, monetized: 1, aged: 2019, subs: 9400,   payouts: false },
  { nickname: 'Deep Archive', niche: 'history',     tier: 'tier2', seed: 67, acq: 1100, monthly: 140, videos: 14, baseViews: 62000,  growth: 1.06, costPerVideo: 110, monetized: 1, aged: 2016, subs: 57000,  payouts: false },
  { nickname: 'Pixel Run',    niche: 'gaming',      tier: 'mixed', seed: 79, acq: 800,  monthly: 110, videos: 24, baseViews: 22000,  growth: 0.99, costPerVideo: 70,  monetized: 1, aged: 2021, subs: 24000,  payouts: false },
  { nickname: 'Quiet Craft',  niche: 'compilation', tier: 'tier3', seed: 89, acq: 400,  monthly: 70,  videos: 9,  baseViews: 12000,  growth: 1.03, costPerVideo: 60,  monetized: 0, aged: 2022, subs: 6800,   payouts: false },
];

const STATUS_BY_INDEX = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'warming'];

export function buildDemoWorkspace(userId) {
  const accounts = [];
  const videos = [];
  const payouts = [];

  BLUEPRINTS.forEach((bp, idx) => {
    const rand = rng(bp.seed);
    const accountId = newId();
    const acquiredDaysAgo = 300 - idx * 18;
    const titles = TITLES[bp.niche] ?? TITLES.compilation;

    let totalViews = 0;
    for (let i = 0; i < bp.videos; i++) {
      const ageDays = Math.round(((bp.videos - 1 - i) / Math.max(1, bp.videos - 1)) * 300) + 2;
      const maturity = Math.min(1, ageDays / 45); // views accumulate over ~6 weeks
      const variance = 0.55 + rand() * 1.5;
      const views = Math.max(300, Math.round(bp.baseViews * Math.pow(bp.growth, i) * variance * maturity));
      totalViews += views;

      videos.push({
        id: newId(),
        account_id: accountId,
        user_id: userId,
        yt_video_id: null,
        // Cycle the title bank, marking repeats as follow-ups rather than duplicates.
        title: i < titles.length ? titles[i] : `${titles[i % titles.length]} — Part ${Math.floor(i / titles.length) + 1}`,
        thumbnail: null,
        published_at: iso(ageDays),
        views,
        likes: Math.round(views * (0.028 + rand() * 0.022)),
        comments: Math.round(views * (0.002 + rand() * 0.003)),
        cost: Math.round(bp.costPerVideo * (0.8 + rand() * 0.5)),
        revenue_actual: null,
        source: 'demo',
        created_at: iso(ageDays),
        updated_at: new Date().toISOString(),
      });
    }

    if (bp.payouts) {
      // Derive payouts from the same RPM model the rest of the app uses.
      // Inventing them from an unrelated formula made the analytics page report
      // "your RPM $2.11 vs benchmark $22" — which looks like a broken product
      // rather than the intended story of a channel earning close to its niche.
      const rpm = getNiche(bp.niche).rpm * getTier(bp.tier).multiplier;
      const modelled = (totalViews / 1000) * rpm;
      const REALISM = 0.92; // real AdSense lands a little under the benchmark
      const weights = [0.1, 0.13, 0.15, 0.18, 0.21, 0.23]; // ramping up over 6 months

      weights.forEach((weight, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (weights.length - 1 - i));
        payouts.push({
          id: newId(),
          user_id: userId,
          account_id: accountId,
          period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          amount: Math.round(modelled * REALISM * weight),
          note: 'AdSense payout',
          created_at: new Date().toISOString(),
        });
      });
    }

    const slug = bp.nickname.toLowerCase().replace(/\s+/g, '');
    accounts.push({
      id: accountId,
      user_id: userId,
      nickname: bp.nickname,
      niche: bp.niche,
      audience_tier: bp.tier,
      status: STATUS_BY_INDEX[idx],
      channel_url: `https://www.youtube.com/@${slug}`,
      channel_id: null,
      handle: `@${slug}`,
      thumbnail: null,
      account_created_at: `${bp.aged}-03-14T00:00:00.000Z`,
      acquired_at: iso(acquiredDaysAgo),
      acquisition_cost: bp.acq,
      monthly_cost: bp.monthly,
      subscribers: bp.subs,
      total_views: totalViews,
      video_count: bp.videos,
      monetized: bp.monetized,
      rpm_override: null,
      notes: encrypt(
        [
          `Username: ${slug}.ops`,
          `Email: ${slug}@protonmail.com`,
          `Password: Dm-${bp.seed}x${slug.slice(0, 4)}!Q9`,
          `2FA / secret: JBSW Y3DP EHPK ${String(bp.seed).padStart(4, '0')}`,
          `Recovery email: recovery.${slug}@gmail.com`,
          '',
          idx === 0 ? 'Flagship channel. Two uploads per week, outsourced editing.' : 'Weekly uploads.',
        ].join('\n')
      ),
      last_synced_at: iso(rand() * 2),
      sync_error: null,
      created_at: iso(acquiredDaysAgo),
      updated_at: new Date().toISOString(),
    });
  });

  return { accounts, videos, payouts };
}
