/* ============================================================
   Demo client id mapping — bridges the seed client ids ('acme', …)
   to Supabase `clients.id` uuids until Task 07 makes clients real
   (DB-backed list, uuid route ids). Real uuids pass straight through.

   The fixed uuid below is what scripts/seed-demo-client.ts inserts
   (npm run db:seed:demo). Never change it once seeded.
   ============================================================ */
import { RepositoryError } from './types';

/** Fixed uuid for the demo engagement row created by db:seed:demo. */
export const DEMO_CLIENT_UUIDS: Record<string, string> = {
  acme: 'ac3e0000-0000-4000-8000-000000000001',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resolve a domain clientId to the Supabase `clients.id` uuid.
 * Synchronous: uuids pass through; known demo ids map; anything else
 * is a typed error (no DB round-trip, no name matching).
 */
export function resolveClientUuid(clientId: string): string {
  if (isUuid(clientId)) return clientId;
  const mapped = DEMO_CLIENT_UUIDS[clientId];
  if (mapped) return mapped;
  throw new RepositoryError(
    'unknown-client',
    'This client does not exist in the cloud workspace yet.',
  );
}
