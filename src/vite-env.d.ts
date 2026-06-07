/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — see .env.example. Optional during MVP (localStorage). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key — see .env.example. Optional during MVP. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
