/* ============================================================
   Demo engagement ids — the single source of truth shared by the
   app (clientIds.ts) and the server-side seed script
   (scripts/seed-demo-client.ts).

   Kept import-free on purpose so the Node seed script can load it
   directly via type-stripping (no extensionless relative imports to
   resolve). Bridges seed client ids ('acme', …) to fixed Supabase
   clients.id uuids until Task 07 makes clients first-class.
   ============================================================ */

/** Fixed uuid for the demo engagement row created by db:seed:demo. */
export const DEMO_CLIENT_UUIDS: Record<string, string> = {
  acme: 'ac3e0000-0000-4000-8000-000000000001',
};
