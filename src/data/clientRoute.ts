/* ============================================================
   clientRoute.ts — pure path → clientId helper shared by the router
   (routes.tsx) and the App's CurrentClientGate (App.tsx).

   Kept in a tiny standalone module so both can import it without a
   cycle (routes.tsx imports useData from data/store; data/store would
   otherwise have to import from routes.tsx). No seed validation here —
   the route's <ClientScope> guard validates the id against the live
   clients list; this only extracts the segment.
   ============================================================ */
import { matchPath } from 'react-router-dom';

/**
 * The `:clientId` of a `/clients/:clientId(/...)` route, or null when the path
 * is not client-scoped. `/clients/new` (the create-client screen) is NOT a
 * client id, so it returns null too.
 */
export function clientIdFromPathname(pathname: string): string | null {
  const m =
    matchPath('/clients/:clientId/*', pathname) ?? matchPath('/clients/:clientId', pathname);
  const id = m?.params.clientId;
  if (!id || id === 'new') return null;
  return id;
}
