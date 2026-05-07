import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { RoleId } from '../state/store';
import type { RoleStats } from '../gameplay/minigames';
import { registerScenes, type NarrativeScene } from '../gameplay/narrative';

export type GenerateSceneContext = {
  roleId: RoleId;
  stats: RoleStats;
  flags: string[];
  eventContext?: string;
};

export type GenerateSceneResult =
  | { ok: true; scene: NarrativeScene }
  | { ok: false; error: string };

/**
 * Ask Maxwell (via the generate-narrative-scene Edge Function) to create a
 * dynamic NarrativeScene tailored to the player's role and current stats.
 *
 * On success the scene is registered in the runtime scene registry so that
 * NarrativeScene.tsx can load it immediately with `loadScene(scene.id)`.
 *
 * Rewards are computed server-side using the balancing constants in
 * shared/config/balancing.ts and stored in the generated_narrative_scenes
 * table for audit/validation. The client receives the validated scene.
 */
export async function generateDynamicScene(
  context: GenerateSceneContext,
  accessToken: string,
): Promise<GenerateSceneResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { ok: false, error: 'Servizio non disponibile offline.' };
  }

  let data: unknown;
  let invokeError: unknown;

  try {
    const response = await supabase.functions.invoke('generate-narrative-scene', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        role_id:       context.roleId,
        stats:         context.stats,
        flags:         context.flags,
        event_context: context.eventContext,
      },
    });
    data = response.data;
    invokeError = response.error;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Errore di rete durante la generazione della missione.',
    };
  }

  if (invokeError) {
    const msg =
      invokeError instanceof Error
        ? invokeError.message
        : typeof invokeError === 'object' && invokeError !== null && 'message' in invokeError
          ? String((invokeError as { message: unknown }).message)
          : 'Errore durante la generazione della missione.';
    return { ok: false, error: msg };
  }

  const scene = (data as { scene?: NarrativeScene } | null)?.scene;
  if (!scene?.id || typeof scene.id !== 'string') {
    return { ok: false, error: 'Risposta non valida dal generatore di missioni.' };
  }

  // Register in the runtime scene registry so NarrativeScene.tsx can find it
  registerScenes([scene]);

  return { ok: true, scene };
}
