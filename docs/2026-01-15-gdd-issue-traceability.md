# GDD → Issue Traceability (2026-01-15)

## Changelog

- 2026-01-15: initial extraction of GDD features and proposed GitHub issue list.

## Fonte

- Documento: `gdd-turni-di-palco.pdf`.

## Caratteristiche chiave dal GDD (estratto)

- Gioco mobile single-player con progressione carriera teatrale, collegata alla partecipazione reale agli eventi ATCL tramite scansione QR su biglietto/locandina.
- Creazione profilo con ruoli professionali (attore/attrice, tecnico luci, fonico, attrezzista/scenografo, assistente di palco), statistiche di ruolo e albero skill semplificato.
- Due macro-componenti: attività simulate sempre disponibili e turni certificati ATCL vincolati a QR.
- Core loop: pianificazione eventi → attività simulate → partecipazione reale → scansione QR → registrazione turno → ricompense → progressione carriera.
- Progressione: livelli e XP per ruolo, XP sul campo per eventi reali, reputazione per teatro e reputazione globale ATCL.
- Valute: cachet (moneta base) e possibile seconda valuta legata ai turni certificati.
- Titoli e riconoscimenti collegati a reputazione/partecipazione.
- Attività simulate (MVP): scelte narrative rapide, minigiochi (tempismo luci, audio base, allestimento scena), formazione e studi.
- Flusso turni certificati: registrazione turno con QR, conferma ruolo, breve questionario/mini-scena, ricompense; anti-abuso (un turno per evento, finestra temporale, opzionale GPS).
- UI: Home, Carriera, Turni ATCL, Attività simulate, Profilo; stile sobrio ispirato al teatro.
- Backend: gestione ID evento, validazione QR, tracciamento progressi, deep link evento ↔ registrazione.
- Roadmap MVP: creazione profilo, sistema base XP/monete, 1–2 minigiochi, flusso QR con evento test.

## Proposta issue backlog (da creare/sincronizzare in GitHub)

1. **Profilo giocatore + scelta ruolo iniziale**
   - Include ruoli, statistiche base, scelta ruolo iniziale e possibilità di cambio ruolo.
2. **Sistema XP/leveling e XP sul campo**
   - Progressione per ruolo, XP standard e XP sul campo legato ai turni certificati.
3. **Reputazione teatro + reputazione ATCL**
   - Tracciamento per teatro e indice globale con sblocchi.
4. **Valuta cachet + eventuale valuta premium**
   - Cachet per attività e turni; struttura per seconda valuta legata ai turni certificati.
5. **Core loop: calendario eventi + pianificazione partecipazione**
   - Consultazione eventi ATCL e pianificazione intenzione ruolo.
6. **Attività simulate: scelte narrative**
   - Dialoghi a bivi con bonus/malus.
7. **Attività simulate: minigiochi MVP**
   - Tempismo luci, audio base, allestimento scena.
8. **Formazione/corsi e skill passive**
   - Investimenti in tempo/moneta per skill e bonus ai turni.
9. **Flusso registrazione turno ATCL (QR scan)**
   - Schermata “Registra turno”, scanner QR, conferma ruolo, report fine turno.
10. **Anti-abuso registrazione turni**
    - Limite per evento, finestra temporale, opzionale verifica GPS.
11. **Ricompense turni certificati**
    - Cachet premium, XP sul campo, reputazioni, sblocchi narrativi/estetici.
12. **Titoli e riconoscimenti**
    - Titoli per traguardi (teatri visitati, stagioni, ecc.).
13. **UI shell PWA: Home/Carriera/Turni/Attività/Profilo**
    - Struttura base e navigazione.
14. **Backend eventi + validazione QR + deep link**
    - API per ID evento, validazione QR e collegamento evento-turno.
15. **MVP milestone**
    - Task aggregata: profilo, XP/monete base, 1–2 minigiochi, QR test.

## MVP milestone: piano di azione e controllo stato

### Piano di azione (da eseguire in ordine)

1. **Consolidare profilo e progressione base**
   - Confermare flusso: creazione profilo + scelta ruolo + avatar + cachet/XP/rep.
   - Verificare persistenza e reset di prova in ambiente dev.
2. **Definire 1–2 minigiochi MVP**
   - Selezionare i minigiochi da prototipare (es. tempismo luci, audio base).
   - Definire input/output minimi, durata e reward base.
3. **Integrare attività simulate**
   - Collegare i minigiochi al loop di attività simulate.
   - Aggiungere cooldown/limite sessione e tracking di progressi.
4. **Preparare flusso QR di test**
   - Definire schema evento mock + validazione QR (anche via codice fisso).
   - Collegare la registrazione turno a XP/monete base.
5. **Checklist di Done per la milestone**
   - Profilo configurabile, XP/cachet aggiornabili, 1–2 minigiochi giocabili, flusso QR di test end-to-end.

### Controllo stato (repo attuale)

| Elemento MVP | Stato | Evidenza/Note |
| --- | --- | --- |
| Profilo giocatore + scelta ruolo | Parziale | UI profilo e ruoli presenti, con campi base e riepilogo stat.【F:apps/pwa/src/profile.ts†L1-L178】 |
| XP/cachet/reputazione base | Parziale | Struttura dati e metriche base presenti nello stato; valori gestiti a livello di profilo/turni.【F:apps/pwa/src/state.ts†L1-L158】 |
| Attività simulate narrative | Parziale | Sezione “Attività simulate” presente in pagina dev con selezione e risultati mock.【F:apps/pwa/src/dev.ts†L220-L271】 |
| 1–2 minigiochi MVP | Non avviato | Nessun riferimento a minigiochi nei sorgenti PWA attuali. |
| Flusso QR di test | Parziale | Mock “Turno ATCL (mock QR)” disponibile in pagina dev; richiede validazione reale/QR scan.【F:apps/pwa/src/dev.ts†L254-L271】 |

## Note operative

- Questa lista va verificata contro le issue esistenti e aggiornata in GitHub.
- Aggiungere label dedicate (es. `gdd`, `mvp`, `backend`, `frontend`, `gameplay`).
- Per creare/sincronizzare le issue serve configurare `GITHUB_TOKEN` e l'owner/repo GitHub.

## Command log (per tracciamento analisi)

- `python` con PyPDF2 per estrarre il testo dal PDF GDD.
- `rg` per individuare riferimenti a configurazione GitHub nel repo.
- `python` per verificare la presenza di `GITHUB_TOKEN` nell'ambiente.
