/* ============================================================================
   getBuildSha — the /health build identifier shown in Settings → Backend Status.
   Returns the 'dev' sentinel when VITE_BUILD_SHA is unset (local dev) and the
   short SHA when CI injects it.
   ============================================================================ */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBuildSha } from './backendConfig';

afterEach(() => vi.unstubAllEnvs());

describe('getBuildSha', () => {
  it("returns the 'dev' sentinel when VITE_BUILD_SHA is unset", () => {
    vi.stubEnv('VITE_BUILD_SHA', '');
    expect(getBuildSha()).toBe('dev');
  });

  it('returns the short (7-char) SHA when CI injects the full commit SHA', () => {
    vi.stubEnv('VITE_BUILD_SHA', '0123456789abcdef0123456789abcdef01234567');
    expect(getBuildSha()).toBe('0123456');
  });

  it('trims surrounding whitespace before slicing', () => {
    vi.stubEnv('VITE_BUILD_SHA', '  abcdef1234  ');
    expect(getBuildSha()).toBe('abcdef1');
  });
});
