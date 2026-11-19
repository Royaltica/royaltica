import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, type ApiUserRow, type PortfolioCustomer } from '../../../../services/apiClient';
import { actualizarEquipo, perfilDeRol, personaDesdeUsuario, quitarUsuario, useEquipo } from './equipo';

const user: ApiUserRow = { id: 'usuario-1', email: 'agente@equipo.invalid', name: 'Agente de prueba', role: 'CORPORATE_USER', status: 'ACTIVE', isActive: true, operationalProfile: 'AGENTE_EJECUTIVO', permissions: ['cxc'], lastLoginAt: null, createdAt: '2026-11-18T16:00:00Z' };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Equipo real', () => {
  it('refleja el estado del servidor y conserva los usuarios sin perfil', () => {
    expect(personaDesdeUsuario(user)).toMatchObject({ rol: 'agente', estado: 'activo' });
    expect(personaDesdeUsuario({ ...user, isActive: false })).toMatchObject({ estado: 'inactivo' });
    expect(personaDesdeUsuario({ ...user, operationalProfile: null, status: 'INVITED' })).toMatchObject({ rol: 'sinPerfil', estado: 'invitado', ultimo: undefined });
    expect(perfilDeRol('supervisor')).toMatchObject({ role: 'CORPORATE_USER', operationalProfile: 'SUPERVISOR_GERENTE' });
  });

  it('carga usuarios y refresca las listas tras un cambio confirmado', async () => {
    const get = vi.spyOn(api, 'getUsers').mockResolvedValueOnce([user]).mockResolvedValue([]);
    const hook = renderHook(() => useEquipo());
    await waitFor(() => expect(hook.result.current.equipo?.[0].id).toBe(user.id));
    act(() => actualizarEquipo());
    await waitFor(() => expect(hook.result.current.equipo).toEqual([]));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('no inventa usuarios cuando falla la carga', async () => {
    vi.spyOn(api, 'getUsers').mockRejectedValue(new Error('No hay conexión'));
    const hook = renderHook(() => useEquipo());
    await waitFor(() => expect(hook.result.current.error).toBe('No hay conexión'));
    expect(hook.result.current.equipo).toBeNull();
  });

  it('una respuesta anterior no restaura un usuario eliminado después de refrescar', async () => {
    let terminar!: (users: ApiUserRow[]) => void;
    vi.spyOn(api, 'getUsers').mockImplementationOnce(() => new Promise((resolve) => { terminar = resolve; })).mockResolvedValue([]);
    const hook = renderHook(() => useEquipo());
    act(() => actualizarEquipo());
    await waitFor(() => expect(hook.result.current.equipo).toEqual([]));
    await act(async () => terminar([user]));
    expect(hook.result.current.equipo).toEqual([]);
  });

  it('reasigna por identificador, elimina el acceso y no confunde nombres repetidos', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue([
      { id: 'cliente-1', agent: { id: user.id, name: user.name } },
      { id: 'cliente-2', agent: { id: 'otro-id', name: user.name } },
    ] as PortfolioCustomer[]);
    const update = vi.spyOn(api, 'updateCustomer').mockResolvedValue({} as never);
    const remove = vi.spyOn(api, 'deleteUser').mockResolvedValue({ deleted: true, id: user.id });
    await quitarUsuario(user.id, 'destino-1');
    expect(update).toHaveBeenCalledExactlyOnceWith('cliente-1', { assignedAgentId: 'destino-1' });
    expect(remove).toHaveBeenCalledExactlyOnceWith(user.id);
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });

  it('no elimina al usuario si falla una reasignación', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue([{ id: 'cliente-1', agent: { id: user.id, name: user.name } }] as PortfolioCustomer[]);
    vi.spyOn(api, 'updateCustomer').mockRejectedValue(new Error('No se pudo reasignar'));
    const remove = vi.spyOn(api, 'deleteUser');
    await expect(quitarUsuario(user.id, 'destino-1')).rejects.toThrow('No se pudo reasignar');
    expect(remove).not.toHaveBeenCalled();
  });

  it('exige destino si hay clientes y bloquea la eliminación si no se puede consultar la cartera', async () => {
    const portfolio = vi.spyOn(api, 'getPortfolio').mockResolvedValue([{ id: 'cliente-1', agent: { id: user.id, name: user.name } }] as PortfolioCustomer[]);
    const remove = vi.spyOn(api, 'deleteUser');
    await expect(quitarUsuario(user.id, null)).rejects.toThrow('Elige quién');
    portfolio.mockRejectedValue(new Error('Sin conexión'));
    await expect(quitarUsuario(user.id, 'destino')).rejects.toThrow('Sin conexión');
    expect(remove).not.toHaveBeenCalled();
  });
});
