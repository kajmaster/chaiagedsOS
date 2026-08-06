import jwt from 'jsonwebtoken';

const TTL = '30d';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET is missing or too short. Set a random 32+ character value.');
  return s;
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, demo: !!user.is_demo }, secret(), { expiresIn: TTL });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, secret());
    req.userId = payload.sub;
    req.isDemo = !!payload.demo;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

/** Demo workspaces are read-only playgrounds — never let them mutate. */
export function blockDemoWrites(req, res, next) {
  if (req.isDemo && req.method !== 'GET') {
    return res.status(403).json({
      error: 'This is the demo workspace — create a free account to save your own channels.',
      code: 'DEMO_READONLY',
    });
  }
  next();
}
