// Type declarations for Deno environment
declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  
  export const env: Env;
}

declare function serve(handler: (req: Request) => Promise<Response>): void;

// Module declarations for external imports
declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.48.0' {
  export interface SupabaseClient {
    auth: {
      getUser(token?: string): Promise<{ data: { user: any | null }; error: any }>;
    };
    from(table: string): any;
  }
  
  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export interface SupabaseClient {
    auth: {
      getUser(token?: string): Promise<{ data: { user: any | null }; error: any }>;
    };
    from(table: string): any;
  }
  
  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}
