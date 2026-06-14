/* ============================================================
   useOnlineStatus — subscribe to TanStack Query's onlineManager.

   onlineManager is the SAME singleton react-query uses to pause queries and
   mutations while offline (default networkMode: 'online'), so this hook and the
   data layer's pause/resume behavior always agree on connectivity. The default
   onlineManager listens to the browser's online/offline events.
   ============================================================ */
import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe((isOnline) => setOnline(isOnline)), []);
  return online;
}
