import { createClient } from "@supabase/supabase-js";
import { appConfig } from "./app-config";

const supabaseUrl = appConfig.supabase.url;
const supabaseAnonKey = appConfig.supabase.anonKey;

export const isSupabaseConfigured = appConfig.supabase.configured;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
