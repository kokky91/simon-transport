# 🌐 Custom Domain Setup — WebGen Gambia

When you're ready to move from `webgen-gambia.pages.dev` to your real domain (e.g. `webgengambia.com` or `webgengambia.gm`):

## 1. Buy the domain
- `.com` / `.net` — Namecheap, Cloudflare Registrar, Squarespace
- `.gm` — Tesito (https://tesito.gm) is the only Gambian registrar (~GMD 1.500/year)

## 2. Connect to Cloudflare Pages
1. Cloudflare Dashboard → **Workers & Pages** → Project `webgen-gambia`
2. **Custom domains** → **Set up a custom domain**
3. Enter `webgengambia.com` → Cloudflare automatically configures DNS (if managed by them) OR shows you the CNAME to add at your registrar
4. SSL certificate auto-issues within ~5 minutes

## 3. Update hardcoded URLs
Find/replace `webgen-gambia.pages.dev` → `webgengambia.com` in:
- [landing.html](landing.html) — canonical, OG, Twitter, JSON-LD URLs
- [sitemap.xml](sitemap.xml) — all `<loc>` entries
- [robots.txt](robots.txt) — Sitemap line
- [kololigrill.html](kololigrill.html) — canonical, OG (or any hand-built demo)
- [worker.js](worker.js) — `ALLOWED_ORIGINS` env var (also update in `wrangler.toml`)
- [wrangler.toml](wrangler.toml) → `ALLOWED_ORIGINS = "https://webgengambia.com,..."`

Then re-deploy:
```bash
npx wrangler deploy   # worker
npx wrangler pages deploy . --project-name=webgen-gambia --branch=main
```

## 4. Enable 301 redirect (optional but recommended)
Uncomment the redirect rule in [_redirects](_redirects):
```
https://webgen-gambia.pages.dev/*  https://webgengambia.com/:splat  301!
```
Cloudflare Pages picks this up automatically — old URLs forward with a permanent redirect (good for SEO).

## 5. Per-client domain flow
Each restaurant client can also connect their own domain (e.g. `kololigrill.gm`):

1. Client buys their domain
2. In Cloudflare Pages → Custom Domains → **Add** for `webgen-gambia` project
3. Add the CNAME at the client's registrar pointing to `webgen-gambia.pages.dev`
4. In the v3 builder: client fills the `domain` field with `kololigrill.gm`
5. The generated site automatically uses this for the `<link rel="canonical">` and OG URLs
6. SEO: each client-site is independently indexable in Google Gambia

## 6. Search Console
After the domain is live:
1. Go to https://search.google.com/search-console
2. Add property: `https://webgengambia.com/`
3. Verify (DNS TXT or HTML tag in `landing.html` `<head>`)
4. Submit sitemap: `https://webgengambia.com/sitemap.xml`
5. Wait 1-3 days for first crawl

## 7. Email (optional)
If you want `info@webgengambia.com` mail:
- Cloudflare Email Routing (free, forwards to your Gmail/Outlook)
- Or full mailbox via Workspace / Zoho / Fastmail
