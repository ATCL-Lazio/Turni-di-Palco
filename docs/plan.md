# MVP Plan - Turni di Palco (2025-12-10)

Changelog

- 2025-12-10: Prima stesura del piano MVP PWA con mock QR e attività simulate.
- 2025-12-10: Aggiunto piano per avatar ReadyPlayer.Me e pagina dedicata per la sincronizzazione.
- 2025-12-30: Avviata integrazione Supabase per autenticazione (mobile) e setup base.

Obiettivo

- Consegnare un MVP web/PWA che simuli il loop core (profilo, attività simulate, registrazione turno via QR mock) in linea con il GDD.

Ambito MVP

- Profilo giocatore locale: ruolo iniziale, XP base, reputazione ATCL/teatro (mock), valute (cachet).
- Attività simulate: almeno 1 micro-attività (es. scelta narrativa a bivi) con esiti su XP/cachet.
- Turni certificati (mock): input manuale/placeholder QR per registrare un evento test, assegnare ricompense, mostrare log turni.
- UI base: schermate Home, Carriera, Attività, Turni ATCL, Profilo (look teatrale coerente con PWA esistente).
- Storage locale: persistenza minima in localStorage; stub per future API backend.

Backlog immediato

- Integrare Supabase (client + auth + sessione) per mobile.
- Modellare tipi/dati cliente (profilo, ruoli, eventi mock, turni registrati, ricompense).
- Routing/scene leggera in `src/` (switch di viste dentro main shell) senza introdurre router esterno.
- Schermata Turni: form per ID evento mock, selezione ruolo, riepilogo ricompense, lista turni.
- Micro-attività: prototipo dialogo a bivi con 2-3 scelte e outcome su XP/cachet/reputazione.
- UI stato giocatore: pannello Carriera con ruolo, XP, reputazione, valute; indicatori di progresso.
- Persistenza: salvataggio/restore da localStorage con fallback in-memory e reset debug.
- Avatar: integra ReadyPlayer.Me con pagina dedicata (`avatar.html`), salva URL/thumbnail nel profilo e riusa anteprima nelle altre viste.

Risorse future (fuori scope MVP)

- Scanner QR reale, deep link eventi, validazione backend.
- Minigiochi aggiuntivi (tempismo luci, livelli audio, allestimento scena).
- Reputazione per teatro dettagliata, titoli cosmetici, valuta prestige.
- Autenticazione/account, sincronizzazione cloud.
