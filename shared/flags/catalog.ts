export const PWA_FEATURE_FLAG_KEYS = [
  "status-card",
  "permissions-card",
  "ai-support",
  "home.main-actions",
  "home.pwa-flags",
  "cp.pwa-flags",
  "cp.quick-presets",
  "cp.command-wizard",
  "cp.mobile-flags",
  "cp.render-overview",
  "cp.audit-overview",
  "cp.db-overview",
  "cp.footer-status",
] as const;
export type PwaFeatureFlagKey = (typeof PWA_FEATURE_FLAG_KEYS)[number];

export const PWA_FEATURE_FLAG_DESCRIPTIONS: Record<PwaFeatureFlagKey, string> = {
  "status-card": "Mostra i messaggi di stato ed errori sintetici nella dashboard.",
  "permissions-card": "Mostra i ruoli e permessi della sessione utente nel control-plane.",
  "ai-support": "Abilita i preset rapidi legati al supporto operativo assistito.",
  "home.main-actions": "Mostra il blocco Azioni principali nella home PWA.",
  "home.pwa-flags": "Mostra il riepilogo delle feature flag nella home PWA.",
  "cp.pwa-flags": "Abilita la sezione toggle delle feature flag PWA nel control-plane.",
  "cp.quick-presets": "Abilita la sezione preset rapidi nel control-plane.",
  "cp.command-wizard": "Abilita il wizard comandi Step 1/2 nel control-plane.",
  "cp.mobile-flags": "Abilita la sezione toggle delle feature flag mobile nel control-plane.",
  "cp.render-overview": "Mostra la card panoramica rilasci e servizi Render.",
  "cp.audit-overview": "Mostra la card registro operazioni recenti.",
  "cp.db-overview": "Mostra la card panoramica operazioni database.",
  "cp.footer-status": "Mostra il footer con last refresh e data source.",
};

export const MOBILE_FEATURE_FLAG_KEYS = [
  "mobile.section.turns",
  "mobile.section.leaderboard",
  "mobile.section.activities",
  "mobile.section.shop",
  "mobile.section.career",
  "mobile.section.earned_titles",
  "mobile.section.role_journey",
  "mobile.action.ai_support",
  "mobile.action.qr_scan",
  "mobile.action.turn_submit",
  "mobile.action.turn_boost",
  "mobile.action.activity_start",
  "mobile.action.activity_complete",
  "mobile.action.shop_purchase",
  "mobile.dev.ticket_qr_prototype",
] as const;
export type MobileFeatureFlagKey = (typeof MOBILE_FEATURE_FLAG_KEYS)[number];

export const MOBILE_FEATURE_FLAG_DESCRIPTIONS: Record<MobileFeatureFlagKey, string> = {
  "mobile.section.turns": "Mostra la sezione Turni ATCL nell'app mobile.",
  "mobile.section.leaderboard": "Mostra la sezione Classifica nell'app mobile.",
  "mobile.section.activities": "Mostra la sezione Attivita nell'app mobile.",
  "mobile.section.shop": "Mostra la sezione Shop nell'app mobile.",
  "mobile.section.career": "Mostra la sezione Carriera nell'app mobile.",
  "mobile.section.earned_titles": "Mostra la sezione Titoli ottenuti nell'app mobile.",
  "mobile.section.role_journey":
    "Abilita il percorso ruolo con onboarding, ordinamento attivita e card dedicate nell'app mobile.",
  "mobile.action.ai_support": "Abilita l'accesso al Supporto AI nelle impostazioni account dell'app mobile.",
  "mobile.action.qr_scan": "Abilita la scansione QR nell'app mobile.",
  "mobile.action.turn_submit": "Abilita la registrazione turni nell'app mobile.",
  "mobile.action.turn_boost": "Abilita il boost turno nell'app mobile.",
  "mobile.action.activity_start": "Abilita l'avvio attivita simulate nell'app mobile.",
  "mobile.action.activity_complete": "Abilita il completamento attivita simulate nell'app mobile.",
  "mobile.action.shop_purchase": "Abilita gli acquisti nello shop mobile.",
  "mobile.dev.ticket_qr_prototype":
    "Abilita il prototipo developer per generazione e attivazione ticket QR nelle impostazioni account.",
};

type FlagOption = {
  value: boolean;
  label: "On" | "Off";
};

type VercelFlagDefinition = {
  description: string;
  origin?: string;
  options: readonly FlagOption[];
};

const BOOLEAN_OPTIONS: readonly FlagOption[] = [
  { value: true, label: "On" },
  { value: false, label: "Off" },
];

function buildVercelFlagDefinitionRecord<K extends string>(
  keys: readonly K[],
  descriptions: Record<K, string>,
  origin: string
): Record<K, VercelFlagDefinition> {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      {
        description: descriptions[key],
        origin,
        options: BOOLEAN_OPTIONS,
      },
    ])
  ) as Record<K, VercelFlagDefinition>;
}

export const PWA_VERCEL_FLAG_DEFINITIONS = buildVercelFlagDefinitionRecord(
  PWA_FEATURE_FLAG_KEYS,
  PWA_FEATURE_FLAG_DESCRIPTIONS,
  "pwa-runtime"
);

export const MOBILE_VERCEL_FLAG_DEFINITIONS = buildVercelFlagDefinitionRecord(
  MOBILE_FEATURE_FLAG_KEYS,
  MOBILE_FEATURE_FLAG_DESCRIPTIONS,
  "mobile-runtime"
);

export type VercelFlagKey = PwaFeatureFlagKey | MobileFeatureFlagKey;

export const VERCEL_FLAG_DEFINITIONS: Record<VercelFlagKey, VercelFlagDefinition> = {
  ...PWA_VERCEL_FLAG_DEFINITIONS,
  ...MOBILE_VERCEL_FLAG_DEFINITIONS,
};

export const VERCEL_FLAGS_DISCOVERY_RESPONSE = {
  overrideEncryptionMode: "plaintext",
  definitions: VERCEL_FLAG_DEFINITIONS,
} as const;
