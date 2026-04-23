// WebGen Gambia — Cloudflare Worker API v4
// Security hardened, rate limited, input validated
// Bind KV namespace "WEBGEN_KV" in wrangler.toml

// ═══════════ CRYPTO UTILS ═══════════
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'webgen-gambia-salt-2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 64);
}

function generateClientCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'WG-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ═══════════ INPUT SANITIZATION ═══════════
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, c => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'
  })[c]);
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') clean[key] = sanitize(val);
    else if (typeof val === 'object' && val !== null) clean[key] = sanitizeObject(val);
    else clean[key] = val;
  }
  return clean;
}

// ═══════════ RATE LIMITER ═══════════
const rateLimitMap = new Map();
function checkRateLimit(ip, maxPerMinute = 60) {
  const now = Date.now();
  const windowMs = 60000;
  const key = ip || 'unknown';
  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  // Cleanup old entries every 100 requests
  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap) {
      if (now - v.windowStart > windowMs) rateLimitMap.delete(k);
    }
  }
  return entry.count <= maxPerMinute;
}

// ═══════════ PLAN FEATURES ═══════════
function getPlanFeatures(plan) {
  const features = {
    free: { websites: 1, tools: 'basic', ai: false, cms: false, templates: 3, storage: '100MB', support: 'community', customDomain: false },
    starter: { websites: 3, tools: 'all', ai: true, cms: true, templates: 10, storage: '1GB', support: 'whatsapp', customDomain: false },
    standard: { websites: 10, tools: 'all', ai: true, cms: true, templates: 20, storage: '5GB', support: 'priority', customDomain: true },
    premium: { websites: 'unlimited', tools: 'all', ai: true, cms: true, templates: 30, storage: '20GB', support: 'dedicated', customDomain: true }
  };
  return features[plan] || features.free;
}

// ═══════════ EMAIL TEMPLATES ═══════════
function buildEmailTemplate(template, data) {
  const styles = `
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;margin:0;padding:20px}
    .container{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
    .header{background:linear-gradient(135deg,#0e1f36,#1a3a5c);padding:32px 24px;text-align:center}
    .header h1{color:#00c896;font-size:22px;margin:0 0 4px}
    .header p{color:#8899aa;font-size:13px;margin:0}
    .body{padding:32px 24px}
    .body h2{color:#1a2332;font-size:18px;margin:0 0 12px}
    .body p{color:#4a5568;font-size:14px;line-height:1.7;margin:0 0 16px}
    .highlight{background:#f0fdf8;border-left:4px solid #00c896;padding:16px;border-radius:0 8px 8px 0;margin:20px 0}
    .highlight strong{color:#1a2332}
    .btn{display:inline-block;background:#00c896;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}
    .footer{background:#f8fafc;padding:20px 24px;text-align:center;font-size:12px;color:#8899aa;border-top:1px solid #e8edf2}
  `;
  const header = `<div class="header"><h1>WebGen Gambia</h1><p>by KOK Enterprises</p></div>`;
  const footer = `<div class="footer">WebGen Gambia &middot; KOK Enterprises<br>Questions? WhatsApp: +220 XXXXXXX</div>`;

  if (template === 'welcome') {
    return `<!DOCTYPE html><html><head><style>${styles}</style></head><body><div class="container">${header}<div class="body">
      <h2>Welcome, ${data.clientName}!</h2>
      <p>Your WebGen Gambia account is ready. You can now build your business website, create flyers, business cards, and more.</p>
      <div class="highlight"><strong>Your Login Code:</strong> ${data.clientCode}<br><strong>Plan:</strong> ${(data.plan || 'free').charAt(0).toUpperCase() + (data.plan || 'free').slice(1)}</div>
      <p>Visit your customer portal to get started:</p>
      <p style="text-align:center"><a href="${data.portalUrl}" class="btn">Open My Portal</a></p>
      <p style="font-size:13px;color:#8899aa">Save your login code — you'll need it each time you sign in.</p>
    </div>${footer}</div></body></html>`;
  }

  if (template === 'invoice') {
    return `<!DOCTYPE html><html><head><style>${styles}</style></head><body><div class="container">${header}<div class="body">
      <h2>Invoice ${data.invoiceId}</h2>
      <p>Dear ${data.clientName},</p>
      <p>Here is your invoice for your WebGen Gambia ${(data.plan || 'starter').charAt(0).toUpperCase() + (data.plan || 'starter').slice(1)} plan.</p>
      <div class="highlight"><strong>Amount Due:</strong> D ${data.amount}<br><strong>Due Date:</strong> ${data.dueDate}<br><strong>Reference:</strong> ${data.invoiceId}</div>
      <p><strong>Payment Methods:</strong></p>
      <p>Wave Money &middot; Afrimoney &middot; QMoney &middot; Bank Transfer</p>
      <p style="font-size:13px;color:#8899aa">Please include your invoice reference (${data.invoiceId}) with your payment.</p>
    </div>${footer}</div></body></html>`;
  }

  if (template === 'reminder') {
    return `<!DOCTYPE html><html><head><style>${styles}</style></head><body><div class="container">${header}<div class="body">
      <h2>Payment Reminder</h2>
      <p>Dear ${data.clientName},</p>
      <p>This is a friendly reminder that your invoice <strong>${data.invoiceId}</strong> for <strong>D ${data.amount}</strong> is due.</p>
      <div class="highlight"><strong>Due Date:</strong> ${data.dueDate}<br><strong>Amount:</strong> D ${data.amount}</div>
      <p>To keep your website and tools active, please complete your payment at your earliest convenience.</p>
    </div>${footer}</div></body></html>`;
  }

  // Custom HTML fallback
  return `<!DOCTYPE html><html><head><style>${styles}</style></head><body><div class="container">${header}<div class="body">${data.content || data.html || '<p>No content</p>'}</div>${footer}</div></body></html>`;
}

// ═══════════ MAIN HANDLER ═══════════
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Allowed origins — configurable via env var
    const allowedOrigins = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = allowedOrigins.includes('*') ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

    // Rate limit check
    const maxReq = parseInt(env.MAX_REQUESTS_PER_MINUTE || '60');
    if (!checkRateLimit(clientIP, maxReq)) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), {
        status: 429, headers: { ...headers, 'Retry-After': '60' }
      });
    }

    // ═══════════ AUTH HELPER ═══════════
    async function verifyAuth(req) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
      const token = authHeader.slice(7);
      if (token.length < 32) return null;
      const session = await env.WEBGEN_KV.get(`session:${token}`, 'json');
      if (!session) return null;
      if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        await env.WEBGEN_KV.delete(`session:${token}`);
        return null;
      }
      return session;
    }

    try {
      // ═══════════ SETUP CHECK ═══════════
      // GET /api/setup/status — Check if first-time setup is needed
      if (path === '/api/setup/status' && request.method === 'GET') {
        const admin = await env.WEBGEN_KV.get('admin:credentials', 'json');
        return new Response(JSON.stringify({
          needsSetup: !admin,
          service: 'WebGen Gambia API',
          version: '4.0'
        }), { headers });
      }

      // POST /api/setup/init — First-time admin setup (only works if no admin exists)
      if (path === '/api/setup/init' && request.method === 'POST') {
        const existing = await env.WEBGEN_KV.get('admin:credentials', 'json');
        if (existing) {
          return new Response(JSON.stringify({ error: 'Admin already configured. Use login.' }), { status: 403, headers });
        }
        const { username, password, name } = await request.json();
        if (!username || !password || password.length < 8) {
          return new Response(JSON.stringify({ error: 'Username required, password must be at least 8 characters.' }), { status: 400, headers });
        }
        const admin = {
          username: sanitize(username.toLowerCase().trim()),
          passwordHash: await hashPassword(password),
          name: sanitize(name || 'WebGen Admin'),
          createdAt: new Date().toISOString()
        };
        await env.WEBGEN_KV.put('admin:credentials', JSON.stringify(admin));
        return new Response(JSON.stringify({ success: true, message: 'Admin account created. You can now login.' }), { headers });
      }

      // ═══════════ AUTH API ═══════════
      // POST /api/auth/login
      if (path === '/api/auth/login' && request.method === 'POST') {
        const { username, password, role } = await request.json();
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Username and password required.' }), { status: 400, headers });
        }

        // Rate limit login attempts more strictly (10 per minute per IP)
        if (!checkRateLimit(`login:${clientIP}`, 10)) {
          return new Response(JSON.stringify({ error: 'Too many login attempts. Please wait.' }), {
            status: 429, headers: { ...headers, 'Retry-After': '60' }
          });
        }

        if (role === 'admin') {
          const admin = await env.WEBGEN_KV.get('admin:credentials', 'json');
          if (!admin) {
            return new Response(JSON.stringify({ error: 'No admin account. Run setup first.', needsSetup: true }), { status: 404, headers });
          }
          const inputHash = await hashPassword(password);
          if (username.toLowerCase().trim() !== admin.username || inputHash !== admin.passwordHash) {
            return new Response(JSON.stringify({ error: 'Invalid credentials.' }), { status: 401, headers });
          }
          const token = generateToken();
          await env.WEBGEN_KV.put(`session:${token}`, JSON.stringify({
            role: 'admin', username: admin.username, name: admin.name, createdAt: Date.now()
          }), { expirationTtl: 86400 });
          return new Response(JSON.stringify({ success: true, token, role: 'admin', name: admin.name }), { headers });
        }

        if (role === 'client') {
          const raw = username.trim();
          let code = null;
          let client = null;
          if (raw.includes('@')) {
            // Email login — look up via index
            const emailKey = `client-email:${raw.toLowerCase()}`;
            code = await env.WEBGEN_KV.get(emailKey);
            if (code) {
              client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
            }
          } else {
            // Legacy: access-code login
            code = raw.toUpperCase();
            client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
          }
          if (!client) {
            return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers });
          }
          const storedPass = client.password || code;
          const inputHash = await hashPassword(password);
          const storedHash = await hashPassword(storedPass);
          if (inputHash !== storedHash) {
            return new Response(JSON.stringify({ error: 'Invalid password.' }), { status: 401, headers });
          }
          const token = generateToken();
          await env.WEBGEN_KV.put(`session:${token}`, JSON.stringify({
            role: 'client', clientCode: code,
            name: client.name || client.businessName || client.bedrijfsnaam,
            pakket: client.pakket || client.plan || 'starter',
            createdAt: Date.now()
          }), { expirationTtl: 86400 });
          return new Response(JSON.stringify({
            success: true, token, role: 'client', clientCode: code,
            name: client.name || client.businessName || client.bedrijfsnaam,
            pakket: client.pakket || client.plan || 'starter'
          }), { headers });
        }

        if (role === 'staff') {
          const staff = await env.WEBGEN_KV.get(`staff:${username.toLowerCase().trim()}`, 'json');
          if (!staff) {
            return new Response(JSON.stringify({ error: 'Staff account not found.' }), { status: 404, headers });
          }
          const inputHash = await hashPassword(password);
          if (inputHash !== staff.passwordHash) {
            return new Response(JSON.stringify({ error: 'Invalid password.' }), { status: 401, headers });
          }
          const token = generateToken();
          await env.WEBGEN_KV.put(`session:${token}`, JSON.stringify({
            role: 'staff', username: staff.username, name: staff.name,
            permissions: staff.permissions || ['read'], createdAt: Date.now()
          }), { expirationTtl: 86400 });
          return new Response(JSON.stringify({ success: true, token, role: 'staff', name: staff.name }), { headers });
        }

        return new Response(JSON.stringify({ error: 'Invalid role. Use: admin, client, or staff.' }), { status: 400, headers });
      }

      // POST /api/auth/verify
      if (path === '/api/auth/verify' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ valid: false }), { status: 401, headers });
        return new Response(JSON.stringify({ valid: true, ...session }), { headers });
      }

      // POST /api/auth/logout
      if (path === '/api/auth/logout' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          await env.WEBGEN_KV.delete(`session:${authHeader.slice(7)}`);
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // POST /api/auth/change-password
      if (path === '/api/auth/change-password' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers });
        }
        const { currentPassword, newPassword } = await request.json();
        if (!newPassword || newPassword.length < 8) {
          return new Response(JSON.stringify({ error: 'New password must be at least 8 characters.' }), { status: 400, headers });
        }
        const admin = await env.WEBGEN_KV.get('admin:credentials', 'json');
        const currentHash = await hashPassword(currentPassword);
        if (currentHash !== admin.passwordHash) {
          return new Response(JSON.stringify({ error: 'Current password incorrect.' }), { status: 400, headers });
        }
        admin.passwordHash = await hashPassword(newPassword);
        await env.WEBGEN_KV.put('admin:credentials', JSON.stringify(admin));
        return new Response(JSON.stringify({ success: true, message: 'Password changed.' }), { headers });
      }

      // ═══════════ SELF-SIGNUP API ═══════════
      // POST /api/signup — Customer self-registration
      if (path === '/api/signup' && request.method === 'POST') {
        if (!checkRateLimit(`signup:${clientIP}`, 5)) {
          return new Response(JSON.stringify({ error: 'Too many signup attempts. Wait a moment.' }), { status: 429, headers });
        }
        const body = sanitizeObject(await request.json());
        const { businessName, ownerName, phone, email, password, plan } = body;
        if (!businessName || !ownerName || !phone || !email) {
          return new Response(JSON.stringify({ error: 'Business name, owner name, phone, and email are required.' }), { status: 400, headers });
        }
        const normalizedEmail = email.toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          return new Response(JSON.stringify({ error: 'Invalid email address.' }), { status: 400, headers });
        }
        const existingCodeForEmail = await env.WEBGEN_KV.get(`client-email:${normalizedEmail}`);
        if (existingCodeForEmail) {
          return new Response(JSON.stringify({ error: 'An account with this email already exists.' }), { status: 409, headers });
        }
        const validPlans = ['free', 'starter', 'standard', 'premium'];
        const selectedPlan = validPlans.includes(plan) ? plan : 'free';

        // Generate unique client code
        let code;
        for (let i = 0; i < 10; i++) {
          code = generateClientCode();
          const existing = await env.WEBGEN_KV.get(`client:${code}`, 'json');
          if (!existing) break;
        }

        // Use provided password (min 8 chars) or generate a random one
        let tempPassword;
        if (password && typeof password === 'string') {
          if (password.length < 8) {
            return new Response(JSON.stringify({ error: 'Password must be at least 8 characters.' }), { status: 400, headers });
          }
          tempPassword = password;
        } else {
          tempPassword = generateToken().slice(0, 12);
        }
        const client = {
          code,
          businessName,
          name: ownerName,
          phone: phone.startsWith('+') ? phone : '+220' + phone.replace(/^0/, ''),
          email: normalizedEmail,
          plan: selectedPlan,
          pakket: selectedPlan,
          password: tempPassword,
          status: selectedPlan === 'free' ? 'active' : 'pending_payment',
          subscription: {
            plan: selectedPlan,
            status: selectedPlan === 'free' ? 'active' : 'pending_payment',
            startDate: new Date().toISOString(),
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          },
          tokens: { starter: 15, standard: 50, premium: 200, free: 3 }[selectedPlan] || 3,
          createdAt: new Date().toISOString()
        };

        await env.WEBGEN_KV.put(`client:${code}`, JSON.stringify(client));
        await env.WEBGEN_KV.put(`client-email:${normalizedEmail}`, code);
        const list = await env.WEBGEN_KV.get('clients:list', 'json') || [];
        list.push(code);
        await env.WEBGEN_KV.put('clients:list', JSON.stringify(list));

        return new Response(JSON.stringify({
          success: true,
          clientCode: code,
          email: normalizedEmail,
          password: tempPassword,
          plan: selectedPlan,
          trialDays: 14,
          message: `Account created! Login with ${normalizedEmail}. Code: ${code}`
        }), { headers });
      }

      // ═══════════ SUBSCRIPTION API ═══════════
      // GET /api/subscription/:code — Check subscription status
      const subMatch = path.match(/^\/api\/subscription\/([A-Z0-9-]+)$/i);
      if (subMatch && request.method === 'GET') {
        const code = subMatch[1].toUpperCase();
        const client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
        if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers });
        const sub = client.subscription || {};
        const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
        const isTrialActive = trialEnd && trialEnd > new Date();
        return new Response(JSON.stringify({
          plan: sub.plan || client.pakket || 'free',
          status: sub.status || 'active',
          trialActive: isTrialActive,
          trialEndsAt: sub.trialEndsAt || null,
          tokens: client.tokens || 0
        }), { headers });
      }

      // POST /api/subscription/upgrade — Upgrade/activate plan after payment
      if (path === '/api/subscription/upgrade' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers });
        const { clientCode, plan, billing, paymentRef, paymentMethod } = await request.json();
        const code = (clientCode || session.clientCode || '').toUpperCase();
        const client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
        if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers });

        const validPlans = ['free', 'starter', 'standard', 'premium'];
        if (!validPlans.includes(plan)) {
          return new Response(JSON.stringify({ error: 'Invalid plan.' }), { status: 400, headers });
        }

        const billingCycle = billing === 'yearly' ? 'yearly' : 'monthly';
        const prices = { free: 0, starter: 2500, standard: 5000, premium: 8500 };
        const monthlyPrice = prices[plan] || 0;
        const yearlyPrice = monthlyPrice * 10; // 2 months free
        const amount = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;
        const nextDue = billingCycle === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        client.plan = plan;
        client.pakket = plan;
        client.tokens = { free: 3, starter: 15, standard: 50, premium: 200 }[plan];
        client.subscription = {
          ...client.subscription,
          plan,
          billing: billingCycle,
          status: 'active',
          amount,
          lastPayment: new Date().toISOString(),
          paymentRef: sanitize(paymentRef || ''),
          paymentMethod: sanitize(paymentMethod || 'wave'),
          nextPaymentDue: nextDue.toISOString()
        };
        client.status = 'active';
        await env.WEBGEN_KV.put(`client:${code}`, JSON.stringify(client));

        // Log payment
        const payments = await env.WEBGEN_KV.get('payments:log', 'json') || [];
        payments.unshift({
          id: 'PAY-' + Date.now(),
          clientCode: code,
          plan, billing: billingCycle,
          amount,
          method: paymentMethod || 'wave',
          ref: paymentRef || '',
          status: 'confirmed',
          createdAt: new Date().toISOString()
        });
        if (payments.length > 1000) payments.length = 1000;
        await env.WEBGEN_KV.put('payments:log', JSON.stringify(payments));

        // Auto-create invoice
        const invoices = await env.WEBGEN_KV.get('invoices:all', 'json') || [];
        invoices.unshift({
          id: 'INV-' + Date.now(),
          clientCode: code,
          clientName: client.name || client.businessName,
          amount,
          plan,
          billing: billingCycle,
          status: 'paid',
          paymentRef: paymentRef || '',
          paymentMethod: paymentMethod || 'wave',
          createdAt: new Date().toISOString()
        });
        await env.WEBGEN_KV.put('invoices:all', JSON.stringify(invoices));

        return new Response(JSON.stringify({
          success: true, plan, billing: billingCycle,
          amount, tokens: client.tokens,
          nextPaymentDue: nextDue.toISOString()
        }), { headers });
      }

      // POST /api/payment/verify — Verify Wave/Afrimoney payment
      if (path === '/api/payment/verify' && request.method === 'POST') {
        const body = await request.json();
        const { clientCode, paymentRef, method, amount } = body;
        if (!clientCode || !paymentRef) {
          return new Response(JSON.stringify({ error: 'Client code and payment reference required.' }), { status: 400, headers });
        }

        // Wave Money verification (when Wave API is available)
        // For now: manual verification by admin, or auto-accept with ref
        const payment = {
          id: 'PAY-' + Date.now(),
          clientCode: clientCode.toUpperCase(),
          amount: parseFloat(amount) || 0,
          method: sanitize(method || 'wave'),
          ref: sanitize(paymentRef),
          status: 'pending_verification',
          createdAt: new Date().toISOString()
        };

        const payments = await env.WEBGEN_KV.get('payments:log', 'json') || [];
        payments.unshift(payment);
        await env.WEBGEN_KV.put('payments:log', JSON.stringify(payments));

        // Create notification for admin
        const notifs = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        notifs.unshift({
          id: 'NOT-' + Date.now(),
          title: 'New Payment Received',
          message: `${clientCode} sent D ${amount} via ${method}. Ref: ${paymentRef}. Please verify and activate.`,
          type: 'invoice', target: 'all', targetType: 'staff',
          createdBy: 'system', createdAt: new Date().toISOString(), read: []
        });
        if (notifs.length > 200) notifs.length = 200;
        await env.WEBGEN_KV.put('notifications:all', JSON.stringify(notifs));

        return new Response(JSON.stringify({
          success: true, paymentId: payment.id,
          status: 'pending_verification',
          message: 'Payment received. Your account will be activated after verification (usually within 1 hour).'
        }), { headers });
      }

      // POST /api/payment/confirm — Admin confirms payment → activates subscription
      if (path === '/api/payment/confirm' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const { paymentId, clientCode, plan, billing } = await request.json();
        const code = (clientCode || '').toUpperCase();
        const client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
        if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers });

        const billingCycle = billing === 'yearly' ? 'yearly' : 'monthly';
        const prices = { free: 0, starter: 2500, standard: 5000, premium: 8500 };
        const monthlyPrice = prices[plan] || 2500;
        const amount = billingCycle === 'yearly' ? monthlyPrice * 10 : monthlyPrice;
        const nextDue = billingCycle === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        client.plan = plan || 'starter';
        client.pakket = plan || 'starter';
        client.tokens = { free: 3, starter: 15, standard: 50, premium: 200 }[plan] || 15;
        client.status = 'active';
        client.subscription = {
          ...client.subscription,
          plan: plan || 'starter',
          billing: billingCycle,
          status: 'active',
          amount,
          lastPayment: new Date().toISOString(),
          nextPaymentDue: nextDue.toISOString(),
          confirmedBy: session.username || session.name
        };
        await env.WEBGEN_KV.put(`client:${code}`, JSON.stringify(client));

        // Update payment log
        const payments = await env.WEBGEN_KV.get('payments:log', 'json') || [];
        const pay = payments.find(p => p.id === paymentId || p.clientCode === code);
        if (pay) { pay.status = 'confirmed'; pay.confirmedAt = new Date().toISOString(); }
        await env.WEBGEN_KV.put('payments:log', JSON.stringify(payments));

        // Notify client
        const notifs = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        notifs.unshift({
          id: 'NOT-' + Date.now(),
          title: 'Subscription Activated!',
          message: `Your ${plan} plan is now active. ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'} billing: D ${amount}. Next payment: ${nextDue.toLocaleDateString()}.`,
          type: 'success', target: code, targetType: 'client',
          createdBy: 'system', createdAt: new Date().toISOString(), read: []
        });
        await env.WEBGEN_KV.put('notifications:all', JSON.stringify(notifs));

        return new Response(JSON.stringify({ success: true, plan, billing: billingCycle, amount }), { headers });
      }

      // GET /api/payments — Payment history (admin only)
      if (path === '/api/payments' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const payments = await env.WEBGEN_KV.get('payments:log', 'json') || [];
        const limit = parseInt(url.searchParams.get('limit') || '100');
        return new Response(JSON.stringify(payments.slice(0, limit)), { headers });
      }

      // POST /api/subscription/check — Check & enforce subscription status
      if (path === '/api/subscription/check' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers });
        const code = (session.clientCode || '').toUpperCase();
        if (!code) return new Response(JSON.stringify({ active: true, reason: 'admin' }), { headers });

        const client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
        if (!client) return new Response(JSON.stringify({ active: false, reason: 'not_found' }), { headers });

        const sub = client.subscription || {};
        const plan = sub.plan || client.plan || 'free';

        // Free plan is always active
        if (plan === 'free') return new Response(JSON.stringify({ active: true, plan: 'free', features: { tools: 1, ai: false, cms: false, templates: 3 } }), { headers });

        // Check trial
        const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
        if (trialEnd && trialEnd > new Date() && sub.status !== 'active') {
          const daysLeft = Math.ceil((trialEnd - new Date()) / 86400000);
          return new Response(JSON.stringify({
            active: true, plan, trial: true, daysLeft,
            features: getPlanFeatures(plan),
            message: `Trial: ${daysLeft} days remaining`
          }), { headers });
        }

        // Check if payment is overdue
        const nextDue = sub.nextPaymentDue ? new Date(sub.nextPaymentDue) : null;
        if (nextDue && nextDue < new Date() && sub.status === 'active') {
          // Grace period: 7 days after due date
          const graceDays = 7;
          const graceEnd = new Date(nextDue.getTime() + graceDays * 86400000);
          if (new Date() > graceEnd) {
            // Subscription expired — downgrade to free
            client.plan = 'free';
            client.pakket = 'free';
            client.tokens = 3;
            client.subscription.status = 'expired';
            await env.WEBGEN_KV.put(`client:${code}`, JSON.stringify(client));
            return new Response(JSON.stringify({
              active: false, plan: 'free', reason: 'payment_overdue',
              features: getPlanFeatures('free'),
              message: 'Your subscription has expired. Please renew to restore your plan.'
            }), { headers });
          } else {
            const daysLeft = Math.ceil((graceEnd - new Date()) / 86400000);
            return new Response(JSON.stringify({
              active: true, plan, grace: true, graceDaysLeft: daysLeft,
              features: getPlanFeatures(plan),
              message: `Payment overdue. ${daysLeft} days grace period remaining.`
            }), { headers });
          }
        }

        // Active subscription
        if (sub.status === 'active') {
          return new Response(JSON.stringify({
            active: true, plan, features: getPlanFeatures(plan),
            billing: sub.billing || 'monthly',
            nextPaymentDue: sub.nextPaymentDue
          }), { headers });
        }

        // Pending payment
        return new Response(JSON.stringify({
          active: false, plan, reason: 'pending_payment',
          features: getPlanFeatures('free'),
          message: 'Payment pending. Complete payment to activate your plan.'
        }), { headers });
      }

      // GET /api/pricing — Public pricing info
      if (path === '/api/pricing' && request.method === 'GET') {
        return new Response(JSON.stringify({
          currency: 'GMD',
          currencySymbol: 'D',
          plans: [
            { id: 'free', name: 'Free', monthlyPrice: 0, yearlyPrice: 0, tokens: 3,
              features: { websites: 1, tools: 'basic', ai: false, cms: false, templates: 3, support: 'community' }},
            { id: 'starter', name: 'Starter', monthlyPrice: 2500, yearlyPrice: 25000, tokens: 15,
              features: { websites: 3, tools: 'all', ai: true, cms: true, templates: 10, support: 'whatsapp' }},
            { id: 'standard', name: 'Standard', monthlyPrice: 5000, yearlyPrice: 50000, tokens: 50,
              features: { websites: 10, tools: 'all', ai: true, cms: true, templates: 20, support: 'priority' }},
            { id: 'premium', name: 'Premium', monthlyPrice: 8500, yearlyPrice: 85000, tokens: 200,
              features: { websites: 'unlimited', tools: 'all', ai: true, cms: true, templates: 30, support: 'dedicated' }}
          ],
          paymentMethods: ['wave', 'afrimoney', 'qmoney', 'bank_transfer'],
          trialDays: 14,
          yearlyDiscount: '2 months free'
        }), { headers });
      }

      // ═══════════ STAFF / USER ROLES API ═══════════
      // POST /api/staff — Create staff account (admin only)
      if (path === '/api/staff' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const body = sanitizeObject(await request.json());
        const { username, password, name, permissions, role } = body;
        if (!username || !password || password.length < 8) {
          return new Response(JSON.stringify({ error: 'Username and password (8+ chars) required.' }), { status: 400, headers });
        }
        // Available permissions: read, clients, invoices, cms, tools, reports, settings
        const validPerms = ['read', 'clients', 'invoices', 'cms', 'tools', 'reports', 'settings', 'all'];
        const staffUser = {
          username: username.toLowerCase().trim(),
          passwordHash: await hashPassword(password),
          name: name || username,
          role: role || 'staff', // staff, manager, viewer
          permissions: (permissions || ['read', 'clients']).filter(p => validPerms.includes(p)),
          active: true,
          createdAt: new Date().toISOString()
        };
        await env.WEBGEN_KV.put(`staff:${staffUser.username}`, JSON.stringify(staffUser));
        const staffList = await env.WEBGEN_KV.get('staff:list', 'json') || [];
        if (!staffList.includes(staffUser.username)) {
          staffList.push(staffUser.username);
          await env.WEBGEN_KV.put('staff:list', JSON.stringify(staffList));
        }
        return new Response(JSON.stringify({ success: true, username: staffUser.username, role: staffUser.role }), { headers });
      }

      // GET /api/staff — List all staff (admin only)
      if (path === '/api/staff' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const staffList = await env.WEBGEN_KV.get('staff:list', 'json') || [];
        const staff = [];
        for (const uname of staffList) {
          const s = await env.WEBGEN_KV.get(`staff:${uname}`, 'json');
          if (s) {
            const { passwordHash, ...safe } = s;
            staff.push(safe);
          }
        }
        return new Response(JSON.stringify(staff), { headers });
      }

      // PUT /api/staff/:username — Update staff permissions (admin only)
      const staffMatch = path.match(/^\/api\/staff\/([a-z0-9_-]+)$/i);
      if (staffMatch && request.method === 'PUT') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const uname = staffMatch[1].toLowerCase();
        const existing = await env.WEBGEN_KV.get(`staff:${uname}`, 'json');
        if (!existing) return new Response(JSON.stringify({ error: 'Staff not found.' }), { status: 404, headers });
        const updates = sanitizeObject(await request.json());
        if (updates.permissions) existing.permissions = updates.permissions;
        if (updates.role) existing.role = updates.role;
        if (updates.name) existing.name = updates.name;
        if (typeof updates.active === 'boolean') existing.active = updates.active;
        await env.WEBGEN_KV.put(`staff:${uname}`, JSON.stringify(existing));
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // DELETE /api/staff/:username — Remove staff (admin only)
      if (staffMatch && request.method === 'DELETE') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const uname = staffMatch[1].toLowerCase();
        await env.WEBGEN_KV.delete(`staff:${uname}`);
        const staffList = await env.WEBGEN_KV.get('staff:list', 'json') || [];
        await env.WEBGEN_KV.put('staff:list', JSON.stringify(staffList.filter(s => s !== uname)));
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // ═══════════ NOTIFICATION API ═══════════
      // POST /api/notifications — Create notification
      if (path === '/api/notifications' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Admin/staff access required.' }), { status: 401, headers });
        }
        const body = sanitizeObject(await request.json());
        const { target, targetType, title, message, type } = body;
        // targetType: 'all', 'client', 'staff', 'plan'
        // type: 'info', 'warning', 'success', 'invoice', 'system'
        const notification = {
          id: 'NOT-' + Date.now(),
          title: title || 'Notification',
          message: message || '',
          type: type || 'info',
          target: target || 'all',
          targetType: targetType || 'all',
          createdBy: session.username || session.name,
          createdAt: new Date().toISOString(),
          read: []
        };
        const all = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        all.unshift(notification);
        // Keep max 200 notifications
        if (all.length > 200) all.length = 200;
        await env.WEBGEN_KV.put('notifications:all', JSON.stringify(all));
        return new Response(JSON.stringify({ success: true, notification }), { headers });
      }

      // GET /api/notifications — Get notifications for current user
      if (path === '/api/notifications' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        const all = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        const limit = parseInt(url.searchParams.get('limit') || '50');

        // Filter notifications based on role
        const filtered = all.filter(n => {
          if (n.targetType === 'all') return true;
          if (n.targetType === 'client' && session.role === 'client') {
            return n.target === session.clientCode || n.target === 'all-clients';
          }
          if (n.targetType === 'staff' && (session.role === 'staff' || session.role === 'admin')) return true;
          if (n.targetType === 'plan' && session.pakket === n.target) return true;
          return false;
        }).slice(0, limit);

        const userId = session.username || session.clientCode || 'unknown';
        const unreadCount = filtered.filter(n => !n.read.includes(userId)).length;

        return new Response(JSON.stringify({ notifications: filtered, unreadCount }), { headers });
      }

      // POST /api/notifications/read — Mark notifications as read
      if (path === '/api/notifications/read' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        const { notificationIds } = await request.json();
        const userId = session.username || session.clientCode || 'unknown';
        const all = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        let marked = 0;
        for (const n of all) {
          if (notificationIds.includes(n.id) && !n.read.includes(userId)) {
            n.read.push(userId);
            marked++;
          }
        }
        if (marked > 0) await env.WEBGEN_KV.put('notifications:all', JSON.stringify(all));
        return new Response(JSON.stringify({ success: true, marked }), { headers });
      }

      // POST /api/notifications/broadcast — Send to all clients (admin only)
      if (path === '/api/notifications/broadcast' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const { title, message, type } = sanitizeObject(await request.json());
        const notification = {
          id: 'NOT-' + Date.now(),
          title: title || 'Announcement',
          message: message || '',
          type: type || 'info',
          target: 'all',
          targetType: 'all',
          createdBy: session.username || session.name,
          createdAt: new Date().toISOString(),
          read: []
        };
        const all = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        all.unshift(notification);
        if (all.length > 200) all.length = 200;
        await env.WEBGEN_KV.put('notifications:all', JSON.stringify(all));
        return new Response(JSON.stringify({ success: true, notification }), { headers });
      }

      // ═══════════ EMAIL API ═══════════
      // POST /api/email/send — Send email via MailChannels (Cloudflare Workers integration)
      if (path === '/api/email/send' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Admin/staff access required.' }), { status: 401, headers });
        }
        if (!checkRateLimit(`email:${clientIP}`, 20)) {
          return new Response(JSON.stringify({ error: 'Email rate limit reached.' }), { status: 429, headers });
        }
        const body = sanitizeObject(await request.json());
        const { to, subject, html, template, templateData } = body;
        if (!to || !subject) {
          return new Response(JSON.stringify({ error: 'Recipient (to) and subject required.' }), { status: 400, headers });
        }

        // Build email HTML from template or raw
        let emailHtml = html || '';
        if (template) {
          emailHtml = buildEmailTemplate(template, templateData || {});
        }

        // Send via MailChannels (free with CF Workers)
        const fromEmail = env.FROM_EMAIL || 'noreply@webgen-gambia.com';
        const fromName = env.FROM_NAME || 'WebGen Gambia';
        try {
          const mailRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to }] }],
              from: { email: fromEmail, name: fromName },
              subject: subject,
              content: [{ type: 'text/html', value: emailHtml }]
            })
          });

          // Log the email
          const emailLog = await env.WEBGEN_KV.get('email:log', 'json') || [];
          emailLog.unshift({
            id: 'EM-' + Date.now(),
            to, subject, template: template || 'custom',
            status: mailRes.ok ? 'sent' : 'failed',
            statusCode: mailRes.status,
            sentBy: session.username || session.name,
            sentAt: new Date().toISOString()
          });
          if (emailLog.length > 500) emailLog.length = 500;
          await env.WEBGEN_KV.put('email:log', JSON.stringify(emailLog));

          if (mailRes.ok || mailRes.status === 202) {
            return new Response(JSON.stringify({ success: true, message: 'Email sent.' }), { headers });
          } else {
            return new Response(JSON.stringify({ error: 'Email delivery failed.', status: mailRes.status }), { status: 502, headers });
          }
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Email service error: ' + e.message }), { status: 500, headers });
        }
      }

      // POST /api/email/invoice — Send invoice email to client
      if (path === '/api/email/invoice' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Admin/staff access required.' }), { status: 401, headers });
        }
        const { clientCode, invoiceId, amount, dueDate } = await request.json();
        const client = await env.WEBGEN_KV.get(`client:${clientCode}`, 'json');
        if (!client || !client.email) {
          return new Response(JSON.stringify({ error: 'Client not found or no email address.' }), { status: 400, headers });
        }
        const emailHtml = buildEmailTemplate('invoice', {
          clientName: client.name || client.businessName,
          invoiceId: invoiceId || 'INV-' + Date.now(),
          amount: amount || '0',
          dueDate: dueDate || 'Upon receipt',
          plan: client.plan || client.pakket || 'starter'
        });
        const fromEmail = env.FROM_EMAIL || 'noreply@webgen-gambia.com';
        try {
          await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: client.email }] }],
              from: { email: fromEmail, name: 'WebGen Gambia' },
              subject: `Invoice ${invoiceId} — WebGen Gambia`,
              content: [{ type: 'text/html', value: emailHtml }]
            })
          });

          // Also create notification for client
          const all = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
          all.unshift({
            id: 'NOT-' + Date.now(), title: 'New Invoice',
            message: `Invoice ${invoiceId} for D ${amount} has been sent.`,
            type: 'invoice', target: clientCode, targetType: 'client',
            createdBy: 'system', createdAt: new Date().toISOString(), read: []
          });
          if (all.length > 200) all.length = 200;
          await env.WEBGEN_KV.put('notifications:all', JSON.stringify(all));

          return new Response(JSON.stringify({ success: true, message: 'Invoice email sent.' }), { headers });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Failed: ' + e.message }), { status: 500, headers });
        }
      }

      // POST /api/email/welcome — Send welcome email to new client
      if (path === '/api/email/welcome' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Admin/staff access required.' }), { status: 401, headers });
        }
        const { clientCode } = await request.json();
        const client = await env.WEBGEN_KV.get(`client:${clientCode}`, 'json');
        if (!client || !client.email) {
          return new Response(JSON.stringify({ error: 'Client not found or no email.' }), { status: 400, headers });
        }
        const emailHtml = buildEmailTemplate('welcome', {
          clientName: client.name || client.businessName,
          clientCode: clientCode,
          plan: client.plan || client.pakket || 'free',
          portalUrl: (env.SITE_URL || 'https://webgen-gambia.pages.dev') + '/klant.html'
        });
        const fromEmail = env.FROM_EMAIL || 'noreply@webgen-gambia.com';
        try {
          await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: client.email }] }],
              from: { email: fromEmail, name: 'WebGen Gambia' },
              subject: 'Welcome to WebGen Gambia!',
              content: [{ type: 'text/html', value: emailHtml }]
            })
          });
          return new Response(JSON.stringify({ success: true, message: 'Welcome email sent.' }), { headers });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Failed: ' + e.message }), { status: 500, headers });
        }
      }

      // GET /api/email/log — View email sending history
      if (path === '/api/email/log' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const log = await env.WEBGEN_KV.get('email:log', 'json') || [];
        const limit = parseInt(url.searchParams.get('limit') || '50');
        return new Response(JSON.stringify(log.slice(0, limit)), { headers });
      }

      // ═══════════ ANALYTICS / TRACKING API ═══════════
      // POST /api/analytics/track — Track event (page view, tool usage, etc)
      if (path === '/api/analytics/track' && request.method === 'POST') {
        const body = await request.json();
        const { event, clientCode, page, tool, meta } = body;
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const key = `analytics:${today}`;
        const dayData = await env.WEBGEN_KV.get(key, 'json') || { events: [], pageViews: {}, toolUsage: {}, visitors: [] };

        // Track event
        dayData.events.push({
          event: sanitize(event || 'pageview'),
          clientCode: sanitize(clientCode || ''),
          page: sanitize(page || ''),
          tool: sanitize(tool || ''),
          ip: clientIP,
          ts: Date.now()
        });

        // Aggregate page views
        if (page) dayData.pageViews[page] = (dayData.pageViews[page] || 0) + 1;
        if (tool) dayData.toolUsage[tool] = (dayData.toolUsage[tool] || 0) + 1;
        if (clientCode && !dayData.visitors.includes(clientCode)) dayData.visitors.push(clientCode);

        // Keep max 1000 events per day
        if (dayData.events.length > 1000) dayData.events = dayData.events.slice(-1000);

        await env.WEBGEN_KV.put(key, JSON.stringify(dayData), { expirationTtl: 90 * 86400 }); // 90 day retention
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // GET /api/analytics/dashboard — Enhanced dashboard with MRR, churn, top tools
      if (path === '/api/analytics/dashboard' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        }

        const now = Date.now();
        const day = 86400000;
        const stats = {
          totalEvents: 0, todayEvents: 0,
          pageViews: {}, toolUsage: {},
          dailyTrend: [],
          mrr: 0, activeSubscriptions: 0, trialUsers: 0, churnedUsers: 0,
          topTools: [], recentSignups: 0
        };

        // Collect analytics events (last 30 days)
        const eventList = await env.WEBGEN_KV.list({ prefix: 'analytics:' });
        for (const key of eventList.keys) {
          try {
            const event = JSON.parse(await env.WEBGEN_KV.get(key.name));
            if (!event) continue;
            stats.totalEvents++;

            const eventAge = now - new Date(event.timestamp).getTime();
            if (eventAge < day) stats.todayEvents++;

            if (event.type === 'page_view') {
              stats.pageViews[event.page] = (stats.pageViews[event.page] || 0) + 1;
            }
            if (event.type === 'tool_use') {
              stats.toolUsage[event.tool] = (stats.toolUsage[event.tool] || 0) + 1;
            }

            // Daily trend (last 7 days)
            const dayIndex = Math.floor(eventAge / day);
            if (dayIndex < 7) {
              if (!stats.dailyTrend[dayIndex]) stats.dailyTrend[dayIndex] = { day: dayIndex, events: 0 };
              stats.dailyTrend[dayIndex].events++;
            }
          } catch(e) {}
        }

        // Calculate MRR from subscriptions
        const prices = { free: 0, starter: 2500, standard: 5000, premium: 8500 };
        const clientList = await env.WEBGEN_KV.list({ prefix: 'client:' });
        for (const key of clientList.keys) {
          if (key.name.includes(':sub')) continue;
          try {
            const client = JSON.parse(await env.WEBGEN_KV.get(key.name));
            if (!client) continue;

            const sub = JSON.parse(await env.WEBGEN_KV.get(`${key.name}:sub`) || 'null');
            if (sub) {
              if (sub.status === 'active') {
                stats.activeSubscriptions++;
                stats.mrr += prices[sub.plan] || 0;
              } else if (sub.status === 'trial') {
                stats.trialUsers++;
              } else if (sub.status === 'expired' || sub.status === 'cancelled') {
                stats.churnedUsers++;
              }
            }

            // Recent signups (last 30 days)
            if (client.createdAt && (now - new Date(client.createdAt).getTime()) < day * 30) {
              stats.recentSignups++;
            }
          } catch(e) {}
        }

        // Sort top tools
        stats.topTools = Object.entries(stats.toolUsage)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tool, count]) => ({ tool, count }));

        return new Response(JSON.stringify({ success: true, stats }), { headers });
      }

      // ═══════════ AI GENERATION ═══════════
      // POST /api/ai/generate-post — generate 3 social media post variations
      if (path === '/api/ai/generate-post' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'client') {
          return new Response(JSON.stringify({ error: 'Client login required.' }), { status: 401, headers });
        }
        if (!checkRateLimit(`ai:${session.clientCode}`, 20)) {
          return new Response(JSON.stringify({ error: 'Too many AI requests. Please wait a minute.' }), { status: 429, headers });
        }
        const body = sanitizeObject(await request.json());
        const { topic, language, tone, businessName, businessType, address } = body;
        if (!topic) {
          return new Response(JSON.stringify({ error: 'Topic is required.' }), { status: 400, headers });
        }

        // Feature-gate based on plan
        const client = await env.WEBGEN_KV.get(`client:${session.clientCode}`, 'json');
        if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers });
        const plan = (client.pakket || client.plan || 'free').toLowerCase();
        const features = getPlanFeatures(plan);
        if (!features.ai) {
          return new Response(JSON.stringify({ error: 'AI is not included in your plan. Upgrade to Business or Complete.', upgrade: true }), { status: 402, headers });
        }

        // Token accounting (3 tokens per generation)
        const COST = 3;
        const tokensLeft = typeof client.tokens === 'number' ? client.tokens : 0;
        if (tokensLeft < COST) {
          return new Response(JSON.stringify({ error: `Not enough AI tokens (need ${COST}, have ${tokensLeft}).`, needsTokens: true }), { status: 402, headers });
        }

        const langMap = { en: 'English', wo: 'Wolof', fr: 'French', ma: 'Mandinka', nl: 'Dutch' };
        const langName = langMap[(language || 'en').toLowerCase()] || 'English';
        const toneName = tone || 'warm and friendly';
        const biz = businessName || client.businessName || client.name || 'the business';
        const type = businessType || client.category || '';
        const loc = address || client.address || 'The Gambia';

        let variations = null;
        let usedModel = 'template';
        const apiKey = env.OPENAI_API_KEY;

        if (apiKey) {
          // Try OpenAI gpt-4o-mini for real AI generation
          const prompt = `You are a social media writer for a small business in The Gambia.
Business: ${biz}${type ? ` (${type})` : ''}
Location: ${loc}
Topic: ${topic}
Write in ${langName} with a ${toneName} tone.
Output exactly 3 post variations. Each post must:
- Be 2-4 sentences, under 280 characters
- Include 1-3 relevant emojis naturally placed
- Include a clear call-to-action (visit, call, WhatsApp)
- Feel authentic to a Gambian small business, not corporate
- If language is Wolof or Mandinka, use authentic local phrases

Return ONLY a JSON array of 3 strings, no commentary. Example: ["post 1 text", "post 2 text", "post 3 text"]`;

          try {
            const ai = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: 'You write short, warm social media posts for small Gambian businesses. Always return a JSON array of exactly 3 strings.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.9,
                max_tokens: 500
              })
            });
            if (ai.ok) {
              const aiData = await ai.json();
              const content = aiData?.choices?.[0]?.message?.content || '';
              // Extract JSON array from content
              const match = content.match(/\[[\s\S]*\]/);
              if (match) {
                try {
                  const parsed = JSON.parse(match[0]);
                  if (Array.isArray(parsed) && parsed.length >= 1) {
                    variations = parsed.slice(0, 3).map(s => String(s).trim());
                    usedModel = 'gpt-4o-mini';
                  }
                } catch (e) { /* fall through to template */ }
              }
            }
          } catch (e) { /* fall through to template */ }
        }

        // Template fallback (when no API key, or AI call fails)
        if (!variations) {
          const templates = {
            English: [
              `✨ Something new at ${biz}! ${topic}. Drop by today in ${loc} — we're excited to welcome you.`,
              `Friends, ${biz} has ${topic}. Real quality, real smiles. Message us on WhatsApp or visit us! 💛`,
              `📍 ${biz}, ${loc} — ${topic}. Come see for yourself. Your support means everything.`
            ],
            Wolof: [
              `🌟 Xibaar bu baax! ${biz} am na ${topic}. Kaay ci ${loc} tey, dinanu la xool. 💛`,
              `Xarit yi, ${biz} jox na ${topic}. Bind ma WhatsApp walla kaay ci butik bi! 📍 ${loc}`,
              `${biz} — ${topic}. Sunu liggéey ak muñ. Jërëjëf ci sa ndimbal. ❤️`
            ],
            French: [
              `✨ Nouveauté chez ${biz}! ${topic}. Passez nous voir à ${loc} — on vous attend avec le sourire.`,
              `Amis, ${biz} vous propose ${topic}. Qualité garantie, accueil chaleureux. WhatsApp ou sur place! 💛`,
              `📍 ${biz}, ${loc} — ${topic}. Venez découvrir. Votre soutien compte pour nous.`
            ],
            Mandinka: [
              `🌟 Kibaaroo kumandingo! ${biz} ye ${topic} soto. Na i naa ${loc} kono. 💛`,
              `Teri lu, ${biz} ye ${topic} dii i la. Naafulo kumandingo. Naa sacc! 📍 ${loc}`,
              `${biz} — ${topic}. Anta jarabi, anta kanoo. Kanoo kumandingo. ❤️`
            ],
            Dutch: [
              `✨ Nieuw bij ${biz}! ${topic}. Kom langs in ${loc} — tot snel!`,
              `${biz} heeft ${topic}. Kwaliteit en service met een glimlach. Stuur ons een WhatsApp! 💛`,
              `📍 ${biz}, ${loc} — ${topic}. Kom het zelf ontdekken.`
            ]
          };
          variations = templates[langName] || templates.English;
        }

        // Deduct tokens and save
        client.tokens = tokensLeft - COST;
        client.tokensUsed = (client.tokensUsed || 0) + COST;
        await env.WEBGEN_KV.put(`client:${session.clientCode}`, JSON.stringify(client));

        return new Response(JSON.stringify({
          success: true,
          variations,
          model: usedModel,
          tokensUsed: COST,
          tokensLeft: client.tokens,
          language: langName
        }), { headers });
      }

      // ═══════════ WHATSAPP NOTIFICATIONS ═══════════
      // POST /api/whatsapp/send — Send WhatsApp message via link generation
      if (path === '/api/whatsapp/send' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        const body = sanitizeObject(await request.json());
        const { phone, message, type } = body;
        if (!phone || !message) return new Response(JSON.stringify({ error: 'Phone and message required' }), { status: 400, headers });

        // Clean phone number (Gambian format)
        const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^00/, '+');
        const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : '+220' + cleanPhone;

        // Generate WhatsApp link
        const waLink = `https://wa.me/${fullPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;

        // Log the notification
        const logKey = `whatsapp:log:${Date.now()}`;
        await env.WEBGEN_KV.put(logKey, JSON.stringify({
          phone: fullPhone, type: type || 'general', message, sentBy: session.username || session.name, sentAt: new Date().toISOString()
        }), { expirationTtl: 86400 * 90 });

        return new Response(JSON.stringify({ success: true, waLink, phone: fullPhone }), { headers });
      }

      // POST /api/whatsapp/welcome — Send welcome message to new client
      if (path === '/api/whatsapp/welcome' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        const body = sanitizeObject(await request.json());
        const { phone, clientCode, businessName } = body;
        if (!phone || !clientCode) return new Response(JSON.stringify({ error: 'Phone and clientCode required' }), { status: 400, headers });

        const siteUrl = env.SITE_URL || 'https://webgen-gambia.pages.dev';
        const message = `Welcome to WebGen Gambia! 🎉\n\nYour account is ready:\n📋 Client Code: ${clientCode}\n🌐 Portal: ${siteUrl}/klant.html\n\nYou have a 14-day free trial. Build your website today!\n\nNeed help? Reply to this message.\n— WebGen Gambia by KOK Enterprises`;

        const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^00/, '+');
        const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : '+220' + cleanPhone;
        const waLink = `https://wa.me/${fullPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;

        return new Response(JSON.stringify({ success: true, waLink, message, phone: fullPhone }), { headers });
      }

      // POST /api/whatsapp/reminder — Send payment reminder
      if (path === '/api/whatsapp/reminder' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        const body = sanitizeObject(await request.json());
        const { phone, clientCode, businessName, amount, dueDate } = body;
        if (!phone || !amount) return new Response(JSON.stringify({ error: 'Phone and amount required' }), { status: 400, headers });

        const message = `Hi ${businessName || 'there'}! 👋\n\nYour WebGen Gambia subscription payment of GMD ${amount} is due${dueDate ? ' on ' + dueDate : ''}.\n\nPay via:\n💰 Wave: +220 XXXXXXX\n💳 Afrimoney: +220 XXXXXXX\n🏦 Bank: Trust Bank Gambia\n\nRef: ${clientCode || 'N/A'}\n\nQuestions? Reply here.\n— WebGen Gambia`;

        const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^00/, '+');
        const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : '+220' + cleanPhone;
        const waLink = `https://wa.me/${fullPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;

        return new Response(JSON.stringify({ success: true, waLink, message, phone: fullPhone }), { headers });
      }

      // ═══════════ RESELLER / AGENT API ═══════════
      // NOTE: POST /api/agents/register is defined below in the RESELLER/AGENT API section (line ~1745)
      // with stricter validation (email required, 8+ char password). Duplicate removed 2026-04-23.

      // GET /api/agents — List all agents (admin only)
      if (path === '/api/agents' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 401, headers });
        }
        const agentList = await env.WEBGEN_KV.get('agents:list', 'json') || [];
        const agents = [];
        for (const code of agentList) {
          const a = await env.WEBGEN_KV.get(`agent:${code}`, 'json');
          if (a) { delete a.password; agents.push(a); }
        }
        return new Response(JSON.stringify({ success: true, agents }), { headers });
      }

      // PUT /api/agents/:code — Update agent (admin: approve/suspend, or agent: update profile)
      const agentMatch = path.match(/^\/api\/agents\/([A-Z0-9-]+)$/i);
      if (agentMatch && request.method === 'PUT') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401, headers });
        const code = agentMatch[1].toUpperCase();
        const agent = await env.WEBGEN_KV.get(`agent:${code}`, 'json');
        if (!agent) return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404, headers });
        const updates = sanitizeObject(await request.json());
        if (session.role === 'admin') {
          if (updates.status) agent.status = updates.status; // approve, suspend, active
          if (updates.commissionRate) agent.commissionRate = updates.commissionRate;
        }
        if (updates.phone) agent.phone = updates.phone;
        if (updates.location) agent.location = updates.location;
        await env.WEBGEN_KV.put(`agent:${code}`, JSON.stringify(agent));
        return new Response(JSON.stringify({ success: true, agent: { ...agent, password: undefined } }), { headers });
      }

      // POST /api/agents/:code/referral — Register a client referral from an agent
      const refMatch = path.match(/^\/api\/agents\/([A-Z0-9-]+)\/referral$/i);
      if (refMatch && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401, headers });
        const agentCode = refMatch[1].toUpperCase();
        const agent = await env.WEBGEN_KV.get(`agent:${agentCode}`, 'json');
        if (!agent || agent.status !== 'active') {
          return new Response(JSON.stringify({ error: 'Agent not found or not active' }), { status: 404, headers });
        }
        const { clientCode } = await request.json();
        if (!clientCode) return new Response(JSON.stringify({ error: 'clientCode required' }), { status: 400, headers });
        const client = await env.WEBGEN_KV.get(`client:${clientCode}`, 'json');
        if (!client) return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers });
        // Link client to agent
        client.referredBy = agentCode;
        await env.WEBGEN_KV.put(`client:${clientCode}`, JSON.stringify(client));
        // Add to agent's client list and commission
        if (!agent.clients.includes(clientCode)) {
          agent.clients.push(clientCode);
          const commission = agent.commissionRate || 500; // Default GMD 500
          agent.totalCommission = (agent.totalCommission || 0) + commission;
          // Log the referral
          const referrals = await env.WEBGEN_KV.get(`referrals:${agentCode}`, 'json') || [];
          referrals.push({ clientCode, commission, date: new Date().toISOString(), status: 'pending' });
          await env.WEBGEN_KV.put(`referrals:${agentCode}`, JSON.stringify(referrals));
        }
        await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));
        return new Response(JSON.stringify({ success: true, totalClients: agent.clients.length, totalCommission: agent.totalCommission }), { headers });
      }

      // GET /api/agents/:code/dashboard — Agent dashboard with stats
      const agentDashMatch = path.match(/^\/api\/agents\/([A-Z0-9-]+)\/dashboard$/i);
      if (agentDashMatch && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401, headers });
        const agentCode = agentDashMatch[1].toUpperCase();
        const agent = await env.WEBGEN_KV.get(`agent:${agentCode}`, 'json');
        if (!agent) return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404, headers });
        const referrals = await env.WEBGEN_KV.get(`referrals:${agentCode}`, 'json') || [];
        // Get this month's stats
        const now = new Date();
        const thisMonth = referrals.filter(r => {
          const d = new Date(r.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        return new Response(JSON.stringify({
          success: true,
          agent: { code: agent.code, name: agent.name, status: agent.status, joinedAt: agent.joinedAt },
          stats: {
            totalClients: agent.clients.length,
            totalCommission: agent.totalCommission || 0,
            paidCommission: agent.paidCommission || 0,
            pendingCommission: (agent.totalCommission || 0) - (agent.paidCommission || 0),
            thisMonth: { clients: thisMonth.length, commission: thisMonth.reduce((s, r) => s + r.commission, 0) }
          },
          recentReferrals: referrals.slice(-10).reverse()
        }), { headers });
      }

      // POST /api/agents/:code/payout — Record commission payout (admin only)
      const payoutMatch = path.match(/^\/api\/agents\/([A-Z0-9-]+)\/payout$/i);
      if (payoutMatch && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 401, headers });
        }
        const agentCode = payoutMatch[1].toUpperCase();
        const agent = await env.WEBGEN_KV.get(`agent:${agentCode}`, 'json');
        if (!agent) return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404, headers });
        const { amount, method } = await request.json();
        if (!amount || amount <= 0) return new Response(JSON.stringify({ error: 'Valid amount required' }), { status: 400, headers });
        agent.paidCommission = (agent.paidCommission || 0) + amount;
        const payouts = await env.WEBGEN_KV.get(`payouts:${agentCode}`, 'json') || [];
        payouts.push({ amount, method: method || 'wave', date: new Date().toISOString() });
        await env.WEBGEN_KV.put(`payouts:${agentCode}`, JSON.stringify(payouts));
        await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));
        return new Response(JSON.stringify({ success: true, paidCommission: agent.paidCommission, pendingCommission: agent.totalCommission - agent.paidCommission }), { headers });
      }

      // ═══════════ SYNC API ═══════════
      if (path === '/api/sync/upload' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const { clients, invoices, cms } = await request.json();
        let synced = { clients: 0, invoices: 0, cms: 0 };

        if (clients && Array.isArray(clients)) {
          const codeList = await env.WEBGEN_KV.get('clients:list', 'json') || [];
          for (const c of clients) {
            const code = c.code || c.clientCode;
            if (!code) continue;
            if (!codeList.includes(code)) codeList.push(code);
            await env.WEBGEN_KV.put(`client:${code}`, JSON.stringify(sanitizeObject(c)));
            synced.clients++;
          }
          await env.WEBGEN_KV.put('clients:list', JSON.stringify(codeList));
        }

        if (invoices && Array.isArray(invoices)) {
          const existing = await env.WEBGEN_KV.get('invoices:all', 'json') || [];
          const merged = [...invoices, ...existing];
          await env.WEBGEN_KV.put('invoices:all', JSON.stringify(merged));
          synced.invoices = invoices.length;
        }

        if (cms && typeof cms === 'object') {
          for (const [code, data] of Object.entries(cms)) {
            await env.WEBGEN_KV.put(`cms:${code}`, JSON.stringify(data));
            synced.cms++;
          }
        }

        return new Response(JSON.stringify({ success: true, synced }), { headers });
      }

      // ═══════════ CMS API ═══════════
      const cmsMatch = path.match(/^\/api\/cms\/([A-Z0-9-]+)$/i);
      if (cmsMatch) {
        const clientCode = cmsMatch[1].toUpperCase();
        if (request.method === 'GET') {
          const data = await env.WEBGEN_KV.get(`cms:${clientCode}`, 'json');
          return new Response(JSON.stringify(data || { photos: [], blogs: [], products: [] }), { headers });
        }
        if (request.method === 'PUT') {
          const body = await request.json();
          await env.WEBGEN_KV.put(`cms:${clientCode}`, JSON.stringify(body));
          return new Response(JSON.stringify({ success: true }), { headers });
        }
      }

      // ═══════════ WEBSITE BUILDER STATE API ═══════════
      // Stores the full builder state (layout, fonts, sections, formData) separately from CMS.
      // Auth required: only the owning client, or admin/staff, can read/write.
      const websiteMatch = path.match(/^\/api\/website\/([A-Z0-9-]+)$/i);
      if (websiteMatch) {
        const clientCode = websiteMatch[1].toUpperCase();
        const session = await verifyAuth(request);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        }
        const allowed = session.role === 'admin'
          || session.role === 'staff'
          || (session.role === 'client' && session.clientCode === clientCode);
        if (!allowed) {
          return new Response(JSON.stringify({ error: 'Forbidden.' }), { status: 403, headers });
        }
        if (request.method === 'GET') {
          const data = await env.WEBGEN_KV.get(`website:${clientCode}`, 'json');
          return new Response(JSON.stringify(data || null), { headers });
        }
        if (request.method === 'PUT') {
          const body = await request.json();
          // Limit state size to 500KB to avoid KV quota abuse
          const json = JSON.stringify(body);
          if (json.length > 500 * 1024) {
            return new Response(JSON.stringify({ error: 'State too large (max 500KB).' }), { status: 413, headers });
          }
          const record = { ...body, updatedAt: new Date().toISOString(), updatedBy: session.clientCode || session.username || session.role };
          await env.WEBGEN_KV.put(`website:${clientCode}`, JSON.stringify(record));
          return new Response(JSON.stringify({ success: true, updatedAt: record.updatedAt }), { headers });
        }
        if (request.method === 'DELETE' && (session.role === 'admin' || session.role === 'staff')) {
          await env.WEBGEN_KV.delete(`website:${clientCode}`);
          return new Response(JSON.stringify({ success: true }), { headers });
        }
      }

      // ═══════════ CLIENTS API ═══════════
      if (path === '/api/clients' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        }
        const list = await env.WEBGEN_KV.get('clients:list', 'json') || [];
        const clients = [];
        for (const code of list) {
          const client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
          if (client) {
            const { password, ...safe } = client;
            clients.push({ code, ...safe });
          }
        }
        return new Response(JSON.stringify(clients), { headers });
      }

      const clientMatch = path.match(/^\/api\/clients\/([A-Z0-9-]+)$/i);
      if (clientMatch) {
        const code = clientMatch[1].toUpperCase();

        if (request.method === 'GET') {
          const client = await env.WEBGEN_KV.get(`client:${code}`, 'json');
          if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers });
          const { password, ...safe } = client;
          return new Response(JSON.stringify({ code, ...safe }), { headers });
        }

        if (request.method === 'PUT') {
          const session = await verifyAuth(request);
          if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
            return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
          }
          const body = sanitizeObject(await request.json());
          const prev = await env.WEBGEN_KV.get(`client:${code}`, 'json');
          const newEmail = body.email ? String(body.email).toLowerCase().trim() : '';
          const prevEmail = prev && prev.email ? String(prev.email).toLowerCase().trim() : '';
          if (newEmail && newEmail !== prevEmail) {
            const owner = await env.WEBGEN_KV.get(`client-email:${newEmail}`);
            if (owner && owner !== code) {
              return new Response(JSON.stringify({ error: 'Email already in use by another client.' }), { status: 409, headers });
            }
          }
          body.email = newEmail;
          await env.WEBGEN_KV.put(`client:${code}`, JSON.stringify(body));
          if (prevEmail && prevEmail !== newEmail) {
            await env.WEBGEN_KV.delete(`client-email:${prevEmail}`);
          }
          if (newEmail) {
            await env.WEBGEN_KV.put(`client-email:${newEmail}`, code);
          }
          const list = await env.WEBGEN_KV.get('clients:list', 'json') || [];
          if (!list.includes(code)) {
            list.push(code);
            await env.WEBGEN_KV.put('clients:list', JSON.stringify(list));
          }
          return new Response(JSON.stringify({ success: true }), { headers });
        }

        if (request.method === 'DELETE') {
          const session = await verifyAuth(request);
          if (!session || session.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
          }
          const prev = await env.WEBGEN_KV.get(`client:${code}`, 'json');
          if (prev && prev.email) {
            await env.WEBGEN_KV.delete(`client-email:${String(prev.email).toLowerCase().trim()}`);
          }
          await env.WEBGEN_KV.delete(`client:${code}`);
          await env.WEBGEN_KV.delete(`cms:${code}`);
          const list = await env.WEBGEN_KV.get('clients:list', 'json') || [];
          await env.WEBGEN_KV.put('clients:list', JSON.stringify(list.filter(c => c !== code)));
          return new Response(JSON.stringify({ success: true }), { headers });
        }
      }

      // ═══════════ INVOICES API ═══════════
      if (path === '/api/invoices' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session) return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        const invoices = await env.WEBGEN_KV.get('invoices:all', 'json') || [];
        if (session.role === 'client') {
          return new Response(JSON.stringify(invoices.filter(i => i.clientCode === session.clientCode)), { headers });
        }
        return new Response(JSON.stringify(invoices), { headers });
      }

      if (path === '/api/invoices' && request.method === 'POST') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Admin/staff access required.' }), { status: 401, headers });
        }
        const invoice = sanitizeObject(await request.json());
        invoice.id = 'INV-' + Date.now();
        invoice.createdAt = new Date().toISOString();
        invoice.createdBy = session.username || session.name;
        const all = await env.WEBGEN_KV.get('invoices:all', 'json') || [];
        all.unshift(invoice);
        await env.WEBGEN_KV.put('invoices:all', JSON.stringify(all));
        return new Response(JSON.stringify({ success: true, invoice }), { headers });
      }

      const invoiceMatch = path.match(/^\/api\/invoices\/([A-Z0-9-]+)$/i);
      if (invoiceMatch && request.method === 'GET') {
        const code = invoiceMatch[1].toUpperCase();
        const all = await env.WEBGEN_KV.get('invoices:all', 'json') || [];
        return new Response(JSON.stringify(all.filter(inv => inv.clientCode === code)), { headers });
      }

      // ═══════════ WEBSITE API (legacy) ═══════════
      // NOTE: /api/website/:code is now handled higher up with auth.
      // /api/generate-website POST kept for backwards-compat with older export flows.
      if (path === '/api/generate-website' && request.method === 'POST') {
        const body = sanitizeObject(await request.json());
        if (!body.clientCode) {
          return new Response(JSON.stringify({ error: 'clientCode required.' }), { status: 400, headers });
        }
        await env.WEBGEN_KV.put(`website:${String(body.clientCode).toUpperCase()}`, JSON.stringify(body));
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // ═══════════ STATS API ═══════════
      if (path === '/api/stats' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || (session.role !== 'admin' && session.role !== 'staff')) {
          return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        }
        const clients = await env.WEBGEN_KV.get('clients:list', 'json') || [];
        const invoices = await env.WEBGEN_KV.get('invoices:all', 'json') || [];
        const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

        // Count by plan
        let planCounts = { free: 0, starter: 0, standard: 0, premium: 0 };
        for (const code of clients) {
          const c = await env.WEBGEN_KV.get(`client:${code}`, 'json');
          if (c) planCounts[c.plan || c.pakket || 'free']++;
        }

        return new Response(JSON.stringify({
          totalClients: clients.length,
          totalInvoices: invoices.length,
          totalRevenue,
          planDistribution: planCounts,
          activeSubscriptions: planCounts.starter + planCounts.standard + planCounts.premium,
          lastUpdated: new Date().toISOString()
        }), { headers });
      }

      // ═══════════ RESELLER/AGENT API ═══════════
      // POST /api/agents/register — Register as reseller agent
      if (path === '/api/agents/register' && request.method === 'POST') {
        if (!checkRateLimit(`agent-signup:${clientIP}`, 5)) {
          return new Response(JSON.stringify({ error: 'Too many signup attempts. Wait a moment.' }), { status: 429, headers });
        }
        const body = sanitizeObject(await request.json());
        const { name, phone, email, password, location } = body;
        if (!name || !phone || !email || !password || password.length < 8) {
          return new Response(JSON.stringify({ error: 'Name, phone, email, and password (8+ chars) are required.' }), { status: 400, headers });
        }

        // Generate unique agent code
        let agentCode;
        for (let i = 0; i < 10; i++) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = 'AG-';
          for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)];
          const existing = await env.WEBGEN_KV.get(`agent:${code}`, 'json');
          if (!existing) {
            agentCode = code;
            break;
          }
        }

        const agent = {
          agentCode,
          name: sanitize(name),
          phone: phone.startsWith('+') ? phone : '+220' + phone.replace(/^0/, ''),
          email: sanitize(email),
          passwordHash: await hashPassword(password),
          location: sanitize(location || ''),
          commissionRate: 500, // GMD per client
          status: 'pending',
          referralLink: (env.SITE_URL || 'https://webgen-gambia.pages.dev') + `/?agent=${agentCode}`,
          clients: [],
          totalEarned: 0,
          createdAt: new Date().toISOString()
        };

        await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));
        const agentList = await env.WEBGEN_KV.get('agents:list', 'json') || [];
        agentList.push(agentCode);
        await env.WEBGEN_KV.put('agents:list', JSON.stringify(agentList));

        // Notify admin of new pending agent
        const notifs = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        notifs.unshift({
          id: 'NOT-' + Date.now(),
          title: 'New Agent Pending Approval',
          message: `${name} (${email}) registered as agent. Agent Code: ${agentCode}. Location: ${location || 'N/A'}`,
          type: 'info',
          target: 'all',
          targetType: 'staff',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          read: []
        });
        if (notifs.length > 200) notifs.length = 200;
        await env.WEBGEN_KV.put('notifications:all', JSON.stringify(notifs));

        return new Response(JSON.stringify({
          success: true,
          agentCode,
          referralLink: agent.referralLink,
          message: 'Agent registration submitted. Awaiting admin approval.'
        }), { headers });
      }

      // GET /api/agents — List all agents (admin only)
      if (path === '/api/agents' && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const agentList = await env.WEBGEN_KV.get('agents:list', 'json') || [];
        const agents = [];
        for (const code of agentList) {
          const agent = await env.WEBGEN_KV.get(`agent:${code}`, 'json');
          if (agent) {
            const { passwordHash, ...safe } = agent;
            const stats = {
              referrals: agent.clients.length,
              totalEarned: agent.totalEarned || 0,
              commissionRate: agent.commissionRate || 500,
              status: agent.status || 'pending'
            };
            agents.push({ ...safe, stats });
          }
        }
        return new Response(JSON.stringify(agents), { headers });
      }

      // GET /api/agents/:code — Get agent details + referred clients (auth required)
      const agentGetMatch = path.match(/^\/api\/agents\/([A-Z0-9-]+)$/i);
      if (agentGetMatch && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        }
        const agentCode = agentGetMatch[1].toUpperCase();
        const agent = await env.WEBGEN_KV.get(`agent:${agentCode}`, 'json');
        if (!agent) {
          return new Response(JSON.stringify({ error: 'Agent not found.' }), { status: 404, headers });
        }

        // Only agent themselves or admin can view details
        if (session.role !== 'admin' && session.role !== 'agent') {
          return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 403, headers });
        }

        const { passwordHash, ...safeAgent } = agent;
        const clientList = [];
        for (const clientCode of agent.clients) {
          const client = await env.WEBGEN_KV.get(`client:${clientCode}`, 'json');
          if (client) {
            clientList.push({
              code: clientCode,
              name: client.name || client.businessName,
              plan: client.plan || client.pakket || 'free',
              status: client.status || 'active',
              createdAt: client.createdAt || null
            });
          }
        }

        return new Response(JSON.stringify({
          ...safeAgent,
          referredClients: clientList,
          stats: {
            totalReferrals: agent.clients.length,
            totalEarned: agent.totalEarned || 0,
            commissionRate: agent.commissionRate || 500
          }
        }), { headers });
      }

      // PUT /api/agents/:code/approve — Approve pending agent (admin only)
      const agentApproveMatch = path.match(/^\/api\/agents\/([A-Z0-9-]+)\/approve$/i);
      if (agentApproveMatch && request.method === 'PUT') {
        const session = await verifyAuth(request);
        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 401, headers });
        }
        const agentCode = agentApproveMatch[1].toUpperCase();
        const agent = await env.WEBGEN_KV.get(`agent:${agentCode}`, 'json');
        if (!agent) {
          return new Response(JSON.stringify({ error: 'Agent not found.' }), { status: 404, headers });
        }

        agent.status = 'active';
        agent.approvedAt = new Date().toISOString();
        agent.approvedBy = session.username || session.name;
        await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));

        // Notify agent of approval
        const notifs = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        notifs.unshift({
          id: 'NOT-' + Date.now(),
          title: 'Agent Approved!',
          message: `Your agent account (${agentCode}) is now active. Start sharing your referral link to earn commissions.`,
          type: 'success',
          target: agentCode,
          targetType: 'agent',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          read: []
        });
        if (notifs.length > 200) notifs.length = 200;
        await env.WEBGEN_KV.put('notifications:all', JSON.stringify(notifs));

        return new Response(JSON.stringify({ success: true, status: 'active', message: 'Agent approved.' }), { headers });
      }

      // POST /api/agents/refer — Track referral when client signs up via agent link
      if (path === '/api/agents/refer' && request.method === 'POST') {
        const body = sanitizeObject(await request.json());
        const { agentCode, clientCode } = body;
        if (!agentCode || !clientCode) {
          return new Response(JSON.stringify({ error: 'agentCode and clientCode are required.' }), { status: 400, headers });
        }

        const agent = await env.WEBGEN_KV.get(`agent:${agentCode}`, 'json');
        if (!agent) {
          return new Response(JSON.stringify({ error: 'Agent not found.' }), { status: 404, headers });
        }

        const client = await env.WEBGEN_KV.get(`client:${clientCode}`, 'json');
        if (!client) {
          return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers });
        }

        // Check if already referred by this agent
        if (agent.clients && agent.clients.includes(clientCode)) {
          return new Response(JSON.stringify({ error: 'Client already referred by this agent.' }), { status: 400, headers });
        }

        // Add client to agent's list
        if (!agent.clients) agent.clients = [];
        agent.clients.push(clientCode);

        // Calculate commission: 500 GMD base, 550 for 5+ clients/month
        let commission = agent.commissionRate || 500;
        if (agent.clients.length >= 5) {
          commission = 550;
        }

        agent.totalEarned = (agent.totalEarned || 0) + commission;
        agent.lastReferralAt = new Date().toISOString();

        await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));

        // Link client to agent
        client.referredBy = agentCode;
        client.referralCommission = commission;
        await env.WEBGEN_KV.put(`client:${clientCode}`, JSON.stringify(client));

        // Create commission record
        const commissions = await env.WEBGEN_KV.get('commissions:log', 'json') || [];
        commissions.unshift({
          id: 'COM-' + Date.now(),
          agentCode,
          clientCode,
          amount: commission,
          status: 'earned',
          createdAt: new Date().toISOString()
        });
        if (commissions.length > 1000) commissions.length = 1000;
        await env.WEBGEN_KV.put('commissions:log', JSON.stringify(commissions));

        // Notify agent
        const notifs = await env.WEBGEN_KV.get('notifications:all', 'json') || [];
        notifs.unshift({
          id: 'NOT-' + Date.now(),
          title: 'New Commission Earned!',
          message: `Client ${clientCode} signed up via your referral. You earned D ${commission}.`,
          type: 'success',
          target: agentCode,
          targetType: 'agent',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          read: []
        });
        if (notifs.length > 200) notifs.length = 200;
        await env.WEBGEN_KV.put('notifications:all', JSON.stringify(notifs));

        return new Response(JSON.stringify({
          success: true,
          commission,
          totalEarned: agent.totalEarned,
          message: `Referral tracked. Commission: D ${commission}`
        }), { headers });
      }

      // GET /api/agents/:code/earnings — Get commission history for agent (auth required)
      const agentEarningsMatch = path.match(/^\/api\/agents\/([A-Z0-9-]+)\/earnings$/i);
      if (agentEarningsMatch && request.method === 'GET') {
        const session = await verifyAuth(request);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers });
        }
        const agentCode = agentEarningsMatch[1].toUpperCase();
        const agent = await env.WEBGEN_KV.get(`agent:${agentCode}`, 'json');
        if (!agent) {
          return new Response(JSON.stringify({ error: 'Agent not found.' }), { status: 404, headers });
        }

        // Only agent themselves or admin can view earnings
        if (session.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 403, headers });
        }

        const commissions = await env.WEBGEN_KV.get('commissions:log', 'json') || [];
        const agentCommissions = commissions.filter(c => c.agentCode === agentCode);
        const limit = parseInt(url.searchParams.get('limit') || '50');

        const totalEarned = agentCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
        const totalPending = agentCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0);
        const totalPaid = agentCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);

        return new Response(JSON.stringify({
          agentCode,
          name: agent.name,
          summary: {
            totalEarned,
            totalPending,
            totalPaid,
            totalCommissions: agentCommissions.length
          },
          commissionHistory: agentCommissions.slice(0, limit)
        }), { headers });
      }

      // ═══════════ HELPER: JSON RESPONSE ═══════════
      function json(data, status = 200) {
        return new Response(JSON.stringify(data), { status, headers });
      }

      // ═══════════ AGENT / RESELLER SYSTEM (SIMPLIFIED) ═══════════

      // POST /api/agent/register — register as agent
      if (request.method === 'POST' && path === '/api/agent/register') {
        if (!checkRateLimit(clientIP, 5)) return json({ error: 'Rate limited' }, 429);
        const body = sanitizeObject(await request.json());
        const { name, phone, email, password, location } = body;
        if (!name || !phone || !password) return json({ error: 'Name, phone and password required' }, 400);

        const agentCode = 'AG-' + Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        const hashedPw = await hashPassword(password);

        const agent = {
          code: agentCode,
          name: sanitize(name),
          phone: sanitize(phone),
          email: sanitize(email || ''),
          location: sanitize(location || ''),
          password: hashedPw,
          role: 'agent',
          referralLink: `?ref=${agentCode}`,
          clients: [],
          commission: { total: 0, paid: 0, pending: 0 },
          stats: { totalClients: 0, thisMonth: 0, bonus: false },
          createdAt: new Date().toISOString(),
          active: true
        };

        await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));

        // Add to agents index
        let agents = JSON.parse(await env.WEBGEN_KV.get('agents:index') || '[]');
        agents.push({ code: agentCode, name: agent.name, phone: agent.phone, createdAt: agent.createdAt });
        await env.WEBGEN_KV.put('agents:index', JSON.stringify(agents));

        return json({ success: true, agentCode, referralLink: agent.referralLink });
      }

      // POST /api/agent/login — agent login (searches both agents:index and agents:list)
      if (request.method === 'POST' && path === '/api/agent/login') {
        if (!checkRateLimit(`login:${clientIP}`, 10)) return json({ error: 'Too many login attempts. Please wait.' }, 429);
        const body = sanitizeObject(await request.json());
        const { phone, password } = body;
        if (!phone || !password) return json({ error: 'Phone and password required' }, 400);

        // Find agent by phone across both legacy indices
        const codes = new Set();
        const idxA = JSON.parse(await env.WEBGEN_KV.get('agents:index') || '[]');
        for (const a of idxA) codes.add(a.code || a);
        const idxB = await env.WEBGEN_KV.get('agents:list', 'json') || [];
        for (const c of idxB) codes.add(c);

        let foundAgent = null;
        for (const code of codes) {
          const data = await env.WEBGEN_KV.get(`agent:${code}`, 'json');
          if (data && data.phone === phone) { foundAgent = data; break; }
        }

        if (!foundAgent) return json({ error: 'Agent not found' }, 404);
        const hashedPw = await hashPassword(password);
        if (foundAgent.password !== hashedPw) return json({ error: 'Invalid password' }, 401);
        if (foundAgent.status === 'suspended' || foundAgent.active === false) {
          return json({ error: 'Agent account is suspended.' }, 403);
        }

        // Generate session token — consistent with admin/client flow
        const token = generateToken();
        await env.WEBGEN_KV.put(`session:${token}`, JSON.stringify({
          role: 'agent',
          agentCode: foundAgent.code,
          name: foundAgent.name,
          createdAt: Date.now()
        }), { expirationTtl: 86400 });

        return json({
          success: true,
          token,
          role: 'agent',
          agentCode: foundAgent.code,
          agent: {
            code: foundAgent.code,
            name: foundAgent.name,
            status: foundAgent.status || (foundAgent.active ? 'active' : 'pending'),
            stats: foundAgent.stats,
            commission: foundAgent.commission
          }
        });
      }

      // GET /api/agent/:code — get agent dashboard data
      if (request.method === 'GET' && path.match(/^\/api\/agent\/AG-[A-F0-9]{6}$/)) {
        const code = path.split('/').pop();
        const agent = JSON.parse(await env.WEBGEN_KV.get(`agent:${code}`) || 'null');
        if (!agent) return json({ error: 'Agent not found' }, 404);

        // Get client details
        const clientDetails = [];
        for (const clientCode of agent.clients) {
          const client = JSON.parse(await env.WEBGEN_KV.get(`client:${clientCode}`) || 'null');
          if (client) clientDetails.push({ code: clientCode, name: client.businessName || client.name, plan: client.plan, createdAt: client.createdAt });
        }

        return json({
          success: true,
          agent: {
            code: agent.code, name: agent.name, phone: agent.phone, location: agent.location,
            stats: agent.stats, commission: agent.commission,
            clients: clientDetails,
            referralLink: agent.referralLink,
            createdAt: agent.createdAt
          }
        });
      }

      // GET /api/agents — list all agents (admin only)
      if (request.method === 'GET' && path === '/api/agents') {
        const agents = JSON.parse(await env.WEBGEN_KV.get('agents:index') || '[]');
        const detailed = [];
        for (const a of agents) {
          const data = JSON.parse(await env.WEBGEN_KV.get(`agent:${a.code}`) || 'null');
          if (data) detailed.push({ code: data.code, name: data.name, phone: data.phone, location: data.location, stats: data.stats, commission: data.commission, active: data.active, createdAt: data.createdAt });
        }
        return json({ success: true, agents: detailed });
      }

      // POST /api/agent/referral — track a referral signup
      if (request.method === 'POST' && path === '/api/agent/referral') {
        const body = sanitizeObject(await request.json());
        const { agentCode, clientCode } = body;
        if (!agentCode || !clientCode) return json({ error: 'Agent code and client code required' }, 400);

        const agent = JSON.parse(await env.WEBGEN_KV.get(`agent:${agentCode}`) || 'null');
        if (!agent) return json({ error: 'Agent not found' }, 404);

        // Add client to agent
        if (!agent.clients.includes(clientCode)) {
          agent.clients.push(clientCode);
          agent.stats.totalClients++;
          agent.stats.thisMonth++;
          agent.commission.pending += 500; // GMD 500 per client
          agent.commission.total += 500;

          // Bonus: 5+ clients per month
          if (agent.stats.thisMonth >= 5) {
            agent.stats.bonus = true;
          }

          await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));
        }

        return json({ success: true, commission: agent.commission, stats: agent.stats });
      }

      // POST /api/agent/payout — mark commission as paid (admin)
      if (request.method === 'POST' && path === '/api/agent/payout') {
        const body = sanitizeObject(await request.json());
        const { agentCode, amount } = body;
        if (!agentCode || !amount) return json({ error: 'Agent code and amount required' }, 400);

        const agent = JSON.parse(await env.WEBGEN_KV.get(`agent:${agentCode}`) || 'null');
        if (!agent) return json({ error: 'Agent not found' }, 404);

        const payAmount = Math.min(amount, agent.commission.pending);
        agent.commission.paid += payAmount;
        agent.commission.pending -= payAmount;

        await env.WEBGEN_KV.put(`agent:${agentCode}`, JSON.stringify(agent));

        return json({ success: true, commission: agent.commission });
      }

      // ═══════════ HEALTH CHECK ═══════════
      if (path === '/api/health' || path === '/') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'WebGen Gambia API',
          version: '5.0',
          features: ['auth', 'signup', 'subscriptions', 'cms', 'invoices', 'staff-roles', 'rate-limiting', 'email', 'notifications', 'analytics', 'agent-referrals'],
          endpoints: [
            'GET  /api/setup/status',
            'POST /api/setup/init',
            'POST /api/auth/login',
            'POST /api/auth/verify',
            'POST /api/auth/logout',
            'POST /api/auth/change-password',
            'POST /api/signup',
            'GET  /api/subscription/:code',
            'POST /api/subscription/upgrade',
            'GET|POST /api/staff',
            'PUT|DELETE /api/staff/:username',
            'GET|POST /api/notifications',
            'POST /api/notifications/read',
            'POST /api/notifications/broadcast',
            'POST /api/email/send',
            'POST /api/email/invoice',
            'POST /api/email/welcome',
            'GET  /api/email/log',
            'POST /api/analytics/track',
            'GET  /api/analytics/dashboard',
            'POST /api/sync/upload',
            'GET|PUT /api/cms/:clientCode',
            'GET|PUT|DELETE /api/website/:clientCode',
            'POST /api/ai/generate-post',
            'POST /api/agent/login',
            'GET /api/clients',
            'GET|PUT|DELETE /api/clients/:code',
            'GET|POST /api/invoices',
            'GET /api/invoices/:clientCode',
            'POST /api/generate-website',
            'GET /api/website/:code',
            'GET /api/stats',
            'POST /api/agents/register',
            'GET /api/agents',
            'GET /api/agents/:code',
            'PUT /api/agents/:code/approve',
            'POST /api/agents/refer',
            'GET /api/agents/:code/earnings'
          ]
        }), { headers });
      }

      // ═══════════ KASSA STAFF AUTH (PIN-based) ═══════════
      // POST /api/kassa/<rid>/staff/login {pin} → returns {token, role, name} if PIN matches a staff member
      // POST /api/kassa/<rid>/staff/verify {token} → returns {valid, role, name}
      const staffLoginMatch = path.match(/^\/api\/kassa\/([A-Za-z0-9_-]+)\/staff\/login$/);
      const staffVerifyMatch = path.match(/^\/api\/kassa\/([A-Za-z0-9_-]+)\/staff\/verify$/);
      const staffSetMatch = path.match(/^\/api\/kassa\/([A-Za-z0-9_-]+)\/staff$/);

      if (staffLoginMatch && request.method === 'POST') {
        if (!checkRateLimit(`staff:login:${clientIP}`, 10)) {
          return new Response(JSON.stringify({ error: 'Too many attempts' }), { status: 429, headers });
        }
        const rid = staffLoginMatch[1];
        const { pin } = sanitizeObject(await request.json());
        if (!pin || !/^\d{4,8}$/.test(String(pin))) {
          return new Response(JSON.stringify({ error: 'Invalid PIN format' }), { status: 400, headers });
        }
        const ownerPin = await env.WEBGEN_KV.get(`kassa:${rid}:owner-pin`) || '0000';
        const list = await env.WEBGEN_KV.get(`kassa:${rid}:staff`, 'json') || [];
        let match = null;
        if (pin === ownerPin) match = { id:'owner', role:'owner', name:'Owner', permissions: ['*'] };
        else {
          const s = list.find(x => x.pin === pin);
          if (s) match = { id: s.id, role: s.role, name: s.name, permissions: s.permissions || [] };
        }
        if (!match) return new Response(JSON.stringify({ error: 'Wrong PIN' }), { status: 401, headers });
        const token = generateToken();
        const expires = Date.now() + 8 * 60 * 60 * 1000;
        await env.WEBGEN_KV.put(`kassa:${rid}:session:${token}`, JSON.stringify({ ...match, expires }), { expirationTtl: 60*60*8 });
        return new Response(JSON.stringify({ token, expires, ...match }), { headers });
      }

      if (staffVerifyMatch && request.method === 'POST') {
        const rid = staffVerifyMatch[1];
        const { token } = sanitizeObject(await request.json());
        if (!token) return new Response(JSON.stringify({ valid: false }), { headers });
        const session = await env.WEBGEN_KV.get(`kassa:${rid}:session:${token}`, 'json');
        if (!session || session.expires < Date.now()) return new Response(JSON.stringify({ valid: false }), { headers });
        return new Response(JSON.stringify({ valid: true, role: session.role, name: session.name, id: session.id, permissions: session.permissions }), { headers });
      }

      // PUT /api/kassa/<rid>/staff — replace the staff list (kassa side)
      if (staffSetMatch && (request.method === 'PUT' || request.method === 'POST')) {
        const rid = staffSetMatch[1];
        const body = sanitizeObject(await request.json());
        if (!body || !Array.isArray(body.staff)) return new Response(JSON.stringify({ error:'staff[] required' }), { status:400, headers });
        await env.WEBGEN_KV.put(`kassa:${rid}:staff`, JSON.stringify(body.staff));
        if (body.ownerPin && /^\d{4,8}$/.test(body.ownerPin)) await env.WEBGEN_KV.put(`kassa:${rid}:owner-pin`, body.ownerPin);
        return new Response(JSON.stringify({ success:true }), { headers });
      }

      if (staffSetMatch && request.method === 'GET') {
        const rid = staffSetMatch[1];
        const list = await env.WEBGEN_KV.get(`kassa:${rid}:staff`, 'json') || [];
        // never return PINs
        const safe = list.map(({pin, ...rest}) => rest);
        return new Response(JSON.stringify({ staff: safe }), { headers });
      }

      // ═══════════ KASSA MULTI-DEVICE SYNC (orders & reservations) ═══════════
      // Public endpoints — any device with the restaurantId can POST orders/reservations.
      // Rate-limited per IP to prevent abuse. Kassa polls GET for near-realtime sync.
      // Storage: KV key `kassa:<rid>:orders` and `kassa:<rid>:reservations` → JSON array (newest first, capped at 500).

      const kassaOrdersMatch = path.match(/^\/api\/kassa\/([A-Za-z0-9_-]+)\/orders$/);
      const kassaOrderPatch = path.match(/^\/api\/kassa\/([A-Za-z0-9_-]+)\/orders\/([A-Z0-9-]+)$/i);
      const kassaResMatch = path.match(/^\/api\/kassa\/([A-Za-z0-9_-]+)\/reservations$/);
      const kassaResPatch = path.match(/^\/api\/kassa\/([A-Za-z0-9_-]+)\/reservations\/([A-Z0-9-]+)$/i);

      const kassaCap = 500; // retention limit per restaurant

      // POST /api/kassa/:rid/orders — new order (klant side)
      if (kassaOrdersMatch && request.method === 'POST') {
        if (!checkRateLimit(`kassa:order:${clientIP}`, 30)) {
          return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers });
        }
        const rid = kassaOrdersMatch[1];
        const body = sanitizeObject(await request.json());
        if (!body || !body.id || !Array.isArray(body.items)) {
          return new Response(JSON.stringify({ error: 'Invalid order: id + items required' }), { status: 400, headers });
        }
        const key = `kassa:${rid}:orders`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const order = {
          ...body,
          restaurantId: rid,
          createdAt: body.createdAt || Date.now(),
          serverAt: Date.now(),
          status: body.status || 'new'
        };
        // Replace if id exists (idempotent), else prepend
        const idx = list.findIndex(o => o.id === order.id);
        if (idx >= 0) list[idx] = order; else list.unshift(order);
        if (list.length > kassaCap) list.length = kassaCap;
        await env.WEBGEN_KV.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ success: true, order }), { headers });
      }

      // GET /api/kassa/:rid/orders?since=<ts> — poll (kassa side)
      if (kassaOrdersMatch && request.method === 'GET') {
        const rid = kassaOrdersMatch[1];
        const since = parseInt(url.searchParams.get('since')) || 0;
        const key = `kassa:${rid}:orders`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const filtered = since ? list.filter(o => (o.serverAt || o.createdAt || 0) > since) : list;
        return new Response(JSON.stringify({ orders: filtered, serverTime: Date.now() }), { headers });
      }

      // PATCH /api/kassa/:rid/orders/:id — update status (kassa side)
      if (kassaOrderPatch && (request.method === 'PATCH' || request.method === 'PUT')) {
        const rid = kassaOrderPatch[1];
        const orderId = kassaOrderPatch[2];
        const patch = sanitizeObject(await request.json());
        const key = `kassa:${rid}:orders`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const idx = list.findIndex(o => o.id === orderId);
        if (idx < 0) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers });
        // Only allow certain fields to be patched
        const allowed = ['status', 'note', 'paidAt', 'preparingAt', 'readyAt', 'servedAt', 'cancelled'];
        allowed.forEach(f => { if (f in patch) list[idx][f] = patch[f]; });
        list[idx].serverAt = Date.now();
        await env.WEBGEN_KV.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ success: true, order: list[idx] }), { headers });
      }

      // DELETE /api/kassa/:rid/orders/:id — cancel order (kassa side)
      if (kassaOrderPatch && request.method === 'DELETE') {
        const rid = kassaOrderPatch[1];
        const orderId = kassaOrderPatch[2];
        const key = `kassa:${rid}:orders`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const next = list.filter(o => o.id !== orderId);
        await env.WEBGEN_KV.put(key, JSON.stringify(next));
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // POST /api/kassa/:rid/reservations — new reservation (klant side)
      if (kassaResMatch && request.method === 'POST') {
        if (!checkRateLimit(`kassa:res:${clientIP}`, 20)) {
          return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers });
        }
        const rid = kassaResMatch[1];
        const body = sanitizeObject(await request.json());
        if (!body || !body.id || !body.date) {
          return new Response(JSON.stringify({ error: 'Invalid reservation: id + date required' }), { status: 400, headers });
        }
        const key = `kassa:${rid}:reservations`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const res = {
          ...body,
          restaurantId: rid,
          createdAt: body.createdAt || Date.now(),
          serverAt: Date.now(),
          status: body.status || 'pending'
        };
        const idx = list.findIndex(r => r.id === res.id);
        if (idx >= 0) list[idx] = res; else list.unshift(res);
        if (list.length > kassaCap) list.length = kassaCap;
        await env.WEBGEN_KV.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ success: true, reservation: res }), { headers });
      }

      // GET /api/kassa/:rid/reservations?since=<ts>
      if (kassaResMatch && request.method === 'GET') {
        const rid = kassaResMatch[1];
        const since = parseInt(url.searchParams.get('since')) || 0;
        const key = `kassa:${rid}:reservations`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const filtered = since ? list.filter(r => (r.serverAt || r.createdAt || 0) > since) : list;
        return new Response(JSON.stringify({ reservations: filtered, serverTime: Date.now() }), { headers });
      }

      // PATCH /api/kassa/:rid/reservations/:id
      if (kassaResPatch && (request.method === 'PATCH' || request.method === 'PUT')) {
        const rid = kassaResPatch[1];
        const resId = kassaResPatch[2];
        const patch = sanitizeObject(await request.json());
        const key = `kassa:${rid}:reservations`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const idx = list.findIndex(r => r.id === resId);
        if (idx < 0) return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers });
        const allowed = ['status', 'notes', 'seatedAt', 'cancelledAt'];
        allowed.forEach(f => { if (f in patch) list[idx][f] = patch[f]; });
        list[idx].serverAt = Date.now();
        await env.WEBGEN_KV.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ success: true, reservation: list[idx] }), { headers });
      }

      // DELETE /api/kassa/:rid/reservations/:id
      if (kassaResPatch && request.method === 'DELETE') {
        const rid = kassaResPatch[1];
        const resId = kassaResPatch[2];
        const key = `kassa:${rid}:reservations`;
        const list = await env.WEBGEN_KV.get(key, 'json') || [];
        const next = list.filter(r => r.id !== resId);
        await env.WEBGEN_KV.put(key, JSON.stringify(next));
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: env.ENVIRONMENT === 'production' ? 'Something went wrong.' : error.message
      }), { status: 500, headers });
    }
  }
};
