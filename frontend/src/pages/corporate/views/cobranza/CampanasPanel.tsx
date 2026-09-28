import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Play, Plus } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle } from './primitives.tsx';
import { BUCKETS, CAMPANAS, PLANTILLAS, type Campana } from './mockV1.ts';

/**
 * Campañas grupales por bloques de vencimiento (buckets) y campañas
 * especiales (Buen Fin, Black Friday) o de servicio (validar contactos).
 * Flujo en 3 pasos: elige bloque → elige plantilla aprobada → lanza.
 */
const TONO_BUCKET: Record<string, string> = {
  preventiva: 'bg-emerald-500',
  temprana: 'bg-amber-300',
  media: 'bg-amber-500',
  alta: 'bg-rose-400',
  critica: 'bg-rose-600',
};

const ESTADO_ESTILO: Record<Campana['estado'], string> = {
  Activa: 'bg-emerald-50 text-emerald-700',
  Programada: 'bg-amber-50 text-amber-700',
  Borrador: 'bg-brand-ink/5 text-brand-ink/55',
};

type Tipo = Campana['tipo'];

export function CampanasPanel() {
  const reduce = useReducedMotion();
  const [campanas, setCampanas] = React.useState<Campana[]>(CAMPANAS);
  const [bucket, setBucket] = React.useState<string>(BUCKETS[0].id);
  const [tipo, setTipo] = React.useState<Tipo>('Bloque');
  const sugerida = { prev: 'N2', b1: 'A', b2: 'B', b3: 'B', b4: 'C', b5: 'D', b6: 'D', b7: 'D' }[bucket] ?? 'N2';
  const [plantilla, setPlantilla] = React.useState<string>(sugerida);
  const [facilidad, setFacilidad] = React.useState('Hasta 3 parcialidades sin recargo');

  React.useEffect(() => {
    if (tipo === 'Bloque') setPlantilla(sugerida);
  }, [sugerida, tipo]);

  const b = BUCKETS.find((x) => x.id === bucket)!;
  const p = PLANTILLAS.find((x) => x.id === plantilla)!;
  const disponibles = PLANTILLAS.filter((x) =>
    tipo === 'Servicio' ? x.grupo === 'Servicio' : tipo === 'Especial' ? x.grupo === 'Especial' : x.grupo === 'Preventiva' || x.grupo === 'Vencida',
  );

  const crear = () => {
    const nueva: Campana = {
      id: `c${Date.now()}`,
      nombre:
        tipo === 'Especial'
          ? `Especial · ${facilidad}`
          : tipo === 'Servicio'
            ? 'Validación de contactos'
            : `${b.rango === 'Por vencer' ? 'Preventiva' : 'Recuperación'} · ${b.rango}`,
      tipo,
      bucket: tipo === 'Servicio' ? 'Toda la cartera' : b.rango,
      plantilla: p.id,
      canal: p.canal,
      cuentas: tipo === 'Servicio' ? 64 : b.cuentas,
      estado: 'Borrador',
      detalle: tipo === 'Especial' ? facilidad : 'Lista para lanzar',
    };
    setCampanas((c) => [nueva, ...c]);
  };

  const lanzar = (id: string) =>
    setCampanas((c) => c.map((x) => (x.id === id ? { ...x, estado: 'Activa', detalle: 'Enviando ahora' } : x)));

  return (
    <div className="space-y-6">
      {/* Bloques: la cartera repartida por días de vencimiento */}
      <Reveal>
        <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6">
          <div className="flex items-baseline justify-between gap-3">
            <BlockTitle>Cartera por bloques de vencimiento</BlockTitle>
            <span className="text-[11px] text-brand-ink/40">Elige un bloque para armar su campaña</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {BUCKETS.map((x) => {
              const activo = bucket === x.id && tipo !== 'Servicio';
              return (
                <button
                  key={x.id}
                  onClick={() => {
                    setBucket(x.id);
                    if (tipo === 'Servicio') setTipo('Bloque');
                  }}
                  className={`relative text-left rounded-2xl border px-4 py-3 transition-colors ${
                    activo ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-ink/8 hover:bg-brand-bone'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${TONO_BUCKET[x.tono]}`} />
                    <span className="text-[12px] font-semibold text-brand-ink">{x.rango}</span>
                  </span>
                  <span className="block text-lg font-serif text-brand-ink mt-1 tabular-nums">
                    {CURRENCY_FORMATTER.format(x.monto)}
                  </span>
                  <span className="block text-[11px] text-brand-ink/45 tabular-nums">
                    {x.cuentas} cuentas{x.detalle ? ` · ${x.detalle}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Creador en 3 pasos */}
      <Reveal delay={0.06}>
        <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 space-y-5">
          <BlockTitle>Nueva campaña</BlockTitle>

          <Paso n={1} titulo="Tipo">
            <div className="flex flex-wrap gap-2">
              {(['Bloque', 'Especial', 'Servicio'] as Tipo[]).map((t) => (
                <Chip key={t} activo={tipo === t} onClick={() => {
                  setTipo(t);
                  setPlantilla(t === 'Especial' ? 'E1' : t === 'Servicio' ? 'S1' : sugerida);
                }}>
                  {t === 'Bloque' ? 'Por bloque de vencimiento' : t === 'Especial' ? 'Especial (Buen Fin, Black Friday…)' : 'Servicio · validar contactos'}
                </Chip>
              ))}
            </div>
            {tipo === 'Especial' && (
              <input
                value={facilidad}
                onChange={(e) => setFacilidad(e.target.value)}
                className="mt-3 w-full sm:w-96 px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-sm text-brand-ink outline-none focus:border-brand-gold/60"
                placeholder="Facilidad de pago que se ofrece"
              />
            )}
          </Paso>

          <Paso n={2} titulo="Plantilla aprobada">
            <div className="flex flex-wrap gap-2">
              {disponibles.map((x) => (
                <Chip key={x.id} activo={plantilla === x.id} onClick={() => setPlantilla(x.id)}>
                  {x.etapa} · {x.nombre}
                  {x.id === sugerida && tipo === 'Bloque' && <span className="ml-1.5 text-brand-gold">sugerida</span>}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-xs text-brand-ink/55 leading-relaxed bg-brand-bone/50 rounded-xl px-4 py-3 border border-brand-ink/6">
              {p.texto}
            </p>
          </Paso>

          <Paso n={3} titulo="Revisar y crear">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-brand-ink/70">
                {tipo === 'Servicio' ? '64 cuentas (toda la cartera)' : `${b.cuentas} cuentas · ${b.rango}`} · por{' '}
                <span className="font-semibold text-brand-ink">{p.canal}</span>
                {p.estado !== 'Aprobada' && (
                  <span className="ml-2 text-amber-700 text-[11px] font-semibold">Plantilla en revisión: se podrá lanzar al aprobarse</span>
                )}
              </p>
              <button
                onClick={crear}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors"
              >
                <Plus size={14} /> Crear campaña
              </button>
            </div>
          </Paso>
        </div>
      </Reveal>

      {/* Campañas existentes */}
      <Reveal delay={0.1}>
        <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-ink/8">
            <BlockTitle>Campañas</BlockTitle>
          </div>
          <div className="divide-y divide-brand-ink/6">
            {campanas.map((c) => {
              const pl = PLANTILLAS.find((x) => x.id === c.plantilla);
              const puedeLanzar = c.estado === 'Borrador' && pl?.estado === 'Aprobada';
              return (
                <motion.div
                  key={c.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="flex flex-wrap items-center gap-4 px-6 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-brand-ink">{c.nombre}</span>
                      <span className={`audit-badge ${ESTADO_ESTILO[c.estado]}`}>{c.estado}</span>
                    </div>
                    <div className="text-[11px] text-brand-ink/45 mt-1">
                      {c.tipo} · {c.bucket} · {pl?.etapa} {pl?.nombre} · {c.canal} · {c.cuentas} cuentas
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.respuesta !== undefined ? (
                      <div className="text-sm font-semibold text-brand-ink tabular-nums">{c.respuesta}% respuesta</div>
                    ) : null}
                    <div className="text-[11px] text-brand-ink/45">{c.detalle}</div>
                  </div>
                  {c.estado === 'Borrador' && (
                    <button
                      onClick={() => lanzar(c.id)}
                      disabled={!puedeLanzar}
                      title={puedeLanzar ? 'Lanzar campaña' : 'La plantilla aún no está aprobada'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-gold/50 text-[12px] font-semibold text-brand-ink hover:bg-brand-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play size={12} /> Lanzar
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-6 h-6 shrink-0 rounded-full bg-brand-ink text-brand-paper text-[11px] font-semibold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-brand-ink mb-2">{titulo}</div>
        {children}
      </div>
    </div>
  );
}

export function Chip({
  activo,
  onClick,
  children,
}: {
  key?: string;
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
        activo
          ? 'bg-brand-ink text-brand-paper border-brand-ink'
          : 'border-brand-ink/12 text-brand-ink/65 hover:bg-brand-bone'
      }`}
    >
      {children}
    </button>
  );
}
