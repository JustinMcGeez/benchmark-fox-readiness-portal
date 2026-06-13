/* ============================================================
   Repository selection seam.

   useRepository() chooses the backend:
     - Supabase env vars present AND a session is authenticated
       → supabaseRepository (cloud workspace).
     - otherwise → localRepository (Local Prototype mode).

   This is the single seam the data store consumes and that tests mock
   to force a mode. While auth is still restoring, mode stays 'local'
   (the ProtectedRoute loading screen covers that window; the mode
   flips to 'supabase' once the session resolves).
   ============================================================ */
import { useMemo } from 'react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useOptionalAuth } from '../../auth/AuthProvider';
import { localClientsRepository, localEvidenceRepository, localRepository } from './localRepository';
import {
  supabaseClientsRepository,
  supabaseEvidenceRepository,
  supabaseRepository,
} from './supabaseRepository';
import type { ClientDataRepository, ClientsRepository, EvidenceRepository } from './types';

export type RepositoryMode = 'local' | 'supabase';

export interface RepositorySelection {
  mode: RepositoryMode;
  repository: ClientDataRepository;
  /** Clients + assignments repository for the same mode. */
  clients: ClientsRepository;
  /** Evidence lifecycle repository for the same mode (Task 08). */
  evidence: EvidenceRepository;
}

export function useRepository(): RepositorySelection {
  const auth = useOptionalAuth();
  const authed = Boolean(auth?.session);
  return useMemo<RepositorySelection>(
    () =>
      isSupabaseConfigured && authed
        ? {
            mode: 'supabase',
            repository: supabaseRepository,
            clients: supabaseClientsRepository,
            evidence: supabaseEvidenceRepository,
          }
        : {
            mode: 'local',
            repository: localRepository,
            clients: localClientsRepository,
            evidence: localEvidenceRepository,
          },
    [authed],
  );
}

export type { ClientDataRepository, ClientsRepository, EvidenceRepository } from './types';
export { RepositoryError, isRepositoryError } from './types';
