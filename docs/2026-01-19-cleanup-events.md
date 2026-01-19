# Sistema di Pulizia Eventi ATCL

Data: 2026-01-19  
Scopo: Documentazione del sistema di pulizia automatica degli eventi passati

## Panoramica

Implementato un sistema completo per la pulizia automatica degli eventi ATCL passati per mantenere il database pulito e migliorare le performance.

## Componenti

### 1. Script Locale (`tools/cleanup-old-events.js`)

Script Node.js per eseguire manualmente la pulizia degli eventi:

```bash
# Pulizia eventi più vecchi di 7 giorni (default)
npm run cleanup:events

# Pulizia eventi più vecchi di 30 giorni
npm run cleanup:events 30
```

**Funzionalità:**
- Connessione al database Supabase
- Calcolo della data di cutoff basata sui giorni specificati
- Identificazione e cancellazione degli eventi passati
- Logging dettagliato delle operazioni

### 2. Supabase Edge Function (`supabase/functions/cleanup-events/`)

Endpoint HTTP per eseguire la pulizia tramite API:

```
GET /functions/v1/cleanup-events?days=7
```

**Response:**
```json
{
  "message": "Cancellati 3 eventi con successo",
  "deleted": 3,
  "events": [
    {
      "id": "ATCL-001",
      "name": "Prova aperta - Teatro di Latina",
      "date": "15 Dic 2025"
    }
  ]
}
```

### 3. GitHub Actions Workflow (`.github/workflows/cleanup-events.yml`)

Esecuzione automatica programmata:

- **Schedule**: Ogni giorno alle 2 AM UTC
- **Manual trigger**: Possibile esecuzione manuale con parametri personalizzati
- **Environment**: Utilizza secrets per le credenziali Supabase

## Configurazione

### Variabili Environment Richieste

Per il funzionamento dello script locale sono necessarie:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Per GitHub Actions, configurare i secrets nel repository:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Logica di Pulizia

1. **Calcolo cutoff**: `data_attuale - giorni_da_mantenere`
2. **Filtro eventi**: Eventi con `event_date + event_time < cutoff`
3. **Cancellazione**: Rimozione batch degli eventi identificati
4. **Logging**: Report dettagliato degli eventi cancellati

## Sicurezza

- Le Edge Functions richiedono autenticazione
- Gli script locali usano ANON key (sola lettura/scrittura eventi)
- Il workflow GitHub Actions usa secrets crittografati
- Logging completo per audit trail

## Manutenzione

### Monitoraggio
- Controllare i log di GitHub Actions per esecuzioni fallite
- Monitorare la dimensione della tabella events nel tempo
- Verificare che gli eventi importanti non vengano cancellati accidentalmente

### Personalizzazione
- Modificare `daysToKeep` per cambiare la politica di ritenzione
- Aggiungere filtri aggiuntivi (es. per genere di eventi)
- Implementare backup prima della cancellazione se necessario

## Comandi Utili

```bash
# Installazione dipendenze
npm install

# Test script locale
npm run cleanup:events 1

# Deploy Edge Function
supabase functions deploy cleanup-events

# Trigger manuale GitHub Actions
# Usare l'interfaccia web di GitHub Actions
```

## Note

- Gli eventi vengono cancellati permanentemente
- I turni associati agli eventi cancellati rimangono nel database
- Considerare implementare soft delete se necessario recuperare eventi
- Testare sempre in ambiente di sviluppo prima di eseguire in produzione
