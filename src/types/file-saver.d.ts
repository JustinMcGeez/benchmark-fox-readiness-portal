/* ============================================================================
   Minimal ambient types for `file-saver` (Task 09).

   file-saver ships no types and @types/file-saver is NOT an authorized
   dependency, so we declare only the single API we use: saveAs(blob, name).
   Keep this surface tiny — it is a type shim, not a re-implementation.
   ============================================================================ */
declare module 'file-saver' {
  /** Trigger a client-side download of `data` as `filename`. */
  export function saveAs(data: Blob, filename?: string): void;
}
