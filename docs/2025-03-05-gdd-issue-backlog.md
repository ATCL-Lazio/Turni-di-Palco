# 2025-03-05 - GDD Issue Backlog (Turni di Palco)

## Changelog

- Added a structured issue backlog derived from the Game Design Document.
- Grouped issues by gameplay loop, progression, UX, and technical integration.
- Included acceptance criteria for each issue to support GitHub issue creation.

## Source

- Game Design Document: `docs/gdd-turni-di-palco.pdf`

## Issue backlog (da creare su GitHub)

> Nota: dove utile, ho aggiunto i blocchi `ISSUE_DRAFT:{...}` pronti per l’endpoint `/api/ai/issue`
> (vedi `apps/mobile/src/services/ai.ts`). Copiare il blocco in un commento o prompt
> dell’assistente per generare automaticamente l’issue con label `gdd`, `feature`, `mvp`.

### Profilo, ruoli e progressione

1. **[GDD-001] Creazione profilo e scelta ruolo iniziale**
   - **Obiettivo:** consentire al giocatore di creare il profilo e selezionare uno dei ruoli iniziali (Attore/Attrice, Tecnico luci, Fonico, Attrezzista/Scenografo, Assistente di palco).
   - **Dettagli GDD:** ruolo iniziale con statistiche base e impatto sulle missioni e ricompense.
   - **Acceptance criteria:**
     - Schermata di onboarding con selezione ruolo e breve descrizione.
     - Salvataggio del ruolo e statistiche base nel profilo.
     - Possibilità di cambiare ruolo in seguito (flag/placeholder per future release).
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-001] Creazione profilo e scelta ruolo iniziale","body":"## Obiettivo\nConsentire al giocatore di creare il profilo e selezionare uno dei ruoli iniziali (Attore/Attrice, Tecnico luci, Fonico, Attrezzista/Scenografo, Assistente di palco).\n\n## Dettagli GDD\nIl ruolo iniziale ha statistiche base e impatta missioni e ricompense.\n\n## Acceptance criteria\n- Schermata di onboarding con selezione ruolo e breve descrizione.\n- Salvataggio del ruolo e statistiche base nel profilo.\n- Possibilità di cambiare ruolo in seguito (flag/placeholder per future release).\n","labels":["gdd","feature","mvp"]}`

2. **[GDD-002] Sistema di livelli e XP per ruolo**
   - **Obiettivo:** tracciare XP e livelli separati per ruolo, includendo XP standard e XP sul campo.
   - **Dettagli GDD:** livelli 1–50, XP da attività simulate e turni certificati.
   - **Acceptance criteria:**
     - Modello dati con XP standard + XP sul campo per ruolo.
     - Regola di progressione configurabile (anche con placeholder numerici).
     - UI che mostra livello e progressione nel profilo.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-002] Sistema di livelli e XP per ruolo","body":"## Obiettivo\nTracciare XP e livelli separati per ruolo, includendo XP standard e XP sul campo.\n\n## Dettagli GDD\nLivelli 1–50, XP da attività simulate e turni certificati.\n\n## Acceptance criteria\n- Modello dati con XP standard + XP sul campo per ruolo.\n- Regola di progressione configurabile (anche con placeholder numerici).\n- UI che mostra livello e progressione nel profilo.\n","labels":["gdd","feature","mvp"]}`

3. **[GDD-003] Reputazione per teatro e reputazione ATCL**
   - **Obiettivo:** gestire reputazione locale (per teatro) e globale (ATCL).
   - **Dettagli GDD:** reputazione sblocca missioni narrative, titoli e oggetti tematici.
   - **Acceptance criteria:**
     - Struttura dati per reputazione per teatro + reputazione globale.
     - Incremento reputazione in base a turni certificati.
     - Visualizzazione nel profilo/carriera.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-003] Reputazione per teatro e reputazione ATCL","body":"## Obiettivo\nGestire reputazione locale (per teatro) e globale (ATCL).\n\n## Dettagli GDD\nLa reputazione sblocca missioni narrative, titoli e oggetti tematici.\n\n## Acceptance criteria\n- Struttura dati per reputazione per teatro + reputazione globale.\n- Incremento reputazione in base a turni certificati.\n- Visualizzazione nel profilo/carriera.\n","labels":["gdd","feature","mvp"]}`

4. **[GDD-004] Valuta base “Cachet” e spese di formazione**
   - **Obiettivo:** implementare la valuta base ottenuta da attività simulate e turni certificati.
   - **Dettagli GDD:** cachet utilizzato per corsi e miglioramenti skill.
   - **Acceptance criteria:**
     - Wallet con cachet e transazioni base.
     - Shop o sezione “Formazione” con costi fittizi.
     - Log delle transazioni essenziali.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-004] Valuta base “Cachet” e spese di formazione","body":"## Obiettivo\nImplementare la valuta base ottenuta da attività simulate e turni certificati.\n\n## Dettagli GDD\nCachet usato per corsi di formazione e miglioramenti skill.\n\n## Acceptance criteria\n- Wallet con cachet e transazioni base.\n- Shop o sezione “Formazione” con costi fittizi.\n- Log delle transazioni essenziali.\n","labels":["gdd","feature","mvp"]}`

5. **[GDD-005] Titoli e riconoscimenti legati a reputazione/XP**
   - **Obiettivo:** sbloccare titoli cosmetici o informativi al raggiungimento di milestone.
   - **Dettagli GDD:** titoli tipo “Tecnico residente”, “Ha lavorato in 5 teatri”.
   - **Acceptance criteria:**
     - Modello per titoli con condizioni di sblocco.
     - Almeno 3 titoli dimostrativi in UI profilo.
     - Notifica o badge quando un titolo viene sbloccato.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-005] Titoli e riconoscimenti legati a reputazione/XP","body":"## Obiettivo\nSbloccare titoli cosmetici o informativi al raggiungimento di milestone.\n\n## Dettagli GDD\nTitoli tipo “Tecnico residente”, “Ha lavorato in 5 teatri”.\n\n## Acceptance criteria\n- Modello per titoli con condizioni di sblocco.\n- Almeno 3 titoli dimostrativi in UI profilo.\n- Notifica o badge quando un titolo viene sbloccato.\n","labels":["gdd","feature","mvp"]}`

### Core loop e attività simulate

1. **[GDD-006] Calendario eventi ATCL e pianificazione turno**
   - **Obiettivo:** mostrare calendario eventi con informazioni base e selezione intenzione ruolo.
   - **Dettagli GDD:** calendario non sostituisce i canali ufficiali ATCL.
   - **Acceptance criteria:**
     - Lista eventi con nome, teatro e data.
     - Possibilità di segnare l’intenzione di partecipazione e ruolo preferito.
     - Disclaimer che rimanda ai canali ufficiali.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-006] Calendario eventi ATCL e pianificazione turno","body":"## Obiettivo\nMostrare calendario eventi con informazioni base e selezione intenzione ruolo.\n\n## Dettagli GDD\nIl calendario non sostituisce i canali ufficiali ATCL.\n\n## Acceptance criteria\n- Lista eventi con nome, teatro e data.\n- Possibilità di segnare l’intenzione di partecipazione e ruolo preferito.\n- Disclaimer che rimanda ai canali ufficiali.\n","labels":["gdd","feature","mvp"]}`

2. **[GDD-007] Attività simulate: scelte narrative rapide**
   - **Obiettivo:** implementare dialoghi a bivi con bonus/malus temporanei.
   - **Dettagli GDD:** situazioni quotidiane di compagnia, sessioni brevi.
   - **Acceptance criteria:**
     - Almeno 1 scenario giocabile con 2–3 scelte.
     - Applicazione di un bonus/malus temporaneo.
     - Reward di XP/cachet minima.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-007] Attività simulate: scelte narrative rapide","body":"## Obiettivo\nImplementare dialoghi a bivi con bonus/malus temporanei.\n\n## Dettagli GDD\nSituazioni quotidiane di compagnia, sessioni brevi.\n\n## Acceptance criteria\n- Almeno 1 scenario giocabile con 2–3 scelte.\n- Applicazione di un bonus/malus temporaneo.\n- Reward di XP/cachet minima.\n","labels":["gdd","feature","mvp"]}`

3. **[GDD-008] Attività simulate: minigioco “tempismo luci” (GitHub Issue #130)**
   - **Obiettivo:** prototipo di minigioco con input a tempo.
   - **Dettagli GDD:** accendere alla battuta corretta.
   - **Acceptance criteria:**
     - Loop di minigioco completabile in < 2 minuti.
     - Valutazione successo/fallimento con reward.
     - Accesso dalla sezione attività simulate.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-008] Attività simulate: minigioco “tempismo luci”","body":"## Obiettivo\nPrototipo di minigioco con input a tempo.\n\n## Dettagli GDD\nAccendere alla battuta corretta.\n\n## Acceptance criteria\n- Loop di minigioco completabile in < 2 minuti.\n- Valutazione successo/fallimento con reward.\n- Accesso dalla sezione attività simulate.\n","labels":["gdd","feature","mvp"]}`

4. **[GDD-009] Sezione “Formazione” con corsi virtuali**
   - **Obiettivo:** investire cachet per corsi che sbloccano perk passivi.
   - **Dettagli GDD:** moduli con nomi realistici e effetti semplificati.
   - **Acceptance criteria:**
     - Lista corsi con costo e perk associato.
     - Possibilità di acquistare un corso e attivare il perk.
     - Visualizzazione perk attivi nel profilo.
   - **ISSUE_DRAFT:**
     `ISSUE_DRAFT:{"title":"[GDD-009] Sezione “Formazione” con corsi virtuali","body":"## Obiettivo\nInvestire cachet per corsi che sbloccano perk passivi.\n\n## Dettagli GDD\nModuli con nomi realistici e effetti semplificati.\n\n## Acceptance criteria\n- Lista corsi con costo e perk associato.\n- Possibilità di acquistare un corso e attivare il perk.\n- Visualizzazione perk attivi nel profilo.\n","labels":["gdd","feature","mvp"]}`

### Turni certificati e QR

1. **[GDD-010] Flusso di registrazione turno con QR**
    - **Obiettivo:** consentire la scansione QR e registrazione turno ATCL.
    - **Dettagli GDD:** verifica evento, data, ruolo confermato, report di fine turno.
    - **Acceptance criteria:**
      - UI “Registra turno” con placeholder di scansione.
      - Validazione base su ID evento e data (mock o endpoint).
      - Riepilogo turno e conferma ruolo.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-010] Flusso di registrazione turno con QR","body":"## Obiettivo\nConsentire la scansione QR e registrazione turno ATCL.\n\n## Dettagli GDD\nVerifica evento, data, ruolo confermato, report di fine turno.\n\n## Acceptance criteria\n- UI “Registra turno” con placeholder di scansione.\n- Validazione base su ID evento e data (mock o endpoint).\n- Riepilogo turno e conferma ruolo.\n","labels":["gdd","feature","mvp"]}`

2. **[GDD-011] Questionario/mini scena post-scan**
    - **Obiettivo:** mostrare un breve questionario o mini scena legata al ruolo.
    - **Dettagli GDD:** esperienza immersiva facoltativa ma consigliata.
    - **Acceptance criteria:**
      - Almeno 1 flusso di domanda legato a un ruolo.
      - Possibilità di saltare il questionario.
      - Reward finale dopo completamento.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-011] Questionario/mini scena post-scan","body":"## Obiettivo\nMostrare un breve questionario o mini scena legata al ruolo.\n\n## Dettagli GDD\nEsperienza immersiva facoltativa ma consigliata.\n\n## Acceptance criteria\n- Almeno 1 flusso di domanda legato a un ruolo.\n- Possibilità di saltare il questionario.\n- Reward finale dopo completamento.\n","labels":["gdd","feature","mvp"]}`

3. **[GDD-012] Anti-abuso: limitazione per evento e finestra temporale (GitHub Issue #131)**
    - **Obiettivo:** prevenire registrazioni multiple e fuori tempo.
    - **Dettagli GDD:** 1 turno per evento, QR valido entro intervallo, GPS opzionale.
    - **Acceptance criteria:**
      - Blocco registrazione doppia per evento.
      - Controllo data/ora con tolleranza configurabile.
      - Placeholder per verifica GPS opzionale.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-012] Anti-abuso: limitazione per evento e finestra temporale","body":"## Obiettivo\nPrevenire registrazioni multiple e fuori tempo.\n\n## Dettagli GDD\n1 turno per evento, QR valido entro intervallo, GPS opzionale.\n\n## Acceptance criteria\n- Blocco registrazione doppia per evento.\n- Controllo data/ora con tolleranza configurabile.\n- Placeholder per verifica GPS opzionale.\n","labels":["gdd","feature","mvp"]}`

4. **[GDD-013] Ricompense turno certificato**
    - **Obiettivo:** assegnare cachet premium, XP sul campo e reputazione.
    - **Dettagli GDD:** bonus, oggetti estetici, eventi narrativi speciali.
    - **Acceptance criteria:**
      - Assegnazione di cachet, XP sul campo e reputazione teatro/ATCL.
      - Log riepilogo reward post-scan.
      - Placeholder per drop estetici.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-013] Ricompense turno certificato","body":"## Obiettivo\nAssegnare cachet premium, XP sul campo e reputazione.\n\n## Dettagli GDD\nBonus, oggetti estetici, eventi narrativi speciali.\n\n## Acceptance criteria\n- Assegnazione di cachet, XP sul campo e reputazione teatro/ATCL.\n- Log riepilogo reward post-scan.\n- Placeholder per drop estetici.\n","labels":["gdd","feature","mvp"]}`

### UI/UX e navigazione

1. **[GDD-014] Schermata Home con accessi rapidi**
    - **Obiettivo:** dashboard con accesso a Carriera, Attività simulate, Turni ATCL, Profilo.
    - **Dettagli GDD:** home con navigazione immediata.
    - **Acceptance criteria:**
      - Layout home con quattro accessi principali.
      - Stato base (progressi, prossimo evento) opzionale.
      - Navigazione funzionante verso sezioni.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-014] Schermata Home con accessi rapidi","body":"## Obiettivo\nDashboard con accesso a Carriera, Attività simulate, Turni ATCL, Profilo.\n\n## Dettagli GDD\nHome con navigazione immediata.\n\n## Acceptance criteria\n- Layout home con quattro accessi principali.\n- Stato base (progressi, prossimo evento) opzionale.\n- Navigazione funzionante verso sezioni.\n","labels":["gdd","feature","mvp"]}`

2. **[GDD-015] Schermata Carriera e Profili**
    - **Obiettivo:** mostrare ruolo, livello, XP, reputazione, titoli.
    - **Dettagli GDD:** sezioni Turni simulati e Turni ATCL.
    - **Acceptance criteria:**
      - Visualizzazione ruolo e progressi.
      - Tab o sottosezioni per turni simulati e ATCL.
      - Elenco titoli e riconoscimenti.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-015] Schermata Carriera e Profili","body":"## Obiettivo\nMostrare ruolo, livello, XP, reputazione, titoli.\n\n## Dettagli GDD\nSezioni Turni simulati e Turni ATCL.\n\n## Acceptance criteria\n- Visualizzazione ruolo e progressi.\n- Tab o sottosezioni per turni simulati e ATCL.\n- Elenco titoli e riconoscimenti.\n","labels":["gdd","feature","mvp"]}`

### Backend e integrazione

1. **[GDD-016] Backend leggero per eventi e validazione QR**
    - **Obiettivo:** API per ID evento, validazione QR e progressi.
    - **Dettagli GDD:** integrazione con sistemi ATCL, deep link evento ↔ turno.
    - **Acceptance criteria:**
      - Endpoint per validare un QR e restituire evento.
      - Endpoint per registrare turno e aggiornare progressi.
      - Documentazione minima API e payload.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-016] Backend leggero per eventi e validazione QR","body":"## Obiettivo\nAPI per ID evento, validazione QR e progressi.\n\n## Dettagli GDD\nIntegrazione con sistemi ATCL, deep link evento ↔ turno.\n\n## Acceptance criteria\n- Endpoint per validare un QR e restituire evento.\n- Endpoint per registrare turno e aggiornare progressi.\n- Documentazione minima API e payload.\n","labels":["gdd","feature","mvp"]}`

2. **[GDD-017] Deep link evento ↔ registrazione turno**
    - **Obiettivo:** gestire URL univoci degli eventi e apertura in app.
    - **Dettagli GDD:** QR con URL univoco per evento.
    - **Acceptance criteria:**
      - Schema URL definito e documentato.
      - App che intercetta URL e apre flusso registrazione.
      - Gestione fallback se evento non valido.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-017] Deep link evento ↔ registrazione turno","body":"## Obiettivo\nGestire URL univoci degli eventi e apertura in app.\n\n## Dettagli GDD\nQR con URL univoco per evento.\n\n## Acceptance criteria\n- Schema URL definito e documentato.\n- App che intercetta URL e apre flusso registrazione.\n- Gestione fallback se evento non valido.\n","labels":["gdd","feature","mvp"]}`

3. **[GDD-018] Eventi narrativi speciali legati ai teatri**
    - **Obiettivo:** sbloccare contenuti narrativi dopo visite o reputazione.
    - **Dettagli GDD:** contenuti speciali per teatro visitato.
    - **Acceptance criteria:**
      - Almeno 1 evento narrativo sbloccabile.
      - Trigger basato su reputazione o numero di visite.
      - Ricompensa o badge associato.
    - **ISSUE_DRAFT:**
      `ISSUE_DRAFT:{"title":"[GDD-018] Eventi narrativi speciali legati ai teatri","body":"## Obiettivo\nSbloccare contenuti narrativi dopo visite o reputazione.\n\n## Dettagli GDD\nContenuti speciali per teatro visitato.\n\n## Acceptance criteria\n- Almeno 1 evento narrativo sbloccabile.\n- Trigger basato su reputazione o numero di visite.\n- Ricompensa o badge associato.\n","labels":["gdd","feature","mvp"]}`

### Miglioramenti Tecnici (Proposti via GitHub CLI)

1. **[TECH-001] Offline Sync Queue (GitHub Issue #132)**
   - Gestione scansioni QR senza rete con sincronizzazione ritardata.
2. **[TECH-002] Avatar ReadyPlayer.Me su Mobile (GitHub Issue #133)**
   - Porting dell'integrazione avatar PWA sulla UI mobile.
3. **[TECH-003] GitHub Actions CI/CD (GitHub Issue #134)**
   - Automazione test e build per il monorepo.
4. **[TECH-004] PWA Deep Linking (GitHub Issue #135)**
   - Apertura diretta dei flussi registrazione da URL QR.

## Note operative

- Creare le issue su GitHub con label dedicate (es. `gdd`, `feature`, `mvp`).
- Collegare ogni issue alla sezione corrispondente della roadmap (Fase 1/2/3).
- Aggiornare lo stato delle issue quando le feature sono implementate.
