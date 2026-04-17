# Ticket hash registrar (Python prototype)

Prototipo per biglietterie teatrali che:
- Calcola l'hash SHA-256 dal payload canonico del biglietto.
- **Pre-registra (riserva) l'hash su Supabase via `reserve_hash`. Questa è l'unica via autorizzata per la generazione di ticket validi.**

## ⚠️ IMPORTANTE: Flusso Obbligatorio

**Tutti i ticket DEVONO essere pre-registrati tramite questo strumento Python prima di poter essere attivati.**  
L'attivazione client-side è possibile solo per ticket già pre-registrati in `ticket_activations` tramite `reserve_hash`.  
Il flusso client-side diretto (`register_ticket`) è stato rimosso per garantire il controllo della biglietteria autorizzata.

## Struttura JSON del ticket

Il payload usato per hashing e registrazione è:

```json
{
  "circuit": "ATCL",
  "eventName": "Esempio",
  "eventID": "ATCL-001",
  "ticketNumber": "1234567890",
  "date": "2026-02-11T11:54:00+01:00"
}
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r tools/ticket_qr_generator/requirements.txt
```

## Avvio UI desktop (consigliato)

```bash
python tools/ticket_qr_generator/ticket_qr_generator_ui.py
```

Nella UI:
1. (Prima volta) Apri **Impostazioni circuito** e seleziona il circuito emittente predefinito.
2. Premi **Aggiorna calendario** e seleziona l'evento.
3. Inserisci **solo** il numero biglietto.
4. Premi **Genera e Prenota Hash**.
5. Ottieni hash e JSON da usare per la conferma della prenotazione.

Il circuito predefinito viene salvato localmente in `~/.turni_ticket_qr_ui.json`.
Puoi cambiare path impostando `TICKET_QR_UI_SETTINGS_PATH`.
L'hash e il solo SHA-256 del payload canonico (64 caratteri).

La lista circuiti del menu e esterna in `tools/ticket_qr_generator/circuit_options.json`.
Puoi sovrascrivere il file con `TICKET_QR_CIRCUITS_PATH` oppure passare una lista CSV diretta con `TICKET_QR_CIRCUITS` (es: `TICKETONE,TICKETTANDO/18 MONTHS,CIAO TICKETS`).

Per leggere il calendario eventi nella UI imposta:

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<anon-or-service-key>"
```

Per prenotare hash su Supabase (quando disattivi "Modalita locale"), serve anche:

```bash
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

## Esecuzione CLI

### Modalita calendario (consigliata)

```bash
python tools/ticket_qr_generator/generate_ticket_qr.py \
  --event-id "ATCL-001" \
  --ticket-number "1234567890" \
  --event-from-calendar
```

### Modalita manuale (compatibilita)

```bash
python tools/ticket_qr_generator/generate_ticket_qr.py \
  --circuit "ATCL" \
  --event-name "Esempio" \
  --event-id "ATCL-001" \
  --ticket-number "1234567890" \
  --date "2026-02-11T11:54:00+01:00" \
  --skip-supabase
```
