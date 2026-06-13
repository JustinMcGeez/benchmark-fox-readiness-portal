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
import { localClientsRepository, localRepository } from './localRepository';
import { supabaseClientsRepository, supabaseRepository } from './supabaseRepository';
import type { ClientDataRepository, ClientsRepository } from './types';

export type RepositoryMode = 'local' | 'supabase';

export interface RepositorySelection {
  mode: RepositoryMode;
  repository: ClientDataRepository;
  /** Clients + assignments repository for the same mode. */
  clients: ClientsRepository;
}

export function useRepository(): RepositorySelection {
  const auth = useOptionalAuth();
  const authed = Boolean(auth?.session);
  return useMemo<RepositorySelection>(
    () =>
      isSupabaseConfigured && authed
        ? { mode: 'supabase', repository: supabaseRepository, clients: supabaseClientsRepository }
        : { mode: 'local', repository: localRepository, clients: localClientsRepository },
    [authed],
  );
}

export type { ClientDataRepository, ClientsRepository } from './types';
export { RepositoryError, isRepositoryError } from './types';
