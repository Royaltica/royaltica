import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EstadoResultadosReal } from './EstadoResultadosReal';
import { api, type StatementApi } from '../../../services/apiClient';

// Migración de referencia a TanStack Query (ver comentario en el componente):
// este test cubre que la lista carga vía useQuery y que generar un estado
// nuevo invalida/refresca la lista vía useMutation + invalidateQueries.
vi.mock('../../../services/apiClient', async () => {
  const actual = await vi.importActual('../../../services/apiClient');
  return {
    ...actual,
    api: {
      getStatements: vi.fn(),
      generateStatement: vi.fn(),
    },
  };
});

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const sampleStatement: StatementApi = {
  id: 'st-1',
  period: '2026-08',
  type: 'monthly',
  revenue: 100_000,
  costs: 40_000,
  opex: 20_000,
  netIncome: 40_000,
  generatedAt: new Date().toISOString(),
};

describe('EstadoResultadosReal', () => {
  beforeEach(() => {
    vi.mocked(api.getStatements).mockReset();
    vi.mocked(api.generateStatement).mockReset();
  });

  it('carga la lista de estados generados al montar (useQuery)', async () => {
    vi.mocked(api.getStatements).mockResolvedValue([sampleStatement]);
    renderWithClient(<EstadoResultadosReal />);

    await waitFor(() => expect(api.getStatements).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/2026-08/)).toBeInTheDocument();
  });

  it('genera un estado nuevo y refresca la lista (useMutation + invalidateQueries)', async () => {
    vi.mocked(api.getStatements).mockResolvedValue([]);
    vi.mocked(api.generateStatement).mockResolvedValue(sampleStatement);

    renderWithClient(<EstadoResultadosReal />);
    await waitFor(() => expect(api.getStatements).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /generar/i }));

    await waitFor(() => expect(api.generateStatement).toHaveBeenCalled());
    // Tras el éxito de la mutación, se invalida la query de la lista.
    await waitFor(() => expect(api.getStatements).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Periodo 2026-08/)).toBeInTheDocument();
  });

  it('muestra un mensaje de error si la generación falla', async () => {
    vi.mocked(api.getStatements).mockResolvedValue([]);
    vi.mocked(api.generateStatement).mockRejectedValue(new Error('No se pudo generar el estado.'));

    renderWithClient(<EstadoResultadosReal />);
    await waitFor(() => expect(api.getStatements).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /generar/i }));

    expect(await screen.findByText('No se pudo generar el estado.')).toBeInTheDocument();
  });
});
