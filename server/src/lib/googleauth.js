/**
 * Google OAuth for exact earnings.
 *
 * An API key can read public view counts but never revenue — only the channel
 * owner can authorise that. This is the consent flow that gets us a refresh
 * token so the server can pull real AdSense figures on a schedule, with nobody
 * typing anything.
 *
 * ── About the weekly re-login ────────────────────────────────────────────────
 * Google expires refresh tokens after 7 days for any app whose publishing
 * status is "Testing". That is the single cause of tools that nag their users
 * to reconnect every week, and no code can work around it. Publish the app on
 * the OAuth consent screen and complete verification, and refresh tokens last
 * until the user revokes them. See EXACT-REVENUE.md.
 */
import jwt from 'jsonwebtoken';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/**
 * Read-only, and monetary analytics only. It cannot upload, delete, edit or
 * post — worth stating plainly to the customer, because "connect your YouTube
 * account" otherwise sounds like handing over the keys.
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export class OAuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const isOAuthConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);

function requireConfig() {
  if (!isOAuthConfigured()) {
    throw new OAuthError(
      'Exact-revenue sync is not configured on this server (needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI).',
      503
    );
  }
}

/** Short-lived signed state — this is the CSRF guard on the callback. */
export function signState(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
}

export function readState(state) {
  try {
    return jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    throw new OAuthError('That authorisation link expired. Start the connection again.', 400);
  }
}

export function buildAuthUrl(state) {
  requireConfig();
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(' '));
  // `offline` is what returns a refresh token at all; `consent` forces Google
  // to reissue one even if the user has approved this app before, which is the
  // usual reason a re-connect silently yields no refresh token.
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // `invalid_grant` after exactly a week is the Testing-mode expiry.
    if (json.error === 'invalid_grant') {
      throw new OAuthError(
        'Google rejected the saved authorisation. If this happens about a week after connecting, the Google Cloud app is still in Testing mode — publish it to stop tokens expiring.',
        401
      );
    }
    throw new OAuthError(json.error_description || json.error || 'Google rejected the token request.', 502);
  }
  return json;
}

export async function exchangeCode(code) {
  requireConfig();
  const tokens = await tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  if (!tokens.refresh_token) {
    throw new OAuthError(
      'Google did not return a refresh token. Revoke this app under your Google account permissions and connect again.',
      400
    );
  }
  return tokens;
}

export async function accessTokenFrom(refreshToken) {
  requireConfig();
  const tokens = await tokenRequest({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  return tokens.access_token;
}

export async function revokeToken(token) {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch {
    /* revocation is best-effort; we drop our copy either way */
  }
}
