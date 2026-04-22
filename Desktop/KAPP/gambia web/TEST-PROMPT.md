# 🧪 WebGen Gambia — Super Test Prompt

Een volledige end-to-end test voor het hele platform. Loop dit door om te zien of **alles werkt** zoals bedoeld.

---

## ✅ Voorbereiding

1. Zet een lokale webserver aan in de `gambia web/` map:
   ```bash
   # Optie A (Python)
   cd "gambia web" && python -m http.server 8080

   # Optie B (Node)
   npx serve "gambia web" -p 8080
   ```
2. Open de browser op **http://localhost:8080/landing.html**
3. Open DevTools (F12) → Console en Application → Local Storage bij de hand
4. Heb **2 browser tabs** open naast elkaar (voor live-sync tests)

---

## 🏠 TEST 1 — Publieke flow (5 min)

### 1.1 Landing page
- [ ] `landing.html` opent zonder fouten
- [ ] Hero animeert, prijzen zichtbaar, "Become reseller" werkt
- [ ] Nav bevat **"Inloggen"** en **"Sign in →"** (beiden → `portal.html`)
- [ ] Mobiele nav toggle (☰) opent de hamburger-menu
- [ ] Footer links werken

### 1.2 Index/Dashboard
- [ ] `index.html` toont 3 portaalkaarten
- [ ] Klik **Admin kaart** → gaat naar `portal.html#admin` en scrollt naar admin-formulier
- [ ] Klik **Medewerker kaart** → scrollt naar medewerker-formulier
- [ ] Klik **Klant kaart** → scrollt naar klant-formulier

### 1.3 Portal
- [ ] `portal.html` toont 3 gekleurde kaarten (goud / blauw / teal)
- [ ] E-mail + wachtwoord velden werken
- [ ] Klik "Inloggen" → spinner → redirect naar juiste portaal
- [ ] "Wachtwoord vergeten" opent alert
- [ ] Back-link rechtsboven → terug naar landing

---

## 🔐 TEST 2 — Portaal-rollen (10 min)

### 2.1 Admin portaal
- [ ] Login met `admin / kok2025`
- [ ] Alle tabbladen werken (dashboard, klanten, medewerkers, financiën, instellingen)
- [ ] **Logout** → redirect naar `portal.html` (niet blijven op eigen login-scherm)

### 2.2 Medewerker portaal
- [ ] Login met `lamin / 1234`
- [ ] Klantenportefeuille zichtbaar, onboarding-wizard werkt
- [ ] **Logout** → redirect naar `portal.html`

### 2.3 Klant portaal
- [ ] Login met demo-klant `WG-DEMO1`
- [ ] Tools / abonnement / website preview werkt
- [ ] **Logout** → redirect naar `portal.html`

---

## 🍽️ TEST 3 — Restaurant-systeem (15 min) — **HOOFDTEST**

### 3.1 Kassa setup
- [ ] Open **Tab 1**: `kassa.html`
- [ ] Sidebar toont "Demo Restaurant", sidebar-foot toont "GMD 0"
- [ ] Klik **Instellingen** → pas aan:
  - Restaurant naam: `Kunta Kinteh Grill`
  - Ondertitel: `Verse vis van de kust`
  - Valuta: `GMD`
  - Aantal tafels: `12`
- [ ] Klik **Opslaan** → toast verschijnt, sidebar update
- [ ] Ga naar **Tafels** → er staan nu 12 tafels (T01 tot T12), allemaal "Leeg"

### 3.2 Menu beheren
- [ ] Klik **Menu** → 12 demo-gerechten zichtbaar
- [ ] Klik **"+ Nieuw gerecht"**:
  - Naam: `Tilapia Gambiaans`
  - Categorie: `Hoofdgerecht`
  - Prijs: `500`
  - Emoji: `🐠`
- [ ] Opslaan → gerecht verschijnt in lijst
- [ ] Bewerk een bestaand gerecht → pas prijs aan → sla op → update zichtbaar
- [ ] Verwijder een gerecht → bevestiging → weg uit lijst

### 3.3 QR codes
- [ ] Klik **QR codes** → 12 QR's worden automatisch gegenereerd
- [ ] Elke QR heeft tafel-nummer (T01..T12)
- [ ] Base-URL veld is automatisch ingevuld
- [ ] Klik **"🖨️ Print"** → print-dialoog opent

### 3.4 Live bestelling plaatsen — 🔥 **DE GROTE TEST**
- [ ] Open **Tab 2**: `bestel.html?r=demo&t=5` (tafel 5)
- [ ] Hero toont restaurantnaam + "Tafel 5"
- [ ] Scroll door menu, zoekveld werkt, categorie-filters werken
- [ ] Voeg toe: **2× Benachin**, **1× JulBrew**, **1× Thiakry**
- [ ] Onderste balk toont `4` items en totaal
- [ ] Klik op balk → cart-modal opent
- [ ] Pas quantity aan (+/− knoppen)
- [ ] Typ opmerking: *"Niet te pittig alsjeblieft"*
- [ ] Klik **"Bestelling plaatsen →"**
- [ ] Bevestigingsscherm met ORD-code en status-tracker

### 3.5 Live ontvangst in kassa — 🔥 **LIVE SYNC CHECK**
- [ ] Ga terug naar **Tab 1** (kassa)
- [ ] **Pieptoon** hoorbaar (zet geluid aan!)
- [ ] Toast: *"🔔 Nieuwe bestelling · Tafel 5"*
- [ ] Badge "Nieuw" in topbar toont `1`
- [ ] Tab **Tafels**: T05 is nu **oranje glow** (status "Nieuw")
- [ ] Tab **Bestellingen**: order staat bovenin met status-tag "Nieuw"
- [ ] Opmerking zichtbaar als gele kader

### 3.6 Order-flow doorzetten
- [ ] Klik **"👨‍🍳 Accepteer"** → status wordt `preparing`, tafel wordt blauw
- [ ] Ga naar **Tab 2** (klant) → status-tracker updateert naar "Bereiden" ✓
- [ ] Terug in **Tab 1**: klik **"🔔 Klaar"** → tafel wordt teal, klant ziet "Klaar"
- [ ] Klik **"🍽️ Geserveerd"** → klant ziet "Geserveerd"
- [ ] Klik **"💰 Betaald"** → order verdwijnt uit "Actief", "Vandaag" toont GMD-bedrag

### 3.7 Bestellingen per tafel
- [ ] Open **Tab 2** opnieuw met `bestel.html?r=demo&t=5` → plaats nog een bestelling
- [ ] Ga in **Tab 1** naar **Tafels** → klik op **T05**
- [ ] Modal opent met **alle open bestellingen** voor tafel 5
- [ ] Totaal-bedrag klopt met som van orders
- [ ] Klik **"✓ Tafel afsluiten"** → bevestiging → alle orders → `paid`

### 3.8 Reserveringen
- [ ] Open nieuwe tab: `reserveer.html?r=demo`
- [ ] Stap 1: kies datum (vandaag of later) + 4 personen
- [ ] Stap 2: kies tijd (verleden-tijden zijn grijs)
- [ ] Stap 3: vul naam + telefoon in
- [ ] Stap 4: bevestig
- [ ] Ga naar kassa → **Reserveringen** → boeking staat er, status "Wacht op bevestiging"
- [ ] Klik **"✓ Bevestig"** → status → `confirmed`
- [ ] Badge in sidebar updatet

---

## 🏗️ TEST 4 — Website-generator (5 min)

- [ ] Open `webgen-gambia-v3.html`
- [ ] Vul in:
  - Bedrijfsnaam: `Kunta Kinteh Grill`
  - Domain: `kunta-kinteh.web.gm`
  - Telefoon: `+220 123 4567`
- [ ] In de sectielijst: **vink "Reserveren (Restaurant)" aan**
- [ ] Preview updatet → er verschijnt een groene "Reserveer nu →" sectie
- [ ] Nav toont "Reserveren" link
- [ ] Reserveer-knop link = `reserveer.html?r=kunta-kinteh-web-gm`

---

## 🛠️ TEST 5 — Tools (3 min)

- [ ] `qr-generator.html` → header toont groene "Inloggen →" knop
- [ ] `flyer-generator.html` → idem
- [ ] `visitekaartje-generator.html` → idem
- [ ] `menu-generator.html` → idem
- [ ] `contract-generator.html` → idem
- [ ] Elke knop leidt naar `portal.html`
- [ ] `webgen-gambia-v3.html` → zwevende login-knop rechtsboven

---

## 🔁 TEST 6 — Edge cases

- [ ] **Multi-tab**: open 3 klant-tabs (tafel 3, 7, 11), bestel tegelijk → alle 3 zichtbaar in kassa
- [ ] **Refresh**: ververs kassa-tab mid-order → alle data blijft bestaan (localStorage)
- [ ] **Reset**: Instellingen → "🔄 Demo data herstellen" → alles terug naar demo
- [ ] **Meerdere restaurants**: open `bestel.html?r=foo&t=1` en `bestel.html?r=bar&t=1` → data gescheiden
- [ ] **Lege winkelmandje**: "Bestelling plaatsen" knop is disabled
- [ ] **Geen telefoon bij reservering**: stap 3 geeft error "Vul alle velden in"
- [ ] **Oude tijd kiezen**: time-slot is grijs en niet klikbaar
- [ ] **Portal met ongeldige URL**: `portal.html#xyz` doet niks vreemds

---

## 📊 Verwacht eindresultaat

Na deze test moet je kunnen zeggen:

> ✅ Een klant scant een QR op tafel → ziet het menu → bestelt → de kassa krijgt het direct binnen met pieptoon → de keuken volgt de order door de statussen → de klant ziet elke status live → tafel wordt afgerekend.
>
> ✅ Een gast boekt online via de restaurant-website → de kassa ziet de reservering onder "Reserveringen" → het restaurant bevestigt.
>
> ✅ Het hele WebGen portaal (admin/medewerker/klant) is vanaf elke pagina bereikbaar via een klikbare inlog-knop.

---

## 🐛 Als iets niet werkt

| Symptoom | Vermoedelijke oorzaak |
|---|---|
| Geen pieptoon bij nieuwe order | Browser blokkeert AudioContext — klik eerst ergens in kassa |
| QR codes blank | Internetverbinding weg — qrcode.js komt van CDN |
| Klant ziet geen status-updates | `BroadcastChannel` werkt alleen tussen tabs in **dezelfde browser** |
| Data verdwijnt | localStorage was geleegd — check DevTools → Application |
| Tafels blijven leeg in kassa | Restaurant ID matcht niet (klant gebruikt `?r=demo`, kassa gebruikt andere ID) |

---

## 🚀 Bonus-test (1 uur)

Bouw een volledig restaurant-scenario na:
1. Kassa: zet 6 tafels op, 15 menu-items, print de QR's
2. 3 gasten boeken online (verschillende tijden)
3. 4 tafels bestellen tegelijk (4 tabs tegelijk open)
4. Bevestig alle reserveringen
5. Loop alle orders door naar betaald
6. Check aan het eind: daily revenue klopt

Als dat zonder hiccups gaat — je hebt een werkend systeem. 🎉
