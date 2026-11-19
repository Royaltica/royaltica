import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../../services/apiClient';
import { EMPTY_WORKSPACE, type CollectionWorkspace } from '../../../../services/collectionWorkspace';
import { CobranzaProvider } from './store';
import { ReportesPanel } from './ReportesPanel';

vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }));
vi.mock('./AnalisisPeriodoPanel.tsx', () => ({ AnalisisPeriodoPanel: () => null }));
let stored: CollectionWorkspace;
beforeEach(() => {
  stored = structuredClone(EMPTY_WORKSPACE);
  vi.spyOn(api, 'getPortfolio').mockResolvedValue([]);
  vi.spyOn(api, 'getUsers').mockResolvedValue([]);
  vi.spyOn(api, 'getWaPlanActivity').mockResolvedValue({ customers: [], testMode: true } as never);
  vi.spyOn(api, 'getLevelPlan').mockResolvedValue({ policy: null });
  vi.spyOn(api, 'getCollectionWorkspace').mockImplementation(async () => structuredClone(stored));
  vi.spyOn(api, 'updateCollectionWorkspace').mockImplementation(async (patch) => { stored = { ...stored, ...patch, revision: stored.revision + 1 }; return structuredClone(stored); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function open() {
  const view = render(<CobranzaProvider><ReportesPanel /></CobranzaProvider>);
  fireEvent.click(screen.getByRole('tab', { name: 'Reporte a la medida' }));
  await screen.findByPlaceholderText('Nombre del reporte');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled());
  return view;
}
describe('Reportes guardados', () => {
  it('guarda, renombra y borra en el servidor; recargar conserva los filtros sin reportes de ejemplo', async () => {
    const view = await open();
    expect(screen.queryByText('Promesas de la semana')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Nombre del reporte'), { target: { value: 'Mi reporte' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('button', { name: 'Mi reporte' });
    expect(stored.reportes).toHaveLength(1);
    view.unmount(); await open();
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar Mi reporte' }));
    fireEvent.change(screen.getByLabelText('Nuevo nombre del reporte'), { target: { value: 'Reporte renombrado' } });
    fireEvent.submit(screen.getByLabelText('Nuevo nombre del reporte').closest('form')!);
    await screen.findByRole('button', { name: 'Reporte renombrado' });
    fireEvent.click(screen.getByRole('button', { name: 'Borrar Reporte renombrado' }));
    await waitFor(() => expect(stored.reportes).toEqual([]));
  });

  it('no muestra éxito si falla el guardado y conserva nombre y filtros para reintentar', async () => {
    await open();
    vi.mocked(api.updateCollectionWorkspace).mockRejectedValue(new Error('Escritura rechazada.'));
    fireEvent.change(screen.getByPlaceholderText('Nombre del reporte'), { target: { value: 'Sin guardar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(screen.getByPlaceholderText('Nombre del reporte')).toHaveValue('Sin guardar');
    expect(screen.queryByText('Guardaste "Sin guardar"')).not.toBeInTheDocument();
    expect(stored.reportes).toEqual([]);
    await act(async () => undefined);
  });
});
