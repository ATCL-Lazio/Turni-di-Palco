# Ticket QR generator (Python prototype)

Prototipo CLI per biglietterie teatrali, pensato per essere distribuibile come app standalone (es. PyInstaller).

## Flusso implementato

1. Raccoglie i dati del ticket (`ticket_code`, `theatre_id`, `performance_iso`).
2. Costruisce JSON canonico con `salt` incrementale.
3. Calcola hash SHA-256 del JSON.
4. Chiama Supabase Edge Function `ticket-activation` (`action: reserve_hash`) per validare unicità.
5. Genera PNG QR con payload `turni://ticket/<hash>`.

## Esecuzione

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r tools/ticket_qr_generator/requirements.txt

export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

python tools/ticket_qr_generator/generate_ticket_qr.py \
  --ticket-code "ATCL-2026-001" \
  --theatre-id "teatro-rendano" \
  --performance-iso "2026-03-15T20:45:00+01:00" \
  --output "./out/atcl-2026-001.png"
```

Per una demo locale senza backend:

```bash
python tools/ticket_qr_generator/generate_ticket_qr.py \
  --ticket-code "ATCL-LOCAL-001" \
  --theatre-id "demo" \
  --performance-iso "2026-01-01T18:00:00+01:00" \
  --skip-supabase
```

## Distribuzione standalone (valutazione)

```bash
pip install pyinstaller
pyinstaller --onefile tools/ticket_qr_generator/generate_ticket_qr.py
```

Output previsto: eseguibile singolo in `dist/` da distribuire sulle postazioni di biglietteria.
