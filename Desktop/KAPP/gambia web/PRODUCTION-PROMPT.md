# 🚀 WebGen Gambia — Master Prompt voor Productie-klaar Systeem

Plak deze prompt in Claude / ChatGPT / Cursor / een developer-chat om van de huidige demo een **echt werkend professioneel SaaS-platform** te maken. De prompt is Engels (werkt overal), met Nederlandstalige context waar relevant.

---

## 📋 COPY-PASTE PROMPT HIER ⬇

```
You are a senior full-stack engineer + product architect. I have a working
prototype for WebGen Gambia — a B2B SaaS platform that sells websites,
menu tools, and a restaurant POS/ordering system to Gambian businesses
(especially restaurants). The current code is static HTML + localStorage
as a demo. I need you to transform it into a production-grade,
multi-tenant SaaS.

============================================================
BUSINESS MODEL
============================================================
- Target: restaurants in Gambia (and later West Africa)
- Revenue: monthly SaaS fee (GMD 2,500+/month) + one-time website build
- Three user roles, all multi-tenant:
  1. ADMIN (financial): full platform control, revenue, invoices
  2. EMPLOYEES (customer service + sellers): onboard clients, manage accounts
  3. CUSTOMERS (restaurant owners): manage their own restaurant, orders, menu

============================================================
CURRENT STATE (what exists)
============================================================
HTML pages in /gambia web/:
  Public:   landing.html, index.html, portal.html
  Portals:  admin.html, medewerker.html, klant.html, agent.html
  Restaurant system:
            - kassa.html  (restaurant owner dashboard: tables, orders, menu,
              QR, reservations — tabs)
            - bestel.html (guest-facing menu + cart + order, reads ?r= &t=)
            - reserveer.html (4-step reservation flow)
  Tools:    webgen-gambia-v3.html, menu-generator.html, qr-generator.html,
            flyer-generator.html, contract-generator.html,
            visitekaartje-generator.html
  Backend:  worker.js (Cloudflare Worker), wrangler.toml
  Styling:  dark theme, teal #00c896, gold #f5a200, Syne + DM Sans

Data currently in localStorage keys:
  wg_menu_{restaurantId}          → menu definition
  wg_orders_{restaurantId}        → array of orders
  wg_reservations_{restaurantId}  → array of reservations
  wg_settings_{restaurantId}      → numTables, etc.
Live sync uses BroadcastChannel (same-browser only).

============================================================
GOALS — BUILD THIS
============================================================
A production-ready, multi-tenant SaaS with:

1. PROPER BACKEND
   - Cloudflare Workers + D1 (SQLite) for data
   - Cloudflare R2 for images/assets
   - Hono or itty-router for routing
   - Durable Objects for real-time order sync per restaurant
   - Queue for sending notifications (WhatsApp/SMS/email)
   - REST + WebSocket endpoints

2. AUTHENTICATION & AUTHORIZATION
   - Proper JWT auth with refresh tokens
   - Roles: super_admin, admin, employee (seller/support), client_owner, client_staff
   - Per-tenant isolation (row-level security via restaurant_id)
   - Password reset, 2FA optional
   - Session management, device tracking
   - Rate limiting per IP and per account

3. DATABASE SCHEMA (D1)
   Tables with tenant isolation:
   - tenants (restaurants)
   - users (with role + tenant_id)
   - menu_categories, menu_items
   - orders (with order_items join table)
   - reservations
   - tables (numbered + qr_token unique per table)
   - subscriptions, invoices, payments
   - activity_log (audit trail)
   - notifications_outbox

4. RESTAURANT ORDERING (productionize the demo)
   - Real-time order push via WebSocket (not BroadcastChannel)
   - Order numbering that resets daily per restaurant
   - Kitchen printer integration (ESC/POS over network or cloud print)
   - Order status webhook so the customer phone polls or gets push
   - Allergen + modifier support (size, extras, "no onions")
   - Split bill, per-person payment
   - Mobile Money payment integration (Africell Pay, Wave, QMoney)
   - Cash-on-delivery option
   - Tipping on the bill
   - Receipt PDF + email/SMS

5. RESERVATIONS
   - Table capacity tracking (no double-booking)
   - Deposit option (prepayment)
   - Confirmation via SMS and email (Twilio / Africa's Talking)
   - Reminder 2h before the booking
   - Cancellation with refund flow
   - Google Calendar iCal feed per restaurant

6. MENU MANAGEMENT
   - Photo upload per item (R2 + image resize worker)
   - Availability toggle (sold out, hidden, hours-based)
   - Multi-language (English + French + Wolof/Mandinka)
   - Print-ready PDF menu export
   - Import from CSV / previous menu-generator

7. QR CODES
   - Unique signed token per table (can't be guessed)
   - QR rotates if suspected abuse
   - Printable PDF with restaurant logo + table number + branding

8. FINANCIAL / ADMIN
   - Stripe Connect or Paystack for global payments
   - Daily/weekly/monthly revenue dashboard
   - VAT/tax breakdown
   - Automatic invoicing for SaaS fee
   - Commission tracking for sellers (agent.html flow)
   - Dunning for failed payments

9. EMPLOYEE / RESELLER FLOW
   - Onboarding wizard for new clients
   - Commission based on plan tier + retention
   - Client assignment per seller
   - Activity feed of what each seller did today

10. WEBSITE GENERATOR (webgen-gambia-v3)
    - Generated sites should be deployed to subdomain.web.gm
    - SSL via Cloudflare
    - Editable after publish (not one-shot generation)
    - SEO: sitemap, meta, Open Graph, schema.org LocalBusiness
    - Analytics: Plausible or Cloudflare Web Analytics
    - Custom domain support
    - "Reserveer" section auto-links to the right reserveer.html?r=...

11. UX / FRONTEND
    - Convert the HTML pages to SvelteKit or Next.js app
    - Shared component library (buttons, forms, modals, tables)
    - i18n: English + Dutch + French
    - Mobile-first (most users on phone)
    - PWA: installable on phone, offline-tolerant for kassa
    - Print stylesheets for receipts and QR codes
    - Keyboard shortcuts in kassa (quick order actions)
    - Accessibility: WCAG 2.1 AA, keyboard nav, aria labels

12. NOTIFICATIONS
    - WhatsApp Business API (this is Gambia — WhatsApp is king)
    - SMS via Africa's Talking or Twilio
    - Email via Resend or Postmark
    - Template system with approval
    - Opt-in / opt-out per customer

13. OFFLINE RESILIENCE
    - Kassa must keep working when internet drops
    - Queue actions locally, sync when back
    - Service worker for static assets + order form
    - Last 24h of orders cached locally

14. OBSERVABILITY
    - Sentry for frontend errors
    - Cloudflare Workers logs + Logpush to R2
    - Structured logging with request IDs
    - Uptime monitoring per tenant (is their site up?)
    - Alerting: failed payments, repeated errors, downtime

15. SECURITY
    - Every endpoint rate-limited
    - CSP headers, HSTS, secure cookies
    - Input validation with Zod on every API route
    - SQL via prepared statements only
    - Audit log for destructive actions
    - GDPR-style data export + delete per user
    - Backups: daily D1 export to R2
    - Secrets in Cloudflare env (never in repo)

16. TESTING
    - Vitest for unit
    - Playwright for E2E (cover the full order flow + reservation + auth)
    - Load test the order endpoint (100 restaurants × 10 orders/min burst)
    - Contract tests for payment webhook handlers

17. DEVOPS
    - Monorepo with pnpm workspaces
    - GitHub Actions: lint → test → deploy staging → e2e → deploy prod
    - Staging environment on *.staging.webgen.gm
    - Feature flags via Cloudflare KV
    - Rollback within 1 minute
    - Migrations as versioned SQL with d1 migrations apply

18. DOCUMENTATION
    - OpenAPI spec for the API
    - Onboarding doc for new devs
    - Runbook for common incidents
    - Customer-facing help center (HTML static pages)
    - Loom-style screencasts for restaurant owners

============================================================
HARD CONSTRAINTS
============================================================
- Must work on a low-end Android phone over 3G
- Must keep the existing dark/teal brand look
- No vendor lock-in beyond Cloudflare
- Currency: primary GMD, support EUR/USD/GBP
- GDPR-aware even though Gambia has no equivalent law yet
- Keep the restaurant owner's cognitive load low —
  "my cousin who runs a beach grill should be able to use this"

============================================================
DELIVERABLES I WANT FROM YOU (in order)
============================================================
1. Architecture diagram (ascii or mermaid) showing services + data flow
2. Database schema as SQL (D1 dialect) with indexes and FKs
3. Endpoint map: method + path + auth + purpose
4. Migration plan from current localStorage prototype → production DB
   (how do we not lose demo data + how do we seed real restaurants)
5. Sprint-by-sprint roadmap (2-week sprints, 3 sprints to MVP)
6. Risk register: top 10 things that will bite us
7. "Definition of Done" checklist per feature
8. Launch checklist: everything that must be green before first paying
   customer goes live

Be opinionated. Don't give me every option — give me THE answer, with
reasoning. Assume a 2-person dev team + me as product owner. Budget is
tight — prefer boring, cheap, proven tools over shiny new ones.

When you produce code, produce REAL code, not pseudocode. When you
propose a schema, make it executable. When you list endpoints, define
request/response shapes.

Start with #1 (architecture) and #2 (schema). Then pause and let me
confirm before moving on.
```

---

## 🎯 Hoe gebruik je deze prompt

1. **Plak alles tussen de ```backticks``` hierboven in Claude / ChatGPT / Cursor / etc.**
2. Voeg eventueel toe:
   - je team-grootte ("I'm solo, I want the simplest version that scales")
   - je deadline ("soft launch in 6 weeks")
   - je budget ("Cloudflare free tier + $50/month max")
3. Laat de AI **architectuur + schema** opleveren — dat is de fundering.
4. Pas daarna implementeren. Niet andersom.

## ⚡ Mini-versies als je iets kleiners wilt

### Alleen de kassa productie-klaar maken
> "Take kassa.html + bestel.html + reserveer.html. Replace localStorage
> with a Cloudflare Worker + D1 backend. Add WebSocket for live sync.
> Add auth via JWT. Keep the UI exactly the same. Make it multi-tenant.
> Deliver: schema SQL, worker code, frontend diff, deploy script."

### Alleen betalingen toevoegen
> "Integrate Mobile Money (Wave, Africell, QMoney) into bestel.html so
> guests can pay the bill at the table. Provide: payment flow UX,
> webhook handler, reconciliation with orders, refund flow, receipt."

### Alleen multi-tenant maken
> "Refactor the localStorage keys (wg_menu_${id} etc.) into a proper
> tenant-isolated database with a single source of truth. Provide
> migration script, tenant provisioning flow, and security audit."

---

## 📐 Als het gebouwd is — "Definition of Done"

Het systeem is **echt** productie-klaar wanneer:

- [ ] 3 echte restaurants draaien erop, 1 maand zonder incidents
- [ ] p99 order-latency < 300ms
- [ ] Betalingen komen binnen op de bankrekening binnen 24u
- [ ] Een nieuwe seller kan in < 10 min een nieuwe klant onboarden
- [ ] Een restaurant-eigenaar kan zonder training een order doorzetten
- [ ] Alles werkt op een GMD 5,000 Android-telefoon via 3G
- [ ] Geen gebruiker ooit eigen data van ander restaurant gezien
- [ ] Backup is in de afgelopen 7 dagen minstens 1× getest met restore
- [ ] Er is een oncall-rotatie en een werkend alerting-systeem
- [ ] Er staat een duidelijke prijs op de site + een ToS + privacy policy

Zodra die vinkjes er staan — mag je "professioneel werkend systeem" zeggen.
