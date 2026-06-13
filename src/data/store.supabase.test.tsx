/* ============================================================
   Store tests — Supabase mode (repository mocked to force the
   TanStack Query engine). Covers the loading gate, resolved data,
   optimistic patch visible before the write resolves, rollback +
   dismissible error toast on failure, and Retry after a read error.
   ============================================================ */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientControlAssessment } from './types';
import { SEED_ASSESSMENTS } from './controls';
import { DEFAULT_INTAKE } from './intake';
import { DEFAULT_SCOPE } from './scope';
import { RepositoryError, type ClientDataRepository } from './repository';

/* ---- force supabase mode with a controllable repository ---- */
const holder = vi.hoisted(() => ({ repo: null as unknown as ClientDataRepository }));
vi.mock('./repository', async () => {
  const actual = await vi.importActual<typeof import('./repository')>('./repository');
  return { ...actual, useRepository: () => ({ mode: 'supabase', repository: holder.repo }) };
});

const { DataProvider, useData } = await import('./store');

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function seedWith(controlId: string, status: ClientControlAssessment['status']): ClientControlAssessment[] {
  return SEED_ASSESSMENTS.map((a) => (a.controlId === controlId ? { ...a, status } : a));
}

function makeRepo(): ClientDataRepository {
  return {
    getAssessments: vi.fn().mockResolvedValue(seedWith('3.1.1', 'Partial')),
    patchAssessment: vi.fn().mockResolvedValue(undefined),
    getIntake: vi.fn().mockResolvedValue(DEFAULT_INTAKE),
    saveIntake: vi.fn().mockResolvedValue(undefined),
    getScope: vi.fn().mockResolvedValue(DEFAULT_SCOPE),
    saveScope: vi.fn().mockResolvedValue(undefined),
  };
}

/* probe screen */
function Probe() {
  const { assessmentFor, updateAssessment } = useData();
  return (
    <div>
      <span data-testid="status">{assessmentFor('3.1.1')?.status}</span>
      <button onClick={() => updateAssessment('3.1.1', { status: 'Not Met' })}>patch</button>
    </div>
  );
}

const renderApp = () =>
  render(
    <DataProvider>
      <Probe />
    </DataProvider>,
  );

beforeEach(() => {
  holder.repo = makeRepo();
});

describe('supabase mode — loading + data', () => {
  it('shows the loading gate, then the children once reads resolve', async () => {
    renderApp();
    expect(screen.getByText('Loading workspace…')).toBeInTheDocument();
    expect(screen.queryByTestId('status')).toBeNull();

    await waitFor(() => expect(screen.getByTestId('status')).toBeInTheDocument());
    expect(screen.getByTestId('status')).toHaveTextContent('Partial'); // from the repository
  });
});

describe('supabase mode — optimistic patch', () => {
  it('reflects the patch immediately, before the write resolves', async () => {
    const d = deferred<void>();
    (holder.repo.patchAssessment as ReturnType<typeof vi.fn>).mockReturnValue(d.promise);
    renderApp();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Partial'));

    fireEvent.click(screen.getByText('patch'));
    // optimistic cache update is visible without the mutationFn having resolved
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Not Met'));
    d.resolve();
  });

  it('rolls back and shows a dismissible toast when the write fails', async () => {
    (holder.repo.patchAssessment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new RepositoryError('save-failed', 'Could not save your change to the cloud workspace.'),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Partial'));

    fireEvent.click(screen.getByText('patch'));

    // rolled back to the previous value
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Partial'));
    // and a toast is shown
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('Could not save your change');

    fireEvent.click(screen.getByLabelText('Dismiss'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('supabase mode — read error + retry', () => {
  it('shows the error panel and recovers after Retry', async () => {
    const getAssessments = holder.repo.getAssessments as ReturnType<typeof vi.fn>;
    getAssessments.mockRejectedValueOnce(new RepositoryError('load-failed', 'Could not load assessments.'));
    renderApp();

    await waitFor(() => expect(screen.getByText('Couldn’t load the workspace')).toBeInTheDocument());

    // next read succeeds
    getAssessments.mockResolvedValue(seedWith('3.1.1', 'Met'));
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Met'));
  });
});
