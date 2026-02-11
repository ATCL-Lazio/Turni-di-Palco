# Ticket QR generator (Python prototype)

Prototipo per biglietterie teatrali con:
- **CLI** per integrazioni/script.
- **UI desktop (Tkinter)** semplice per operatori non tecnici.

## Struttura JSON del ticket

Il payload usato per hashing e registrazione è:

```json
{
  "circuit": "TicketOne",
  "eventName": "Esempio",
  "eventID": "1234567890",
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
1. Compila i campi del ticket.
2. Scegli il file PNG di output.
3. Premi **Genera QR**.
4. Ottieni hash, JSON e anteprima QR.

Per usare Supabase nella UI, disattiva "Modalità locale" e imposta variabili ambiente:

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

## Esecuzione CLI

```bash
python tools/ticket_qr_generator/generate_ticket_qr.py \
  --circuit "TicketOne" \
  --event-name "Esempio" \
  --event-id "1234567890" \
  --ticket-number "1234567890" \
  --date "2026-02-11T11:54:00+01:00" \
  --output "./out/atcl-2026-001.png" \
  --skip-supabase
```

## Distribuzione standalone (valutazione)

```bash
pip install pyinstaller
pyinstaller --onefile tools/ticket_qr_generator/ticket_qr_generator_ui.py
```

Output previsto: eseguibile singolo in `dist/` da distribuire sulle postazioni di biglietteria.
