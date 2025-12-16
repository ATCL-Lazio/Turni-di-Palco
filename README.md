# Turni di Palco – Monorepo

**Turni di Palco** è una Progressive Web App (PWA) progettata per la gestione gamificata dei turni in teatro. L'obiettivo è rendere l'organizzazione del lavoro teatrale più coinvolgente attraverso meccaniche di gioco (XP, livelli, ruoli).

Questo repository è strutturato come monorepo contenente:
- **apps/pwa**: Il frontend principale (Vite + TypeScript + Vanilla).
- **apps/mobile**: (Sottoprogetto UI Mobile).
- **shared**: Codice e stili condivisi.

## 🚀 Guida Rapida (PWA)

### Prerequisiti
- Node.js (v18+ raccomandato)
- npm

### Installazione
Esegui questo comando nella root del progetto per installare tutte le dipendenze (utilizzando i workspaces):
```bash
npm install
```

### Sviluppo
Per avviare l'ambiente di sviluppo locale:
```bash
npm run dev:pwa
```
L'app sarà disponibile su `http://localhost:5173`.

### Testing
Esegui i test unitari con Vitest:
```bash
npm run test:pwa
```

### Build
Per compilare il progetto per la produzione:
```bash
npm run build:pwa
```
L'output sarà in `apps/pwa/dist`.

## 🏗️ Struttura del Progetto

Il codice sorgente della PWA si trova in `apps/pwa/src` ed è organizzato modularmente:
- **components/**: Componenti UI riutilizzabili.
- **features/**: Moduli funzionali (es. gestione permessi, status card).
- **services/**: Logica di business e integrazioni API/Browser (es. `permissions.ts`).
- **utils/**: Funzioni di utilità generali.

## 🤝 Contribuire
Vedi [CONTRIBUTING.md](CONTRIBUTING.md) per linee guida su stile del codice, commit e setup dell'ambiente.

## 📄 Note di Design
Consulta la cartella `docs and references/` per i dettagli sul Game Design Document e analisi del progetto.
