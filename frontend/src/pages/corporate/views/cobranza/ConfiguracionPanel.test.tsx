import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type ApiUserRow, type CollectionLevelPlan, type OrgSettings } from '../../../../services/apiClient';
import { Equipo, Reglas, Empresa, AlertasCelular } from './ConfiguracionPanel';

vi.mock('./store.tsx', () => ({ useCobranza: () => ({ recargarCartera: async () => undefined }) }));
vi.mock('./WhatsappPanel.tsx', () => ({ ModoEnvio: () => null }));
vi.mock('./alertas.tsx', () => ({ useAlertas: () => ({ vigentes: [] }) }));
vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }));

const user: ApiUserRow = { id: 'agente-1', email: 'agente@equipo.invalid', name: 'Agente de prueba', role: 'CORPORATE_USER', status: 'ACTIVE', isActive: true, operationalProfile: 'AGENTE_EJECUTIVO', permissions: ['cxc'], lastLoginAt: null, createdAt: '2026-11-18T16:00:00Z' };
const settings = {
  collectionCompany: { empresa: '', telefono_oficial: '', banco: '', clabe: '', liga: '', correo: '', firma: '' },
  collectionNotifications: { noMolestar: true, resumenHora: '08:00', destinatarios: [] },
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

describe('Empresa y destinatarios persistentes', () => {
  it('guarda empresa y recupera sus datos al volver; la vista previa no inventa clientes', async () => {
    let saved = structuredClone(settings);
    vi.mocked(api.getSettings).mockImplementation(async () => saved);
    const update = vi.spyOn(api, 'updateSettings').mockImplementation(async (patch) => { saved = { ...saved, ...patch } as OrgSettings; return saved; });
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<Empresa />);
    const name = await screen.findByLabelText('Nombre comercial');
    expect(name).toHaveValue('');
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    fireEvent.change(name, { target: { value: 'Empresa de prueba' } });
    fireEvent.change(screen.getByLabelText('CLABE'), { target: { value: '000000000000000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Datos guardados');
    expect(update).toHaveBeenCalledWith({ collectionCompany: { ...settings.collectionCompany, empresa: 'Empresa de prueba', clabe: '000000000000000000' } });
    view.unmount(); render(<Empresa />);
    expect(await screen.findByLabelText('Nombre comercial')).toHaveValue('Empresa de prueba');
    expect(storage).not.toHaveBeenCalled();
  });

  it('conserva el formulario y muestra el error sin anunciar empresa guardada', async () => {
    vi.spyOn(api, 'updateSettings').mockRejectedValue(new Error('Revisa la CLABE.'));
    render(<Empresa />);
    fireEvent.change(await screen.findByLabelText('Nombre comercial'), { target: { value: 'Empresa sin guardar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa la CLABE.');
    expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Empresa sin guardar');
    expect(screen.queryByText('Datos guardados')).not.toBeInTheDocument();
  });

  it('guarda destinatarios, no molestar y resumen sin fingir verificación ni envíos', async () => {
    let saved = structuredClone(settings);
    vi.mocked(api.getSettings).mockImplementation(async () => saved);
    const update = vi.spyOn(api, 'updateSettings').mockImplementation(async (patch) => { saved = { ...saved, ...patch } as OrgSettings; return saved; });
    const view = render(<AlertasCelular />);
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar número' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Persona de prueba' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '+000000000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la lista' }));
    expect(screen.queryByText('verificado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mandar prueba' })).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: 'No molestar de noche' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '18:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));
    await screen.findByText('Preferencias guardadas');
    expect(update).toHaveBeenCalledWith({ collectionNotifications: { noMolestar: false, resumenHora: '18:00', destinatarios: [expect.objectContaining({ nombre: 'Persona de prueba', telefono: '+000000000000', verificado: false })] } });
    view.unmount(); render(<AlertasCelular />);
    expect(await screen.findByText('Persona de prueba')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'No molestar de noche' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('combobox')).toHaveValue('18:00');
  });

  it('informa errores al guardar o cargar preferencias sin escribir defaults', async () => {
    const update = vi.spyOn(api, 'updateSettings').mockRejectedValue(new Error('No se pudieron guardar las preferencias.'));
    const view = render(<AlertasCelular />);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar preferencias' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar las preferencias.');
    expect(screen.queryByText('Preferencias guardadas')).not.toBeInTheDocument();
    view.unmount(); update.mockClear();
    vi.mocked(api.getSettings).mockRejectedValue(new Error('Sin conexión'));
    render(<AlertasCelular />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.queryByRole('button', { name: 'Guardar preferencias' })).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});
