import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type ApiUserRow, type CollectionLevelPlan, type OrgSettings } from '../../../../services/apiClient';
import { Equipo, Reglas } from './ConfiguracionPanel';

vi.mock('./store.tsx', () => ({ useCobranza: () => ({ recargarCartera: async () => undefined }) }));
vi.mock('./WhatsappPanel.tsx', () => ({ ModoEnvio: () => null }));
vi.mock('./alertas.tsx', () => ({ useAlertas: () => ({ vigentes: [] }) }));
vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }));

const user: ApiUserRow = { id: 'agente-1', email: 'agente@equipo.invalid', name: 'Agente de prueba', role: 'CORPORATE_USER', status: 'ACTIVE', isActive: true, operationalProfile: 'AGENTE_EJECUTIVO', permissions: ['cxc'], lastLoginAt: null, createdAt: '2026-11-18T16:00:00Z' };
const settings = {
  collectionEngineHour: 11,
  collectionSecurity: { dosPasos: false, inactividad: false },
  collectionRules: { festivos: false, descuentoMax: 10, parcialidades: true, prorroga: false, aprueba: 'admin' },
} as OrgSettings;
const policy = { id: 'politica-1', name: 'Plan de prueba', autoSend: false, shadowMode: false, maxContactsPerWeek: 3, blackoutDates: [], timezone: 'America/Mexico_City', sequenceSteps: [] } as CollectionLevelPlan;

beforeEach(() => {
  vi.spyOn(api, 'getSettings').mockResolvedValue(structuredClone(settings));
  vi.spyOn(api, 'getUsers').mockResolvedValue([structuredClone(user)]);
  vi.spyOn(api, 'getLevelPlan').mockResolvedValue({ policy: structuredClone(policy) });
  vi.spyOn(api, 'getCollectionStatus').mockResolvedValue({ paused: false } as never);
  vi.spyOn(api, 'getShadowReport').mockResolvedValue({ since: '2026-11-20T00:00:00Z', total: 0, alreadyPaidCount: 0, items: [] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Equipo en configuración', () => {
  it('carga usuarios reales y persiste perfil y estado solo mediante la API', async () => {
    const update = vi.spyOn(api, 'updateUser').mockResolvedValue({ ...user, operationalProfile: 'SUPERVISOR_GERENTE' });
    const status = vi.spyOn(api, 'setUserStatus').mockResolvedValue({ ...user, isActive: false, status: 'DISABLED' });
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    render(<Equipo />);
    expect(await screen.findByText(user.name)).toBeInTheDocument();
    expect(screen.queryByText('Laura Méndez')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: `Perfil de ${user.name}` }), { target: { value: 'supervisor' } });
    await waitFor(() => expect(update).toHaveBeenCalledWith(user.id, expect.objectContaining({ operationalProfile: 'SUPERVISOR_GERENTE' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desactivar acceso' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar acceso' }));
    await waitFor(() => expect(status).toHaveBeenCalledWith(user.id, false));
    expect(storage).not.toHaveBeenCalled();
  });

  it('guarda las preferencias de seguridad y las recupera al volver a montar', async () => {
    const update = vi.spyOn(api, 'updateSettings').mockImplementation(async (patch) => ({ ...settings, collectionSecurity: { ...settings.collectionSecurity, ...patch.collectionSecurity } }));
    const view = render(<Equipo />);
    const twoFactor = await screen.findByRole('switch', { name: 'Verificación en dos pasos' });
    fireEvent.click(twoFactor);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar seguridad' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ collectionSecurity: { dosPasos: true, inactividad: false } }));
    await screen.findByText('Preferencias de seguridad guardadas');
    view.unmount();
    vi.mocked(api.getSettings).mockResolvedValue({ ...settings, collectionSecurity: { dosPasos: true, inactividad: false } });
    render(<Equipo />);
    expect(await screen.findByRole('switch', { name: 'Verificación en dos pasos' })).toHaveAttribute('aria-checked', 'true');
  });

  it('conserva el formulario y muestra el error si no se pudo invitar', async () => {
    const invite = vi.spyOn(api, 'inviteUser').mockRejectedValue(new Error('No hay licencias disponibles.'));
    render(<Equipo />);
    await screen.findByText(user.name);
    fireEvent.click(screen.getByRole('button', { name: 'Invitar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Persona de prueba' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'persona@equipo.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mandar invitación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay licencias disponibles.');
    expect(invite).toHaveBeenCalledWith(expect.objectContaining({ email: 'persona@equipo.invalid', operationalProfile: 'AGENTE_EJECUTIVO' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Persona de prueba');
    expect(screen.queryByText('Invitación creada y correo enviado.')).not.toBeInTheDocument();
  });

  it('no anuncia seguridad guardada si falla la escritura', async () => {
    vi.spyOn(api, 'updateSettings').mockRejectedValue(new Error('No se pudo guardar la seguridad.'));
    render(<Equipo />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Verificación en dos pasos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar seguridad' }));
    await screen.findByText('No se pudo guardar la seguridad.');
    expect(screen.getByRole('switch', { name: 'Verificación en dos pasos' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Preferencias de seguridad guardadas')).not.toBeInTheDocument();
  });

  it('confirma la creación usando el contrato user/emailSent del servidor', async () => {
    vi.spyOn(api, 'inviteUser').mockResolvedValue({ user, inviteLink: null, emailSent: true });
    render(<Equipo />);
    await screen.findByText(user.name);
    fireEvent.click(screen.getByRole('button', { name: 'Invitar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Persona de prueba' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'persona@equipo.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mandar invitación' }));
    expect(await screen.findByText('Invitación creada y correo enviado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mandar invitación' })).not.toBeInTheDocument();
  });

  it('no anuncia éxito si falla el guardado del perfil', async () => {
    vi.spyOn(api, 'updateUser').mockRejectedValue(new Error('No se pudo guardar el perfil.'));
    render(<Equipo />);
    const profile = await screen.findByRole('combobox', { name: `Perfil de ${user.name}` });
    fireEvent.change(profile, { target: { value: 'supervisor' } });
    await screen.findByText('No se pudo guardar el perfil.');
    expect(profile).toHaveValue('agente');
    expect(screen.queryByText('Perfil guardado')).not.toBeInTheDocument();
  });
});

describe('Reglas persistentes', () => {
  it('mantiene el máximo semanal en al menos 1 y no permite bajarlo a cero', async () => {
    vi.mocked(api.getLevelPlan).mockResolvedValue({ policy: { ...policy, maxContactsPerWeek: 1 } });
    const update = vi.spyOn(api, 'updateCollectionPolicy').mockImplementation(async (_id, patch) => ({ ...policy, ...patch }));
    render(<Reglas />);
    await screen.findByRole('button', { name: 'Guardar calendario y límite' });
    const menos = screen.getAllByRole('button', { name: 'Menos' })[0];
    expect(menos).toBeDisabled();
    fireEvent.click(menos);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calendario y límite' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(policy.id, expect.objectContaining({ maxContactsPerWeek: 1 })));
  });

  it('rechaza guardar un cero previo del servidor hasta elegir al menos 1', async () => {
    vi.mocked(api.getLevelPlan).mockResolvedValue({ policy: { ...policy, maxContactsPerWeek: 0 } });
    const update = vi.spyOn(api, 'updateCollectionPolicy').mockImplementation(async (_id, patch) => ({ ...policy, ...patch }));
    render(<Reglas />);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar calendario y límite' }));
    await screen.findByText('El máximo de mensajes por semana debe ser al menos 1.');
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Más' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calendario y límite' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(policy.id, expect.objectContaining({ maxContactsPerWeek: 1 })));
  });

  it('guarda calendario y límite en la política y mantiene la hora únicamente en settings', async () => {
    const update = vi.spyOn(api, 'updateCollectionPolicy').mockImplementation(async (_id, patch) => ({ ...policy, ...patch }));
    const settingsUpdate = vi.spyOn(api, 'updateSettings').mockResolvedValue(settings);
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    render(<Reglas />);
    const saturday = await screen.findByRole('button', { name: 'Mensajes en sábado' });
    fireEvent.click(saturday);
    fireEvent.click(screen.getAllByRole('button', { name: 'Más' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calendario y límite' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(policy.id, { maxContactsPerWeek: 4, blackoutDates: expect.any(Array) }));
    expect(update.mock.calls[0][1].blackoutDates!.length).toBeGreaterThan(50);
    await screen.findByText('Calendario y límite de mensajes guardados');
    expect(settingsUpdate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Hora de envío' }), { target: { value: '12' } });
    await waitFor(() => expect(settingsUpdate).toHaveBeenCalledWith({ collectionEngineHour: 12 }));
    expect(storage).not.toHaveBeenCalled();
  });

  it('guarda solo las preferencias de reglas y muestra errores de la política sin anunciar éxito', async () => {
    const update = vi.spyOn(api, 'updateSettings').mockResolvedValue(settings);
    vi.spyOn(api, 'updateCollectionPolicy').mockRejectedValue(new Error('No se pudo guardar la política.'));
    render(<Reglas />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Parcialidades' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ collectionRules: { ...settings.collectionRules, parcialidades: false } }));
    await screen.findByText('Reglas guardadas');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calendario y límite' }));
    await screen.findByText('No se pudo guardar la política.');
    expect(screen.queryByText('Calendario y límite de mensajes guardados')).not.toBeInTheDocument();
  });

  it('muestra el error de carga y no deja guardar defaults sobre los datos reales', async () => {
    vi.mocked(api.getSettings).mockRejectedValue(new Error('Sin conexión'));
    const update = vi.spyOn(api, 'updateSettings');
    render(<Reglas />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las reglas');
    expect(screen.queryByRole('button', { name: 'Guardar reglas' })).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('Modo sombra y plan para la semana de prueba', () => {
  it('con el modo sombra apagado explica qué va a aparecer en el reporte', async () => {
    render(<Reglas />);
    expect(await screen.findByText(/El modo sombra está apagado/)).toBeInTheDocument();
  });

  it('el reporte de 7 días pide la semana y muestra el indicador de facturas pagadas', async () => {
    vi.mocked(api.getLevelPlan).mockResolvedValue({ policy: { ...policy, shadowMode: true } });
    vi.mocked(api.getShadowReport).mockImplementation(async (dias = 1) => ({
      since: '2026-11-13T00:00:00Z',
      total: dias === 7 ? 2 : 0,
      alreadyPaidCount: 0,
      items: dias === 7
        ? [
            { at: '2026-11-18T17:00:00Z', invoiceId: 'i1', folio: 'F-1', customerName: 'Cliente A', channel: 'WHATSAPP', template: null, daysOverdue: 3, stepOrder: 1, alreadyPaid: false },
            { at: '2026-11-19T17:00:00Z', invoiceId: 'i2', folio: 'F-2', customerName: 'Cliente B', channel: 'EMAIL', template: null, daysOverdue: 5, stepOrder: 2, alreadyPaid: false },
          ]
        : [],
    }));
    render(<Reglas />);
    expect(await screen.findByText('En las últimas 24 horas no se habría enviado nada.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    expect(await screen.findByText('Ninguno habría ido a una factura ya pagada.')).toBeInTheDocument();
    expect(api.getShadowReport).toHaveBeenLastCalledWith(7);
    expect(screen.getByText(/En los últimos 7 días se habrían enviado 2 mensaje/)).toBeInTheDocument();
  });

  it('sin plan no muestra un máximo semanal en 0 y al prender el modo sombra recarga el calendario', async () => {
    vi.mocked(api.getLevelPlan).mockResolvedValueOnce({ policy: null as never }).mockResolvedValueOnce({ policy: null as never });
    const update = vi.spyOn(api, 'updateLevelPlanSettings').mockResolvedValue({ policy: { ...policy, shadowMode: true } } as never);
    render(<Reglas />);
    expect(await screen.findByRole('button', { name: 'Crear plan con aprobación' })).toBeInTheDocument();
    expect(screen.queryByText('Máximo de mensajes por semana')).not.toBeInTheDocument();
    vi.mocked(api.getLevelPlan).mockResolvedValue({ policy: { ...policy, shadowMode: true } });
    fireEvent.click(await screen.findByRole('switch', { name: 'Modo sombra' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ shadowMode: true }));
    expect(await screen.findByText('Máximo de mensajes por semana')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear plan con aprobación' })).not.toBeInTheDocument();
  });
});
