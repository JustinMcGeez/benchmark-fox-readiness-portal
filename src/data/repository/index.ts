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
import { localRepository } from './localRepository';
import { supabaseRepository } from './supabaseRepository';
import type { ClientDataRepository } from './types';

export type RepositoryMode = 'local' | 'supabase';

export interface RepositorySelection {
  mode: RepositoryMode;
  repository: ClientDataRepository;
}

export function useRepository(): RepositorySelection {
  const auth = useOptionalAuth();
  const authed = Boolean(auth?.session);
  return useMemo<RepositorySelection>(
    () =>
      isSupabaseConfigured && authed
        ? { mode: 'supabase', repository: supabaseRepository }
        : { mode: 'local', repository: localRepository },
    [authed],
  );
}

export type { ClientDataRepository } from './types';
export { RepositoryError, isRepositoryError } from './types';
