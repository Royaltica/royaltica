import React from 'react';
import { api, type ApiUserRow } from '../../../../services/apiClient.ts';

export const EQUIPO_ACTUALIZADO = 'royaltica:equipo-actualizado';
export type RolEquipo = 'admin' | 'supervisor' | 'agente';
export type PersonaEquipo = {
  id: string;
  nombre: string;
  correo: string;
  rol: RolEquipo | 'sinPerfil';
  estado: 'activo' | 'invitado' | 'inactivo';
  ultimo?: string;
};

export function personaDesdeUsuario(u: ApiUserRow): PersonaEquipo {
  const rol = u.role === 'CORPORATE_ADMIN' || u.operationalProfile === 'ADMINISTRADOR_DATA' ? 'admin'
    : u.operationalProfile === 'SUPERVISOR_GERENTE' ? 'supervisor'
      : u.operationalProfile === 'AGENTE_EJECUTIVO' ? 'agente' : 'sinPerfil';
  return {
    id: u.id,
    nombre: u.name,
    correo: u.email,
    rol,
    estado: !u.isActive || ['INACTIVE', 'DISABLED'].includes(u.status) ? 'inactivo' : u.status === 'INVITED' ? 'invitado' : 'activo',
    ultimo: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('es-MX') : undefined,
  };
}

export function perfilDeRol(rol: RolEquipo) {
  return {
    role: rol === 'admin' ? 'CORPORATE_ADMIN' as const : 'CORPORATE_USER' as const,
    operationalProfile: rol === 'admin' ? 'ADMINISTRADOR_DATA' as const : rol === 'supervisor' ? 'SUPERVISOR_GERENTE' as const : 'AGENTE_EJECUTIVO' as const,
    permissions: rol === 'admin' ? [] : rol === 'supervisor' ? ['dashboard', 'cxc', 'finanzas', 'estados'] : ['cxc'],
  };
}

export function useEquipo() {
  const [equipo, setEquipo] = React.useState<PersonaEquipo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let vigente = true;
    let solicitud = 0;
    const cargar = () => {
      const numero = ++solicitud;
      api.getUsers().then((users) => {
        if (vigente && numero === solicitud) { setEquipo(users.map(personaDesdeUsuario)); setError(null); }
      }).catch((e: unknown) => {
        if (vigente && numero === solicitud) setError(e instanceof Error ? e.message : 'No se pudo cargar el equipo.');
      });
    };
    cargar();
    window.addEventListener(EQUIPO_ACTUALIZADO, cargar);
    return () => { vigente = false; window.removeEventListener(EQUIPO_ACTUALIZADO, cargar); };
  }, []);
  return { equipo, error };
}

export function actualizarEquipo() {
  window.dispatchEvent(new Event(EQUIPO_ACTUALIZADO));
}

/** No elimina el acceso si alguna reasignación falla. Los identificadores vienen de la API. */
export async function quitarUsuario(id: string, destino: string | null) {
  const cartera = await api.getPortfolio();
  const clientes = cartera.filter((c) => c.agent?.id === id);
  if (clientes.length && !destino) throw new Error('Elige quién tomará los clientes antes de quitar el acceso.');
  if (destino === id) throw new Error('Elige otro agente para recibir los clientes.');
  for (const cliente of clientes) await api.updateCustomer(cliente.id, { assignedAgentId: destino });
  await api.deleteUser(id);
  actualizarEquipo();
}
