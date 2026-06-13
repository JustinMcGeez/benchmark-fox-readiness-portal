/* ============================================================
   MigrationPrompt tests — the one-time import offer.
   Verifies the show conditions, Import (one batched call + mark),
   Discard (mark, no call), and that a prior decision or existing
   cloud data keeps the prompt hidden.
   ============================================================ */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const supa = vi.hoisted(() => ({
  hasRemoteClientData: vi.fn(),
  importLocalData: vi.fn(),
}));
vi.mock('./repository/supabaseRepository', () => supa);

const { MigrationPrompt } = await import('./MigrationPrompt');
const { LS_ASSESS, LS_MIGRATED } = await import('./repository/localRepository');

const CLIENT = 'acme';
const onError = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const renderPrompt = () => render(<MigrationPrompt clientId={CLIENT} onError={onError} />, { wrapper });

/** Seed a local edit so readLocalSnapshot(clientId).hasAny is true. */
function seedLocalEdit() {
  localStorage.setItem(LS_ASSESS, JSON.stringify({ 'acme:3.1.1': { status: 'Not Met' } }));
}

beforeEach(() => {
  supa.hasRemoteClientData.mockReset();
  supa.importLocalData.mockReset();
  onError.mockReset();
});

describe('MigrationPrompt visibility', () => {
  it('shows when there are local edits and the cloud workspace is empty', async () => {
    seedLocalEdit();
    supa.hasRemoteClientData.mockResolvedValue(false);
    renderPrompt();
    expect(await screen.findByText('Import local demo edits to the cloud workspace?')).toBeInTheDocument();
  });

  it('stays hidden when there are no local edits', async () => {
    supa.hasRemoteClientData.mockResolvedValue(false);
    renderPrompt();
    await Promise.resolve();
    expect(screen.queryByText(/Import local demo edits/)).toBeNull();
    expect(supa.hasRemoteClientData).not.toHaveBeenCalled(); // query disabled when ineligible
  });

  it('stays hidden when the cloud workspace already has data', async () => {
    seedLocalEdit();
    supa.hasRemoteClientData.mockResolvedValue(true);
    renderPrompt();
    await waitFor(() => expect(supa.hasRemoteClientData).toHaveBeenCalled());
    expect(screen.queryByText(/Import local demo edits/)).toBeNull();
  });

  it('stays hidden when a prior decision was already recorded', async () => {
    seedLocalEdit();
    localStorage.setItem(LS_MIGRATED, JSON.stringify({ acme: 'discarded' }));
    supa.hasRemoteClientData.mockResolvedValue(false);
    renderPrompt();
    await Promise.resolve();
    expect(screen.queryByText(/Import local demo edits/)).toBeNull();
    expect(supa.hasRemoteClientData).not.toHaveBeenCalled();
  });
});

describe('MigrationPrompt actions', () => {
  it('Import imports once, marks the client, and hides the prompt', async () => {
    seedLocalEdit();
    supa.hasRemoteClientData.mockResolvedValue(false);
    supa.importLocalData.mockResolvedValue(undefined);
    renderPrompt();

    fireEvent.click(await screen.findByText('Import'));

    await waitFor(() => expect(screen.queryByText(/Import local demo edits/)).toBeNull());
    expect(supa.importLocalData).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(LS_MIGRATED)!)).toEqual({ acme: 'imported' });
    // localStorage edits are left intact
    expect(localStorage.getItem(LS_ASSESS)).not.toBeNull();
  });

  it('surfaces an error and keeps the prompt when the import fails', async () => {
    seedLocalEdit();
    supa.hasRemoteClientData.mockResolvedValue(false);
    supa.importLocalData.mockRejectedValue(new Error('boom'));
    renderPrompt();

    fireEvent.click(await screen.findByText('Import'));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(screen.getByText('Import local demo edits to the cloud workspace?')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(LS_MIGRATED) ?? 'null')).toBeNull(); // not marked
  });

  it('Discard marks the client without importing and hides the prompt', async () => {
    seedLocalEdit();
    supa.hasRemoteClientData.mockResolvedValue(false);
    renderPrompt();

    fireEvent.click(await screen.findByText('Discard'));

    await waitFor(() => expect(screen.queryByText(/Import local demo edits/)).toBeNull());
    expect(supa.importLocalData).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(LS_MIGRATED)!)).toEqual({ acme: 'discarded' });
  });
});
