/**
 * Tiny in-memory rate limiter.
 *
 * Guards the YouTube quota: the demo is open to anyone, and 10,000 daily units
 * would not survive a single bored visitor holding down a button.
 */
const buckets = new Map();

export function rateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { allowed: false, retryAfter };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, remaining: limit - hits.length };
}

// Keep the map from growing without bound on a long-lived process.
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => t > cutoff);
    if (live.length) buckets.set(key, live);
    else buckets.delete(key);
  }
}, 600_000).unref();
