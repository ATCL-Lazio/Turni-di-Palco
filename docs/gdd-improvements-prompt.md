# Turni di Palco — GDD v2.0: Piano di miglioramenti

> Prompt operativo per Claude Code. Ogni sezione contiene contesto, problema identificato e azione richiesta.
> Priorità: P0 = bloccante per MVP, P1 = critico per retention, P2 = importante per crescita, P3 = nice-to-have.

---

## Contesto generale

Turni di Palco è una PWA (React/TypeScript/Vite, backend Supabase, deploy Vercel) che gamifica la partecipazione a eventi teatrali ATCL nel Lazio. Il giocatore sceglie un ruolo professionale teatrale (attore, tecnico luci, fonico, attrezzista, assistente di palco), progredisce tramite attività simulate quotidiane e turni certificati via QR agli spettacoli reali.

Il GDD attuale (`docs/gdd-turni-di-palco.pdf`) è rimasto in versione bozza mentre il codice è avanzato significativamente (1.440+ commit, app deployata, milestone fino a v1.5). Questa divergenza causa decisioni di design implicite nel codice senza documentazione condivisa.

Il repository è: `https://github.com/ATCL-Lazio/Turni-di-Palco`
L'app mobile è servita su `/mobile/` del deploy Vercel.

---

## P0 — Bloccanti per MVP

### 1. Aggiornamento GDD alla v2.0

**Problema:** Il GDD non riflette lo stato attuale del prodotto. Parla di "possibile PWA" e suggerisce React Native/Flutter, ma il prodotto è già una PWA React/TypeScript con Supabase. Le decisioni di design vengono prese nel codice senza documentazione.

**Azione:** Crea un nuovo file `docs/gdd-v2.md` che documenti il gioco com'è adesso e come dovrà essere. Deve includere:

- Stack tecnologico reale (React + TypeScript + Vite + Supabase + Vercel), non quello ipotizzato
- Stato attuale di ogni feature (implementata / parziale / non avviata), incrociando con `docs/2026-01-15-gdd-issue-traceability.md`
- Vincoli noti della piattaforma PWA: limitazioni notifiche push su iOS, accesso fotocamera per QR, assenza da App Store/Play Store
- Sezione esplicita sulle conseguenze della scelta PWA vs app nativa per il target 14-35

### 2. Offline Sync per QR (promozione da nice-to-have a P0)

**Problema:** Il flusso QR dipende da connettività internet nel teatro. La issue TECH-001 (Offline Sync Queue) è classificata come miglioramento tecnico, ma è una feature critica: se il QR non funziona a teatro, l'esperienza principale del gioco fallisce.

**Azione:** Implementa una coda di sincronizzazione offline:

- Quando la scansione QR avviene senza rete, salva localmente: `{ eventId, timestamp, gpsCoords?, role }` in IndexedDB
- Al ritorno della connettività, sincronizza automaticamente con il backend Supabase
- Mostra all'utente uno stato chiaro: "Turno registrato — in attesa di conferma" con icona di sync pending
- Gestisci il conflitto: se il turno viene registrato offline e poi l'utente riprova online, deduplica
- Aggiungi un indicatore visivo nella UI del turno per distinguere turni confermati vs pending

### 3. Redirect root URL → /mobile/

**Problema:** L'URL base (`turni-di-palco.vercel.app/`) mostra un "Dev Dashboard" visibile a chiunque. In un contesto istituzionale (dirigenti comunali, sponsor, giornalisti), la prima impressione è una pagina di debug.

**Azione:**

- In `vercel.json`, aggiungi un redirect 302 da `/` a `/mobile/` per gli utenti non autenticati come dev
- Oppure: proteggi il Dev Dashboard dietro autenticazione e mostra una landing page minimale sulla root che rimandi a `/mobile/`

---

## P1 — Critici per retention

### 4. Espansione e dettaglio delle attività simulate

**Problema principale del progetto.** Le attività simulate sono l'unico contenuto disponibile tra un evento ATCL e l'altro (potenzialmente 25-28 giorni al mese). Nel GDD occupano mezza pagina. Nel codice esistono solo come mock nella pagina dev. Senza contenuto simulato sufficiente, gli utenti abbandonano dopo pochi giorni.

**Azione — Engine narrativa (`apps/pwa/src/features/narrative/` o equivalente):**

- Crea un sistema di scenari narrativi basato su dati JSON, non hardcoded:

```typescript
interface NarrativeScenario {
  id: string;
  role: Role[];           // ruoli per cui è disponibile
  title: string;
  description: string;
  choices: {
    text: string;
    outcome: {
      statModifiers: Record<string, number>;  // es. { "tempismo": +2 }
      xpReward: number;
      cachetReward: number;
      durationMinutes?: number;  // bonus/malus temporaneo
      narrativeFlag?: string;    // sblocca scenari futuri
    };
  }[];
  prerequisites?: {
    minLevel?: number;
    requiredFlags?: string[];
    minReputation?: Record<string, number>;
  };
  cooldownHours: number;
}
```

- Crea almeno 15-20 scenari narrativi di base distribuiti tra i 5 ruoli, con situazioni realistiche del mondo teatrale: ritardi in prova, guasto tecnico, sostituzione dell'ultimo minuto, conflitto tra attori, budget ridotto, visita critico
- Implementa un sistema di cooldown/refresh: nuovi scenari disponibili ogni X ore, rotazione giornaliera, pool settimanale
- Ogni scelta deve avere conseguenze percepibili: non solo +XP numerico, ma testo di feedback narrativo che mostri l'impatto

**Azione — Minigiochi (`apps/pwa/src/features/minigames/`):**

- Implementa almeno 2 minigiochi funzionanti per l'MVP:
  1. **Tempismo Luci:** timeline orizzontale con battute di testo che scorrono; il giocatore deve tappare al momento giusto per "accendere" alla battuta corretta. Scoring: precisione del timing → XP + cachet proporzionali
  2. **Livello Audio:** visualizzazione di un VU meter; il giocatore trascina un slider per impostare il livello corretto senza distorsione e senza essere troppo basso. 3-5 round con difficoltà crescente
- Ogni minigioco deve: durare 1-3 minuti, dare XP e cachet proporzionali alla performance, avere un cooldown (es. 1 tentativo ogni 4 ore per minigioco), adattarsi al ruolo del giocatore (bonus se il minigioco è coerente col ruolo scelto)

**Azione — Formazione (`apps/pwa/src/features/training/`):**

- Implementa un catalogo di corsi virtuali con: nome realistico, costo in cachet, durata in-game (es. "completabile in 3 giorni di login"), perk passivo sbloccato al completamento
- Esempio corsi: "Sicurezza in palcoscenico" (perk: +10% XP turni certificati), "Dizione avanzata" (perk: nuove opzioni narrative per attore), "Manutenzione fari" (perk: bonus al minigioco luci)

### 5. Semplificazione del sistema di progressione

**Problema:** Il GDD descrive 7+ assi di progressione (XP standard, XP sul campo, reputazione teatro, reputazione ATCL, cachet, token/prestigio, titoli, perk). Per un target 14-35 e un prodotto che dichiara "accessibilità" come pilastro, è troppo frammentato. L'utente deve capire in 5 secondi cosa sta salendo e perché gli importa.

**Azione:**

- Riduci a 3 metriche primarie visibili in dashboard:
  1. **Livello** (unifica XP standard e XP sul campo in un unico contatore, con bonus moltiplicatore per XP da turni reali)
  2. **Reputazione** (unifica reputazione teatro e ATCL in un singolo score con breakdown consultabile in sezione Carriera, ma non sulla dashboard)
  3. **Cachet** (unica valuta — elimina la seconda valuta "Prestigio/Token" che aggiunge complessità senza gameplay)
- Mantieni titoli e perk come layer secondario, visibile nella sezione Carriera ma non bombardato sulla dashboard
- Nella dashboard mostra: barra XP verso il prossimo livello, cachet totale, prossima attività disponibile. Basta.

### 6. Differenziazione meccanica reale dei ruoli

**Problema:** I ruoli hanno statistiche diverse (Precisione, Tempismo per tecnico luci vs Ascolto, Reattività per fonico) ma il GDD non spiega mai cosa queste statistiche fanno concretamente nel gameplay. Rischio: ruoli percepiti come skin cosmetiche.

**Azione:** Crea una tabella di mapping statistica → effetto concreto e implementala:

```
| Statistica          | Effetto minigioco                    | Effetto narrativa                    | Effetto ricompense          |
|---------------------|--------------------------------------|--------------------------------------|-----------------------------|
| Precisione (luci)   | Finestra di timing più ampia         | Opzione "calibra con cura"           | +15% cachet turni luci      |
| Tempismo (luci)     | Bonus combo per sequenze corrette    | Sblocca dialoghi "sa anticipare"     | XP bonus se perfect score   |
| Ascolto (fonico)    | Soglia di errore audio più tollerante| Opzione "noto un problema audio"     | +15% cachet turni audio     |
| Presenza scenica    | N/A (non ha minigioco dedicato)      | Opzioni carismatiche in dialoghi     | +15% XP turni recitazione   |
| Coordinazione (AP)  | Bonus tempo in allestimento scena    | Opzione "organizzo la squadra"       | +10% cachet su tutti i turni|
```

- Ogni livello di statistica deve produrre un cambiamento percepibile. Non +0.5% invisibile, ma qualcosa che il giocatore nota: finestra di timing più larga, opzione di dialogo nuova, feedback visivo diverso.

### 7. Onboarding / FTUE (First Time User Experience)

**Problema:** Il GDD non descrive mai i primi 5 minuti dell'app. La Scheda Tecnica menziona un "onboarding ridotto" per chi arriva dal QR, ma senza dettaglio. Nel mobile gaming, i primi 60 secondi determinano se l'utente resta.

**Azione:** Implementa un flusso di onboarding in 4 schermate massimo:

1. **Schermata 1:** "Benvenuto nel mondo del teatro" — breve animazione/illustrazione, skip possibile
2. **Schermata 2:** "Scegli il tuo ruolo" — i 5 ruoli con icona, nome, 1 riga di descrizione, tap per selezionare. Mostra immediatamente come il ruolo influenza il gioco ("Come tecnico luci, le tue missioni saranno..."). Non chiedere nome/avatar qui — riduci attrito.
3. **Schermata 3:** "Ecco la tua prima missione" — lancio immediato di uno scenario narrativo breve (30 secondi) per far toccare il gameplay subito
4. **Schermata 4:** Dashboard — l'utente è già dentro, con il primo scenario completato e il primo XP guadagnato

- Se l'utente arriva da QR (deep link evento), comprimi l'onboarding: ruolo + registrazione turno immediata, il resto viene dopo
- MAI mostrare tutorial testuali lunghi. Ogni meccanica si impara facendola.

---

## P2 — Importanti per crescita

### 8. Feature di condivisione sociale minima

**Problema:** Il target 14-35 vive di interazione sociale digitale. Il gioco è single-player senza nessuna feature sociale. Zero ragioni per parlare del gioco con amici. La viralità organica è il canale di acquisizione più economico, e il progetto lo ignora completamente.

**Azione (scope minimo, non un social network):**

- **Profilo condivisibile:** genera un URL univoco (`/profile/{userId}`) che mostra una card con: ruolo, livello, teatro più frequentato, titolo più alto. La card deve essere visivamente bella (condivisibile su Instagram Stories/WhatsApp)
- **Schermata "Condividi":** dopo ogni turno certificato o milestone (nuovo livello, nuovo titolo), mostra un bottone "Condividi" che genera un'immagine card con il risultato. Usa Web Share API dove disponibile
- **Classifica semplice:** anche solo "I più attivi di questo mese" come lista top 10. Non serve infrastruttura complessa: query Supabase su XP dell'ultimo mese, cache ogni ora

### 9. Content pipeline e struttura dati narrativi

**Problema:** Un gioco che vive di contenuti narrativi senza un piano di produzione contenuti è insostenibile. Chi scrive gli scenari? Come si aggiungono? Come si collegano alle stagioni?

**Azione:**

- Tutti i contenuti narrativi (scenari, dialoghi, corsi) devono vivere in file JSON/YAML in una cartella dedicata (`data/narrative/`, `data/courses/`, `data/minigames/`) — non hardcoded nel codice
- Crea un README in `data/` che documenti lo schema dei file e come aggiungere nuovi contenuti senza toccare codice
- Implementa un sistema di tagging per stagione: ogni scenario può avere `season: "2025-2026"` per permettere rotazione stagionale
- Bonus: crea uno script di validazione (`npm run validate:content`) che verifichi che ogni scenario JSON rispetti lo schema e che i prerequisiti referenzino ID esistenti

### 10. Placeholder numeri di bilanciamento

**Problema:** Il GDD rimanda completamente il bilanciamento. Ma senza almeno numeri placeholder, è impossibile valutare se il rapporto attività simulate / turni certificati è soddisfacente.

**Azione:** Crea un file `docs/balancing.md` con una prima proposta numerica:

```markdown
## Ricompense per attività

| Attività                    | XP      | Cachet  | Cooldown       |
|-----------------------------|---------|---------|----------------|
| Scenario narrativo          | 15-30   | 5-15    | 6 ore          |
| Minigioco (completamento)   | 20-50   | 10-25   | 4 ore          |
| Minigioco (perfect score)   | 50-80   | 25-40   | 4 ore          |
| Corso formazione (completo) | 100     | 0       | 3 giorni login |
| Turno certificato QR        | 200-400 | 50-100  | 1 per evento   |

## Progressione livelli

| Livello | XP totale richiesta | Giorni stimati (solo simulato) | Giorni stimati (simulato + 1 turno/mese) |
|---------|--------------------|---------------------------------|------------------------------------------|
| 1→5     | 500                | ~5 giorni                       | ~3 giorni                                |
| 5→10    | 1500               | ~15 giorni                      | ~10 giorni                               |
| 10→20   | 5000               | ~50 giorni                      | ~30 giorni                               |
| 20→50   | 25000              | ~250 giorni                     | ~150 giorni                              |

## Principi di bilanciamento

- Un turno certificato deve valere 5-10x un'attività simulata, ma le attività simulate devono comunque far sentire progresso
- Un giocatore che fa SOLO attività simulate deve raggiungere livello 10 in un mese (altrimenti si sente escluso)
- Un giocatore che va a teatro 1 volta al mese + attività simulate deve raggiungere livello 10 in 2 settimane (reward per la partecipazione reale)
- Il cachet deve permettere di acquistare 1 corso ogni 2 settimane di gioco attivo
```

- Implementa questi numeri come configurazione (`shared/config/balancing.ts` o simile), non hardcoded, così da poterli iterare facilmente durante il playtesting

---

## P3 — Nice-to-have

### 11. Accessibilità

**Problema:** Il GDD dichiara "accessibilità" come pilastro ma non menziona: tema chiaro alternativo, supporto screen reader, dimensioni font adattive, alternative per minigiochi a tempo per utenti con disabilità motorie.

**Azione:**

- Implementa toggle dark/light theme (il dark attuale è coerente col teatro ma esclude utenti con deficit visivi)
- Assicurati che tutti gli elementi interattivi abbiano `aria-label` appropriati
- Nei minigiochi a tempo, aggiungi un'opzione "modalità accessibile" con tempi più lunghi
- Testa contrasto colori con WCAG 2.1 AA come target minimo

### 12. Metriche di successo

**Azione:** Definisci e implementa tracking per le KPI minime:

- Retention D1/D7/D30 (% utenti che tornano dopo 1/7/30 giorni)
- Tasso di completamento onboarding
- Attività simulate completate per utente per settimana
- QR scan per utente per mese
- Tempo medio di sessione
- Tasso di conversione "installa → primo scenario completato"

Usa un sistema privacy-friendly (Plausible, o anche solo eventi custom su Supabase) — il target include minori 14-17, quindi GDPR e consenso genitoriale sono obbligatori.

### 13. Eventi narrativi legati ai teatri

**Problema:** È potenzialmente la killer feature del gioco (sbloccare "la storia segreta del Teatro Traiano di Civitavecchia" dopo 3 visite) ma nel GDD è trattata come appendice.

**Azione:**

- Per ogni teatro nella rete ATCL (vedi `docs/2026-03-23-atcl-teatri-ticketing.md` per la lista completa), crea almeno 1 scenario narrativo esclusivo sbloccabile con reputazione teatro >= X
- Gli scenari teatro-specifici devono contenere riferimenti reali: storia del teatro, curiosità, aneddoti — questo è il contenuto che crea legame emotivo con il luogo e che differenzia Turni di Palco da qualsiasi app di gamification generica
- Struttura dati: `data/narrative/theaters/{theater-id}.json`

---

## Note per Claude Code

- Il repository è un monorepo con `apps/pwa/` (app web principale), `apps/mobile/` (interfaccia mobile), `shared/` (asset condivisi)
- Il backend è Supabase (vedi `supabase/` per edge functions e migrations)
- Lo stile di codice è TypeScript strict, 2 spazi, ESLint+Prettier configurati
- Prima di implementare qualsiasi feature, verifica lo stato attuale del codice con `rg` o `find` per evitare duplicazioni
- Ogni feature implementata deve aggiornare la documentazione corrispondente in `docs/`
- Per i contenuti narrativi, preferisci italiano coerente con il registro del progetto (informale ma professionale, tono teatrale)
