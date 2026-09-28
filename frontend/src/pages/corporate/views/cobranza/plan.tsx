import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Link2, Mail, MessageSquare, Phone } from 'lucide-react';
import { EASE, Bar, BlockTitle } from './primitives.tsx';
import type { PasoId, PlanConfig } from './mockV1.ts';

// Plan de cobranza por cliente: la misma escalera (niveles 0-4 antes de
// vencer, etapas A-D después) para Administrador, Supervisor y Agente.

export const CANAL_ICON = {
  WhatsApp: MessageSquare,
  Correo: Mail,
  Llamada: Phone,
} as const;

export type Canal = keyof typeof CANAL_ICON;

export const PLANTILLA: {
  id: PasoId;
  etiqueta: string;
  nombre: string;
  /** Días respecto al vencimiento (negativo = antes). */
  dia: number;
  fase: keyof typeof FASES;
  tono: string;
  liga: boolean;
  /** Canal fijo del paso; si no hay, usa el preferido del cliente. */
  canalFijo?: Canal;
}[] = [
  { id: 'N0', etiqueta: 'Nivel 0', nombre: 'Confirmación de factura', dia: -30, fase: 'temprana', tono: 'Informativo', liga: false, canalFijo: 'Correo' },
  { id: 'N1', etiqueta: 'Nivel 1', nombre: 'Aviso preventivo', dia: -14, fase: 'temprana', tono: 'Cordial', liga: false },
  { id: 'N2', etiqueta: 'Nivel 2', nombre: 'Recordatorio de cortesía', dia: -7, fase: 'temprana', tono: 'Suave', liga: true },
  { id: 'N3', etiqueta: 'Nivel 3', nombre: 'Vence en 3 días', dia: -3, fase: 'temprana', tono: 'Estándar', liga: true },
  { id: 'N4', etiqueta: 'Nivel 4', nombre: 'Vence hoy', dia: 0, fase: 'temprana', tono: 'Neutral', liga: true },
  { id: 'A', etiqueta: 'Etapa A', nombre: 'Aviso urgente', dia: 1, fase: 'seguimiento', tono: 'Estándar', liga: true },
  { id: 'B', etiqueta: 'Etapa B', nombre: 'Preguntar qué pasó', dia: 7, fase: 'seguimiento', tono: 'Cercano', liga: true },
  { id: 'C', etiqueta: 'Etapa C', nombre: 'Notificación formal', dia: 20, fase: 'escalamiento', tono: 'Firme', liga: true },
  { id: 'D', etiqueta: 'Etapa D', nombre: 'Negociación', dia: 35, fase: 'escalamiento', tono: 'Firme', liga: false, canalFijo: 'Llamada' },
];

export type EstadoPaso = 'hecho' | 'actual' | 'programado' | 'omitido';
export type PasoPlan = (typeof PLANTILLA)[number] & {
  canal: Canal;
  estado: EstadoPaso;
  resultado?: string;
  obligatorio: boolean;
  /** Días que faltan para que un paso sombreado se active. */
  faltan: number;
};

/** "14 días antes", "Día del vencimiento", "1 día después"… */
export function cuandoPaso(id: PasoId, dia: number): string {
  if (id === 'N0') return 'Al emitir';
  if (dia === 0) return 'Día del vencimiento';
  const n = Math.abs(dia);
  return `${n} ${n === 1 ? 'día' : 'días'} ${dia < 0 ? 'antes' : 'después'}`;
}

export function textoHoy(hoy: number): string {
  if (hoy < 0) return `Faltan ${-hoy} ${hoy === -1 ? 'día' : 'días'} para vencer`;
  if (hoy === 0) return 'Vence hoy';
  return `${hoy} ${hoy === 1 ? 'día' : 'días'} vencida`;
}

/**
 * Aplica la plantilla general a un cliente. Reglas de personalización
 * (deterministas y explicables, se muestran en pantalla):
 * - cumplido  → se omiten los niveles 0 a 2.
 * - formal    → tono más formal y todo por correo (salvo la llamada final).
 * - disputas  → la confirmación de factura es obligatoria.
 * Estado: el paso más reciente cuyo día ya llegó es "Hoy"; los anteriores
 * están hechos y los que no han llegado quedan sombreados.
 */
export function construirPlan(plan: PlanConfig) {
  const omitidos = new Set<PasoId>(plan.perfil === 'cumplido' ? ['N0', 'N1', 'N2'] : []);
  const base = PLANTILLA.map((t) => ({
    ...t,
    canal: (plan.perfil === 'formal' && t.id !== 'D' ? 'Correo' : t.canalFijo ?? plan.canal) as Canal,
    tono: plan.perfil === 'formal' && (t.tono === 'Cordial' || t.tono === 'Suave') ? 'Estándar' : t.tono,
    obligatorio: plan.perfil === 'disputas' && t.id === 'N0',
  }));
  const vigentes = base.filter((t) => !omitidos.has(t.id));
  const actual = [...vigentes].reverse().find((t) => t.dia <= plan.hoy)?.id;

  const pasos: PasoPlan[] = base.map((t) => {
    const estado: EstadoPaso = omitidos.has(t.id)
      ? 'omitido'
      : t.id === actual
        ? 'actual'
        : t.dia <= plan.hoy
          ? 'hecho'
          : 'programado';
    return { ...t, estado, resultado: plan.resultados[t.id], faltan: t.dia - plan.hoy };
  });

  const ajustes: string[] = [];
  if (plan.perfil === 'cumplido') ajustes.push('Se omiten los niveles 0 a 2: es un cliente cumplido y no necesita avisos tan temprano.');
  if (plan.perfil === 'formal') ajustes.push('Cuenta grande: tono más formal y estado de cuenta adjunto, todo por correo.');
  if (plan.perfil === 'disputas') ajustes.push('Ha tenido aclaraciones de factura: la confirmación (nivel 0) es obligatoria.');
  if (plan.perfil !== 'formal') ajustes.push(`Avisos por ${plan.canal}, el canal donde más responde.`);
  if (plan.perfil === 'estandar') ajustes.push('Resto de la plantilla general sin cambios.');

  return {
    pasos,
    actual: pasos.find((p) => p.estado === 'actual'),
    proxima: pasos.find((p) => p.estado === 'programado'),
    ajustes,
  };
}


export const FASES = {
  temprana: { label: 'Temprana', punto: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', linea: 'bg-emerald-200' },
  seguimiento: { label: 'Seguimiento', punto: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700', linea: 'bg-amber-200' },
  escalamiento: { label: 'Escalamiento', punto: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', linea: 'bg-rose-200' },
} as const;

export function FaseDot({ fase }: { fase: keyof typeof FASES }) {
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${FASES[fase].punto}`} aria-hidden />;
}


export function TramoPlan({ titulo, pasos, inicio }: { titulo: string; pasos: PasoPlan[]; inicio: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-3">{titulo}</div>
      <ol className="relative border-l border-brand-ink/10 ml-2 space-y-3">
        {pasos.map((paso, i) => (
          <PasoEscalera key={paso.id} paso={paso} index={inicio + i} />
        ))}
      </ol>
    </div>
  );
}

export function PasoEscalera({
  paso,
  index,
}: {
  // Convención del proyecto: un componente que recibe `key` debe declararla.
  key?: string;
  paso: PasoPlan;
  index: number;
}) {
  const reduce = useReducedMotion();
  const fase = FASES[paso.fase];
  const { estado } = paso;
  const esActual = estado === 'actual';
  const hecho = estado === 'hecho';
  const sombreado = estado === 'programado';
  const omitido = estado === 'omitido';

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, delay: reduce ? 0 : 0.04 + index * 0.04, ease: EASE }}
      className="pl-5"
    >
      {/* Punto de la línea: lleno si ya pasó, con halo si es hoy, vacío si falta */}
      <span
        className={`absolute -left-[6px] mt-4 w-3 h-3 rounded-full border-2 border-brand-paper flex items-center justify-center ${
          hecho || esActual ? fase.punto : omitido ? 'bg-brand-paper ring-1 ring-brand-ink/15' : 'bg-brand-ink/15'
        } ${esActual ? 'ring-4 ring-brand-gold/25' : ''}`}
        aria-hidden
      />
      <div
        className={`rounded-xl px-4 py-3 border transition-colors ${
          esActual
            ? 'bg-brand-cream border-brand-gold/50 shadow-sm'
            : hecho
              ? 'bg-brand-paper border-brand-ink/8'
              : omitido
                ? 'bg-transparent border-dashed border-brand-ink/12'
                : 'bg-brand-bone/40 border-brand-ink/6 opacity-50'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${sombreado || omitido ? 'bg-brand-ink/5 text-brand-ink/40' : fase.chip}`}>
            {paso.etiqueta}
          </span>
          <span
            className={`text-sm font-semibold ${
              omitido ? 'text-brand-ink/35 line-through' : sombreado ? 'text-brand-ink/50' : 'text-brand-ink'
            }`}
          >
            {paso.nombre}
          </span>
          {hecho && <Check size={13} className="text-emerald-600" aria-label="Hecho" />}
          {esActual && <span className="audit-badge bg-brand-gold/20 text-brand-ink/75">Hoy</span>}
          {paso.obligatorio && <span className="audit-badge bg-amber-50 text-amber-700">Obligatorio</span>}
          <span className="ml-auto text-[11px] text-brand-ink/40 tabular-nums">
            {cuandoPaso(paso.id, paso.dia)}
          </span>
        </div>
        {omitido ? (
          <div className="mt-1.5 text-[11px] text-brand-ink/35 italic">Omitido para este cliente</div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-brand-ink/45">
            <span className="flex items-center gap-1">
              <CanalIcon canal={paso.canal} />
              {paso.canal}
            </span>
            <span>Tono {paso.tono}</span>
            {paso.liga && (
              <span className="flex items-center gap-1 text-brand-ink/55">
                <Link2 size={11} />
                Liga de pago
              </span>
            )}
            {sombreado && (
              <span className="ml-auto italic">
                Se activa {paso.faltan === 1 ? 'mañana' : `en ${paso.faltan} días`}
              </span>
            )}
            {!sombreado && paso.resultado && (
              <span className="ml-auto font-semibold text-brand-ink/60">{paso.resultado}</span>
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function CanalIcon({ canal }: { canal: string }) {
  const Icon = CANAL_ICON[canal as keyof typeof CANAL_ICON] ?? MessageSquare;
  return <Icon size={11} />;
}


/** Línea de tiempo completa del plan: antes y después del vencimiento. */
export function LineaPlan({ pasos }: { pasos: PasoPlan[] }) {
  const vigentes = pasos.filter((p) => p.estado !== 'omitido');
  const hechos = vigentes.filter((p) => p.estado === 'hecho').length;
  const avance = Math.round((hechos / vigentes.length) * 100);
  const antes = pasos.filter((p) => p.fase === 'temprana');
  const despues = pasos.filter((p) => p.fase !== 'temprana');
  return (
    <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BlockTitle>Plan de cobranza</BlockTitle>
          <div className="flex items-center gap-3">
            {(Object.keys(FASES) as (keyof typeof FASES)[]).map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <FaseDot fase={f} />
                <span className="text-[10px] text-brand-ink/45">{FASES[f].label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Bar value={avance} tone="accent" delay={0.1} />
          </div>
          <span className="text-[11px] text-brand-ink/45 tabular-nums shrink-0">
            {hechos} de {vigentes.length} pasos
          </span>
        </div>

        <TramoPlan titulo="Antes del vencimiento" pasos={antes} inicio={0} />

        {/* Línea del vencimiento: separa la cobranza temprana de la vencida */}
        <div className="flex items-center gap-3 py-1" aria-hidden>
          <span className="h-px flex-1 bg-rose-200" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-500">
            Vencimiento
          </span>
          <span className="h-px flex-1 bg-rose-200" />
        </div>

        <TramoPlan titulo="Después del vencimiento" pasos={despues} inicio={antes.length} />
    </div>
  );
}
