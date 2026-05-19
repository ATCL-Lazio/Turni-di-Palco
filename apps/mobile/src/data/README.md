# Content pipeline · `apps/mobile/src/data/`

Closes [#474](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/474).

Tutti i contenuti di gioco (scenari narrativi, corsi, configurazioni minigiochi)
vivono **in file JSON tipizzati**, non hardcoded nei componenti. Aggiungere
contenuti **non deve richiedere modifiche al codice**.

## Struttura

```
apps/mobile/src/data/
├── README.md                # ← questo file
├── narrative/
│   ├── index.ts             # registry: import + assertValidScene su ogni scena
│   ├── scenes/              # scene generiche (debug, FTUE)
│   │   ├── README.md        # schema scenario + tips di scrittura
│   │   └── *.json
│   └── theaters/            # scenari teatro-specifici (#478)
│       ├── README.md        # convenzioni naming e gating
│       └── <theater-id>.json
├── courses/
│   ├── README.md            # schema corso (#327, propedeutico a #121)
│   └── *.json
└── minigames/
    └── README.md            # configurazioni minigiochi rotanti (#469)
```

> `achievements_data.ts`, `atcl_promotions.ts`, `circuit_options.ts`,
> `onboarding/first_mission.ts` sono asset legacy in TypeScript; saranno
> migrati a JSON progressivamente. Per ora **non aggiungere nuovi `.ts` con
> contenuto statico**: usa JSON.

## Stagionalità

Ogni file di contenuto può dichiarare un campo opzionale:

```json
"season": "2025-2026"
```

Quando il backoffice (o un toggle env) imposta `ACTIVE_SEASONS = ["2025-2026"]`,
i contenuti con `season` differenti vengono ignorati silenziosamente in lettura.
**Default**: senza `season` il contenuto è considerato evergreen (sempre attivo).

La logica di filtro sta in `data/<feature>/index.ts` accanto al `registerScenes`
così che ogni feature possa decidere la propria policy (alcune potrebbero
preferire mostrare comunque i contenuti out-of-season).

## Aggiungere una scena narrativa

1. Scrivi `apps/mobile/src/data/narrative/scenes/<id>.json` rispettando lo
   schema in [`scenes/README.md`](./narrative/scenes/README.md).
2. Aggiungi l'import in [`narrative/index.ts`](./narrative/index.ts) e
   appendi al registry.
3. Esegui `npm run validate:content` dalla root del monorepo. Lo script
   valida via JSON Schema (Ajv) ogni file in `data/`.
4. (Opzionale) Aggiungi un test in `apps/mobile/src/test/` per coprire un
   percorso specifico se la scena introduce nuovo gating.

## Aggiungere uno scenario di teatro (#478)

Stesso flusso ma in `data/narrative/theaters/<theater-id>.json`. Il `<theater-id>`
deve essere lo slug del comune in kebab-case (es. `civitavecchia-teatro-traiano`).

Vincoli specifici per gli scenari teatro:

- `theatre`: stringa con il nome ufficiale del teatro (deve combaciare con
  `TheatreReputation.theatre` nel store).
- `requires.theatreVisits.min`: numero opzionale che richiede almeno N turni
  registrati in quel teatro per sbloccare la scena.
- Il contenuto deve fare riferimento a **fatti reali** (storia, curiosità,
  aneddoti del teatro). Vedi [`theaters/README.md`](./narrative/theaters/README.md).

## Validazione runtime e CI

```bash
npm run validate:content      # ajv: valida tutti i JSON in data/
npm --workspace apps/mobile run test   # vitest: assertion sul registry
```

Lo script `validate:content` esce con `1` al primo errore e stampa il path
del file con il messaggio diagnostico, in modo da essere usato come gate
in pre-commit o CI.
