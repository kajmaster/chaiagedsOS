/**
 * YouTube Analytics API — real money, not a model.
 *
 * `estimatedRevenue` is the same figure the owner sees in YouTube Studio, so
 * once a channel is connected nobody has to open AdSense or type a number.
 */
import { accessTokenFrom, OAuthError } from './googleauth.js';

const REPORTS = 'https://youtubeanalytics.googleapis.com/v2/reports';

/** YouTube Analytics has no data before this; asking for more just errors. */
const EARLIEST = '2005-01-01';

const iso = (d) => d.toISOString().slice(0, 10);

/**
 * Monthly revenue for a channel.
 * @returns [{ period: 'YYYY-MM', amount: number, views: number }]
 */
export async function fetchMonthlyRevenue(refreshToken, { months = 24 } = {}) {
  const accessToken = await accessTokenFrom(refreshToken);

  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);

  const url = new URL(REPORTS);
  url.searchParams.set('ids', 'channel==MINE');
  url.searchParams.set('startDate', iso(start) < EARLIEST ? EARLIEST : iso(start));
  url.searchParams.set('endDate', iso(end));
  url.searchParams.set('metrics', 'estimatedRevenue,views');
  url.searchParams.set('dimensions', 'month');
  url.searchParams.set('sort', 'month');

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const reason = body?.error?.message || 'YouTube Analytics rejected the request.';
    if (res.status === 403) {
      throw new OAuthError(
        `${reason} A channel must be in the YouTube Partner Programme before revenue figures exist.`,
        403
      );
    }
    throw new OAuthError(reason, res.status === 401 ? 401 : 502);
  }

  // Columns come back in the order requested, but read them by name rather than
  // position so a future metric addition cannot silently shift the values.
  const headers = (body.columnHeaders ?? []).map((h) => h.name);
  const at = (row, name) => row[headers.indexOf(name)];

  return (body.rows ?? []).map((row) => ({
    period: String(at(row, 'month')), // already 'YYYY-MM'
    amount: Math.round((Number(at(row, 'estimatedRevenue')) || 0) * 100) / 100,
    views: Number(at(row, 'views')) || 0,
  }));
}

/** Which channel did the customer actually authorise? */
export async function fetchAuthorisedChannel(refreshToken) {
  const accessToken = await accessTokenFrom(refreshToken);
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('mine', 'true');

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new OAuthError(body?.error?.message || 'Could not read the authorised channel.', 502);

  const item = body.items?.[0];
  return item ? { channelId: item.id, title: item.snippet?.title ?? null } : null;
}
