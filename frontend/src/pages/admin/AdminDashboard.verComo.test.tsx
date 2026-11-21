import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User as FirebaseUser } from 'firebase/auth';
import { api, type AdminOrg } from '../../services/apiClient.ts';
import { AdminDashboard } from './AdminDashboard.tsx';

vi.mock('../../components/NotificationBell.tsx', () => ({ NotificationBell: () => null }));

const org = (id: string, name: string): AdminOrg => ({
  id, name, rfc: 'XAXX010101000', plan: 'STARTER', isActive: true, deleted: false, createdAt: '2026-01-01T00:00:00Z',
  amount: 0, remindersSent: 0, remindersCostMxn: 0, lastLoginAt: null, totalCostMxn: 0, revenueMxn: 0, marginMxn: 0,
  subscriptionStatus: null, healthScore: 80, counts: { users: 1, suppliers: 0, invoices: 0 },
} as unknown as AdminOrg);

const user = { uid: 'su', displayName: 'Superadmin', email: 'su@royaltica.invalid' } as FirebaseUser;

beforeEach(() => {
  const nope = () => Promise.reject(new Error('sin backend'));
  for (const m of ['adminActivity', 'adminCollectionEngineHealth', 'adminCostForOrg', 'adminCostsByFeature', 'adminHealthHistory', 'adminLoginHistory', 'adminRemindersCostGlobal', 'aiStatus', 'health'] as const) {
    vi.spyOn(api, m).mockImplementation(nope as never);
  }
  vi.spyOn(api, 'adminOrganizations').mockResolvedValue([org('11111111-1111-4111-8111-111111111111', 'Piloto Uno SA')]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Ver como cliente (antes "Cambiar Rol")', () => {
  it('no cierra la sesión: abre la lista de organizaciones y entra a la elegida', async () => {
    const onLogout = vi.fn();
    const onImpersonate = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <AdminDashboard user={user} onLogout={onLogout} onImpersonate={onImpersonate} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Cambiar Rol')).not.toBeInTheDocument();
    await waitFor(() => expect(api.adminOrganizations).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Ver como cliente/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Piloto Uno SA' }));
    await waitFor(() => expect(onImpersonate).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111'));
    expect(onLogout).not.toHaveBeenCalled();
  });
});
