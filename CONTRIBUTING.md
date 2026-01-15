# Contributing to Turni di Palco

Grazie per l'interesse nel contribuire a Turni di Palco!

## Workflow di Sviluppo

1. **Branching**: Crea sempre un nuovo branch per le tue modifiche (`feature/nome-feature` o `fix/nome-bug`). Non committare direttamente su `main`.
2. **Commit**: Usa messaggi di commit chiari e descrittivi (Conventional Commits preferiti). Es. `feat(pwa): aggiunto controllo permessi`.
3. **Pull Request**: Apri una PR verso il branch di sviluppo (o `main` in assenza di `dev`) descrivendo le modifiche.

## Stile del Codice

- **TypeScript**: Usa tipi espliciti dove possibile. Evita `any`.
- **Linting**: Esegui `npm run lint` prima di committare per verificare lo stile.
- **Formatting**: Il progetto usa Prettier.

## Testing

- Aggiungi test unitari per nuova logica di business in `src/test/`.
- Esegui `npm run test:pwa` per verificare che tutto funzioni.

## Struttura

Mantieni la separazione tra logica (services) e presentazione (components/features).
