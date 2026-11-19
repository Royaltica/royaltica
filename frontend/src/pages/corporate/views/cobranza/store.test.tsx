import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type ApiUserRow } from '../../../../services/apiClient';
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

beforeEach(() => {
  vi.spyOn(api, 'getPortfolio').mockResolvedValue([]);
  vi.spyOn(api, 'getWaPlanActivity').mockResolvedValue({ customers: [], testMode: true } as never);
  vi.spyOn(api, 'getLevelPlan').mockResolvedValue({ policy: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('agentesReales', () => {
  it('incluye solo usuarios corporativos con perfil de agente y conserva su estado real', async () => {
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
});
