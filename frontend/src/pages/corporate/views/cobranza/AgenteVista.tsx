import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, Clock, Copy, MapPin, Phone } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, Bar } from './primitives.tsx';
import { MIS_CUENTAS, PLANTILLAS, llenarPlantilla, type CuentaAgente } from './mockV1.ts';

/**
 * Vista del Agente / Ejecutivo. Pensada para alta rotación: se entiende sin
 * capacitación. Solo lo necesario para contactar: a quién, a qué teléfono,
 * si se puede llamar ahora, cuánto debe y qué decir (plantilla aprobada).
 * Sin gráficas, sin configuración, sin pestañas.
 */
const RESULTADOS = [
  { id: 'contactado', label: 'Contactado' },
  { id: 'promesa', label: 'Promesa de pago' },
  { id: 'no_contesto', label: 'No contestó' },
  { id: 'disputa', label: 'Disputa' },
  { id: 'escalar', label: 'Escalar a supervisor' },
] as const;
type ResultadoId = (typeof RESULTADOS)[number]['id'];

function situacion(dias: number): { texto: string; clase: string } {
  if (dias < 0) return { texto: `Vence en ${-dias} ${dias === -1 ? 'día' : 'días'}`, clase: 'text-emerald-700' };
  if (dias === 0) return { texto: 'Vence hoy', clase: 'text-amber-700' };
  return { texto: `${dias} ${dias === 1 ? 'día' : 'días'} vencida`, clase: 'text-rose-600' };
}

export function AgenteVista() {
  const [hechas, setHechas] = React.useState<Record<string, ResultadoId>>({});
  const [abierta, setAbierta] = React.useState<string | null>(MIS_CUENTAS[0].id);

  // Primero lo que se puede contactar ahora; lo gestionado se va al final.
  const pendientes = MIS_CUENTAS.filter((c) => !hechas[c.id]).sort(
    (a, b) => Number(b.contactable) - Number(a.contactable),
  );
  const listas = MIS_CUENTAS.filter((c) => hechas[c.id]);
  const avance = Math.round((listas.length / MIS_CUENTAS.length) * 100);
  const ahora = MIS_CUENTAS.filter((c) => c.contactable && !hechas[c.id]).length;

  const registrar = (id: string, r: ResultadoId) => {
    setHechas((h) => ({ ...h, [id]: r }));
    const siguiente = pendientes.find((c) => c.id !== id && c.contactable);
    setAbierta(siguiente?.id ?? null);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Reveal>
        <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-brand-ink/55">Hola, Ana. Estas son tus cuentas de hoy.</p>
              <p className="text-2xl font-serif text-brand-ink mt-1">
                {ahora} para contactar ahora
              </p>
            </div>
            <span className="text-[11px] text-brand-ink/45 tabular-nums">
              {listas.length} de {MIS_CUENTAS.length} gestionadas
            </span>
          </div>
          <div className="mt-4">
            <Bar value={avance} tone="positivo" />
          </div>
        </div>
      </Reveal>

      <div className="space-y-3">
        {pendientes.map((c, i) => (
          <Reveal key={c.id} delay={0.04 + i * 0.04}>
            <TarjetaCuenta
              cuenta={c}
              abierta={abierta === c.id}
              onToggle={() => setAbierta(abierta === c.id ? null : c.id)}
              onResultado={(r) => registrar(c.id, r)}
            />
          </Reveal>
        ))}
      </div>

      {listas.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-2">
            Gestionadas hoy
          </div>
          <ul className="space-y-2">
            {listas.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-brand-bone/60 border border-brand-ink/6"
              >
                <span className="flex items-center gap-2 text-sm text-brand-ink/60">
                  <Check size={14} className="text-emerald-600" />
                  {c.cliente}
                </span>
                <span className="text-[11px] font-semibold text-brand-ink/55">
                  {RESULTADOS.find((r) => r.id === hechas[c.id])?.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TarjetaCuenta({
  cuenta: c,
  abierta,
  onToggle,
  onResultado,
}: {
  cuenta: CuentaAgente;
  abierta: boolean;
  onToggle: () => void;
  onResultado: (r: ResultadoId) => void;
}) {
  const reduce = useReducedMotion();
  const [copiado, setCopiado] = React.useState(false);
  const plantilla = PLANTILLAS.find((p) => p.id === c.plantilla)!;
  const monto = CURRENCY_FORMATTER.format(c.saldo);
  const mensaje = llenarPlantilla(plantilla.texto, c, monto);
  const sit = situacion(c.dias);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* sin permiso de portapapeles: no pasa nada */
    }
  };

  return (
    <div
      className={`rounded-3xl border bg-brand-paper transition-colors ${
        abierta ? 'border-brand-gold/50 shadow-sm' : 'border-brand-ink/10'
      } ${c.contactable ? '' : 'opacity-60'}`}
    >
      <button onClick={onToggle} className="w-full text-left px-6 py-5" aria-expanded={abierta}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-brand-ink truncate">{c.cliente}</div>
            <div className="text-sm text-brand-ink/60 mt-0.5">
              {c.contacto} · {c.puesto}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-semibold text-brand-ink tabular-nums">{monto}</div>
            <div className={`text-[11px] font-semibold mt-0.5 ${sit.clase}`}>{sit.texto}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[12px]">
          <span className="flex items-center gap-1.5 font-semibold text-brand-ink tabular-nums">
            <Phone size={13} className="text-brand-ink/40" />
            {c.telefono}
          </span>
          <span className="flex items-center gap-1.5 text-brand-ink/55">
            <MapPin size={13} className="text-brand-ink/35" />
            {c.ciudad}
          </span>
          <span className="flex items-center gap-1.5 text-brand-ink/55 tabular-nums">
            <Clock size={13} className="text-brand-ink/35" />
            {c.horaLocal} hora local ({c.zona})
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${c.contactable ? 'bg-emerald-500' : 'bg-brand-ink/25'}`} />
            <span className={c.contactable ? 'text-emerald-700 font-semibold' : 'text-brand-ink/50'}>
              {c.contactable ? 'Puedes contactar ahora' : c.motivo}
            </span>
            <ChevronDown
              size={15}
              className={`text-brand-ink/35 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4 border-t border-brand-ink/8 pt-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
                    Qué decir · {plantilla.etapa} · {plantilla.canal}
                  </span>
                  <button
                    onClick={copiar}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-ink/55 hover:text-brand-ink transition-colors"
                  >
                    {copiado ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-brand-ink/80 leading-relaxed bg-brand-bone/60 border border-brand-ink/6 rounded-2xl px-4 py-3">
                  {mensaje}
                </p>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-2">
                  ¿Cómo te fue?
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {RESULTADOS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onResultado(r.id)}
                      disabled={!c.contactable}
                      className={`px-3 py-2.5 rounded-xl text-[12px] font-semibold border transition-colors disabled:cursor-not-allowed ${
                        r.id === 'escalar'
                          ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                          : 'border-brand-ink/12 text-brand-ink/75 hover:bg-brand-cream hover:border-brand-gold/40'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
