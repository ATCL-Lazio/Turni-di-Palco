# Deploy su Netlify

## Prerequisiti
- Account Netlify
- Repository GitHub collegato a Netlify

## Configurazione Automatica

1. **Connetti il repository a Netlify**
   - Vai su [netlify.com](https://netlify.com)
   - Clicca "Add new site" → "Import an existing project"
   - Seleziona GitHub e autorizza
   - Scegli il repository `Turni-di-Palco`

2. **Configurazione Build Settings**
   - **Build command**: `npm ci && npm run build:pwa`
   - **Publish directory**: `apps/pwa/dist`
   - **Node version**: `18`

3. **Environment Variables**
   - `VITE_SUPABASE_URL`: URL del tuo database Supabase
   - `VITE_SUPABASE_ANON_KEY`: Chiave anonima di Supabase

## Configurazione Manuale

Il progetto include già un file `netlify.toml` con la configurazione necessaria.

## Deploy

1. **Push su GitHub**
   ```bash
   git add .
   git commit -m "Add Netlify configuration"
   git push
   ```

2. **Trigger Deploy**
   - Netlify rileverà automaticamente il push
   - Il deploy iniziale richiederà 2-3 minuti

## Funzionalità Configurate

- **Multi-page app**: Tutte le pagine HTML sono incluse
- **Service Worker**: Cache automatico per PWA
- **Headers di sicurezza**: Configurati in `.netlify/headers`
- **Redirect SPA**: Tutte le rotte reindirizzano a index.html
- **Ottimizzazione**: Cache statico per asset

## Verifica Post-Deploy

- Controlla che tutte le pagine funzionino
- Verifica il service worker
- Testa la connessione a Supabase
- Controlla le performance con Lighthouse

## Troubleshooting

Se il build fallisce:
1. Verifica le environment variables
2. Controlla i log di build su Netlify
3. Assicurati che il branch sia corretto
