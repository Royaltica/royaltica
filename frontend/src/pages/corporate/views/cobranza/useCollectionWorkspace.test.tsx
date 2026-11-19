import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../../services/apiClient';
import { EMPTY_WORKSPACE, type CollectionWorkspace } from '../../../../services/collectionWorkspace';
import { useCollectionWorkspace } from './useCollectionWorkspace';

let persisted: CollectionWorkspace;
beforeEach(() => {
  persisted = structuredClone(EMPTY_WORKSPACE);
  vi.spyOn(api, 'getCollectionWorkspace').mockImplementation(async () => structuredClone(persisted));
  vi.spyOn(api, 'updateCollectionWorkspace').mockImplementation(async (patch) => {
    if (patch.revision !== persisted.revision) throw new Error('Hay cambios más recientes.');
    persisted = { ...persisted, ...patch, revision: persisted.revision + 1 };
    return structuredClone(persisted);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Workspace confirmado por el servidor', () => {
  it('no escribe al montar, ignora el almacenamiento viejo y recupera los datos al recargar', async () => {
    const storage = vi.spyOn(Storage.prototype, 'getItem');
    const hook = renderHook(useCollectionWorkspace);
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(api.updateCollectionWorkspace).not.toHaveBeenCalled();
    await act(() => hook.result.current.update(() => ({ alertas: { a: { firma: 'Alerta de prueba' } } })));
    hook.unmount();
    const next = renderHook(useCollectionWorkspace);
    await waitFor(() => expect(next.result.current.data.alertas.a).toEqual({ firma: 'Alerta de prueba' }));
    expect(storage).not.toHaveBeenCalled();
  });

  it('serializa cambios rápidos y calcula cada uno desde la última revisión confirmada', async () => {
    const hook = renderHook(useCollectionWorkspace);
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await act(async () => {
      const first = hook.result.current.update((s) => ({ alertas: { ...s.alertas, a: { firma: 'Primera' } } }));
      const second = hook.result.current.update((s) => ({ alertas: { ...s.alertas, b: { firma: 'Segunda' } } }));
      await Promise.all([first, second]);
    });
    expect(persisted.alertas).toEqual({ a: { firma: 'Primera' }, b: { firma: 'Segunda' } });
    expect(vi.mocked(api.updateCollectionWorkspace).mock.calls.map(([p]) => p.revision)).toEqual([0, 1]);
  });

  it('no publica éxito ni defaults al fallar; exige releer antes del siguiente guardado', async () => {
    const hook = renderHook(useCollectionWorkspace);
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    vi.mocked(api.updateCollectionWorkspace).mockRejectedValueOnce(new Error('No se pudo escribir.'));
    await act(async () => { await expect(hook.result.current.update(() => ({ alertas: { a: { firma: 'Sin guardar' } } }))).rejects.toThrow(); });
    expect(hook.result.current.data.alertas).toEqual({});
    expect(hook.result.current.error).toBe('No se pudo escribir.');
    expect(hook.result.current.ready).toBe(false);
    await act(async () => { await expect(hook.result.current.update(() => ({ alertas: {} }))).rejects.toThrow('Recarga'); });
    expect(api.updateCollectionWorkspace).toHaveBeenCalledTimes(1);
    await act(() => hook.result.current.reload());
    expect(hook.result.current.ready).toBe(true);
  });

  it('no deja que un conflicto pise datos guardados desde otra pestaña', async () => {
    const hook = renderHook(useCollectionWorkspace);
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    persisted = { ...persisted, revision: 1, alertas: { otra: { firma: 'Otra pestaña' } } };
    await act(async () => { await expect(hook.result.current.update(() => ({ alertas: {} }))).rejects.toThrow('más recientes'); });
    expect(persisted.alertas).toEqual({ otra: { firma: 'Otra pestaña' } });
    await act(() => hook.result.current.reload());
    expect(hook.result.current.data.alertas.otra.firma).toBe('Otra pestaña');
  });

  it('no guarda después de un error de carga ni lleva datos a una nueva sesión', async () => {
    vi.mocked(api.getCollectionWorkspace).mockRejectedValueOnce(new Error('Sin conexión'));
    const hook = renderHook(useCollectionWorkspace);
    await waitFor(() => expect(hook.result.current.error).toContain('No se pudieron cargar'));
    await act(async () => { await expect(hook.result.current.update(() => ({ alertas: {} }))).rejects.toThrow(); });
    expect(api.updateCollectionWorkspace).not.toHaveBeenCalled();
    hook.unmount();
    persisted = { ...structuredClone(EMPTY_WORKSPACE), revision: 4 };
    const next = renderHook(useCollectionWorkspace);
    await waitFor(() => expect(next.result.current.data.revision).toBe(4));
    expect(next.result.current.data.alertas).toEqual({});
  });
});
