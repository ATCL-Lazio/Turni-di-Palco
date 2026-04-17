export const MOBILE_FEATURE_FLAG_KEYS = [
  "turni",
  "classifica",
  "attivita",
  "shop",
  "carriera",
  "titoli",
  "percorso_ruolo",
  "supporto_ai",
  "qr_scan",
  "registra_turno",
  "geofence",
  "boost_turno",
  "avvia_attivita",
  "completa_attivita",
  "acquisti",
  "ticket_qr",
] as const;
export type MobileFeatureFlagKey = (typeof MOBILE_FEATURE_FLAG_KEYS)[number];

export const MOBILE_FEATURE_FLAG_DESCRIPTIONS: Record<MobileFeatureFlagKey, string> = {
  turni: "Schermata Turni",
  classifica: "Schermata Classifica",
  attivita: "Schermata Attività",
  shop: "Schermata Shop",
  carriera: "Schermata Carriera",
  titoli: "Schermata Titoli",
  percorso_ruolo: "Percorso Ruolo",
  supporto_ai: "Supporto AI",
  qr_scan: "Scansione QR",
  registra_turno: "Registra Turno",
  geofence: "Validazione GPS",
  boost_turno: "Boost Turno",
  avvia_attivita: "Avvia Attività",
  completa_attivita: "Completa Attività",
  acquisti: "Acquisti Shop",
  ticket_qr: "Ticket QR (dev)",
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

export const MOBILE_VERCEL_FLAG_DEFINITIONS = buildVercelFlagDefinitionRecord(
  MOBILE_FEATURE_FLAG_KEYS,
  MOBILE_FEATURE_FLAG_DESCRIPTIONS,
  "mobile-runtime"
);

export type VercelFlagKey = MobileFeatureFlagKey;

export const VERCEL_FLAG_DEFINITIONS: Record<VercelFlagKey, VercelFlagDefinition> = {
  ...MOBILE_VERCEL_FLAG_DEFINITIONS,
};

export const VERCEL_FLAGS_DISCOVERY_RESPONSE = {
  overrideEncryptionMode: "encrypted",
  definitions: VERCEL_FLAG_DEFINITIONS,
} as const;
