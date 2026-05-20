# Mappatura statistiche di ruolo → effetto concreto

Documento di riferimento per **game designer e developer** del progetto Turni di Palco.
Versione: 2026-05-19 · Issue di riferimento: [#471](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/471), [#475](https://github.com/ATCL-Lazio/Turni-di-Palco/issues/475).

## Obiettivo

Ogni statistica di ruolo (`presence`, `precision`, `leadership`, `creativity`) deve produrre
**almeno un effetto percepibile e verificabile** in minigiochi, narrativa o ricompense.
Un giocatore che confronta due ruoli con stat opposte deve notare la differenza in
**≤ 1 sessione di gioco**.

## Schema reale (4 stat)

I ruoli sono **7** (`attore`, `luci`, `fonico`, `attrezzista`, `palco`, `rspp`, `dramaturg`)
e le stat sono **4**, normalizzate in `[0, 100]` con baseline a `50`.

| Stat         | Effetto minigioco                              | Effetto narrativa                                  | Effetto ricompense                                       |
|--------------|------------------------------------------------|----------------------------------------------------|----------------------------------------------------------|
| `precision`  | Finestra di timing più ampia (`+4 ms/punto`)   | Sblocca scelte `requires.stat.precision ≥ X`       | +0,3 %/punto cachet su attività `luci`/`fonico` (cap 20 %) |
| `presence`   | Bonus combo (+1/hit) se `presence ≥ 80`        | Sblocca scelte carismatiche/leadership emotiva     | +0,4 %/punto XP su attività `recitazione`/`copione` (cap 20 %) |
| `leadership` | +2 s in minigiochi multi-fase se `leadership ≥ 75` | Sblocca scelte "organizzo la squadra"          | +0,2 %/punto cachet **globale** (cap 10 %)               |
| `creativity` | Sblocca round bonus "improvvisa" (`≥ 70`)      | Sblocca soluzioni non ortodosse (terza scelta)     | +0,3 %/punto XP su attività `palco`/`attrezzista` (cap 20 %) |

I numeri vivono in [`shared/config/balancing.ts`](../shared/config/balancing.ts) (`STAT_EFFECTS`)
e si modificano da lì senza redeploy dei componenti.

## API runtime

Tutti i consumer leggono il mapping via [`apps/mobile/src/gameplay/role-effects.ts`](../apps/mobile/src/gameplay/role-effects.ts):

- `computeRewardBreakdown({ baseXp, baseCachet, activityId, stats })` — restituisce il dettaglio
  bonus per la schermata ActivityResult.
- `getTimingWindowBonus(stats)`, `getPresenceComboBonus(stats)`, `getLeadershipPhaseTimeBonusSec(stats)`,
  `isImproviseRoundUnlocked(stats)` — usati dai minigiochi.
- `getRoleStatPreviews(stats)` — anteprima 1 riga per ruolo nella schermata `RoleSelection`.
- `getActiveStatBenefitsForActivity(activityId, stats)` — guida il badge "Beneficio X attivo"
  nel pannello del minigioco.

## Wiring narrativa

Le scelte in `data/narrative/scenes/*.json` possono dichiarare requisiti stat con
`requires: { stat: 'precision', min: 75 }`. La funzione `evaluateChoice` in
`gameplay/narrative.ts` consuma `STAT_EFFECTS.statBaseline` come unica fonte
di verità; quando si modifica la baseline in `balancing.ts` non serve toccare le scene.

## Acceptance — come verificare in 1 sessione

1. Avvia un nuovo profilo, crea ruolo **Tecnico Luci** (`precision = 95`).
2. Gioca il minigioco `audio` → osserva il badge giallo "Beneficio Precisione attivo".
3. A fine round, la schermata `ActivityResult` mostra `+X cachet da Precisione`.
4. Cambia ruolo a **Attore** (`presence = 95`), rigioca `audio`:
   il badge sparisce e il cachet non riceve il bonus precisione, ma la `recitazione`
   guadagna il bonus presenza in XP.

## Out of scope (deferred)

- Calibrazione fine dei numeri (è un playtest ricorrente, non un'attività di codice).
- Skill tree / sblocco progressivo degli effetti — qui le stat sono statiche per ruolo.
- Scaling delle stat in funzione del livello giocatore.
