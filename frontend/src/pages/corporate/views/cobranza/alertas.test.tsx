import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type PortfolioCustomer } from '../../../../services/apiClient';
import { EMPTY_WORKSPACE, type CollectionWorkspace } from '../../../../services/collectionWorkspace';
import { CobranzaProvider, useCobranza } from './store';
import { useAlertas } from './alertas';

let state: CollectionWorkspace;
const customer: PortfolioCustomer = { id: 'cliente-prueba', externalId: null, name: 'Cliente de prueba', rfc: 'DEMO00000001', contact: null, email: null, phone: null, financeContactName: null, financeContactEmail: null, financeContactPhone: null, doNotContact: false, doNotContactReason: null, score: null, agent: null, pending: [{ id: 'factura-prueba', folio: 'PRUEBA-1', total: 100, currency: 'MXN', date: '2026-01-01T12:00:00Z', dueDate: '2026-01-02T12:00:00Z' }], history: [] };
beforeEach(() => {
  state = structuredClone(EMPTY_WORKSPACE);
  vi.spyOn(api, 'getPortfolio').mockResolvedValue([customer]);
  vi.spyOn(api, 'getUsers').mockResolvedValue([]);
  vi.spyOn(api, 'getWaPlanActivity').mockResolvedValue({ customers: [], testMode: true } as never);
  vi.spyOn(api, 'getLevelPlan').mockResolvedValue({ policy: null });
  vi.spyOn(api, 'getCollectionWorkspace').mockImplementation(async () => structuredClone(state));
  vi.spyOn(api, 'updateCollectionWorkspace').mockImplementation(async (patch) => { state = { ...state, ...patch, revision: state.revision + 1 }; return structuredClone(state); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Alertas atendidas y pospuestas', () => {
  it('persiste atender, posponer y reactivar; una causa distinta vuelve a pendientes', async () => {
    const hook = renderHook(() => ({ alerts: useAlertas(), store: useCobranza() }), { wrapper: CobranzaProvider });
    await waitFor(() => expect(hook.result.current.store.workspace.ready).toBe(true));
    await waitFor(() => expect(hook.result.current.alerts.vigentes.some((a) => a.id === 'sin-finanzas')).toBe(true));
    const alert = hook.result.current.alerts.vigentes.find((a) => a.id === 'sin-finanzas')!;
    act(() => hook.result.current.alerts.atender(alert));
    await waitFor(() => expect(hook.result.current.alerts.atendidas.some((a) => a.id === alert.id)).toBe(true));
    hook.unmount();
    const next = renderHook(() => ({ alerts: useAlertas(), store: useCobranza() }), { wrapper: CobranzaProvider });
    await waitFor(() => expect(next.result.current.alerts.atendidas.some((a) => a.id === alert.id)).toBe(true));
    act(() => next.result.current.alerts.reactivar(alert));
    await waitFor(() => expect(state.alertas[alert.id]).toBeUndefined());
    act(() => next.result.current.alerts.posponer(alert));
    await waitFor(() => expect(state.alertas[alert.id]?.hasta).toBeDefined());
    vi.mocked(api.getPortfolio).mockResolvedValue([{ ...customer, name: 'Cliente con otra causa' }]);
    await act(() => next.result.current.store.recargarCartera());
    expect(next.result.current.alerts.vigentes.some((a) => a.id === alert.id)).toBe(true);
  });

  it('mantiene la alerta pendiente si falla el guardado y no genera alertas de ejemplo con cartera vacía', async () => {
    vi.mocked(api.updateCollectionWorkspace).mockRejectedValue(new Error('Sin conexión'));
    const hook = renderHook(() => ({ alerts: useAlertas(), store: useCobranza() }), { wrapper: CobranzaProvider });
    await waitFor(() => expect(hook.result.current.store.workspace.ready).toBe(true));
    await waitFor(() => expect(hook.result.current.alerts.vigentes.some((a) => a.id === 'sin-finanzas')).toBe(true));
    const alert = hook.result.current.alerts.vigentes.find((a) => a.id === 'sin-finanzas')!;
    act(() => hook.result.current.alerts.atender(alert));
    await waitFor(() => expect(hook.result.current.store.workspace.error).toBe('Sin conexión'));
    expect(hook.result.current.alerts.vigentes.some((a) => a.id === alert.id)).toBe(true);
    vi.mocked(api.getPortfolio).mockResolvedValue([]);
    await act(() => hook.result.current.store.recargarCartera());
    expect(hook.result.current.alerts.vigentes).toEqual([]);
    expect(hook.result.current.store.campanas).toEqual([]);
    expect(hook.result.current.store.gestiones).toEqual([]);
    expect(hook.result.current.store.pagos).toEqual([]);
  });
});
