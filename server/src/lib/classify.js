/**
 * Niche and audience detection.
 *
 * Lives on the server so the guess, the RPM benchmark and the revenue estimate
 * all come from one place — the client should never re-implement this and drift.
 *
 * Scored, not first-match-wins. An earlier version returned the first pattern
 * that hit, which meant `invest` matched "murder investigations" and filed a
 * true-crime channel under Finance at triple the RPM. Every keyword is now
 * word-bounded and every niche is scored, so a single loose word cannot
 * outrank a pile of specific ones.
 */

/** `[keyword, weight]`; weight 2 = strong signal, 1 = supporting. */
const NICHE_KEYWORDS = {
  finance: [['investing', 2], ['investor', 2], ['stock market', 2], ['stocks', 2], ['dividend', 2], ['portfolio', 1], ['trading', 2], ['forex', 2], ['personal finance', 2], ['wealth', 1], ['retirement', 2], ['index fund', 2], ['savings', 1], ['money', 1]],
  real_estate: [['real estate', 2], ['property', 2], ['landlord', 2], ['realtor', 2], ['mortgage', 2], ['rental', 1], ['airbnb', 2]],
  insurance: [['insurance', 2], ['lawyer', 2], ['attorney', 2], ['legal advice', 2], ['lawsuit', 2]],
  business: [['business', 2], ['startup', 2], ['entrepreneur', 2], ['ecommerce', 2], ['dropshipping', 2], ['saas', 2], ['agency', 1], ['marketing', 1], ['sales', 1]],
  ai: [['artificial intelligence', 2], ['chatgpt', 2], ['machine learning', 2], ['automation', 2], ['prompt', 1], ['neural', 1], ['openai', 2], ['claude', 1]],
  crypto: [['crypto', 2], ['bitcoin', 2], ['ethereum', 2], ['blockchain', 2], ['altcoin', 2], ['web3', 2], ['nft', 2]],
  tech: [['software', 2], ['coding', 2], ['programming', 2], ['developer', 2], ['gadget', 2], ['unboxing', 2], ['smartphone', 2], ['laptop', 1], ['tech review', 2]],
  luxury: [['luxury', 2], ['rolex', 2], ['supercar', 2], ['mansion', 2], ['billionaire', 1], ['watch collection', 2]],
  self_improve: [['motivation', 2], ['discipline', 2], ['mindset', 2], ['self improvement', 2], ['productivity', 2], ['habits', 2], ['confidence', 1]],
  true_crime: [['true crime', 2], ['murder', 2], ['unsolved', 2], ['detective', 2], ['cold case', 2], ['missing person', 2], ['homicide', 2], ['investigation', 1], ['serial killer', 2]],
  automotive: [['automotive', 2], ['engine', 1], ['racing', 2], ['restoration', 1], ['car review', 2], ['cars', 1], ['motorcycle', 2]],
  health: [['fitness', 2], ['workout', 2], ['nutrition', 2], ['weight loss', 2], ['gym', 2], ['diet', 2], ['wellness', 2], ['health', 1], ['exercise', 1]],
  education: [['tutorial', 2], ['how to', 1], ['course', 2], ['lesson', 2], ['explained', 1], ['learn', 1], ['exam', 2], ['revision', 2], ['classroom', 2]],
  news: [['news', 2], ['politics', 2], ['election', 2], ['geopolitics', 2], ['breaking', 1], ['current affairs', 2]],
  travel: [['travel', 2], ['destination', 2], ['backpacking', 2], ['itinerary', 2], ['nomad', 2], ['tourism', 2]],
  beauty: [['makeup', 2], ['skincare', 2], ['fashion', 2], ['beauty', 2], ['outfit', 2], ['haul', 1]],
  science: [['science', 2], ['physics', 2], ['astronomy', 2], ['nasa', 2], ['quantum', 2], ['biology', 2], ['chemistry', 2]],
  history: [['history', 2], ['documentary', 2], ['ancient', 2], ['empire', 2], ['medieval', 2], ['world war', 2], ['civilisation', 2], ['civilization', 2]],
  food: [['recipe', 2], ['cooking', 2], ['baking', 2], ['kitchen', 2], ['chef', 2], ['restaurant', 2], ['food', 1]],
  lifestyle: [['vlog', 2], ['lifestyle', 2], ['day in the life', 2], ['storytime', 2], ['daily vlog', 2]],
  sports: [['football', 2], ['soccer', 2], ['basketball', 2], ['nba', 2], ['nfl', 2], ['boxing', 2], ['mma', 2], ['highlights', 1], ['sports', 2]],
  gaming: [['gaming', 2], ['gameplay', 2], ['minecraft', 2], ['fortnite', 2], ['roblox', 2], ['speedrun', 2], ['walkthrough', 2], ['lets play', 2], ['playthrough', 2]],
  pets: [['puppy', 2], ['kitten', 2], ['wildlife', 2], ['aquarium', 2], ['pets', 2], ['dog training', 2]],
  kids: [['nursery rhyme', 2], ['toddler', 2], ['kids', 2], ['cartoon', 2], ['preschool', 2]],
  music: [['music', 2], ['lofi', 2], ['playlist', 2], ['remix', 2], ['beats', 2], ['song', 2], ['guitar', 2], ['piano', 2], ['album', 1]],
  compilation: [['compilation', 2], ['satisfying', 2], ['asmr', 2], ['relaxing', 2], ['ambient', 2], ['sleep sounds', 2]],
  entertainment: [['comedy', 2], ['prank', 2], ['reaction', 2], ['funny', 2], ['challenge', 1], ['giveaway', 1], ['memes', 2]],
};

/** Build word-bounded matchers once at module load. */
const MATCHERS = Object.entries(NICHE_KEYWORDS).map(([niche, keywords]) => ({
  niche,
  keywords: keywords.map(([word, weight]) => ({
    // \b around a multi-word phrase still anchors both ends correctly.
    re: new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    weight,
  })),
}));

const TIER_BY_COUNTRY = {
  tier1: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE'],
  tier2: ['DE', 'NL', 'SE', 'NO', 'DK', 'CH', 'AT', 'FI', 'BE', 'FR', 'IT', 'ES', 'IS', 'LU'],
  tier3: ['PL', 'RO', 'BR', 'MX', 'AR', 'CO', 'CL', 'TR', 'RU', 'UA', 'PT', 'GR', 'CZ', 'HU'],
  tier4: ['IN', 'PK', 'BD', 'ID', 'PH', 'VN', 'NG', 'EG', 'KE', 'ZA', 'TH', 'MA', 'LK'],
};

const TITLE_WEIGHT = 3; // a word in the channel name means far more than one in the blurb

/**
 * @returns {{ niche: string, confident: boolean, score: number, runnerUp: string|null }}
 * `confident: false` means the UI should ask rather than silently assume — a
 * wrong niche silently changes every revenue figure on the screen.
 */
export function detectNiche(title = '', description = '') {
  const head = String(title).slice(0, 200);
  const body = String(description).slice(0, 4000);

  const scores = MATCHERS.map(({ niche, keywords }) => {
    let score = 0;
    for (const { re, weight } of keywords) {
      if (re.test(head)) score += weight * TITLE_WEIGHT;
      if (re.test(body)) score += weight;
    }
    return { niche, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scores.length) return { niche: 'other', confident: false, score: 0, runnerUp: null };

  const [top, second] = scores;
  // Confident only when the winner is both meaningful and clearly ahead.
  const confident = top.score >= 3 && (!second || top.score >= second.score * 1.5);

  return { niche: top.niche, confident, score: top.score, runnerUp: second?.niche ?? null };
}

export function detectTier(country) {
  if (!country) return 'mixed';
  for (const [tier, list] of Object.entries(TIER_BY_COUNTRY)) {
    if (list.includes(country)) return tier;
  }
  return 'mixed';
}
