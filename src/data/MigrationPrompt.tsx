/* ============================================================
   MigrationPrompt — one-time "import local demo edits to the cloud"
   offer, shown only in Supabase mode.

   Appears only when ALL hold: signed-in Supabase mode, the three
   reads have settled, this client has bf_* local edits, no prior
   import/discard decision (bf_migrated_v1), and the cloud workspace
   for this client is empty. Never migrates automatically — the user
   chooses Import or Discard. Import batches the upload and marks the
   client; Discard marks the client and leaves localStorage untouched.

   Rendered by the data store (not a screen), so it may use the
   repository helpers directly.
   ============================================================ */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Btn } from '../components/primitives';
import { RepositoryError } from './repository';
import { loadMigrationMarks, markMigrated, readLocalSnapshot } from './repository/localRepository';
import { hasRemoteClientData, importLocalData } from './repository/supabaseRepository';

export function MigrationPrompt({
  clientId,
  onError,
}: {
  clientId: string;
  onError: (message: string) => void;
}) {
  const qc = useQueryClient();
  const [snapshot] = useState(() => readLocalSnapshot(clientId));
  const [decided, setDecided] = useState(() => Boolean(loadMigrationMarks()[clientId]));
  const eligible = snapshot.hasAny && !decided;

  const remoteCheck = useQuery({
    queryKey: ['migration-check', clientId],
    queryFn: () => hasRemoteClientData(clientId),
    enabled: eligible,
  });

  const importMut = useMutation({
    mutationFn: () => importLocalData(clientId, snapshot),
    onSuccess: () => {
      markMigrated(clientId, 'imported');
      setDecided(true);
      void qc.invalidateQueries({ queryKey: ['assessments', clientId] });
      void qc.invalidateQueries({ queryKey: ['intake', clientId] });
      void qc.invalidateQueries({ queryKey: ['scope', clientId] });
    },
    onError: (e) =>
      onError(
        e instanceof RepositoryError
          ? e.message
          : 'Could not import your local edits to the cloud workspace. Please try again.',
      ),
  });

  // Show only once we know the cloud workspace is empty for this client.
  if (!eligible || remoteCheck.data !== false) return null;

  const onDiscard = () => {
    markMigrated(clientId, 'discarded');
    setDecided(true);
  };

  return (
    <div
      role="region"
      aria-label="Import local edits"
      className="w-card"
      style={{
        position: 'fixed',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px 10px 16px',
        borderStyle: 'dashed',
        boxShadow: 'var(--sh-md)',
        fontSize: '.85rem',
        maxWidth: 'min(620px, 92vw)',
      }}
    >
      <span className="dot warn" style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none' }} />
      <span style={{ flex: 1 }}>Import local demo edits to the cloud workspace?</span>
      <Btn sm primary onClick={() => importMut.mutate()} disabled={importMut.isPending}>
        {importMut.isPending ? 'Importing…' : 'Import'}
      </Btn>
      <Btn sm ghost onClick={onDiscard} disabled={importMut.isPending}>
        Discard
      </Btn>
    </div>
  );
}
