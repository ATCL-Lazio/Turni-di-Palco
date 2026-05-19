// Pure helpers che mappano statistiche del ruolo → effetti concreti.
// Single source of truth per #471: ogni consumer (minigames, narrativa,
// reward calc, UI di anteprima) deve passare da qui invece di leggere
// direttamente STAT_EFFECTS, così il mapping resta documentato e testabile.

import {
  STAT_EFFECTS,
  getLeadershipCachetMultiplier,
  getStatMultiplier,
} from '../../../../shared/config/balancing';
import type { RoleStats } from './minigames';

export type StatKey = keyof RoleStats;

// Quanto in millisecondi si allarga la finestra di timing per ogni punto
// di precisione sopra la baseline. Usato dai minigiochi cue-based.
export function getTimingWindowBonus(stats: RoleStats | null | undefined): number {
  if (!stats) return 0;
  const delta = Math.max(0, stats.precision - STAT_EFFECTS.statBaseline);
  return Math.round(delta * STAT_EFFECTS.precision.timingWindowBonusMs);
}

// Combo extra (punti aggiuntivi per hit "perfetto") sbloccato sopra soglia presence.
export function getPresenceComboBonus(stats: RoleStats | null | undefined): number {
  if (!stats) return 0;
  return stats.presence >= STAT_EFFECTS.presence.comboBonusThreshold
    ? STAT_EFFECTS.presence.comboBonusPerHit
    : 0;
}

// Tempo extra (secondi) per minigiochi multi-fase, sbloccato sopra soglia leadership.
export function getLeadershipPhaseTimeBonusSec(stats: RoleStats | null | undefined): number {
  if (!stats) return 0;
  return stats.leadership >= STAT_EFFECTS.leadership.multiPhaseTimeBonusThreshold
    ? STAT_EFFECTS.leadership.multiPhaseTimeBonusSeconds
    : 0;
}

// Se sopra soglia, sblocca il round bonus "improvvisa" nei minigiochi compatibili.
export function isImproviseRoundUnlocked(stats: RoleStats | null | undefined): boolean {
  if (!stats) return false;
  return stats.creativity >= STAT_EFFECTS.creativity.improviseRoundUnlockThreshold;
}

// Helpers di appartenenza: leggono direttamente `STAT_EFFECTS.X.affectedActivities`
// da `shared/config/balancing.ts`, così l'elenco vive in un solo posto e
// aggiungere una nuova attività al gioco non richiede toccare role-effects.
const PRECISION_ACTIVITIES = STAT_EFFECTS.precision.affectedActivities as readonly string[];
const PRESENCE_ACTIVITIES = STAT_EFFECTS.presence.affectedActivities as readonly string[];
const CREATIVITY_ACTIVITIES = STAT_EFFECTS.creativity.affectedActivities as readonly string[];

export type RewardBonusBreakdown = {
  /** Identifica la stat (`precision`, `presence`, ...) o `'leadership'` per il bonus globale. */
  source: StatKey | 'leadership_global';
  /** Tipo di bonus applicato. */
  kind: 'xp' | 'cachet';
  /** Moltiplicatore reale applicato (>= 1). */
  multiplier: number;
  /** Punti reward extra rispetto alla base (positivo). */
  delta: number;
};

export type RewardBreakdownInput = {
  baseXp: number;
  baseCachet: number;
  activityId: string;
  stats: RoleStats | null | undefined;
};

export type RewardBreakdown = {
  baseXp: number;
  baseCachet: number;
  finalXp: number;
  finalCachet: number;
  bonuses: RewardBonusBreakdown[];
};

/**
 * Calcola la decomposizione bonus stat → ricompensa finale.
 * Vincolo: pure function, niente effetti collaterali, niente RNG.
 *
 * **Modello additivo, non composto.** Ogni bonus stat è calcolato sulla
 * `baseXp` / `baseCachet` originali, mai sul valore già aumentato da un
 * bonus precedente. Questo evita lo stacking moltiplicativo che farebbe
 * divergere il breakdown UI dai reward effettivi calcolati dallo store
 * (vedi `state/store.tsx:getRoleActivityOverride`, che applica un
 * `xpMultiplier`/`cachetMultiplier` singolo per coppia ruolo×attività).
 *
 * Il breakdown qui è quindi una **stima del contributo isolato di ogni
 * stat** rispetto alla reward base. Lo store può applicare in aggiunta
 * moltiplicatori specifici di ruolo (override) che non sono catturati
 * da questo modello; finché STAT_EFFECTS non diventa l'unica source of
 * truth anche nello store, l'UI mostra il breakdown come "Impatto
 * teorico delle tue statistiche".
 *
 * Le formule sono in `shared/config/balancing.ts`; qui solo composizione.
 */
export function computeRewardBreakdown({
  baseXp,
  baseCachet,
  activityId,
  stats,
}: RewardBreakdownInput): RewardBreakdown {
  if (!stats) {
    return {
      baseXp,
      baseCachet,
      finalXp: baseXp,
      finalCachet: baseCachet,
      bonuses: [],
    };
  }

  const bonuses: RewardBonusBreakdown[] = [];
  let xpDelta = 0;
  let cachetDelta = 0;

  // Precision → cachet su attività luci/fonico (delta sulla BASE)
  if (PRECISION_ACTIVITIES.includes(activityId)) {
    const mult = getStatMultiplier('precision', 'cachet', stats.precision);
    if (mult > 1) {
      const delta = Math.round(baseCachet * (mult - 1));
      if (delta > 0) {
        bonuses.push({ source: 'precision', kind: 'cachet', multiplier: mult, delta });
        cachetDelta += delta;
      }
    }
  }

  // Presence → xp su recitazione/copione (delta sulla BASE)
  if (PRESENCE_ACTIVITIES.includes(activityId)) {
    const mult = getStatMultiplier('presence', 'xp', stats.presence);
    if (mult > 1) {
      const delta = Math.round(baseXp * (mult - 1));
      if (delta > 0) {
        bonuses.push({ source: 'presence', kind: 'xp', multiplier: mult, delta });
        xpDelta += delta;
      }
    }
  }

  // Creativity → xp su palco/attrezzista (delta sulla BASE)
  if (CREATIVITY_ACTIVITIES.includes(activityId)) {
    const mult = getStatMultiplier('creativity', 'xp', stats.creativity);
    if (mult > 1) {
      const delta = Math.round(baseXp * (mult - 1));
      if (delta > 0) {
        bonuses.push({ source: 'creativity', kind: 'xp', multiplier: mult, delta });
        xpDelta += delta;
      }
    }
  }

  // Leadership → cachet globale (delta sulla BASE, non sul cachet già aumentato)
  const leadershipMult = getLeadershipCachetMultiplier(stats.leadership);
  if (leadershipMult > 1) {
    const delta = Math.round(baseCachet * (leadershipMult - 1));
    if (delta > 0) {
      bonuses.push({ source: 'leadership_global', kind: 'cachet', multiplier: leadershipMult, delta });
      cachetDelta += delta;
    }
  }

  return {
    baseXp,
    baseCachet,
    finalXp: baseXp + xpDelta,
    finalCachet: baseCachet + cachetDelta,
    bonuses,
  };
}

export type StatPreview = {
  stat: StatKey;
  /** Label utente in italiano. */
  label: string;
  /** Conseguenza meccanica in una frase, per RoleSelection / homepage ruolo. */
  effect: string;
  /** True se il ruolo ha questa stat sopra la baseline (effetto attivo). */
  active: boolean;
};

const STAT_LABEL: Record<StatKey, string> = {
  presence: 'Presenza scenica',
  precision: 'Precisione',
  leadership: 'Leadership',
  creativity: 'Creatività',
};

/**
 * Anteprima per RoleSelection: 1 effetto concreto per stat, con flag `active`
 * vero quando il ruolo è sopra la baseline (`STAT_EFFECTS.statBaseline`).
 *
 * Le stringhe sono volutamente esplicite: "timing più generoso" è verificabile
 * dal player, "+15% cachet" è verificabile in ActivityResult.
 */
export function getRoleStatPreviews(stats: RoleStats): StatPreview[] {
  const baseline = STAT_EFFECTS.statBaseline;
  return [
    {
      stat: 'precision',
      label: STAT_LABEL.precision,
      effect:
        'Finestra di timing più ampia sui cue luci e fonico, fino al +20% cachet sulle attività tecniche.',
      active: stats.precision > baseline,
    },
    {
      stat: 'presence',
      label: STAT_LABEL.presence,
      effect:
        'Bonus combo sulle scene di recitazione e copione, fino al +20% XP.',
      active: stats.presence > baseline,
    },
    {
      stat: 'leadership',
      label: STAT_LABEL.leadership,
      effect:
        'Tempo extra nei minigiochi multi-fase e +0,2% cachet globale per punto, cap +10%.',
      active: stats.leadership > baseline,
    },
    {
      stat: 'creativity',
      label: STAT_LABEL.creativity,
      effect:
        'Sblocca round bonus "improvvisa" e +20% XP sulle attività palco/attrezzista.',
      active: stats.creativity > baseline,
    },
  ];
}

/**
 * Identifica le stat che producono un effetto **attivo** per la attività
 * specifica. Usata dal minigame UI per mostrare il badge "Beneficio X attivo".
 */
export function getActiveStatBenefitsForActivity(
  activityId: string,
  stats: RoleStats | null | undefined,
): Array<{ stat: StatKey; label: string }> {
  if (!stats) return [];
  const baseline = STAT_EFFECTS.statBaseline;
  const active: Array<{ stat: StatKey; label: string }> = [];

  if (PRECISION_ACTIVITIES.includes(activityId) && stats.precision > baseline) {
    active.push({ stat: 'precision', label: STAT_LABEL.precision });
  }
  if (PRESENCE_ACTIVITIES.includes(activityId) && stats.presence > baseline) {
    active.push({ stat: 'presence', label: STAT_LABEL.presence });
  }
  if (CREATIVITY_ACTIVITIES.includes(activityId) && stats.creativity > baseline) {
    active.push({ stat: 'creativity', label: STAT_LABEL.creativity });
  }
  if (stats.leadership > baseline) {
    active.push({ stat: 'leadership', label: STAT_LABEL.leadership });
  }
  return active;
}
