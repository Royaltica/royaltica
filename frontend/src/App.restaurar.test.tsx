import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type ApiUser } from './services/apiClient.ts';

// Firebase ya recuerda a alguien al cargar la página (como tras recargar).
const authMocks = vi.hoisted(() => ({ signOut: vi.fn(async () => undefined) }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb({ uid: 'fb-1', getIdToken: async () => 'id-token' });
    return () => {};
  },
  signOut: authMocks.signOut,
}));
vi.mock('./lib/firebase.ts', () => ({ auth: {}, signInWithEmail: vi.fn(), signInWithGoogle: vi.fn() }));
vi.mock('./pages/LandingPage.tsx', () => ({ LandingPage: () => <div>PANTALLA DE LOGIN</div> }));
vi.mock('./pages/admin/AdminDashboard.tsx', () => ({ AdminDashboard: () => <div>PANEL SUPERADMIN</div> }));
vi.mock('./pages/corporate/CorporateDashboard.tsx', () => ({
  CorporateDashboard: ({ isImpersonating }: { isImpersonating?: boolean }) => <div>PORTAL CLIENTE {isImpersonating ? '(viendo como cliente)' : ''}</div>,
}));

import App from './App.tsx';

const usuario = (role: string): ApiUser => ({ id: 'u-1', name: 'Persona', email: 'p@x.invalid', role, permissions: [] } as unknown as ApiUser);
const montar = () => render(<MemoryRouter initialEntries={['/overview']}><App /></MemoryRouter>);

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); authMocks.signOut.mockClear(); });

describe('Recargar la página no cierra la sesión', () => {
  it('rehace el canje con el backend y vuelve al portal de su rol', async () => {
    const verify = vi.spyOn(api, 'verifyToken').mockResolvedValue({ user: usuario('SUPERADMIN'), twoFactorRequired: false, tempToken: null });
    montar();
    expect(await screen.findByText('PANEL SUPERADMIN')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledWith('id-token');
  });

  it('si estaba viendo como cliente, conserva esa vista', async () => {
    localStorage.setItem('royaltica_jwt', 'token-cliente');
    localStorage.setItem('royaltica_jwt_superadmin_stash', 'token-superadmin');
    vi.spyOn(api, 'me').mockResolvedValue(usuario('CORPORATE_USER'));
    const verify = vi.spyOn(api, 'verifyToken');
    montar();
    expect(await screen.findByText(/PORTAL CLIENTE \(viendo como cliente\)/)).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('si el backend ya no reconoce la cuenta, limpia todo y muestra el login', async () => {
    localStorage.setItem('royaltica_jwt', 'viejo');
    vi.spyOn(api, 'verifyToken').mockRejectedValue(new Error('no invitado'));
    montar();
    expect(await screen.findByText('PANTALLA DE LOGIN')).toBeInTheDocument();
    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalled());
    expect(localStorage.getItem('royaltica_jwt')).toBeNull();
  });
});
