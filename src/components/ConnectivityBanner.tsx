/* ============================================================
   ConnectivityBanner — shows when the browser goes offline.

   In Supabase mode, reads pause and any in-flight/queued writes are held by
   react-query (networkMode 'online') and resume automatically on reconnect, so
   the banner promises the retry. In Local Prototype mode there is no network —
   edits persist to localStorage — so the copy is honest about that instead.
   A fixed, non-layout-shifting status strip; never blocks interaction.
   ============================================================ */
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function ConnectivityBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  const message = isSupabaseConfigured
    ? 'Reconnecting — changes will retry when the connection returns.'
    : 'You’re offline — changes are saved to this browser.';

  return (
    <div
      role="status"
      data-testid="connectivity-banner"
      className="w-card center"
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        gap: 10,
        padding: '8px 14px',
        borderStyle: 'dashed',
        boxShadow: 'var(--sh-md)',
        fontSize: '.85rem',
        maxWidth: 'min(560px, 92vw)',
      }}
    >
      <span
        className="dot warn"
        aria-hidden="true"
        style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none' }}
      />
      {message}
    </div>
  );
}
