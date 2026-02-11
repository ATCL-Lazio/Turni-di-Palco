# Ticket QR generator (Python prototype)

Prototipo per biglietterie teatrali con:
- **CLI** per integrazioni/script.
- **UI desktop (Tkinter)** per operatori non tecnici.

## Struttura JSON del ticket

Il payload usato per hashing e registrazione e:

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
1. Premi **Aggiorna calendario** e seleziona l'evento.
2. Inserisci **solo** il numero biglietto.
3. Scegli il file PNG di output.
4. Premi **Genera QR**.
5. Ottieni hash, JSON e anteprima QR.

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
  --event-from-calendar \
  --output "./out/atcl-2026-001.png"
```

### Modalita manuale (compatibilita)

```bash
python tools/ticket_qr_generator/generate_ticket_qr.py \
  --circuit "ATCL" \
  --event-name "Esempio" \
  --event-id "ATCL-001" \
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
