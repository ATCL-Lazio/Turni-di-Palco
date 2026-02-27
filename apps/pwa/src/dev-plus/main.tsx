import "../../../../shared/styles/main.css";
import "./dev-plus.css";

import type { Session } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { promptServiceWorkerUpdate } from "../pwa/sw-update";
import { registerServiceWorker } from "../pwa/register-sw";
import { isSupabaseConfigured, supabase } from "../services/supabase";
import {
  appConfig,
  clearStoredFeatureFlagOverrides,
  getRuntimeFeatureFlagBaseline,
  setStoredFeatureFlagOverride,
  setStoredFeatureFlagOverrides,
  type FeatureFlag,
  type FeatureFlagConfig,
} from "../services/app-config";
import {
  buildControlPlaneUrl,
  getRoleAdaptiveQuickActions,
  parseControlPlanePreset,
  type OpsQuickAction,
} from "../services/ops-sdk";
import { enforceDesktopOnly } from "../utils/desktop-only";
import {
  executeControlCommand,
  fetchCommandCatalog,
  fetchDashboardSnapshot,
  getControlPlaneEndpoint,
  prepareControlCommand,
  validateControlPlaneSession,
} from "./control-plane";
import type {
  AuditEntry,
  CommandCatalogEntry,
  CommandDraft,
  DashboardSnapshot,
  DbOperationStatus,
  MobileFeatureFlagEntry,
  PreparedCommand,
  RenderServiceStatus,
  SessionValidation,
} from "./types";

type AuthState = "checking" | "anonymous" | "authenticated";
type FeedbackTone = "info" | "ok" | "warn" | "error";

type FeedbackMessage = {
  tone: FeedbackTone;
  text: string;
};

type CommandPreset = {
  id: string;
  label: string;
  note: string;
  commandId: string;
  target?: string;
  reason: string;
  payload: Record<string, unknown>;
  dryRun?: boolean;
};

const DEFAULT_COMMAND_OPTIONS: CommandCatalogEntry[] = [
  {
    id: "render.services.health",
    label: "Stato servizi Render",
    description: "Legge salute servizi e stato rilascio.",
    requiredRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmation: false,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "render.deployments.list",
    label: "Elenco rilasci Render",
    description: "Mostra i rilasci recenti dei servizi.",
    requiredRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmation: false,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "render.deployments.trigger",
    label: "Avvia nuovo rilascio",
    description: "Avvia rilascio con conferma in due passaggi.",
    requiredRole: "dev_operator",
    riskLevel: "high",
    requiresConfirmation: true,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "supabase.db.read",
    label: "Lettura dati Supabase",
    description: "Legge dati con filtri sicuri.",
    requiredRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmation: false,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "supabase.events.cleanup",
    label: "Pulizia eventi vecchi",
    description: "Elimina eventi piÃ¹ vecchi della soglia giorni.",
    requiredRole: "dev_operator",
    riskLevel: "medium",
    requiresConfirmation: true,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "supabase.db.mutate",
    label: "Modifica dati Supabase",
    description: "Inserisce o aggiorna dati con regole di sicurezza.",
    requiredRole: "dev_admin",
    riskLevel: "high",
    requiresConfirmation: true,
    supportsDryRun: true,
    available: true,
  },
];

const DEFAULT_CONFIRM_TEXT = "CONFIRM";
const DEFAULT_PAYLOAD = '{\n  "scope": "default"\n}';
const DEFAULT_PRESET_REASON = "Controllo operativo pianificato da dashboard.";

const COMMAND_PRESETS: CommandPreset[] = [
  {
    id: "health-check",
    label: "Check servizi",
    note: "Stato rapido servizi Render",
    commandId: "render.services.health",
    target: "all",
    reason: "Verifica salute servizi prima del controllo giornaliero.",
    payload: { scope: "all" },
    dryRun: true,
  },
  {
    id: "deployments-last24h",
    label: "Ultimi rilasci",
    note: "Rilasci ultime 24 ore",
    commandId: "render.deployments.list",
    target: "all",
    reason: "Verifica storico rilasci per controllo versioni online.",
    payload: { windowHours: 24, includeStatus: true },
    dryRun: true,
  },
  {
    id: "db-read-events",
    label: "Leggi eventi",
    note: "Lettura tabella eventi",
    commandId: "supabase.db.read",
    target: "events",
    reason: "Controllo rapido record eventi da dashboard.",
    payload: { table: "events", limit: 20, orderBy: "created_at.desc" },
    dryRun: true,
  },
  {
    id: "cleanup-preview",
    label: "Pulizia eventi (preview)",
    note: "Simulazione pulizia dati storici",
    commandId: "supabase.events.cleanup",
    target: "events",
    reason: "Valutazione impatto pulizia eventi piu vecchi.",
    payload: { retentionDays: 90, scope: "stale-events" },
    dryRun: true,
  },
];

const MOBILE_FLAG_DEFAULTS: MobileFeatureFlagEntry[] = [
  { key: "mobile.section.turns", enabled: true, label: "Sezione Turni", description: "Mostra sezione turni e tab.", category: "section" },
  { key: "mobile.section.leaderboard", enabled: true, label: "Sezione Classifica", description: "Mostra sezione classifica e tab.", category: "section" },
  { key: "mobile.section.activities", enabled: true, label: "Sezione Attivita", description: "Mostra sezione attivita e tab.", category: "section" },
  { key: "mobile.section.shop", enabled: true, label: "Sezione Shop", description: "Mostra sezione shop e tab.", category: "section" },
  { key: "mobile.section.career", enabled: true, label: "Sezione Carriera", description: "Abilita schermata carriera.", category: "section" },
  { key: "mobile.section.earned_titles", enabled: true, label: "Sezione Titoli", description: "Abilita schermata titoli sbloccati.", category: "section" },
  { key: "mobile.action.qr_scan", enabled: true, label: "Azione Scansione QR", description: "Abilita scanner QR mobile.", category: "action" },
  { key: "mobile.action.turn_submit", enabled: true, label: "Azione Conferma Turno", description: "Abilita registrazione turni.", category: "action" },
  { key: "mobile.action.turn_boost", enabled: true, label: "Azione Boost Turno", description: "Abilita boost token su turno.", category: "action" },
  { key: "mobile.action.activity_start", enabled: true, label: "Azione Avvio Attivita", description: "Abilita avvio attivita.", category: "action" },
  { key: "mobile.action.activity_complete", enabled: true, label: "Azione Completamento Attivita", description: "Abilita completamento attivita.", category: "action" },
  { key: "mobile.action.shop_purchase", enabled: true, label: "Azione Acquisto Shop", description: "Abilita acquisti shop.", category: "action" },
];

const MOBILE_FLAG_FALLBACK_ENTRIES: MobileFeatureFlagEntry[] = MOBILE_FLAG_DEFAULTS.map((entry) => ({
  ...entry,
}));

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function parsePayloadInput(payloadText: string) {
  const trimmed = payloadText.trim();
  if (!trimmed) return { payload: undefined as Record<string, unknown> | undefined };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "I dati aggiuntivi devono essere un oggetto JSON." };
    }
    return { payload: parsed as Record<string, unknown> };
  } catch {
    return { error: "Formato JSON non valido nei dati aggiuntivi." };
  }
}

function normalizeRiskLabel(risk?: PreparedCommand["riskLevel"]) {
  if (!risk) return "risk-medium";
  return risk === "low" ? "risk-low" : risk === "high" ? "risk-high" : "risk-medium";
}

function toDisplayValue(value: number | undefined, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value}${suffix}`;
}

function toFeedbackClass(tone: FeedbackTone) {
  if (tone === "ok") return "feedback feedback-ok";
  if (tone === "warn") return "feedback feedback-warn";
  if (tone === "error") return "feedback feedback-error";
  return "feedback feedback-info";
}

function App() {
  const initialPreset = useMemo(
    () => parseControlPlanePreset(typeof window === "undefined" ? "" : window.location.search),
    []
  );

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [validation, setValidation] = useState<SessionValidation | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");

  const [catalog, setCatalog] = useState<CommandCatalogEntry[]>([]);

  const [commandValue, setCommandValue] = useState(initialPreset.commandId ?? DEFAULT_COMMAND_OPTIONS[0].id);
  const [targetValue, setTargetValue] = useState(initialPreset.target ?? "");
  const [reasonValue, setReasonValue] = useState(initialPreset.reason ?? "");
  const [payloadValue, setPayloadValue] = useState(
    initialPreset.payload ? JSON.stringify(initialPreset.payload, null, 2) : DEFAULT_PAYLOAD
  );
  const [dryRunValue, setDryRunValue] = useState(initialPreset.dryRun ?? true);
  const [preparedCommand, setPreparedCommand] = useState<PreparedCommand | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<FeedbackMessage>({
    tone: "info",
    text: "Pronto. Seleziona un'azione, controlla e poi conferma.",
  });
  const [mobileFlags, setMobileFlags] = useState<MobileFeatureFlagEntry[]>(MOBILE_FLAG_FALLBACK_ENTRIES);
  const [mobileFlagsBusy, setMobileFlagsBusy] = useState(false);
  const [mobileFlagsFeedback, setMobileFlagsFeedback] = useState<FeedbackMessage>({
    tone: "info",
    text: "Apri la sezione interruttori mobile per modificare le funzioni.",
  });
  const [pwaFlags, setPwaFlags] = useState<FeatureFlagConfig>(() => ({ ...appConfig.featureFlags }));
  const [pwaFlagsFeedback, setPwaFlagsFeedback] = useState<FeedbackMessage>({
    tone: "info",
    text: "Usa i toggle per attivare o disattivare le feature flags PWA.",
  });

  const controlPlaneEndpoint = getControlPlaneEndpoint();
  const pwaFlagBaseline = useMemo(() => getRuntimeFeatureFlagBaseline(), []);

  const commandOptions = useMemo(() => {
    const liveOptions = catalog.filter((entry) => entry.available);
    return liveOptions.length ? liveOptions : DEFAULT_COMMAND_OPTIONS;
  }, [catalog]);

  useEffect(() => {
    if (!commandOptions.some((entry) => entry.id === commandValue)) {
      setCommandValue(commandOptions[0]?.id ?? DEFAULT_COMMAND_OPTIONS[0].id);
    }
  }, [commandOptions, commandValue]);

  const roleActions = useMemo(() => getRoleAdaptiveQuickActions(validation?.roles), [validation?.roles]);

  const loadSnapshot = useCallback(
    async (activeSession: Session, validationState: SessionValidation | null) => {
      setSnapshotBusy(true);
      setSnapshotError("");
      const response = await fetchDashboardSnapshot(activeSession.access_token, validationState ?? undefined);
      setSnapshot(response);
      if (response.source.startsWith("fallback:")) {
        setSnapshotError(response.source);
      }
      setSnapshotBusy(false);
    },
    []
  );

  const loadCatalog = useCallback(async (activeSession: Session) => {
    const response = await fetchCommandCatalog(activeSession.access_token);
    if (!response.commands.length && response.error) {
      setCommandFeedback({ tone: "warn", text: response.error });
      return;
    }
    setCatalog(response.commands);
  }, []);

  const loadMobileFlags = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setMobileFlags(MOBILE_FLAG_FALLBACK_ENTRIES);
      setMobileFlagsFeedback({ tone: "warn", text: "Supabase non configurato: impossibile leggere le mobile feature flags." });
      return;
    }
    if (authState !== "authenticated") {
      setMobileFlags(MOBILE_FLAG_FALLBACK_ENTRIES);
      setMobileFlagsFeedback({ tone: "info", text: "Preset locali visibili. Effettua login per leggere e modificare lo stato reale." });
      return;
    }

    setMobileFlagsBusy(true);
    const { data, error } = await supabase
      .from("mobile_feature_flags")
      .select("key,enabled,label,description,category,updated_at,updated_by")
      .order("category", { ascending: true })
      .order("key", { ascending: true });
    setMobileFlagsBusy(false);

    if (error) {
      setMobileFlags(MOBILE_FLAG_FALLBACK_ENTRIES);
      setMobileFlagsFeedback({ tone: "error", text: error.message || "Lettura feature flags fallita." });
      return;
    }

    const next = (data ?? []).map((row) => ({
      key: String(row.key ?? ""),
      enabled: Boolean(row.enabled),
      label: String(row.label ?? row.key ?? ""),
      description: String(row.description ?? ""),
      category: String(row.category ?? ""),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
      updatedBy: typeof row.updated_by === "string" ? row.updated_by : null,
    }));

    if (!next.length) {
      setMobileFlags(MOBILE_FLAG_FALLBACK_ENTRIES);
      setMobileFlagsFeedback({
        tone: "warn",
        text: "Nessuna feature flag remota trovata: uso preset locali ON.",
      });
      return;
    }

    setMobileFlags(next);
    setMobileFlagsFeedback({ tone: "ok", text: `${next.length} feature flags mobile caricate.` });
  }, [authState]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState("anonymous");
      setAuthError("Supabase non configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const bootstrap = async () => {
      setAuthState("checking");
      setAuthError("");

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        setAuthState("anonymous");
        setAuthError(error.message);
        return;
      }

      if (!data.session) {
        setAuthState("anonymous");
        return;
      }

      const validationResult = await validateControlPlaneSession(data.session.access_token, controller.signal);
      if (cancelled) return;

      if (!validationResult.valid) {
        await supabase.auth.signOut();
        setAuthState("anonymous");
        setValidation(validationResult);
        setAuthError(validationResult.reason || "Sessione non autorizzata dal control-plane.");
        return;
      }

      setSession(data.session);
      setValidation(validationResult);
      setAuthState("authenticated");
      await Promise.all([loadSnapshot(data.session, validationResult), loadCatalog(data.session), loadMobileFlags()]);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadCatalog, loadMobileFlags, loadSnapshot]);

  const handleSignIn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!supabase || !isSupabaseConfigured) {
        setAuthError("Supabase non configurato.");
        return;
      }

      setAuthBusy(true);
      setAuthError("");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthBusy(false);
        setAuthError(error.message);
        return;
      }

      const activeSession = data.session ?? (await supabase.auth.getSession()).data.session;
      if (!activeSession) {
        setAuthBusy(false);
        setAuthError("Sessione non disponibile dopo il login.");
        return;
      }

      const validationResult = await validateControlPlaneSession(activeSession.access_token);
      if (!validationResult.valid) {
        await supabase.auth.signOut();
        setAuthBusy(false);
        setAuthState("anonymous");
        setValidation(validationResult);
        setAuthError(validationResult.reason || "Sessione rifiutata dal control-plane.");
        return;
      }

      setSession(activeSession);
      setValidation(validationResult);
      setAuthState("authenticated");
      setAuthBusy(false);
      await Promise.all([loadSnapshot(activeSession, validationResult), loadCatalog(activeSession), loadMobileFlags()]);
    },
    [email, loadCatalog, loadMobileFlags, loadSnapshot, password]
  );

  const handleSignOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setValidation(null);
    setSnapshot(null);
    setCatalog([]);
    setMobileFlags(MOBILE_FLAG_FALLBACK_ENTRIES);
    setAuthState("anonymous");
    setPassword("");
    setCommandFeedback({ tone: "info", text: "Sessione chiusa." });
    setMobileFlagsFeedback({ tone: "info", text: "Sessione chiusa." });
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!session) return;

    const validationResult = await validateControlPlaneSession(session.access_token);
    setValidation(validationResult);

    if (!validationResult.valid) {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setAuthState("anonymous");
      setSession(null);
      setSnapshot(null);
      setCatalog([]);
      setAuthError(validationResult.reason || "Sessione non valida.");
      return;
    }

    await Promise.all([loadSnapshot(session, validationResult), loadCatalog(session), loadMobileFlags()]);
  }, [loadCatalog, loadMobileFlags, loadSnapshot, session]);

  const handleToggleMobileFlag = useCallback(
    async (flag: MobileFeatureFlagEntry, enabled: boolean) => {
      if (!supabase || authState !== "authenticated") {
        setMobileFlagsFeedback({ tone: "error", text: "Sessione non valida per modificare le feature flags." });
        return;
      }
      setMobileFlagsBusy(true);
      const { error } = await supabase
        .from("mobile_feature_flags")
        .update({ enabled })
        .eq("key", flag.key);
      setMobileFlagsBusy(false);

      if (error) {
        setMobileFlagsFeedback({ tone: "error", text: error.message || "Aggiornamento flag fallito." });
        return;
      }

      setMobileFlagsFeedback({ tone: "ok", text: `Flag aggiornata: ${flag.key} -> ${enabled ? "ON" : "OFF"}` });
      await loadMobileFlags();
    },
    [authState, loadMobileFlags]
  );

  const handleBulkSetMobileFlags = useCallback(
    async (enabled: boolean) => {
      if (!supabase || authState !== "authenticated") {
        setMobileFlagsFeedback({ tone: "error", text: "Sessione non valida per modificare le feature flags." });
        return;
      }
      if (!mobileFlags.length) {
        setMobileFlagsFeedback({ tone: "warn", text: "Nessuna flag disponibile per bulk update." });
        return;
      }

      setMobileFlagsBusy(true);
      const keys = mobileFlags.map((entry) => entry.key);
      const { error } = await supabase
        .from("mobile_feature_flags")
        .update({ enabled })
        .in("key", keys);
      setMobileFlagsBusy(false);

      if (error) {
        setMobileFlagsFeedback({ tone: "error", text: error.message || "Bulk update feature flags fallito." });
        return;
      }

      setMobileFlagsFeedback({ tone: "ok", text: `Aggiornamento bulk completato: ${enabled ? "tutte ON" : "tutte OFF"}.` });
      await loadMobileFlags();
    },
    [authState, loadMobileFlags, mobileFlags]
  );

  const handleResetMobileFlags = useCallback(async () => {
    if (!supabase || authState !== "authenticated") {
      setMobileFlagsFeedback({ tone: "error", text: "Sessione non valida per il reset feature flags." });
      return;
    }

    setMobileFlagsBusy(true);
    const { error } = await supabase
      .from("mobile_feature_flags")
      .upsert(
        MOBILE_FLAG_DEFAULTS.map((entry) => ({
          key: entry.key,
          enabled: true,
          label: entry.label,
          description: entry.description,
          category: entry.category,
        })),
        { onConflict: "key" }
      );
    setMobileFlagsBusy(false);

    if (error) {
      setMobileFlagsFeedback({ tone: "error", text: error.message || "Reset feature flags fallito." });
      return;
    }

    setMobileFlagsFeedback({ tone: "ok", text: "Reset feature flags completato (seed ON)." });
    await loadMobileFlags();
  }, [authState, loadMobileFlags]);

  useEffect(() => {
    setPreparedCommand(null);
    setConfirmText("");
  }, [commandValue, dryRunValue, payloadValue, reasonValue, targetValue]);

  const buildDraft = useCallback((): { draft?: CommandDraft; error?: string } => {
    if (reasonValue.trim().length < 8) {
      return { error: "La reason deve contenere almeno 8 caratteri." };
    }

    const payloadResult = parsePayloadInput(payloadValue);
    if (payloadResult.error) {
      return { error: payloadResult.error };
    }

    return {
      draft: {
        commandId: commandValue,
        target: targetValue.trim(),
        reason: reasonValue.trim(),
        dryRun: dryRunValue,
        payload: payloadResult.payload,
      },
    };
  }, [commandValue, dryRunValue, payloadValue, reasonValue, targetValue]);

  const handlePrepareCommand = useCallback(async () => {
    if (!session) {
      setCommandFeedback({ tone: "error", text: "Sessione non valida. Effettua login." });
      return;
    }

    const { draft, error } = buildDraft();
    if (!draft || error) {
      setCommandFeedback({ tone: "error", text: error || "Draft non valido." });
      return;
    }

    setCommandBusy(true);
    setCommandFeedback({ tone: "info", text: "Step 1/2: preparo il comando..." });
    const response = await prepareControlCommand(draft, session.access_token);
    setCommandBusy(false);

    if (!response.prepared) {
      setCommandFeedback({ tone: "error", text: response.error || "Preparazione comando fallita." });
      return;
    }

    setPreparedCommand(response.prepared);
    setCommandFeedback({ tone: "ok", text: "Step 1/2 completato. Verifica preview e conferma step 2." });
  }, [buildDraft, session]);

  const handleExecuteCommand = useCallback(async () => {
    if (!session || !preparedCommand) {
      setCommandFeedback({ tone: "error", text: "Nessun comando preparato." });
      return;
    }

    const requiredText = preparedCommand.requiresConfirmText || DEFAULT_CONFIRM_TEXT;
    if (confirmText.trim() !== requiredText) {
      setCommandFeedback({
        tone: "warn",
        text: `Conferma non valida. Inserisci esattamente: ${requiredText}`,
      });
      return;
    }

    if (preparedCommand.requiresConfirmation && !preparedCommand.confirmationToken) {
      setCommandFeedback({
        tone: "error",
        text: "Token di conferma assente. Ripeti lo step di preparazione.",
      });
      return;
    }

    const { draft, error } = buildDraft();
    if (!draft || error) {
      setCommandFeedback({ tone: "error", text: error || "Draft comando non valido." });
      return;
    }

    setCommandBusy(true);
    setCommandFeedback({ tone: "info", text: "Step 2/2: esecuzione comando in corso..." });
    const response = await executeControlCommand(draft, preparedCommand, confirmText.trim(), session.access_token);
    setCommandBusy(false);

    if (!response.result) {
      setCommandFeedback({ tone: "error", text: response.error || "Esecuzione comando fallita." });
      return;
    }

    const tone: FeedbackTone =
      response.result.status === "failed" ? "error" : response.result.status === "accepted" ? "warn" : "ok";
    setCommandFeedback({ tone, text: response.result.message });
    setPreparedCommand(null);
    setConfirmText("");
    await handleRefresh();
  }, [buildDraft, confirmText, handleRefresh, preparedCommand, session]);

  const applyQuickAction = useCallback((action: OpsQuickAction) => {
    if (action.preset.view) {
      const section = document.getElementById(`section-${action.preset.view}`);
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action.preset.commandId) setCommandValue(action.preset.commandId);
    if (action.preset.target) setTargetValue(action.preset.target);
    if (action.preset.reason) setReasonValue(action.preset.reason);
    if (typeof action.preset.dryRun === "boolean") setDryRunValue(action.preset.dryRun);
    if (action.preset.payload) {
      setPayloadValue(JSON.stringify(action.preset.payload, null, 2));
    }
    setCommandFeedback({
      tone: "info",
      text: `Preset applicato: ${action.label}. Esegui Step 1/2 per preparare il comando.`,
    });
  }, []);

  const applyCommandPreset = useCallback((preset: CommandPreset) => {
    setCommandValue(preset.commandId);
    setTargetValue(preset.target ?? "");
    setReasonValue(preset.reason || DEFAULT_PRESET_REASON);
    setPayloadValue(JSON.stringify(preset.payload, null, 2));
    setDryRunValue(typeof preset.dryRun === "boolean" ? preset.dryRun : true);
    setPreparedCommand(null);
    setConfirmText("");
    setCommandFeedback({
      tone: "info",
      text: `Preset pronto: ${preset.label}. Esegui Step 1/2 per validare.`,
    });
  }, []);

  const handleTogglePwaFlag = useCallback((flag: FeatureFlag, enabled: boolean) => {
    setStoredFeatureFlagOverride(flag, enabled);
    setPwaFlags((prev) => ({ ...prev, [flag]: enabled }));
    setPwaFlagsFeedback({
      tone: "ok",
      text: `Flag aggiornata: ${flag} -> ${enabled ? "ON" : "OFF"}. Ricarica la pagina per applicarla ovunque.`,
    });
  }, []);

  const handleSetAllPwaFlags = useCallback((enabled: boolean) => {
    const keys = Object.keys(pwaFlags) as FeatureFlag[];
    const next = keys.reduce((acc, key) => {
      acc[key] = enabled;
      return acc;
    }, {} as FeatureFlagConfig);
    setStoredFeatureFlagOverrides(next);
    setPwaFlags(next);
    setPwaFlagsFeedback({
      tone: "ok",
      text: `Feature flags PWA impostate su ${enabled ? "ON" : "OFF"}. Ricarica la pagina per applicarle ovunque.`,
    });
  }, [pwaFlags]);

  const handleResetPwaFlags = useCallback(() => {
    clearStoredFeatureFlagOverrides();
    setPwaFlags({ ...pwaFlagBaseline });
    setPwaFlagsFeedback({
      tone: "info",
      text: "Override locali rimossi. Ripristinato il baseline runtime delle flags PWA.",
    });
  }, [pwaFlagBaseline]);

  const auditRows: AuditEntry[] = snapshot?.audit ?? [];
  const renderRows: RenderServiceStatus[] = snapshot?.renderServices ?? [];
  const dbRows: DbOperationStatus[] = snapshot?.dbOperations ?? [];
  const currentUser = session?.user?.email || "anonymous";
  const pwaFeatureFlags = Object.entries(pwaFlags) as [FeatureFlag, boolean][];

  return (
    <main className="cp-shell">
      <header className="cp-card cp-header">
        <div>
          <p className="cp-kicker">Turni di Palco</p>
          <h1>Dashboard comandi semplice</h1>
          <p className="cp-muted">Una pagina, flusso lineare, preset pronti.</p>
        </div>
        <div className="cp-links">
          <a href="/">Dashboard</a>
          <a href="/mobile/">Mobile</a>
          <a href={buildControlPlaneUrl({ view: "commands", source: "header" })}>Comandi</a>
        </div>
      </header>

      <section className="cp-card cp-auth">
        <h2>Accesso</h2>

        {!isSupabaseConfigured ? (
          <p className="cp-feedback cp-feedback-error">
            Supabase non configurato. Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        ) : null}

        {authState === "checking" ? <p className="cp-feedback cp-feedback-info">Controllo sessione in corso...</p> : null}

        {authState !== "authenticated" && isSupabaseConfigured ? (
          <form className="cp-login" onSubmit={handleSignIn}>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit" disabled={authBusy}>{authBusy ? "Accesso in corso..." : "Accedi"}</button>
          </form>
        ) : null}

        {authState === "authenticated" ? (
          <div className="cp-session">
            <p>
              Sessione: <strong>{currentUser}</strong>
            </p>
            <p>
              Verificata: <strong>{formatDateTime(validation?.validatedAt)}</strong>
            </p>
            <div className="cp-inline-actions">
              <button type="button" onClick={handleRefresh} disabled={snapshotBusy}>
                {snapshotBusy ? "Sync..." : "Aggiorna tutto"}
              </button>
              <button type="button" className="ghost" onClick={handleSignOut}>
                Logout
              </button>
            </div>
          </div>
        ) : null}

        {validation?.roles?.length ? <p className="cp-muted">Ruoli: {validation.roles.join(", ")}</p> : null}
        {authError ? <p className="cp-feedback cp-feedback-error">{authError}</p> : null}
      </section>

      <section className="cp-grid cp-grid-2">
        <article className="cp-card">
          <h2>Feature flags PWA</h2>
          <div className="cp-inline-actions">
            <button type="button" onClick={() => handleSetAllPwaFlags(true)}>
              Tutte ON
            </button>
            <button type="button" className="ghost" onClick={() => handleSetAllPwaFlags(false)}>
              Tutte OFF
            </button>
            <button type="button" className="ghost" onClick={handleResetPwaFlags}>
              Reset
            </button>
          </div>
          <p className={toFeedbackClass(pwaFlagsFeedback.tone)}>{pwaFlagsFeedback.text}</p>
          <div className="cp-flag-list">
            {pwaFeatureFlags.map(([flagKey, enabled]) => (
              <article key={flagKey} className="cp-flag-item">
                <div>
                  <p>
                    <strong>{flagKey}</strong>
                  </p>
                </div>
                <div className="cp-inline-actions">
                  <span className={enabled ? "cp-on" : "cp-off"}>{enabled ? "ON" : "OFF"}</span>
                  <button type="button" onClick={() => handleTogglePwaFlag(flagKey, !enabled)}>
                    {enabled ? "Disattiva" : "Attiva"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="cp-card">
          <h2>Preset rapidi</h2>
          <div className="cp-preset-grid">
            {roleActions.map((action) => (
              <button key={action.id} type="button" className="cp-preset-button" onClick={() => applyQuickAction(action)}>
                <strong>{action.label}</strong>
                <small>{action.note}</small>
              </button>
            ))}
            {COMMAND_PRESETS.map((preset) => (
              <button key={preset.id} type="button" className="cp-preset-button" onClick={() => applyCommandPreset(preset)}>
                <strong>{preset.label}</strong>
                <small>{preset.note}</small>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="cp-card" id="section-commands">
        <h2>Comando guidato</h2>
        <p className="cp-muted">Compila i campi, poi usa Step 1 e Step 2.</p>

        <div className="cp-command-grid">
          <label>
            <span>Azione</span>
            <select value={commandValue} onChange={(event) => setCommandValue(event.target.value)}>
              {commandOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Target (opzionale)</span>
            <input
              type="text"
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
              placeholder="es. servizio o tabella"
            />
          </label>

          <label className="cp-full-row">
            <span>Motivo</span>
            <textarea value={reasonValue} onChange={(event) => setReasonValue(event.target.value)} rows={3} />
          </label>

          <label className="cp-full-row">
            <span>Dati aggiuntivi (JSON)</span>
            <textarea value={payloadValue} onChange={(event) => setPayloadValue(event.target.value)} rows={7} spellCheck={false} />
          </label>

          <label className="cp-checkbox cp-full-row">
            <input type="checkbox" checked={dryRunValue} onChange={(event) => setDryRunValue(event.target.checked)} />
            <span>Simulazione attiva (nessuna modifica reale)</span>
          </label>
        </div>

        <div className="cp-inline-actions">
          <button type="button" onClick={handlePrepareCommand} disabled={commandBusy || authState !== "authenticated"}>
            1) Prepara comando
          </button>
        </div>

        {preparedCommand ? (
          <article className="cp-review">
            <p>
              <strong>Summary:</strong> {preparedCommand.summary}
            </p>
            <p>
              <strong>Rischio:</strong> {preparedCommand.riskLevel || "medio"}
            </p>
            <p>
              <strong>Comando:</strong> <code>{preparedCommand.commandId}</code>
            </p>

            {preparedCommand.preview?.length ? (
              <ul className="cp-list cp-list-plain">
                {preparedCommand.preview.map((item, index) => (
                  <li key={`${preparedCommand.commandId}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}

            <label>
              <span>
                2) Digita <code>{preparedCommand.requiresConfirmText || DEFAULT_CONFIRM_TEXT}</code> per confermare
              </span>
              <input type="text" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} />
            </label>

            <button type="button" onClick={handleExecuteCommand} disabled={commandBusy || authState !== "authenticated"}>
              2) Conferma ed esegui
            </button>
          </article>
        ) : null}

        <p className={toFeedbackClass(commandFeedback.tone)}>{commandFeedback.text}</p>
      </section>

      <section className="cp-card" id="section-mobile-flags">
        <h2>Feature flags mobile</h2>

        <div className="cp-inline-actions">
          <button type="button" onClick={() => void loadMobileFlags()} disabled={mobileFlagsBusy || authState !== "authenticated"}>
            {mobileFlagsBusy ? "Sync..." : "Ricarica"}
          </button>
          <button type="button" onClick={() => void handleBulkSetMobileFlags(true)} disabled={mobileFlagsBusy || authState !== "authenticated"}>
            Tutte ON
          </button>
          <button type="button" className="ghost" onClick={() => void handleBulkSetMobileFlags(false)} disabled={mobileFlagsBusy || authState !== "authenticated"}>
            Tutte OFF
          </button>
          <button type="button" className="ghost" onClick={() => void handleResetMobileFlags()} disabled={mobileFlagsBusy || authState !== "authenticated"}>
            Reset default
          </button>
        </div>

        <p className={toFeedbackClass(mobileFlagsFeedback.tone)}>{mobileFlagsFeedback.text}</p>

        {mobileFlags.length ? (
          <div className="cp-flag-list">
            {mobileFlags.map((flag) => (
              <article key={flag.key} className="cp-flag-item">
                <div>
                  <p>
                    <strong>{flag.label}</strong>
                  </p>
                  <p className="cp-muted">
                    <code>{flag.key}</code> | {flag.category}
                  </p>
                </div>
                <div className="cp-inline-actions">
                  <span className={flag.enabled ? "cp-on" : "cp-off"}>{flag.enabled ? "ON" : "OFF"}</span>
                  <button type="button" onClick={() => void handleToggleMobileFlag(flag, !flag.enabled)} disabled={mobileFlagsBusy || authState !== "authenticated"}>
                    {flag.enabled ? "Disattiva" : "Attiva"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="cp-feedback cp-feedback-info">Nessuna mobile flag disponibile.</p>
        )}
      </section>

      <section className="cp-grid cp-grid-3">
        <article className="cp-card" id="section-render">
          <h2>Rilasci</h2>
          <ul className="cp-list cp-list-plain">
            {renderRows.length ? (
              renderRows.slice(0, 12).map((service) => (
                <li key={service.id}>
                  <strong>{service.name}</strong> - {service.status} - {service.environment}
                </li>
              ))
            ) : (
              <li>Nessun dato disponibile.</li>
            )}
          </ul>
        </article>

        <article className="cp-card" id="section-audit">
          <h2>Registro</h2>
          <ul className="cp-list cp-list-plain">
            {auditRows.length ? (
              auditRows.slice(0, 12).map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.action}</strong> ({entry.result}) - {formatDateTime(entry.at)}
                </li>
              ))
            ) : (
              <li>Nessun dato disponibile.</li>
            )}
          </ul>
        </article>

        <article className="cp-card" id="section-db">
          <h2>Database</h2>
          <ul className="cp-list cp-list-plain">
            {dbRows.length ? (
              dbRows.slice(0, 12).map((operation) => (
                <li key={operation.id}>
                  <strong>{operation.operation}</strong> - {operation.status} - {operation.target}
                </li>
              ))
            ) : (
              <li>Nessun dato disponibile.</li>
            )}
          </ul>
        </article>
      </section>

      {snapshotError ? <p className="cp-feedback cp-feedback-warn">{snapshotError}</p> : null}

      <footer className="cp-card cp-footer">
        <p>
          Last refresh: <strong>{snapshot ? formatDateTime(snapshot.refreshedAt) : "-"}</strong>
        </p>
        <p>
          Data source: <code>{snapshot?.source || controlPlaneEndpoint}</code>
        </p>
      </footer>
    </main>
  );
}

const start = () => {
  if (enforceDesktopOnly()) return;

  const rootElement = document.querySelector<HTMLDivElement>("#app");
  if (!rootElement) {
    throw new Error("Root container missing");
  }

  const root = createRoot(rootElement);
  root.render(<App />);

  registerServiceWorker({
    onReady: () => undefined,
    onUpdate: (registration) => {
      promptServiceWorkerUpdate(registration);
    },
    onError: (error) => {
      console.error("Service worker registration failed", error);
    },
  });
};

start();


