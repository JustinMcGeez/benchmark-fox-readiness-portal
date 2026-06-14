/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — see .env.example. Optional during MVP (localStorage). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key — see .env.example. Optional during MVP. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Sentry DSN — enables error monitoring when set. Absent → monitoring off. */
  readonly VITE_SENTRY_DSN?: string;
  /** Git commit SHA of the build, injected by CI (deploy.yml / vercel.json).
      Shown in Settings → Backend Status. Absent in local dev → shows "dev". */
  readonly VITE_BUILD_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
