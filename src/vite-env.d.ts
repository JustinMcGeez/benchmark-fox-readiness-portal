/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — see .env.example. Optional during MVP (localStorage). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key — see .env.example. Optional during MVP. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Sentry DSN — enables error monitoring when set. Absent → monitoring off. */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
