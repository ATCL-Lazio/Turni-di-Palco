# Generatore ticket (prototipo Python)

Strumento per la biglietteria che **emette** i ticket sul server:
- Il server genera un valore casuale a 256 bit (il contenuto del QR) e un **codice manuale** di 10 caratteri.
- Il valore del QR non deriva piu dai campi del biglietto (evento, numero, data): non si puo indovinare.
- Il codice manuale va **stampato accanto al QR**: serve per l'attivazione a mano ed e mostrato una sola volta.

## ⚠️ IMPORTANTE: Flusso Obbligatorio

**Tutti i ticket DEVONO essere emessi tramite questo strumento (o la schermata admin dell'app) prima di poter essere attivati.**
L'attivazione e possibile solo per ticket gia presenti in `ticket_activations`.

Per emettere servono un **account admin** (ruolo `admin` in `app_metadata`) e la chiave **anon** del progetto. Lo strumento non usa piu la chiave service-role e non deve piu stare sui computer di biglietteria.

> I ticket emessi con la vecchia versione (hash dei campi, azione `reserve_hash`) non sono piu generabili: `reserve_hash` risponde con un invito ad aggiornare.

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
4. Premi **Genera e Prenota Hash**; alla prima emissione ti viene chiesto l'accesso con l'account admin (oppure imposta `TICKET_ADMIN_EMAIL` e `TICKET_ADMIN_PASSWORD`).
5. Copia il **valore del QR** (da codificare nel QR) e il **codice manuale** (da stampare sul biglietto).

Il circuito predefinito viene salvato localmente in `~/.turni_ticket_qr_ui.json`.
Puoi cambiare path impostando `TICKET_QR_UI_SETTINGS_PATH`.
Il valore del QR e un segreto casuale di 64 caratteri generato dal server.

La lista circuiti del menu e esterna in `tools/ticket_qr_generator/circuit_options.json`.
Puoi sovrascrivere il file con `TICKET_QR_CIRCUITS_PATH` oppure passare una lista CSV diretta con `TICKET_QR_CIRCUITS` (es: `TICKETONE,TICKETTANDO/18 MONTHS,CIAO TICKETS`).

Per emettere ticket (quando disattivi "Modalita locale") imposta:

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<anon-key>"
# Facoltativi: se mancano, vengono chiesti a ogni avvio
export TICKET_ADMIN_EMAIL="<email account admin>"
export TICKET_ADMIN_PASSWORD="<password account admin>"
```

Per leggere il calendario eventi nella UI servono `SUPABASE_URL` e una chiave API Supabase (`SUPABASE_ANON_KEY`, oppure `SUPABASE_SERVICE_ROLE_KEY` se il calendario non e leggibile con la chiave anon: tienila solo su una macchina fidata e non e piu necessaria per emettere i ticket).

## Esecuzione CLI

### Modalita calendario (consigliata)

```bash
python tools/ticket_qr_generator/generate_ticket_qr.py \
  --event-id "ATCL-001" \
  --ticket-number "1234567890" \
  --event-from-calendar
```

### Modalita manuale (solo prove locali)

```bash
python tools/ticket_qr_generator/generate_ticket_qr.py \
  --circuit "ATCL" \
  --event-name "Esempio" \
  --event-id "ATCL-001" \
  --ticket-number "1234567890" \
  --date "2026-02-11T11:54:00+01:00" \
  --skip-supabase
```

In modalita `--skip-supabase` il valore e casuale e **non viene registrato**: non puo essere attivato.

L'output JSON contiene `hash` (valore del QR) e `redeem_code` (codice manuale da stampare).

## Test

```bash
python -m unittest tools/ticket_qr_generator/test_generate_ticket_qr.py
```
