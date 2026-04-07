# Turni di Palco — Game Design Document v2.0

> **Versione:** 2.0  
> **Data:** 2026-04-02  
> **Autori:** Team ATCL-Lazio  
> **Riferimento storico:** `docs/gdd-turni-di-palco.pdf` (GDD v1, bozza originale)  
> **Stato:** Documento di riferimento attivo — aggiornato allo stato reale del prodotto

---

## 1. Vision e Target

**Turni di Palco** è una Progressive Web App (PWA) che gamifica la partecipazione agli eventi teatrali di [ATCL Lazio](https://www.atcl.it). Il giocatore interpreta un ruolo professionale teatrale, progredisce attraverso attività simulate quotidiane e accumula esperienza reale partecipando agli spettacoli in cartellone.

**Elevator pitch:** *Scegli il tuo ruolo dietro le quinte, allenati ogni giorno con scenari e minigiochi, poi vai a teatro e registra il tuo turno reale — il gioco si intreccia con la vita.*

### Target audience

- **Primario:** 14–35 anni, residenti nel Lazio, con interesse per il teatro e la cultura
- **Secondario:** Studentesse e studenti di scuole di teatro e performing arts
- **Contesto d'uso:** Mobile first, sessioni brevi (3–10 min) tra un evento ATCL e l'altro

### Obiettivi del progetto

1. Aumentare la fidelizzazione del pubblico giovane di ATCL Lazio
2. Educare alla cultura teatrale attraverso gameplay narrativo
3. Creare un legame digitale–fisico tra il giocatore e i teatri della rete ATCL
4. Raccogliere dati aggregati sulla partecipazione (con consenso esplicito, GDPR-compliant)

---

## 2. Stack Tecnologico

> Nota: il GDD v1 descriveva il progetto come "possibile PWA" con riferimenti a React Native e Flutter. Il prodotto è una PWA React completa, deployata e in produzione.

### Frontend mobile (app principale)

| Tecnologia | Versione | Ruolo |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.9 | Tipizzazione |
| Vite | 7.3 | Build tool |
| Tailwind CSS | 4.1 | Styling |
| Radix UI | varie | Componenti primitivi accessibili |
| Supabase JS | 2.50 | Client database/auth |
| Vitest | 4.0 | Testing |

Base path: `/mobile/` — l'app è servita su `{dominio}/mobile/`.

### PWA shell (`apps/pwa`)

TypeScript puro (no React), Vite 7. Funziona come dev dashboard e pannello di controllo interno. Non è l'app player-facing.

### Backend

| Servizio | Tecnologia | Funzione |
|---|---|---|
| Supabase | PostgreSQL + Auth + Storage | Database, autenticazione, RLS |
| Edge Functions | Deno (TypeScript) | Logica server-side (8 funzioni) |
| Control Plane | Express 4 + Node.js | API admin interna |
| Maxwell AI | Node.js + Codex CLI | Supporto AI in-app |

### Deploy

Il progetto è deployato su **4 piattaforme in parallelo**:

| Piattaforma | Cosa serve | Branch |
|---|---|---|
| **Netlify** | App mobile (produzione principale) | `main` |
| **Vercel** | App mobile (mirror/preview) | `main` |
| **Render** | App mobile + Maxwell AI + Control Plane + Badges | `render/preview` |
| **Railway** | App mobile alternativa | `main` |

### CI/CD

GitHub Actions con 6 workflow: lint+test su ogni PR verso main, cleanup eventi giornaliero, security scan, sync branch di deploy, auto-assign PR, cleanup gitignore.

---

## 3. Architettura del Monorepo

```
Turni-di-Palco/
├── apps/
│   ├── mobile/          # App player-facing (React 18 + Vite)
│   │   ├── src/
│   │   │   ├── components/screens/   # 28 schermate
│   │   │   ├── components/ui/        # Design system
│   │   │   ├── gameplay/             # Logica minigiochi
│   │   │   ├── data/                 # Dati statici (achievements, ecc.)
│   │   │   ├── services/             # Client API, feature flags, storage
│   │   │   └── state/store.tsx       # Context store (~4800 righe)
│   │   └── public/                   # manifest.webmanifest, icone, SW
│   ├── pwa/             # Dev dashboard (TypeScript puro)
│   ├── control-plane/   # API admin (Express 4)
│   └── reactbricks/     # CMS (da integrare)
├── supabase/
│   ├── functions/       # 8 Edge Functions
│   └── migrations/      # 39 migrazioni (2025-12 → 2026-04)
├── tools/               # Script utilità (cleanup, shields/badges)
└── docs/                # Design docs e GDD
```

### PWA e vincoli di piattaforma

La scelta PWA ha conseguenze dirette sull'esperienza utente, in particolare per il target 14–35:

| Aspetto | Situazione |
|---|---|
| **Notifiche push su iOS** | Supportate solo da iOS 16.4+ tramite Add to Home Screen. Non disponibili in-browser. |
| **Fotocamera (QR)** | Richiede HTTPS e permesso esplicito dell'utente. Supportata su tutti i browser moderni. |
| **Distribuzione** | Nessun App Store / Play Store. L'utente accede via URL e aggiunge alla home screen. |
| **Aggiornamenti** | Istantanei via deploy — nessuna attesa di approvazione store. |
| **Background sync** | Nessun supporto nativo universale → workaround con IndexedDB + service worker. |
| **Visibilità** | Nessuna discoverability organica tramite store — dipende da canali propri ATCL. |

---

## 4. Ruoli Giocabili

Il GDD v1 prevedeva 5 ruoli. Il codice attuale implementa **7 ruoli**, due aggiunti durante lo sviluppo.

| ID | Nome | Focus | Presenza | Precisione | Leadership | Creatività |
|---|---|---|---|---|---|---|
| `attore` | Attore / Attrice | Presenza scenica | 90 | 70 | 60 | 85 |
| `luci` | Tecnico Luci | Precisione cue | 50 | 95 | 65 | 75 |
| `fonico` | Fonico | Pulizia audio | 45 | 90 | 60 | 70 |
| `attrezzista` | Attrezzista / Scenografo | Allestimento rapido | 55 | 85 | 70 | 90 |
| `palco` | Assistente di Palco | Coordinamento | 60 | 88 | 85 | 65 |
| `rspp` | RSPP | Sicurezza e prevenzione | 65 | 92 | 88 | 58 |
| `dramaturg` | Dramaturg | Analisi narrativa | 70 | 82 | 78 | 92 |

I valori delle statistiche (0–100) influenzano bonus e sblocchi nelle attività. Vedere issue [#471](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/471) per la roadmap sulla differenziazione meccanica completa.

---

## 5. Core Loop

```
Attività simulate
  (scenari, minigiochi, formazione)
        ↓
  XP + Cachet + Riputazione
        ↓
  Livello + Titoli + Skill passive
        ↓
  Partecipazione evento ATCL
  (ticket → registrazione turno)
        ↓
  XP Campo + Cachet premium
        ↓
       [↑ ritorna ad Attività simulate]
```

### Attività simulate

Sempre disponibili, senza bisogno di un evento fisico. Divise in tre categorie:

**1. Scenari narrativi (scelte a bivi)**
- Situazioni realistiche del mondo teatrale
- Il giocatore sceglie tra opzioni di risposta
- Ogni scelta modifica statistiche, XP, cachet e può sbloccare flag narrativi
- Engine implementata; contenuti in espansione (issue [#119](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/119))

**2. Minigiochi**

5 configurazioni implementate in `apps/mobile/src/gameplay/minigames.ts`:

| ID attività | Titolo | Tipo | Ruoli |
|---|---|---|---|
| `ritardo` | Cue luci d'emergenza | Timing | Tutti |
| `palco` | Cambio scena rapido | Timing | Tutti |
| `audio` | Bilanciamento audio | Audio | Tutti |
| `recitazione` | Attacco battuta | Timing | Tutti (Dramaturg: "Analisi sottotesto") |
| `copione` | Revisione copione | Timing | Solo Dramaturg |

Scoring: Perfetto (≥90%) / Ottimo (≥75%) / Buono (≥60%) / Da migliorare.

**3. Formazione e corsi**
- Investimento di cachet + tempo (login giornalieri)
- Completamento sblocca perk passivi e bonus permanenti
- Struttura base implementata; catalogo da espandere (issue [#121](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/121))

### Turni certificati

1. Il giocatore individua un evento ATCL nel calendario
2. Pianifica la partecipazione con il ruolo scelto
3. All'evento, attiva il biglietto tramite QR scan
4. Il sistema verifica: finestra temporale, unicità turno per evento, geofencing opzionale
5. Registrazione confermata → ricompense XP Campo + Cachet premium

Anti-abuso: un turno per evento per utente, finestra temporale configurabile, geolocalizzazione opzionale.

---

## 6. Sistema di Progressione

### Metriche principali

| Metrica | Descrizione | Fonte |
|---|---|---|
| **XP** | Esperienza standard da attività simulate | Minigiochi, scenari, formazione |
| **XP Campo** | Esperienza da partecipazione reale (moltiplicatore) | Turni certificati |
| **Reputazione Teatro** | Punteggio per ogni teatro ATCL frequentato | Turni + attività teatro-specifiche |
| **Reputazione ATCL** | Indice globale su tutta la rete | Aggregato delle reputazioni teatro |
| **Cachet** | Valuta principale per shop e formazione | Tutte le attività |
| **Token ATCL** | Valuta legata ai turni certificati | Solo turni certificati |

> **Nota GDD v2:** Il GDD v1 ipotizzava di ridurre a 3 metriche visibili. La struttura DB attuale è più articolata. La semplificazione dell'UI (mostrare solo Livello + Reputazione + Cachet sulla dashboard, nascondere il resto in Carriera) è in roadmap — issue [#470](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/470).

### Livelli

- Livelli 1–50, calcolati su XP totale (standard + campo)
- I turni certificati valgono significativamente più delle attività simulate (XP Campo con moltiplicatore)
- Reputation decay: la reputazione per teatro decresce senza visite, incentivando la partecipazione continua

### Titoli e achievement

8 badge implementati (`apps/mobile/src/data/achievements_data.ts`): "Primo sipario", "Ritmo di scena", "Teatri in tour", "Presenza costante", "Settimana piena", "Compagnia itinerante", "Veterano di palco", "Mappa completa".

### Shop

Tre categorie di slot acquistabili con cachet: `slot` (slot attività extra), `rep_atcl` (boost reputazione ATCL), `rep_theatre` (boost reputazione teatro). Token ATCL come valuta premium da turni certificati.

---

## 7. Feature Inventory — Stato Attuale

> Ultimo aggiornamento: 2026-04-02. Basato su 39 migrazioni Supabase e ispezione del codice.

| Feature | Stato | Note |
|---|---|---|
| Profilo giocatore + selezione ruolo | ✅ Implementata | 7 ruoli, statistiche, immagine profilo |
| Sistema XP / Cachet / Reputazione | ✅ Implementata | Con decay e moltiplicatori |
| Minigiochi (timing + audio) | ✅ Implementata | 5 config, scoring, outcome |
| Shop cachet/slot/token | ✅ Implementata | 3 categorie, slot extra |
| Leaderboard | ✅ Implementata | RPC Supabase, cache |
| Scanner ticket / attivazione | ✅ Implementata | Edge function `ticket-activation` |
| Geofencing turni (opzionale) | ✅ Implementata | Raggio + coordinate per teatro, configurabile runtime |
| Achievement system | ✅ Implementata | 8 badge, alcuni hidden |
| Profilo pubblico condivisibile | ✅ Implementata | URL `/profile/{userId}`, teatri frequentati |
| GDPR compliance | ✅ Implementata | Cookie consent, account deletion (Art.17), leaderboard visibility |
| Feature flags | ✅ Implementata | Supabase + env override, per-feature |
| Passive skills / progressione | ✅ Implementata | Skill sbloccabili, bonus applicati |
| Pianificazione partecipazione eventi | ✅ Implementata | Intenzione ruolo, sync offline |
| Maxwell AI support | ✅ Implementata | Chat in-app, creazione issue, Codex CLI |
| Control plane admin | ✅ Implementata | API Express, JWT, RLS admin |
| Calendario eventi ATCL | ✅ Implementata | Con cleanup automatico (cron) |
| Navigazione bottom tab | ✅ Implementata | 6 tab: home, turns, leaderboard, activities, shop, profile |
| Scenari narrativi | 🔶 Parziale | Engine base presente, contenuti limitati |
| Formazione / corsi | 🔶 Parziale | Struttura presente, catalogo da espandere |
| Onboarding FTUE | 🔶 Parziale | Role selection esiste, flusso completo mancante |
| Condivisione sociale (Web Share) | ❌ Non avviata | Issue [#473](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/473) |
| Content pipeline strutturato | ❌ Non avviata | Issue [#474](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/474) |
| Light theme / accessibilità avanzata | ❌ Non avviata | Issue [#476](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/476) |
| Tracking KPI / analytics | ❌ Non avviata | Issue [#477](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/477) |
| Redirect root URL → /mobile/ | ✅ Implementata | Issue [#468](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/468) |

---

## 8. Schermate dell'App

28 schermate implementate in `apps/mobile/src/components/screens/`:

**Autenticazione e onboarding**
- `Welcome` — splash/landing
- `Login` / `Signup` — autenticazione
- `CookieConsent` — gate GDPR
- `RoleSelection` — scelta ruolo iniziale
- `InstallApp` — prompt installazione PWA

**App principale**
- `Home` — dashboard con XP, cachet, eventi imminenti
- `ATCLTurns` — lista eventi e turni certificati
- `Activities` / `ActivitiesHub` / `ActivityDetail` — hub attività simulate
- `ActivityMinigame` — gameplay minigiochi
- `ActivityResult` — risultati post-attività
- `Career` — progressione carriera
- `Profile` / `PublicProfile` — profilo privato e pubblico
- `EarnedTitles` — achievement e titoli
- `Leaderboard` — classifiche
- `Shop` — negozio cachet/token
- `EventConfirmation` / `EventDetails` — dettaglio e conferma partecipazione
- `SupportChat` — Maxwell AI

**Account e legale**
- `AccountSettings` / `ChangePassword`
- `PrivacyPolicy` / `TermsAndConditions`

**Prototype / dev**
- `TicketQrActivationPrototype` — prototipo attivazione ticket QR

---

## 9. Backend — Supabase

### Edge Functions (8)

| Funzione | Descrizione |
|---|---|
| `app-version` | Restituisce versione corrente dell'app |
| `cleanup-events` | Cancella eventi ATCL passati (eseguita da cron GitHub Actions) |
| `delete-my-account` | GDPR Art. 17 — eliminazione account completa |
| `dev-access` | Controllo accesso dashboard developer |
| `event-links` | Generazione deep link per eventi |
| `import-spazio-rossellini` | Importazione dati teatro Spazio Rossellini |
| `mobile-logs` | Raccolta log diagnostici dal client mobile |
| `ticket-activation` | Attivazione ticket via QR e registrazione turno |

### Schema DB (tabelle principali)

| Tabella | Contenuto |
|---|---|
| `profiles` | Profilo utente: level, xp, xp_field, reputation, cachet, role_id |
| `roles` | Definizione ruoli: id, name, focus, stats, role_profile |
| `events` | Eventi ATCL: theatre_id, date, title, focus_role |
| `turns` | Turni certificati: user_id, event_id, role_id, status (pending/synced/failed) |
| `activity_completions` | Completamenti attività simulate: user_id, activity_id, outcome |
| `theatre_reputation` | Reputazione per-teatro: user_id, theatre_id, score |
| `ticket_activations` | Attivazioni ticket QR: hash, user_id, status |
| `feature_flags` | Flag feature per-utente o globali |
| `shop_slots` | Slot extra acquistati dallo shop |

39 migrazioni dal 2025-12-30 al 2026-04-01.

---

## 10. Roadmap e Issue Aperte

Issues create nel contesto del GDD v2.0 ([#467](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/467)–[#478](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/478)):

### P0 — Bloccanti

| Issue | Titolo |
|---|---|
| [#467](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/467) | **Questo documento** — GDD v2.0 |
| [#468](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/468) | Redirect root URL → /mobile/ |

### P1 — Critici per retention

| Issue | Titolo |
|---|---|
| [#469](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/469) | Minigiochi: Tempismo Luci + Livello Audio (espansione) |
| [#470](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/470) | Semplificazione sistema di progressione (3 metriche) |
| [#471](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/471) | Differenziazione meccanica reale dei ruoli |
| [#472](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/472) | Onboarding / FTUE (First Time User Experience) |

### P2 — Importanti per crescita

| Issue | Titolo |
|---|---|
| [#473](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/473) | Feature di condivisione sociale minima |
| [#474](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/474) | Content pipeline e struttura dati narrativi |
| [#475](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/475) | Placeholder numeri di bilanciamento |
| [#476](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/476) | Accessibilità (theme, aria, WCAG 2.1 AA) |
| [#477](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/477) | Metriche di successo e tracking KPI |
| [#478](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/478) | Eventi narrativi esclusivi legati ai teatri ATCL |

Issue correlate precedenti: [#119](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/119) (engine narrativa), [#121](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/121) (formazione), [#302](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/302) (multi-teatro), [#328](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/328) (engine narrativa), [#164](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/164) (audience development).

---

## Appendice A — Delta GDD v1 → v2

| Aspetto | GDD v1 (bozza) | GDD v2 (reale) |
|---|---|---|
| Piattaforma | "Possibile PWA, valutare React Native / Flutter" | PWA React 18 in produzione |
| Ruoli | 5 | 7 (aggiunti RSPP e Dramaturg) |
| Minigiochi | "Da avviare" | 5 configurazioni implementate |
| QR | Flusso QR per turni | Ticket activation con Edge Function e geofencing |
| Valute | Cachet + "possibile seconda valuta" | Cachet + Token ATCL (implementati) |
| Deploy | Non specificato | 4 piattaforme (Netlify, Vercel, Render, Railway) |
| Backend | "Gestione ID evento, validazione QR" | 8 Edge Functions, 39 migrazioni, RLS policies complete |
| AI | Non menzionata | Maxwell AI Support (in-app chat + issue creation) |
| GDPR | Non menzionata | Implementata (Art. 7, 15, 17, 20, 21) |
| Admin | Non menzionata | Control plane con Express + JWT |
| Bilanciamento | "Definire i numeri precisi è rimandato" | Ancora da definire — issue [#475](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/475) |

---

## Appendice B — Teatri ATCL

La rete include 25+ teatri/venue nel Lazio. Per la lista completa con provider ticketing (TicketOne, Ciaotickets, Tickettando, Liveticket, ecc.) vedere `docs/2026-03-23-atcl-teatri-ticketing.md`.

Per gli scenari narrativi teatro-specifici (sblocchi basati su reputazione teatro), vedere issue [#478](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/478).

---

## Appendice C — Deployment e configurazione

| File | Contenuto |
|---|---|
| `netlify.toml` | Config Netlify (produzione principale) — build command, headers CSP/HSTS, SPA redirect |
| `vercel.json` | Config Vercel — build mobile, output dir |
| `render.yaml` | Config Render — 4 servizi (app, Maxwell AI, control-plane, badges Docker) |
| `apps/mobile/public/manifest.webmanifest` | Manifest PWA — icone, theme color `#05070d`, start URL `/mobile/`, shortcuts |
| `apps/pwa/public/sw.js` | Service Worker — cache versioning |
| `.github/workflows/` | 6 GitHub Actions workflow |
