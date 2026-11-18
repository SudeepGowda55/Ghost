import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '@tryghost/admin-x-framework/errors';
import { useActiveLabelAutomations } from './use-active-label-automations';

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@tryghost/admin-x-framework/hooks', () => ({
  useFeatureFlag: () => true,
  useFetchApi: () => fetchApi,
}));

function renderLookup(enabled: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  return renderHook(() => useActiveLabelAutomations({ enabled }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

const notFound = () => new APIError(new Response(null, { status: 404 }));
const summary = { id: 'a', name: 'Guide', status: 'active' };

beforeEach(() => fetchApi.mockReset());

describe('Active label automation lookup', () => {
  it('does not request automations until enabled', () => {
    const { result } = renderLookup(false);
    expect(result.current).toMatchObject({ data: [], isLoading: false, isError: false });
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it.each(['missing browse endpoint', 'missing trigger rules', 'deleted after browse'])(
    'returns no references for %s',
    async (scenario) => {
      if (scenario === 'missing browse endpoint') {
        fetchApi.mockRejectedValueOnce(notFound());
      } else {
        fetchApi.mockResolvedValueOnce({ automations: [summary] });
        if (scenario === 'deleted after browse') {
          fetchApi.mockRejectedValueOnce(notFound());
        } else {
          fetchApi.mockResolvedValueOnce({ automations: [summary] });
        }
      }
      const { result } = renderLookup(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ data: [], isError: false });
    },
  );

  it('reports real lookup failures and retries with only active trigger references', async () => {
    fetchApi.mockRejectedValueOnce(new Error('Unavailable'));
    const { result } = renderLookup(true);
    await waitFor(() => expect(result.current.isError).toBe(true));

    fetchApi
      .mockResolvedValueOnce({ automations: [summary, { id: 'inactive', status: 'inactive' }] })
      .mockResolvedValueOnce({
        automations: [
          { ...summary, trigger_rules: [{ trigger_type: 'label_added', label_id: 'guide' }] },
        ],
      });
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.data).toEqual([{ id: 'a', name: 'Guide', labelIds: ['guide'] }]);
  });
});
