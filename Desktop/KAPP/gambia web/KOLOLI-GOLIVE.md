# 🍽️ Kololi Grill — Go-Live Plan (eerste betalende klant)

Concrete stappen om van de huidige `kololigrill.html` naar een écht live, betaald restaurant op jouw platform te komen. Alles dat hier staat is **doe-werk** — geen strategie, geen pseudocode.

---

## 🎯 Doel

Aan het eind van deze checklist:
- Kololi Grill staat live op een eigen (sub)domein
- Heeft werkende QR-bestellingen op tafels
- Accepteert online reserveringen
- Betaalt een maandabonnement aan jou
- Kan zelf menu wijzigen zonder jouw hulp

**Streeftijd:** 1 werkweek (5 werkdagen, ~20 uur totaal).

---

## 📋 FASE 1 — Contract & onboarding (Dag 1, ~3 uur)

### 1.1 Gesprek + contract
- [ ] Afspraak maken met eigenaar Kololi Grill — bij voorkeur ter plaatse
- [ ] Demo laten zien op je laptop: live order van tafel 5 → kassa
- [ ] Pakket kiezen (ik stel **Standard** voor: GMD 3.500/maand, custom domein, 10 websites, alle tools)
- [ ] Contract uitprinten via `contract-generator.html` — invullen met:
  - Looptijd: 12 maanden met 1 maand opzegtermijn
  - Start: eerste van volgende maand
  - Eenmalige website-fee: GMD 8.000
  - Maandelijks: GMD 3.500
- [ ] Beide partijen tekenen, scan in Google Drive
- [ ] **Betaal-methode afspreken**: Wave, Afrimoney of bankoverschrijving
- [ ] Eerste factuur sturen (website-fee + eerste maand = GMD 11.500)

### 1.2 Data ophalen
- [ ] Google Doc aanmaken: "Kololi Grill — Launch Data"
- [ ] Verzamel bij de eigenaar:
  - [ ] Exacte bedrijfsnaam + spelling logo
  - [ ] Volledig menu (liefst in Word/Excel) — per item: naam, beschrijving, prijs, allergenen, foto
  - [ ] Openingstijden per dag
  - [ ] Adres + Google Maps link
  - [ ] WhatsApp-nummer (zakelijk!)
  - [ ] Telefoonnummer voor reserveringen
  - [ ] E-mail (info@…)
  - [ ] Social media accounts (FB, IG, TikTok)
  - [ ] Aantal tafels binnen + buiten (totaal)
  - [ ] Gemiddelde zit-duur per tafel (voor reserveer-slots)
  - [ ] 10–15 professionele foto's (gerechten + interieur + team)
  - [ ] Kernverhaal in 100 woorden (about-sectie)
- [ ] Maak een **restaurant ID** vast: `kololi-grill` (lowercase, geen spaties)

---

## 🌐 FASE 2 — Technische setup (Dag 2, ~4 uur)

### 2.1 Backend voorbereiden
- [ ] `wrangler.toml` KV-namespace controleren → `1748e887683d40c7b5a57dafe7ea9f66` klopt
- [ ] Seed een tenant-record in KV:
  ```bash
  wrangler kv key put --namespace-id=1748e887683d40c7b5a57dafe7ea9f66 \
    "tenant:kololi-grill" \
    '{"name":"Kololi Grill","plan":"standard","active":true,"createdAt":"2026-04-19","contactEmail":"...","contactPhone":"..."}'
  ```
- [ ] Maak een admin-account voor de restauranthouder aan via `/api/auth/signup`
- [ ] Test de login werkt via `klant.html`
- [ ] Stuur welcome-email via `POST /api/email/welcome`

### 2.2 Domein
- [ ] Bepaal URL-strategie. Twee opties:
  - **Optie A** (snel): subdomein → `kololi-grill.web.gm` (jij regelt DNS)
  - **Optie B** (pro): eigen domein → `kololigrill.gm` (klant koopt + jij pointt)
- [ ] Kies **A** voor nu, upgrade later. Kost je 5 min.
- [ ] Cloudflare DNS: A-record of CNAME naar je Pages-project
- [ ] SSL wordt automatisch geregeld door Cloudflare
- [ ] Test: https://kololi-grill.web.gm moet openen

### 2.3 Bestanden klaarzetten
- [ ] Kopieer `kololigrill.html` → hernoem naar `index.html` in een nieuwe map `sites/kololi-grill/`
- [ ] Voeg deze regels toe aan de nav van die site:
  ```html
  <a href="../../reserveer.html?r=kololi-grill" class="btn btn-primary">Reserveer</a>
  <a href="../../bestel.html?r=kololi-grill&t=QR" class="nav-links-a">Menu</a>
  ```
- [ ] Kopieer `bestel.html`, `reserveer.html`, `kassa.html` mee in dezelfde deploy
- [ ] `favicon.svg` en `manifest.json` meenemen
- [ ] Lokaal testen: open `sites/kololi-grill/index.html` → klik "Reserveer" → landt op reserveer.html met juiste restaurant-ID

---

## 🍽️ FASE 3 — Menu vullen (Dag 2–3, ~4 uur)

### 3.1 Menu in de kassa laden
- [ ] Open `kassa.html` in een incognito-tab (schone localStorage)
- [ ] Klik **Instellingen** → restaurant-ID handmatig op `kololi-grill` zetten via console:
  ```javascript
  localStorage.setItem('wg_restaurant_id', 'kololi-grill');
  location.reload();
  ```
- [ ] Vul instellingen in:
  - Restaurant naam: `Kololi Grill`
  - Ondertitel: `Grilled fresh, Gambian soul`
  - Valuta: `GMD`
  - Aantal tafels: (vraag aan eigenaar, stel 12)
- [ ] Opslaan

### 3.2 Alle gerechten invoeren
- [ ] Voor elk gerecht via **Menu → + Nieuw gerecht**:
  - Categorie (Voorgerecht / Hoofd / Grill / Drank / Dessert)
  - Naam (exact zoals op papieren menu)
  - Omschrijving (1 zin)
  - Prijs (in GMD)
  - Emoji (🐟 vis, 🍗 kip, 🥩 vlees, 🥗 salade, 🍹 drank…)
- [ ] Streef naar 25–40 items, niet meer (overload)
- [ ] Check dubbele namen, check prijzen nogmaals met eigenaar

### 3.3 QR codes genereren & printen
- [ ] Klik **QR codes** → zet aantal tafels op 12 (of wat het echt is)
- [ ] Base URL: `https://kololi-grill.web.gm/bestel.html`
- [ ] Klik **Print**
- [ ] Stuur naar drukkerij in Serekunda — op stevig karton, 10×10 cm, gelamineerd
- [ ] Kosten: ~GMD 50 per sticker, 12 tafels = GMD 600
- [ ] **Belangrijk**: elk kaartje vermeldt tafelnummer groot (T01, T02, …)

---

## 💳 FASE 4 — Betaalintegratie (Dag 3, ~3 uur)

### 4.1 Gast-betaling (voor bestellingen)
- [ ] **Fase 1 keuze**: alléén cash aan tafel, geen online pay
  - Waarom: eerste klant, testen of flow werkt, geen payment-risico
  - Workflow: gast bestelt via QR → eten komt → ober rekent cash af → kassa markeert "Betaald"
- [ ] Fase 2 (over 2 maanden): Wave/Afrimoney integratie uitrollen
  - Backend is al klaar (zie `POST /api/payment/verify` in worker.js)

### 4.2 SaaS-betaling (jij krijgt je geld)
- [ ] Zet een **terugkerende factuur** op in `admin.html`:
  - Klant: Kololi Grill
  - Bedrag: GMD 3.500/maand
  - Start: 1e van volgende maand
  - Methode: Wave transfer naar jouw nummer
- [ ] Zet automatische herinneringen aan (WhatsApp template via `POST /api/whatsapp/reminder`)
- [ ] Bouw dunning: als 7 dagen niet betaald → account pauze → site toont "Betalingsachterstand"

---

## 📚 FASE 5 — Training & handover (Dag 4, ~4 uur)

### 5.1 Training eigenaar + 1 medewerker
- [ ] 2 uur training op locatie, op hun eigen apparaten:
  - Kassa openen, inloggen
  - Order accepteren → bereiden → klaar → geserveerd → betaald
  - Tafel afsluiten
  - Reservering bevestigen
  - Menu item toevoegen/wijzigen
  - Instellingen: naam, tafel-aantal
- [ ] **Opdrachten tijdens training**: laat ze 5 echte orders verwerken
- [ ] Geef ze een **laminated cheat sheet** (1 A5-kaart):
  - QR op tafel + tel nr noodlijn (jouw WhatsApp)
  - De 5 status-knoppen uitgelegd met iconen
  - "Probleem? Bel +220-XXX-XXXX"

### 5.2 Documentatie voor de klant
- [ ] Maak `KOLOLI-HANDLEIDING.pdf` via `contract-generator.html` of Word:
  - Hoe open ik de kassa?
  - Hoe voeg ik een gerecht toe?
  - Hoe bevestig ik een reservering?
  - Wat doe ik bij problemen?
- [ ] WhatsApp-groep aanmaken: "Kololi Grill ↔ WebGen Support"
- [ ] Beloof: reactie binnen 2 uur tijdens openingstijden

---

## 🧪 FASE 6 — Soft launch (Dag 5, ~4 uur)

### 6.1 Test dag (alleen intern)
- [ ] 1 dag met QR's alléén bij personeel-tafel
- [ ] Personeel speelt gasten: 10 fake orders, 3 reserveringen
- [ ] Monitor `admin.html` → analytics dashboard
- [ ] Checken: 
  - [ ] Pieptoon werkt op de kassa-tablet
  - [ ] Tablet valt niet in slaap (schermtime-out instellen op "nooit")
  - [ ] Wi-Fi is stabiel in alle hoeken van de zaak
  - [ ] Gasten-telefoons krijgen de site netjes geladen (3G test!)

### 6.2 Tablet + hardware
- [ ] Koop een goedkope Android tablet (GMD 4.000) — zet in keuken
- [ ] Apart account voor keuken (beperkt tot "bestellingen" tab)
- [ ] Tablet op oplader aan het aanrecht, volume 100%
- [ ] Bonprinter (optioneel, fase 2): ESC/POS via Cloudflare

### 6.3 Go-live
- [ ] Vrijdag avondservice — soft launch met aankondiging op IG/FB:
  > "📱 Nu scan-to-order bij Kololi Grill! Scan de QR op je tafel."
- [ ] Eigenaar aanwezig, jij aanwezig de eerste 2 uur
- [ ] Eerste probleem? Fix onmiddellijk in de console
- [ ] Verzamel **alle feedback** — noteer elke klacht

---

## 📈 FASE 7 — Na-launch (Week 2–4)

### Week 2
- [ ] Dagelijks monitoren: aantal orders, gemiddeld ticket, reservations
- [ ] Weekly call met eigenaar: "Wat kan beter?"
- [ ] Bug-fixes binnen 48 uur

### Week 3
- [ ] Eerste echte factuur voor maand 2 — check of betaling komt
- [ ] Vraag om testimonial + foto van de eigenaar (voor je eigen marketing)
- [ ] Vraag om introductie bij andere restaurants in de buurt

### Week 4
- [ ] Case study schrijven: "Hoe Kololi Grill 40% meer reserveringen kreeg in 30 dagen"
- [ ] Publiceer op `landing.html` — eerste testimonial sectie
- [ ] Gebruik als sales-argument voor klant #2

---

## 💰 Verwachte cijfers (eerste maand Kololi Grill)

| Post | Bedrag (GMD) |
|---|---:|
| Eenmalig website-fee | +8.000 |
| Maand 1 SaaS-fee | +3.500 |
| QR-kaartjes drukkerij | −600 |
| Domein .web.gm | −0 (via CF) |
| Training (4 uur × 2 mensen) | −0 (eigen tijd) |
| Tablet voor keuken (optioneel) | −4.000 |
| **Netto maand 1** | **+6.900** |
| **Netto maand 2+ (recurring)** | **+3.500/maand** |

---

## 🚨 Top 5 risico's + mitigatie

| Risico | Kans | Mitigatie |
|---|---|---|
| Wi-Fi valt uit midden in service | Hoog | Backup: papier-bestelbonnen naast elke tafel |
| Personeel begrijpt kassa niet | Hoog | Uitgebreide training + cheat sheet + WhatsApp-lijn |
| Gasten scannen QR niet | Middel | Ober legt het persoonlijk uit bij binnenkomst |
| Eerste factuur niet betaald | Middel | Contract getekend, incasso-clausule, eenmalige fee vooraf |
| Browser-crash = orders kwijt | Laag | localStorage overleeft crash. Backup naar worker binnen 1 week |

---

## ✅ Launch-checklist (printbaar)

Print dit vel en kruis af tijdens go-live dag:

```
[ ] Contract getekend
[ ] Eerste betaling binnen
[ ] Domein werkt (kololi-grill.web.gm)
[ ] Menu volledig ingevoerd (34 items)
[ ] 12 QR-kaartjes op tafels geplakt
[ ] Kassa-tablet aan het werk
[ ] Geluid op 100%, scherm-timeout uit
[ ] Wi-Fi getest in 4 hoeken van zaak
[ ] Personeel getraind (2 mensen)
[ ] Cheat sheet uitgereikt
[ ] WhatsApp support-lijn actief
[ ] Social post aangekondigd
[ ] 5 test-orders succesvol doorlopen
[ ] Eigenaar enthousiast en zelfstandig
```

---

## 🎯 Definitie van "klaar"

Kololi Grill is pas écht live wanneer:
- ✅ 30 dagen operationeel zonder jouw dagelijkse hulp
- ✅ 100+ orders door het systeem
- ✅ Tweede maandfactuur betaald zonder herinnering
- ✅ Eigenaar beveelt jou aan bij restaurant #2
- ✅ Jij slaapt een volle nacht zonder WhatsApp-paniek 🛌

Als die 5 vinkjes staan — dan **verkoop je aan klant #2** met dit als referentie. Dat is het vliegwiel.
