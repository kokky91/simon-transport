/**
 * WebGen Gambia — Cloudflare Worker v4.1
 * ========================================
 * Backend voor het WebGen platform met:
 * - AI proxy met body-validatie
 * - Rate limiting (burst + hourly)
 * - Multi-user auth (Admin/Medewerker/Klant)
 * - CRM data API
 *
 * ENVIRONMENT VARIABLES (stel in via Cloudflare dashboard):
 *   ANTHROPIC_API_KEY  = jouw Anthropic API key (sk-ant-...)
 *   ADMIN_PASSWORD     = wrangler secret put ADMIN_PASSWORD
 *
 * KV NAMESPACES:
 *   CRM_DATA           = KV namespace voor klant + user data
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS — restrict to allowed origins
    const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || 'https://webgen-gambia.pages.dev,http://localhost:3456,http://localhost:8788').split(',').map(s => s.trim());
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    const cors = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      // ─── AUTH ROUTES ─────────────────────────────────
      if (path === '/api/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env, cors);
      }
      if (path === '/api/auth/me' && request.method === 'GET') {
        return await handleMe(request, env, cors);
      }
      if (path === '/api/auth/logout' && request.method === 'POST') {
        return await handleLogout(request, env, cors);
      }

      // ─── USER MANAGEMENT (admin only) ────────────────
      if (path === '/api/users' && request.method === 'GET') {
        return await handleGetUsers(request, env, cors);
      }
      if (path === '/api/users' && request.method === 'POST') {
        return await handleCreateUser(request, env, cors);
      }
      if (path.startsWith('/api/users/') && request.method === 'PUT') {
        return await handleUpdateUser(request, env, cors, path);
      }
      if (path.startsWith('/api/users/') && request.method === 'DELETE') {
        return await handleDeleteUser(request, env, cors, path);
      }

      // ─── AI PROXY ────────────────────────────────────
      if (path === '/api/generate' && request.method === 'POST') {
        return await handleGenerate(request, env, cors);
      }

      // ─── CRM DATA ────────────────────────────────────
      if (path === '/api/crm') {
        return await handleCRM(request, env, cors);
      }

      // ─── HEALTH / STATUS ─────────────────────────────
      if (path === '/api/health') {
        return json({ status: 'ok', version: '4.1', timestamp: new Date().toISOString() }, cors);
      }
      if (path === '/api/status') {
        return json({
          api_key_set: !!env.ANTHROPIC_API_KEY,
          kv_connected: !!env.CRM_DATA,
          ready: !!env.ANTHROPIC_API_KEY
        }, cors);
      }

      // ─── SETUP: init eerste admin user ────────────────
      if (path === '/api/setup' && request.method === 'POST') {
        return await handleSetup(request, env, cors);
      }

      return json({ error: 'Not found', path }, cors, 404);

    } catch (err) {
      return json({ error: err.message }, cors, 500);
    }
  }
};

// ═══════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_webgen_salt_2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSessionToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return 'sess_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateUserId() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return 'u_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getAuthData(env) {
  if (!env.CRM_DATA) return null;
  const data = await env.CRM_DATA.get('auth_data', 'json');
  return data || { users: [], sessions: {} };
}

async function saveAuthData(env, data) {
  if (!env.CRM_DATA) return;
  data._updatedAt = new Date().toISOString();
  await env.CRM_DATA.put('auth_data', JSON.stringify(data));
}

async function getSessionUser(request, env) {
  const token = request.headers.get('X-Session-Token');
  if (!token) return null;

  const auth = await getAuthData(env);
  if (!auth) return null;

  const session = auth.sessions[token];
  if (!session) return null;

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    delete auth.sessions[token];
    await saveAuthData(env, auth);
    return null;
  }

  const user = auth.users.find(u => u.id === session.userId);
  return user || null;
}

async function requireRole(request, env, cors, roles) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return { error: json({ error: 'Not authenticated' }, cors, 401) };
  }
  if (!roles.includes(user.role)) {
    return { error: json({ error: 'Insufficient permissions' }, cors, 403) };
  }
  return { user };
}

// ═══════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════

async function handleSetup(request, env, cors) {
  if (!env.CRM_DATA) {
    return json({ error: 'CRM_DATA KV not configured' }, cors, 500);
  }

  const auth = await getAuthData(env);

  // Only allow setup if no users exist
  if (auth.users.length > 0) {
    return json({ error: 'Setup already completed. Users exist.' }, cors, 400);
  }

  const body = await request.json();
  if (!body.name || !body.email || !body.password) {
    return json({ error: 'name, email, and password are required' }, cors, 400);
  }

  const passwordHash = await hashPassword(body.password);
  const userId = generateUserId();
  const now = new Date().toISOString();

  auth.users.push({
    id: userId,
    name: body.name,
    email: body.email.toLowerCase().trim(),
    passwordHash,
    role: 'admin',
    createdAt: now,
    lastLogin: now,
  });

  // Create session
  const token = generateSessionToken();
  auth.sessions[token] = {
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await saveAuthData(env, auth);

  return json({
    ok: true,
    token,
    user: { id: userId, name: body.name, email: body.email, role: 'admin' }
  }, cors);
}

async function handleLogin(request, env, cors) {
  if (!env.CRM_DATA) {
    return json({ error: 'CRM_DATA KV not configured' }, cors, 500);
  }

  const body = await request.json();
  if (!body.email || !body.password) {
    return json({ error: 'Email and password required' }, cors, 400);
  }

  const auth = await getAuthData(env);
  const email = body.email.toLowerCase().trim();
  const user = auth.users.find(u => u.email === email);

  if (!user) {
    return json({ error: 'Invalid email or password' }, cors, 401);
  }

  const passwordHash = await hashPassword(body.password);
  if (user.passwordHash !== passwordHash) {
    return json({ error: 'Invalid email or password' }, cors, 401);
  }

  // Create session token
  const token = generateSessionToken();
  const rememberMe = body.rememberMe === true;
  const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  auth.sessions[token] = {
    userId: user.id,
    expiresAt: new Date(Date.now() + expiresIn).toISOString(),
  };

  // Update last login
  user.lastLogin = new Date().toISOString();

  // Clean up expired sessions
  const now = new Date();
  for (const [key, sess] of Object.entries(auth.sessions)) {
    if (new Date(sess.expiresAt) < now) {
      delete auth.sessions[key];
    }
  }

  await saveAuthData(env, auth);

  return json({
    ok: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  }, cors);
}

async function handleMe(request, env, cors) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'Not authenticated' }, cors, 401);
  }
  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, lastLogin: user.lastLogin }
  }, cors);
}

async function handleLogout(request, env, cors) {
  const token = request.headers.get('X-Session-Token');
  if (token && env.CRM_DATA) {
    const auth = await getAuthData(env);
    delete auth.sessions[token];
    await saveAuthData(env, auth);
  }
  return json({ ok: true }, cors);
}

// ═══════════════════════════════════════════════════════
// USER MANAGEMENT (admin only)
// ═══════════════════════════════════════════════════════

async function handleGetUsers(request, env, cors) {
  const check = await requireRole(request, env, cors, ['admin']);
  if (check.error) return check.error;

  const auth = await getAuthData(env);
  const users = auth.users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    createdAt: u.createdAt, lastLogin: u.lastLogin
  }));

  return json({ users }, cors);
}

async function handleCreateUser(request, env, cors) {
  const check = await requireRole(request, env, cors, ['admin']);
  if (check.error) return check.error;

  const body = await request.json();
  if (!body.name || !body.email || !body.password || !body.role) {
    return json({ error: 'name, email, password, and role are required' }, cors, 400);
  }

  const validRoles = ['admin', 'medewerker', 'klant'];
  if (!validRoles.includes(body.role)) {
    return json({ error: `Invalid role. Must be: ${validRoles.join(', ')}` }, cors, 400);
  }

  const auth = await getAuthData(env);
  const email = body.email.toLowerCase().trim();

  if (auth.users.find(u => u.email === email)) {
    return json({ error: 'Email already exists' }, cors, 409);
  }

  const userId = generateUserId();
  const passwordHash = await hashPassword(body.password);

  auth.users.push({
    id: userId,
    name: body.name,
    email,
    passwordHash,
    role: body.role,
    createdAt: new Date().toISOString(),
    lastLogin: null,
  });

  await saveAuthData(env, auth);

  return json({
    ok: true,
    user: { id: userId, name: body.name, email, role: body.role }
  }, cors, 201);
}

async function handleUpdateUser(request, env, cors, path) {
  const check = await requireRole(request, env, cors, ['admin']);
  if (check.error) return check.error;

  const userId = path.split('/').pop();
  const auth = await getAuthData(env);
  const user = auth.users.find(u => u.id === userId);

  if (!user) {
    return json({ error: 'User not found' }, cors, 404);
  }

  const body = await request.json();

  if (body.name) user.name = body.name;
  if (body.email) user.email = body.email.toLowerCase().trim();
  if (body.role) {
    const validRoles = ['admin', 'medewerker', 'klant'];
    if (!validRoles.includes(body.role)) {
      return json({ error: `Invalid role. Must be: ${validRoles.join(', ')}` }, cors, 400);
    }
    user.role = body.role;
  }
  if (body.password) {
    user.passwordHash = await hashPassword(body.password);
  }

  await saveAuthData(env, auth);

  return json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  }, cors);
}

async function handleDeleteUser(request, env, cors, path) {
  const check = await requireRole(request, env, cors, ['admin']);
  if (check.error) return check.error;

  const userId = path.split('/').pop();
  const auth = await getAuthData(env);

  // Don't allow deleting yourself
  if (check.user.id === userId) {
    return json({ error: 'Cannot delete your own account' }, cors, 400);
  }

  const idx = auth.users.findIndex(u => u.id === userId);
  if (idx === -1) {
    return json({ error: 'User not found' }, cors, 404);
  }

  auth.users.splice(idx, 1);

  // Remove all sessions for this user
  for (const [key, sess] of Object.entries(auth.sessions)) {
    if (sess.userId === userId) {
      delete auth.sessions[key];
    }
  }

  await saveAuthData(env, auth);

  return json({ ok: true }, cors);
}

// ═══════════════════════════════════════════════════════
// AI PROXY (with body validation + rate limiting)
// ═══════════════════════════════════════════════════════

async function handleGenerate(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, cors, 500);
  }

  const body = await request.json();

  // ── Body validation ──
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'messages must be a non-empty array' }, cors, 400);
  }

  if (body.model && !body.model.startsWith('claude-')) {
    return json({ error: 'Only Claude models are allowed' }, cors, 400);
  }

  // Whitelist allowed fields only
  const sanitized = {
    model: body.model || 'claude-sonnet-4-20250514',
    messages: body.messages,
    max_tokens: Math.min(parseInt(body.max_tokens) || 4096, 8192),
  };

  if (body.system) sanitized.system = body.system;
  if (typeof body.temperature === 'number') {
    sanitized.temperature = Math.max(0, Math.min(1, body.temperature));
  }

  // ── Rate limiting ──
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.CRM_DATA) {
    const now = Date.now();
    const hourKey = `rate_h_${ip}_${new Date().getUTCHours()}`;
    const minuteKey = `rate_m_${ip}_${Math.floor(now / 60000)}`;

    // Burst limit: 10 per minute
    const minuteCount = parseInt(await env.CRM_DATA.get(minuteKey) || '0');
    if (minuteCount >= 10) {
      return json({ error: 'Too many requests. Max 10 per minute.' }, cors, 429);
    }
    await env.CRM_DATA.put(minuteKey, String(minuteCount + 1), { expirationTtl: 120 });

    // Hourly limit: 50 per hour
    const hourCount = parseInt(await env.CRM_DATA.get(hourKey) || '0');
    if (hourCount >= 50) {
      return json({ error: 'Rate limit exceeded. Max 50 per hour.' }, cors, 429);
    }
    await env.CRM_DATA.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 });
  }

  // ── Forward to Anthropic ──
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(sanitized),
  });

  const data = await resp.json();
  return json(data, cors, resp.status);
}

// ═══════════════════════════════════════════════════════
// CRM DATA (authenticated)
// ═══════════════════════════════════════════════════════

async function handleCRM(request, env, cors) {
  if (!env.CRM_DATA) {
    return json({ error: 'CRM_DATA KV namespace not configured' }, cors, 500);
  }

  // Support both old Bearer auth and new session auth
  const auth = request.headers.get('Authorization');
  const sessionToken = request.headers.get('X-Session-Token');
  let authorized = false;
  let userRole = 'admin';

  if (auth && env.ADMIN_PASSWORD && auth === `Bearer ${env.ADMIN_PASSWORD}`) {
    authorized = true;
  } else if (sessionToken) {
    const user = await getSessionUser(request, env);
    if (user && (user.role === 'admin' || user.role === 'medewerker')) {
      authorized = true;
      userRole = user.role;
    }
  }

  if (!authorized) {
    return json({ error: 'Unauthorized' }, cors, 401);
  }

  if (request.method === 'GET') {
    const data = await env.CRM_DATA.get('crm_main', 'json');
    return json(data || { clients: [], invoices: [], nextCid: 1, nextIid: 1 }, cors);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    body._savedAt = new Date().toISOString();
    await env.CRM_DATA.put('crm_main', JSON.stringify(body));
    return json({ ok: true, savedAt: body._savedAt }, cors);
  }

  return json({ error: 'Method not allowed' }, cors, 405);
}

// ═══════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════

function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
