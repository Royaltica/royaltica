import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Estatus de gestión que un Agente/Ejecutivo puede dejar sobre una cuenta
 * asignada (spec "Mejoras V1", perfil Agente/Ejecutivo: "actualización de
 * estatus de gestión"). Se guarda como ActivityLog, no como estado propio de
 * la factura — es una bitácora de la gestión humana, no cambia el estatus
 * real de cobro (eso lo sigue haciendo el flujo normal de pagos/CxC).
 */
export const AGENT_ACCOUNT_STATUSES = [
  'CONTACTED',
  'NO_ANSWER',
  'PROMISE_TO_PAY',
  'DISPUTE',
  'ESCALATE_TO_SUPERVISOR',
] as const;
export type AgentAccountStatus = (typeof AGENT_ACCOUNT_STATUSES)[number];

export class UpdateAccountStatusDto {
  @IsIn(AGENT_ACCOUNT_STATUSES, {
    message: `Estatus inválido. Válidos: ${AGENT_ACCOUNT_STATUSES.join(', ')}.`,
  })
  status!: AgentAccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
