# Eventi narrativi esclusivi per teatro · `data/narrative/theaters/`

Closes [#478](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/478).

Una scena narrativa **per ogni teatro della rete ATCL**, sbloccabile dopo un
numero configurabile di turni registrati in quel teatro. Riferimento alla rete
in [`docs/2026-03-23-atcl-teatri-ticketing.md`](../../../../../../docs/2026-03-23-atcl-teatri-ticketing.md).

## Naming

- File: `<comune-slug>-<teatro-slug>.json` (kebab-case, ASCII).
  Esempio: `civitavecchia-teatro-traiano.json`.
- `scene.id`: identico al filename senza estensione (più `theater_` prefix per
  evitare collisioni con scene generiche). Esempio: `theater_civitavecchia_teatro_traiano`.

## Schema esteso (rispetto a `scenes/`)

Oltre ai campi obbligatori della scena narrativa
(vedi [`../scenes/README.md`](../scenes/README.md)), gli scenari di teatro
**devono** includere:

```json
{
  "id": "theater_civitavecchia_teatro_traiano",
  "theatre": "Teatro Traiano",
  "city": "Civitavecchia",
  "season": "2025-2026",
  "requires": {
    "theatreVisits": { "min": 3 }
  },
  ...
}
```

- `theatre`: nome ufficiale del teatro (deve combaciare con
  `TheatreReputation.theatre` nel store).
- `city`: comune del teatro (informazione di contesto).
- `requires.theatreVisits.min`: numero minimo di turni registrati in quel teatro
  per sbloccare la scena. Default consigliato: **3**.

## Linea editoriale

Ogni scenario deve contenere **almeno un riferimento reale**: aneddoto, storia,
curiosità, dettaglio architettonico, episodio celebre. Le scene placeholder
contengono spunti documentati: vanno **arricchite** dal redattore di contenuti
prima della release, non sostituite con testo generico.

Il commit `closes #478` aggiunge **un placeholder per ogni teatro**; il loro
arricchimento successivo è materiale per i prossimi sprint editoriali (può
essere tracciato in issue figlie senza riaprire #478).

## Mappatura teatri sbloccabili

La lista canonica vive nello script [`tools/generate-theater-scenes.js`](../../../../../../tools/generate-theater-scenes.js)
(seed dei 25 venue ATCL). Per aggiungere/modificare scenari:

1. Edita il seed nello script.
2. Esegui `node tools/generate-theater-scenes.js` dalla root (rigenera **solo**
   i file che non esistono ancora; non sovrascrive le scene già scritte a mano).
3. Lancia `npm run validate:content`.

> Non serve toccare [`../index.ts`](../index.ts): il registry usa
> `import.meta.glob` e raccoglie automaticamente ogni nuovo `.json` in
> questa cartella al successivo build/dev.
