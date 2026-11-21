import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, type PortfolioSegments } from '../../../../services/apiClient.ts';
import { SegmentosServidor } from './SegmentosServidor.tsx';

const cliente = (id: string, segment: PortfolioSegments['customers'][number]['segment'], reason: string) => ({
  id, name: `Cliente ${id}`, category: null, riskTier: 'ATENCION', score: 60, outstanding: 1000,
  brokenPromises: 0, disputed: false, segment, segmentName: segment, reason, onTimeRate: 0.5, avgDaysLate: 4, offsetDays: 0,
});

const data: PortfolioSegments = {
  generatedAt: '2026-11-20T18:00:00Z',
  segments: [
    { segment: 'puntual', name: 'Puntual', count: 0, outstanding: 0 },
    { segment: 'deterioro', name: 'En deterioro', count: 1, outstanding: 1000 },
    { segment: 'nuevo', name: 'Nuevo', count: 1, outstanding: 1000 },
  ],
  byCategory: [{ category: 'Sin tipo', count: 2, outstanding: 2000 }],
  byRiskTier: [{ riskTier: 'ATENCION', count: 2, outstanding: 2000 }],
  customers: [cliente('a', 'deterioro', 'Pagaba a tiempo y sus últimas 2 facturas llegaron tarde.'), cliente('b', 'nuevo', 'Sin historial.')],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Segmentos calculados en el servidor', () => {
  it('muestra cada segmento con su conteo y abre los clientes con su motivo', async () => {
    vi.spyOn(api, 'getSegments').mockResolvedValue(data);
    render(<SegmentosServidor />);
    const deterioro = await screen.findByRole('button', { name: /En deterioro/ });
    expect(screen.getByRole('button', { name: /Puntual/ })).toBeDisabled();
    fireEvent.click(deterioro);
    expect(screen.getByText('Cliente a')).toBeInTheDocument();
    expect(screen.getByText(/últimas 2 facturas llegaron tarde/)).toBeInTheDocument();
    expect(screen.queryByText('Cliente b')).not.toBeInTheDocument();
    expect(screen.getByText(/Por riesgo:/)).toBeInTheDocument();
  });

  it('si falla el cálculo lo dice y permite reintentar', async () => {
    const get = vi.spyOn(api, 'getSegments').mockRejectedValueOnce(new Error('caído')).mockResolvedValueOnce(data);
    render(<SegmentosServidor />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron calcular');
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
    expect(await screen.findByRole('button', { name: /En deterioro/ })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
