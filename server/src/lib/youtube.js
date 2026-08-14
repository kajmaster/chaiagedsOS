/**
 * YouTube Data API v3 client.
 *
 * The customer pastes a channel URL — we do the rest: resolve it, pull channel
 * stats, then pull every recent upload with its view count. One server-side API
 * key covers all customers (public data only, no OAuth, no per-user consent).
 */
const BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError('YouTube sync is not configured on this server (missing YOUTUBE_API_KEY).', 503);
  return key;
}

async function get(endpoint, params) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey());

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') throw new YouTubeError('Daily YouTube API quota reached. Sync resets at midnight PT.', 429);
    throw new YouTubeError(body?.error?.message || `YouTube API error (${res.status}).`, 502);
  }
  return body;
}

/**
 * Accepts anything a customer might paste:
 *   UC..., @handle, youtube.com/@handle, /channel/UC..., /c/Name, /user/Name
 */
export function parseChannelInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^UC[\w-]{20,}$/.test(raw)) return { type: 'id', value: raw };
  if (raw.startsWith('@')) return { type: 'handle', value: raw.slice(1) };

  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const seg = url.pathname.split('/').filter(Boolean);
    if (seg[0] === 'channel' && seg[1]) return { type: 'id', value: seg[1] };
    if (seg[0]?.startsWith('@')) return { type: 'handle', value: seg[0].slice(1) };
    if ((seg[0] === 'c' || seg[0] === 'user') && seg[1]) return { type: 'search', value: seg[1] };
    if (seg.length === 1) return { type: 'search', value: seg[0] };
  } catch {
    /* not a URL — fall through */
  }
  return { type: 'search', value: raw };
}

/** Resolve any input to a full channel record. */
export async function resolveChannel(input) {
  const parsed = parseChannelInput(input);
  if (!parsed) throw new YouTubeError('Enter a channel URL, @handle or channel ID.', 400);

  const part = 'snippet,statistics,contentDetails';
  let data;

  if (parsed.type === 'id') data = await get('channels', { part, id: parsed.value });
  else if (parsed.type === 'handle') data = await get('channels', { part, forHandle: parsed.value });

  if (!data?.items?.length) {
    const found = await get('search', { part: 'snippet', q: parsed.value, type: 'channel', maxResults: 1 });
    const id = found?.items?.[0]?.snippet?.channelId || found?.items?.[0]?.id?.channelId;
    if (!id) throw new YouTubeError(`No YouTube channel found for "${parsed.value}".`, 404);
    data = await get('channels', { part, id });
  }

  const c = data.items[0];
  if (!c) throw new YouTubeError('Channel not found.', 404);

  return {
    channelId: c.id,
    title: c.snippet?.title ?? 'Untitled channel',
    handle: c.snippet?.customUrl ?? null,
    description: c.snippet?.description ?? '',
    thumbnail: c.snippet?.thumbnails?.high?.url ?? c.snippet?.thumbnails?.default?.url ?? null,
    country: c.snippet?.country ?? null,
    publishedAt: c.snippet?.publishedAt ?? null,
    subscribers: Number(c.statistics?.subscriberCount ?? 0),
    totalViews: Number(c.statistics?.viewCount ?? 0),
    videoCount: Number(c.statistics?.videoCount ?? 0),
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads ?? null,
    url: `https://www.youtube.com/channel/${c.id}`,
  };
}

/**
 * Pull uploads (newest first) with full statistics.
 *
 * The default used to be 50, which silently truncated every channel with more
 * uploads than that — a customer with 123 videos saw 50 and, reasonably,
 * concluded the tool was broken. Paging is cheap: playlistItems and videos both
 * cost 1 quota unit per 50 items, so a full 123-video channel is 6 units out of
 * 10,000 a day. The cap below exists only to stop a runaway on a huge archive.
 */
export const MAX_VIDEOS_PER_SYNC = 2000;

export async function fetchChannelVideos(uploadsPlaylistId, limit = MAX_VIDEOS_PER_SYNC) {
  if (!uploadsPlaylistId) return { videos: [], truncated: false };

  const ids = [];
  let pageToken;
  while (ids.length < limit) {
    const page = await get('playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(50, limit - ids.length),
      pageToken,
    });
    for (const item of page.items ?? []) {
      if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    }
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  if (!ids.length) return { videos: [], truncated: false };

  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await get('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(',') });
    for (const v of batch.items ?? []) {
      videos.push({
        ytVideoId: v.id,
        title: v.snippet?.title ?? 'Untitled',
        thumbnail: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
        publishedAt: v.snippet?.publishedAt ?? null,
        views: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comments: Number(v.statistics?.commentCount ?? 0),
        duration: v.contentDetails?.duration ?? null,
      });
    }
  }
  return { videos, truncated: ids.length >= limit };
}

export const isConfigured = () => Boolean(process.env.YOUTUBE_API_KEY);
