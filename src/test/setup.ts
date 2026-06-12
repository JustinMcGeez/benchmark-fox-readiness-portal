/* ============================================================
   Vitest setup — registers @testing-library/jest-dom matchers and
   resets DOM + localStorage between tests so persistence tests are
   isolated from each other.
   ============================================================ */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom does not implement ResizeObserver (used by TweaksPanel).
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub;
