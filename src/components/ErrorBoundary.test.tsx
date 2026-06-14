/* ============================================================
   ErrorBoundary — containment + recovery.
   - app variant: branded fallback, Reload, copyable error id.
   - screen variant: recoverable panel ("Try again"), and auto-clears when the
     resetKey changes (route navigation) so a crashed screen recovers.
   React logs caught errors to console.error; we silence that for clean output.
   ============================================================ */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}
function Flaky({ crash }: { crash: boolean }) {
  if (crash) throw new Error('flaky');
  return <div>recovered content</div>;
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children unchanged when nothing throws', () => {
    render(
      <ErrorBoundary variant="screen">
        <div>safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('app variant shows the branded fallback with Reload + a copyable error id', () => {
    render(
      <ErrorBoundary variant="app">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByTestId('error-id').textContent).toMatch(/^[0-9A-F]{8}$/);
    expect(screen.getByRole('button', { name: 'Copy error ID' })).toBeInTheDocument();
  });

  it('screen variant offers Try again and recovers once the cause is gone', async () => {
    const { rerender } = render(
      <ErrorBoundary variant="screen">
        <Flaky crash />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This screen ran into a problem')).toBeInTheDocument();

    // The underlying issue is resolved; "Try again" re-renders the children.
    rerender(
      <ErrorBoundary variant="screen">
        <Flaky crash={false} />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('recovered content')).toBeInTheDocument();
  });

  it('auto-clears the caught error when resetKey changes (navigation)', () => {
    const { rerender } = render(
      <ErrorBoundary variant="screen" resetKey="/a">
        <Flaky crash />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This screen ran into a problem')).toBeInTheDocument();

    rerender(
      <ErrorBoundary variant="screen" resetKey="/b">
        <Flaky crash={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('recovered content')).toBeInTheDocument();
  });
});
