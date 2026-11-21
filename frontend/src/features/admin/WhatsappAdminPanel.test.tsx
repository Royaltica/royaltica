import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsappAdminPanel } from './WhatsappAdminPanel';
import { api } from '../../services/apiClient';

const mensaje = {
  id: 'u-1',
  receivedAt: '2026-11-20T18:00:00Z',
  reason: 'AMBIGUOUS' as const,
  from: '5215512345678',
  kind: 'TEXT' as const,
  text: 'Ya pagué',
  resolved: false,
  resolution: null,
  candidates: [{ customerId: 'c-1', customerName: 'ACME', organizationId: 'org-1', organizationName: 'Uno SA' }],
};

describe('WhatsappAdminPanel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra el mensaje con sus candidatos y lo quita al asignarlo', async () => {
    vi.spyOn(api, 'adminWaUnmatched').mockResolvedValue([mensaje]);
    const assign = vi.spyOn(api, 'adminWaAssign').mockResolvedValue({ ok: true });
    render(<WhatsappAdminPanel />);
    const boton = await screen.findByRole('button', { name: 'Asignar a ACME (Uno SA)' });
    expect(screen.getByText('Ya pagué')).toBeTruthy();
    fireEvent.click(boton);
    await waitFor(() => expect(screen.queryByText('Ya pagué')).toBeNull());
    expect(assign).toHaveBeenCalledWith('u-1', 'c-1');
  });

  it('avisa si no se pudo cargar', async () => {
    vi.spyOn(api, 'adminWaUnmatched').mockRejectedValue(new Error('Sin conexión'));
    render(<WhatsappAdminPanel />);
    expect((await screen.findByRole('alert')).textContent).toContain('Sin conexión');
  });
});
