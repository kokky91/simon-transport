# 📖 WebGen Gambia — Quick Start (English)

> All-in-one restaurant system: QR menu, online orders, takeaway, reservations, kitchen flow, staff roles. Works online & offline.

---

## 🔗 The 3 URLs you need

| Who | URL | What |
|---|---|---|
| 🧑‍🍳 **Restaurant team** | `kassa.html?r=<your-restaurant>` | Cash register / dashboard |
| 👤 **Customers (table)** | `bestel.html?r=<your-restaurant>&t=<table>` | Scan QR at the table |
| 👤 **Customers (takeaway)** | `bestel.html?r=<your-restaurant>&m=takeaway` | Order online for pickup |

Replace `<your-restaurant>` with your slug (e.g. `kololi-grill`).
Demo: [webgen-gambia.pages.dev/kassa.html?r=kololi-grill](https://webgen-gambia.pages.dev/kassa.html?r=kololi-grill)

---

## 🔐 First-time login (Owner)

1. Open the kassa URL → you see a **PIN pad** screen.
2. Default Owner PIN is **`0000`**.
3. Type it on the pad (or use the keyboard). You're in.
4. **Change the PIN immediately**:
   `Settings → 🔐 Owner PIN → 4 digits → Save`

Session lasts **8 hours**. After that the PIN pad shows again. Tap 🔒 in the sidebar to log out manually.

---

## 👥 Roles & permissions

| Icon | Role | Sees |
|---|---|---|
| 👑 | **Owner** | Everything (incl. Finance) |
| 👔 | **Manager** | Everything except Finance |
| 👨‍🍳 | **Cook** | Kitchen tab only |
| 🤵 | **Waitress** | Tables · Orders · Reservations |
| ✏️ | **Custom** | Per-tab checkboxes |

### Add staff
1. `Staff` tab → **+ New staff member**
2. Name · Role · 4-digit PIN
3. Save → that person can now log in with their PIN

---

## 🧑‍🍳 Daily flows

### 🤵 Waitress flow
- Login with PIN → sees Tables, Orders, Reservations only
- **At the table on her phone**: open `bestel.html?r=<id>&w=1` (or scan the QR from kassa → Orders → 🤵 Waiter)
- Pick the table number from the top bar → tap dishes → **Send to kitchen**
- After submit: cart resets, ready for next table

### 👨‍🍳 Cook flow
- Login with PIN → sees only the Kitchen tab
- Each new order appears as a card with a colored border:
  - 🔴 **New** (just placed)
  - 🔵 **Cooking** (in progress)
  - 🟢 **Ready** (waiting to be served)
- One button per stage: `Start preparing → Mark ready → Served`
- Age timer turns orange after 10 min, red after 20 min — so nothing gets forgotten

### 👔 Manager flow
- Sees everything except revenue numbers
- Manage menu, staff, deals, QR codes, settings
- Can mark tables as paid, cancel orders, confirm reservations

### 👑 Owner flow
- Same as manager + **Finance**: revenue, profit, top-5 dishes, dine-in vs takeaway split, CSV export

---

## 👤 Customer flows

### Scan QR at table
1. Each table has its own QR (printed sticker)
2. Customer scans → instant menu on their phone
3. Add dishes → cart bar at bottom → **Place order**
4. Status tracker shows progress: Ordered → Cooking → Ready → Served
5. Or tap **💬 WhatsApp** to also send the order via WhatsApp

### Online takeaway
1. Customer opens the website → clicks **🛍️ Order takeaway**
2. Same menu, but the cart asks for name + phone + pickup time
3. Order appears in kassa with a 🛍️ Takeaway badge

### Online reservation
1. Customer clicks **📅 Reserve a table** on the website
2. Picks date, time, guest count, contact details
3. Booking lands in kassa → Reservations tab → manager taps **✓ Confirm**

---

## ⚙️ Settings checklist (do this once)

`Settings tab → fill in:`

- ☑ Restaurant name + subtitle
- ☑ Currency (GMD / EUR / USD / GBP)
- ☑ Number of tables
- ☑ WhatsApp number (used for order-via-WA + customer chat link)
- ☑ Phone number
- ☑ **Owner PIN** (change from default `0000`!)
- ☑ **QR base URL** — must point to your live site, not localhost
   - Easy: tap **🌐 Custom domain…** → paste `https://yoursite.com/bestel.html`
   - Or **📡 Use LAN IP** for offline-only WiFi mode

Then go to **QR codes tab** → **Generate QRs** → **Print** → stick on tables.

---

## 📡 Offline mode (no internet)

The system keeps working when the ISP is down:

- ✅ All pages load offline (cached by Service Worker)
- ✅ Orders saved locally, automatically sent to cloud when internet returns
- ✅ For multi-device sync without internet: run `python lan-server.py` on the restaurant computer → set the LAN URL in Settings → all phones on the WiFi keep working

The sync badge in the kassa top-bar shows: ☁ Live · ⚠ Offline · ⟳ Sync…

---

## 🌐 Language

Tap the **🇬🇧 EN / 🇳🇱 NL** pill in the top-left of any page. Choice is remembered per browser. Works on:
- Restaurant website (`kololigrill.html`)
- Order page (`bestel.html`)
- Reservation page (`reserveer.html`)
- Kassa dashboard (`kassa.html`) — including kitchen view, status badges, role labels

---

## 🚨 Common questions

| Question | Answer |
|---|---|
| QR doesn't work on phone | The QR points to `localhost`. In Settings → QR base URL → use your domain or LAN IP. |
| Audio beep doesn't play on new orders | Browsers block audio until you've clicked once. Tap anywhere in kassa to enable. |
| Forgot Owner PIN | Open browser DevTools → Application → Local Storage → delete the key `wg_owner_pin_<your-rid>`. PIN resets to `0000`. |
| Order doesn't appear in kassa | Check that customer URL `?r=` matches kassa `?r=`. They must use the same restaurant ID. |
| Want a separate WhatsApp catalog | The order page already includes a 💬 WhatsApp button per order. |
| Multi-restaurant on one device | Open kassa with `?r=other-restaurant` — each restaurant gets its own data, menu, staff and PIN. |

---

## 🆘 Need help?

- **Demo restaurant**: [webgen-gambia.pages.dev/kololigrill.html](https://webgen-gambia.pages.dev/kololigrill.html)
- **Sitemap (all pages)**: [webgen-gambia.pages.dev/sitemap.html](https://webgen-gambia.pages.dev/sitemap.html)
- **Open todos & roadmap**: see `TODO.md` in the repo
