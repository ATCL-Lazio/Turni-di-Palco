# Minigiochi · `data/minigames/`

Closes scaffolding di [#474](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/474).
Implementazione integrata in `apps/mobile/src/gameplay/minigames.ts` (#469).

I minigiochi attualmente hanno la configurazione hardcoded in
[`gameplay/minigames.ts`](../../gameplay/minigames.ts). Questa cartella è il **target di
migrazione**: ogni nuova variante (palette di round, parametri, override per
ruolo) dovrebbe essere aggiunta come JSON qui invece che editando il TS.

## Schema target

```json
{
  "id": "sequenza_luci_avanzato",
  "season": "2025-2026",
  "type": "timing",
  "title": "Sequenza cue luci avanzata",
  "subtitle": "Sequenza accelerata di cue per spettacoli high-tech.",
  "allowedRoles": ["luci"],
  "rounds": [
    { "label": "Cue 1", "tolerance": 4 },
    { "label": "Cue 2", "tolerance": 3 }
  ],
  "roleOverrides": {
    "dramaturg": { "title": "...", "subtitle": "..." }
  }
}
```

> I `target` dei round sono **sempre** randomizzati a runtime entro
> `MINIGAME_TARGET_RANGE` (vedi `balancing.ts`); ometterli dal JSON.

## Flow di aggiunta (target)

1. Crea `apps/mobile/src/data/minigames/<id>.json`.
2. Esegui `npm run validate:content`.
3. Il consumer si cabla in `gameplay/minigames.ts` quando la migrazione viene completata.

Per ora la cartella esiste per la pipeline di validazione e per il README di onboarding.
