# Corsi · `data/courses/`

Closes scaffolding di [#474](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/474).
Implementazione completa del flusso è tracciata in [#121](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/121) e [#327](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/327).

I corsi sono attività con **costo** (cachet o tempo) che applicano un **bonus passivo**
ad almeno una stat o ad almeno un calcolo di reward.

## Schema (proposta v1)

```json
{
  "id": "regia-base",
  "title": "Regia base",
  "description": "Concetti fondamentali della regia teatrale.",
  "season": "2025-2026",
  "cost": {
    "cachet": 100,
    "loginDays": 3
  },
  "rewards": {
    "skill": "presence",
    "bonus": 5
  },
  "cooldownMinutes": 4320
}
```

Campi:

- `id` *(string, required)* — snake_case, univoco a livello globale.
- `title`, `description` *(string, required)*.
- `season` *(string, optional)* — vedi `data/README.md` § Stagionalità.
- `cost` *(object, required)* — almeno una tra `cachet` (>=0) o `loginDays` (>=0).
- `rewards.skill` — una delle 4 stat (`presence`/`precision`/`leadership`/`creativity`).
- `rewards.bonus` — punti aggiunti alla stat a corso completato (cap rimandato a `balancing.ts`).
- `cooldownMinutes` — tempo prima di poter rifrequentare lo stesso corso.

I numeri di default (cost/reward) provengono da `ACTIVITY_REWARDS.course_completion`
in [`shared/config/balancing.ts`](../../../../../shared/config/balancing.ts).

## Flow di aggiunta

1. Crea `apps/mobile/src/data/courses/<id>.json`.
2. Esegui `npm run validate:content` dalla root.
3. Il consumer reale verrà cablato come parte di #327.

> Attualmente la cartella non viene letta dal client: è pronta per accogliere
> i primi corsi appena #327 chiude l'integrazione store ↔ corsi.
