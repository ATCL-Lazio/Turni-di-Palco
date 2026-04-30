# Scenari narrativi — guida per chi scrive

Ogni scenario è un file `.json` in questa cartella, con la shape definita in
`apps/mobile/src/gameplay/narrative.ts` (`NarrativeScene`).

## Schema essenziale

```json
{
  "id": "unique_snake_case_id",
  "title": "Titolo breve della scena",
  "setting": "Dove siamo, in 1 riga",
  "prompt": "Cosa sta succedendo. 2-4 righe. Termina con una decisione da prendere.",
  "allowedRoles": ["attore", "luci"],         // opzionale: omettere = tutti i ruoli
  "requiresFlags": ["completed_intro"],       // opzionale: gating su flag globali
  "choices": [
    { "id": "...", "label": "...", "outcome": { ... } },
    { "id": "...", "label": "...", "outcome": { ... } }
  ]
}
```

## Vincoli

- `choices`: minimo **2**, massimo **4**.
- `id` di ogni choice deve essere **unico nella scena**.
- `label`: testo del bottone, max ~40 caratteri.
- `outcome.text`: 1-3 righe descrittive su cosa accade.
- `outcome.rewards`: almeno uno tra `xp`, `cachet`, `reputation` (anche 0 è valido).
- `outcome.next`: `"id_scena_successiva"` per concatenare, oppure `null` per chiudere.

## Gating

- **Per ruolo** (`allowedRoles` sulla scena): solo i ruoli elencati vedono la scena.
- **Per flag** (`requiresFlags` sulla scena): flag impostati da scelte precedenti.
- **Per stat** (`choices[].requires.stat + min`): la singola scelta è disabilitata se la stat del ruolo è sotto la soglia. Le 4 stat disponibili sono `presence`, `precision`, `leadership`, `creativity`.
- **Per flag su singola scelta** (`choices[].requires.flag`).

Esempio scelta gated:

```json
{
  "id": "improvvisa",
  "label": "Improvvisa una variazione",
  "requires": { "stat": "creativity", "min": 70 },
  "outcome": { "text": "...", "rewards": { "xp": 30 }, "next": null }
}
```

## Flow

1. Crea il file in `apps/mobile/src/data/narrative/scenes/<id>.json`.
2. Aggiungi l'import in `apps/mobile/src/data/narrative/index.ts` e mettilo in `SCENES`.
3. Lancia `npm run test:mobile` (o avvia l'app in dev): la validazione runtime fallisce con messaggi puntuali se lo schema non è rispettato.

## Tips di scrittura

- **Una decisione vera per scena.** Se le scelte hanno tutte lo stesso outcome, non è una decisione: è rumore.
- **Conseguenze diverse, non solo numeri diversi.** Cambia il testo dell'outcome, magari un flag. Le ricompense seguono, non guidano.
- **Mostra il risultato in 2 righe.** Niente paragrafi, niente lore-dump.
- **`null` chiude la scena.** Quando concateni con `next: "..."`, ricorda di scrivere anche la scena successiva, altrimenti il loader fallisce all'apertura della scena mancante (a runtime, non in build).
