# WebGen Gambia — Open TODO's

## 🔎 SEO — handmatige stappen buiten de code
Deze acties kun je alleen zelf doen (vereisen inloggen of domein-beheer):

- [ ] **Google Search Console** — claim `webgen-gambia.pages.dev`
  1. Ga naar https://search.google.com/search-console
  2. Voeg property toe (URL-prefix: `https://webgen-gambia.pages.dev/`)
  3. Verifieer via HTML-tag (voeg `<meta name="google-site-verification" content="...">` in `landing.html` `<head>`) OF via Cloudflare DNS TXT-record
  4. Submit sitemap: `https://webgen-gambia.pages.dev/sitemap.xml`
  5. Bij eerste crawl (1–3 dagen) verschijnen FAQ/rich results in Google SERP

- [ ] **Rich Results Test** — valideer de Schema.org markup
  1. Open https://search.google.com/test/rich-results
  2. Plak `https://webgen-gambia.pages.dev/landing.html` → check dat `SoftwareApplication`, `FAQPage` en `Organization` worden herkend
  3. Plak `https://webgen-gambia.pages.dev/kololigrill.html` → check dat `Restaurant` met `hasMenu`, `address`, `openingHours` worden herkend
  4. Zelfde test voor elke klant-website na publicatie via de v3-builder

- [ ] **Eigen domein koppelen** — upgrade van `*.pages.dev` naar een echt domein
  1. Koop `webgengambia.com` of `.gm` bij een registrar (bv. Namecheap, Squarespace of Tesito voor `.gm`)
  2. In Cloudflare Pages dashboard → Custom Domains → Add `webgengambia.com`
  3. Update DNS: CNAME naar `webgen-gambia.pages.dev`
  4. Update alle `https://webgen-gambia.pages.dev` URLs in `landing.html`, `sitemap.xml`, `robots.txt`, `webgen-gambia-v3.html` OG-tags, `worker.js` ALLOWED_ORIGINS
  5. Voeg de nieuwe origin toe aan `wrangler.toml` → `ALLOWED_ORIGINS`
  6. 301-redirect van `*.pages.dev` naar het nieuwe domein (`_redirects` file of Cloudflare Page Rule)

- [ ] **Per-klant domein flow**
  1. Elke klant krijgt optie bij onboarding: "Koppel je eigen domein?"
  2. Klant koopt bv. `kololigrill.gm` en stelt DNS CNAME in naar `webgen-gambia.pages.dev`
  3. In Cloudflare Pages: Custom Domains → Add for Project → koppel het klant-domein
  4. In de v3-builder: klant zet zijn domein in het `domain`-veld → canonical-tag in de gegenereerde site gebruikt dat automatisch
  5. Elke klant-site is zo zelfstandig vindbaar in Google Gambia

## 🐛 Code-audit restpunten (lagere prioriteit)
- [ ] Server-side permissie-check in worker.js (huidige rol-filter is client-side)
- [ ] Auth tokens op LAN-server (nu open CORS op lokale WiFi)
- [ ] Mobile cart-modal scroll-fix op kleine iOS schermen
- [ ] Deal-editor: start-tijd/eind-tijd velden (happy hour 17–19u)
- [ ] Menu-price validatie (min/max, geen wetenschappelijke notatie)
- [ ] Server-side rate-limit per username (niet alleen per IP)

## ✨ Nice-to-have features (v2)
- [ ] Bluetooth thermal-printer ondersteuning (kitchen ticket + kassa-bon)
- [ ] SMS/WhatsApp notification voor takeaway "je bestelling is klaar"
- [ ] Refund/discount workflow op betaalde orders
- [ ] Staff shift tracking (klok-in/uit, loonberekening)
- [ ] Analytics dashboard met charts.js (top-5 gerechten, piekuren)
- [ ] Tafel-groepen (Terras T1-5, Binnen T6-10, Bar B1-3)
- [ ] Multi-currency support (GMD + EUR + USD)
