Esegui il Console Audit approfondito del deploy Vercel di produzione e arricchisci la issue GitHub con i runtime logs server-side e un'analisi completa.

## Flusso

### 1. Trova la issue di oggi

Cerca su GitHub la issue aperta con label `console-audit` che contiene la data odierna nel titolo (formato `[Console Audit] YYYY-MM-DD`).

- Se la issue **esiste**: aggiungerai un commento di approfondimento.
- Se la issue **non esiste ancora** (la GitHub Action non ha ancora girato o non ha trovato errori): creala tu con tutti i dati raccolti in questo step.

### 2. Recupera i runtime logs Vercel

Usa i tool Vercel MCP disponibili nella sessione per:

1. Trovare il progetto e l'ultimo deployment di produzione
2. Recuperare i runtime logs delle ultime 24 ore
3. Filtrare per livello `error` e `warning`

I runtime logs Vercel catturano errori **server-side** che la GitHub Action non vede:
- `console.error()` / `console.warn()` da Edge Functions e Serverless Functions
- Crash di funzioni (uncaught exceptions, timeouts)
- Errori di rete verso Supabase o altri servizi

### 3. Analizza tutto

Esamina in modo critico:
- Gli errori **browser-side** riportati nella issue (dalla GitHub Action)
- Gli errori **server-side** appena recuperati dai log Vercel

Per ogni pattern distinto di errore:
- Diagnosi della causa probabile (1–2 frasi)
- Fix concreto con snippet di codice se applicabile
- Priorità: 🔴 alta / 🟡 media / 🟢 bassa

Cerca pattern trasversali (es. un errore browser causato da un errore server-side).

### 4. Pubblica il risultato

**Se la issue esiste**, aggiungi un commento con questa struttura:

```
## Approfondimento Claude Code — YYYY-MM-DD HH:MM UTC

### Runtime logs Vercel (ultime 24h)

| Funzione | Livello | Messaggio | Timestamp |
|----------|---------|-----------|-----------|
...

### Analisi trasversale & fix proposti

...

---
_Generato con `/console-audit` da Claude Code._
```

**Se la issue non esiste**, creala con label `console-audit` includendo sia i dati Vercel che l'analisi.

## Note operative

- Il repo è `ATCL-Lazio/Turni-di-Palco`
- Il progetto è una PWA/app mobile React + Vite + Supabase deployata su Vercel
- La route principale dell'app è `/mobile/` — è lì che gira tutta la logica client
- Non aprire PR o modificare codice: questo comando è solo di lettura + issue
