import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type ApiUserRow, type PortfolioCustomer } from '../../../../services/apiClient';
import { EQUIPO_ACTUALIZADO } from './equipo';
import { CobranzaProvider, useCobranza } from './store';

function usuario(id: string, changes: Partial<ApiUserRow> = {}): ApiUserRow {
  return {
    id,
    email: `${id}@equipo.invalid`,
    name: id,
    role: 'CORPORATE_USER',
    operationalProfile: 'AGENTE_EJECUTIVO',
    isActive: true,
    status: 'ACTIVE',
    permissions: ['cxc'],
    lastLoginAt: null,
    createdAt: '2026-11-18T16:00:00Z',
    ...changes,
  };
}

function cliente(id: string, agentId: string): PortfolioCustomer {
  return {
    id, externalId: null, name: `Cliente de prueba ${id}`, rfc: 'DEMO00000001',
    contact: null, email: null, phone: null, financeContactName: null,
    financeContactEmail: null, financeContactPhone: null, doNotContact: false,
    doNotContactReason: null, score: null, agent: { id: agentId, name: agentId },
    pending: [], history: [],
  };
}

beforeEach(() => {
  vi.spyOn(api, 'getPortfolio').mockResolvedValue([]);
  vi.spyOn(api, 'getWaPlanActivity').mockResolvedValue({ customers: [], testMode: true } as never);
  vi.spyOn(api, 'getLevelPlan').mockResolvedValue({ policy: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('agentesReales', () => {
  it('incluye perfiles de agente sin exigir rol corporativo y excluye siempre superadministradores y proveedores', async () => {
    vi.mocked(api.getPortfolio).mockResolvedValue([cliente('c1', 'superadmin'), cliente('c2', 'proveedor')]);
    vi.spyOn(api, 'getUsers').mockResolvedValue([
      usuario('agente-activo'),
      usuario('agente-deshabilitado', { isActive: false, status: 'DISABLED' }),
      usuario('agente-invitado', { status: 'INVITED' }),
      usuario('admin', { role: 'CORPORATE_ADMIN' }),
      usuario('superadmin', { role: 'SUPERADMIN' }),
      usuario('proveedor', { role: 'PROVIDER' }),
      usuario('supervisor', { operationalProfile: 'SUPERVISOR_GERENTE' }),
      usuario('sin-perfil', { operationalProfile: null }),
    ]);
    const hook = renderHook(() => useCobranza(), { wrapper: CobranzaProvider });
    await waitFor(() => expect(hook.result.current.agentesReales).toEqual([
      { id: 'agente-activo', nombre: 'agente-activo', activo: true },
      { id: 'agente-deshabilitado', nombre: 'agente-deshabilitado', activo: false },
      { id: 'agente-invitado', nombre: 'agente-invitado', activo: false },
      { id: 'admin', nombre: 'admin', activo: true },
    ]));
  });

  it('incluye al administrador con clientes asignados y excluye al administrador sin clientes ni perfil de agente', async () => {
    vi.spyOn(api, 'getUsers').mockResolvedValue([
      usuario('admin-con-clientes', { role: 'CORPORATE_ADMIN', operationalProfile: null }),
      usuario('admin-sin-clientes', { role: 'CORPORATE_ADMIN', operationalProfile: null }),
      usuario('sin-perfil-con-clientes', { operationalProfile: null }),
      usuario('supervisor-con-clientes', { operationalProfile: 'SUPERVISOR_GERENTE' }),
    ]);
    vi.mocked(api.getPortfolio).mockResolvedValue([
      cliente('c1', 'admin-con-clientes'), cliente('c2', 'sin-perfil-con-clientes'),
      cliente('c3', 'supervisor-con-clientes'),
    ]);
    const hook = renderHook(() => useCobranza(), { wrapper: CobranzaProvider });
    await waitFor(() => expect(hook.result.current.agentesReales).toEqual([
      { id: 'admin-con-clientes', nombre: 'admin-con-clientes', activo: true },
      { id: 'sin-perfil-con-clientes', nombre: 'sin-perfil-con-clientes', activo: true },
      { id: 'supervisor-con-clientes', nombre: 'supervisor-con-clientes', activo: true },
    ]));
  });

  it('reaplica el filtro al refrescar el equipo después de cambiar un perfil', async () => {
    vi.spyOn(api, 'getUsers').mockResolvedValueOnce([usuario('agente')])
      .mockResolvedValue([usuario('agente', { operationalProfile: 'SUPERVISOR_GERENTE' })]);
    const hook = renderHook(() => useCobranza(), { wrapper: CobranzaProvider });
    await waitFor(() => expect(hook.result.current.agentesReales).toHaveLength(1));
    act(() => window.dispatchEvent(new Event(EQUIPO_ACTUALIZADO)));
    await waitFor(() => expect(hook.result.current.agentesReales).toEqual([]));
  });

  it('no pierde a un usuario que cambia de perfil mientras conserva sus clientes', async () => {
    vi.spyOn(api, 'getUsers').mockResolvedValueOnce([usuario('responsable')])
      .mockResolvedValue([usuario('responsable', { role: 'CORPORATE_ADMIN', operationalProfile: null })]);
    vi.mocked(api.getPortfolio).mockResolvedValue([cliente('c1', 'responsable')]);
    const hook = renderHook(() => useCobranza(), { wrapper: CobranzaProvider });
    await waitFor(() => expect(hook.result.current.agentesReales).toHaveLength(1));
    act(() => window.dispatchEvent(new Event(EQUIPO_ACTUALIZADO)));
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledTimes(2));
    expect(hook.result.current.agentesReales).toEqual([{ id: 'responsable', nombre: 'responsable', activo: true }]);
  });

  it('recalcula los responsables cuando se actualizan las asignaciones de la cartera', async () => {
    const users = vi.spyOn(api, 'getUsers').mockResolvedValue([usuario('admin', { role: 'CORPORATE_ADMIN', operationalProfile: null })]);
    vi.mocked(api.getPortfolio).mockResolvedValueOnce([cliente('c1', 'admin')]).mockResolvedValue([]);
    const hook = renderHook(() => useCobranza(), { wrapper: CobranzaProvider });
    await waitFor(() => expect(hook.result.current.agentesReales).toHaveLength(1));
    await act(() => hook.result.current.recargarCartera());
    await waitFor(() => expect(hook.result.current.agentesReales).toEqual([]));
    expect(users).toHaveBeenCalledTimes(1);
  });

  it('espera la cartera antes de filtrar para no omitir asignaciones que aún están cargando', async () => {
    vi.spyOn(api, 'getUsers').mockResolvedValue([usuario('admin', { role: 'CORPORATE_ADMIN', operationalProfile: null })]);
    let cargar!: (rows: PortfolioCustomer[]) => void;
    vi.mocked(api.getPortfolio).mockImplementation(() => new Promise((resolve) => { cargar = resolve; }));
    const hook = renderHook(() => useCobranza(), { wrapper: CobranzaProvider });
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledTimes(1));
    expect(hook.result.current.agentesReales).toBeNull();
    await act(async () => cargar([cliente('c1', 'admin')]));
    await waitFor(() => expect(hook.result.current.agentesReales).toEqual([{ id: 'admin', nombre: 'admin', activo: true }]));
  });
});
