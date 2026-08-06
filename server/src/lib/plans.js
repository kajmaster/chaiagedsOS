/**
 * Subscription plans.
 *
 * Billing is not wired up yet, but every gate the paywall will need already
 * runs off this table. When Stripe is added, the webhook only has to write a
 * new value into `users.plan` — no other code changes.
 */
export const PLANS = {
  demo:     { label: 'Demo',      channelLimit: 8,        syncPerDay: 0,    price: 0 },
  free:     { label: 'Free',      channelLimit: 3,        syncPerDay: 10,   price: 0 },
  // `starter` is what every new signup gets today — generous on purpose while
  // billing is off. Flipping the paywall on = changing this number, nothing else.
  starter:  { label: 'Starter',   channelLimit: 25,       syncPerDay: 100,  price: 0 },
  operator: { label: 'Operator',  channelLimit: 100,      syncPerDay: 400,  price: 29 },
  studio:   { label: 'Studio',    channelLimit: Infinity, syncPerDay: 2000, price: 79 },
};

export const getPlan = (id) => PLANS[id] ?? PLANS.starter;

export function planError(plan, count) {
  const p = getPlan(plan);
  if (count < p.channelLimit) return null;
  return {
    error: `The ${p.label} plan tracks up to ${p.channelLimit} channels. Upgrade to add more.`,
    code: 'PLAN_LIMIT',
    plan,
    limit: p.channelLimit,
  };
}
