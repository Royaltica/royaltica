import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CloudUpload, Copy, Info, Mail, MessageCircle, Phone, Quote } from 'lucide-react';
import { SPRING, SPRING_SUAVE, BotonPrincipal, BotonSecundario } from './campanasUi.tsx';
import { Subpestanas } from './vidrio.tsx';
import { useCobranza } from './store.tsx';
import { CAUSAS, EJEMPLO_VARS, TIPOS_DEUDOR, tipoDeudor, type CausaDeudor, type TipoDeudor } from './catalogoDeudores.ts';
import { AsistenteTiposDeudor, CatalogoTipos, ChipCausa, IconoCausa } from './TiposDeudor.tsx';

// Plantillas por tipo de deudor: se elige un tipo activo y se ve su camino
// de mensajes, antes y después del vencimiento, como los recibiría el cliente.

type Tramo = 'antes' | 'despues';
type Mensaje =
  | { id: string; etapa: string; cuando: string; titulo: string; canal: 'whatsapp'; texto: string }
  | { id: string; etapa: string; cuando: string; titulo: string; canal: 'correo'; asunto: string; texto: string }
  | { id: string; etapa: string; cuando: string; titulo: string; canal: 'llamada'; guion: string[] };

function mensajesDe(t: TipoDeudor, tramo: Tramo): Mensaje[] {
  if (tramo === 'antes') {
    return [
      { id: 'pre', etapa: 'Niveles 1 a 3', cuando: '14, 7 y 3 días antes', titulo: 'Recordatorio previo', canal: 'whatsapp', texto: t.pla.pre },
      { id: 'hoy', etapa: 'Nivel 4', cuando: 'El día que vence', titulo: 'Vence hoy', canal: 'whatsapp', texto: t.pla.hoy },
    ];
  }
  return [
    { id: 'a', etapa: 'Etapa A', cuando: '1 día después', titulo: 'Primer aviso', canal: 'whatsapp', texto: t.pla.a },
    { id: 'b', etapa: 'Etapa B', cuando: '7 días después', titulo: 'Seguimiento', canal: 'whatsapp', texto: t.pla.b },
    { id: 'c', etapa: 'Etapa C', cuando: '20 días después', titulo: 'Notificación formal', canal: 'correo', asunto: t.pla.c.asunto, texto: t.pla.c.txt },
    { id: 'd', etapa: 'Etapa D', cuando: '35 días después', titulo: 'Negociación', canal: 'llamada', guion: t.pla.d },
  ];
}

const llenar = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (m, k: string) => EJEMPLO_VARS[k] ?? m);

/** Variables resaltadas: con ejemplo se ve el dato; sin él, el nombre de la variable. */
function Texto({ texto, ejemplo, oscuro = false }: { texto: string; ejemplo: boolean; oscuro?: boolean }) {
  return (
    <>
      {texto.split(/(\{\{\w+\}\})/g).map((p, i) => {
        const m = /^\{\{(\w+)\}\}$/.exec(p);
        if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
        return (
          <span
            key={i}
            className={`rounded px-1 font-semibold ${oscuro ? 'bg-white/15 text-brand-gold' : 'bg-cyan-500/12 text-cyan-800'}`}
          >
            {ejemplo ? (EJEMPLO_VARS[m[1]] ?? m[1]) : m[1].replace(/_/g, ' ')}
          </span>
        );
      })}
    </>
  );
}

export function PlantillasPorTipo({ onIrSegmentos }: { onIrSegmentos?: () => void }) {
  const reduce = useReducedMotion();
  const { tiposDeudor, cartera } = useCobranza();
  const [asistente, setAsistente] = React.useState(false);
  const [catalogo, setCatalogo] = React.useState(false);
  const activos = (tiposDeudor?.activos ?? []).map(tipoDeudor).filter(Boolean) as TipoDeudor[];
  const [elegido, setElegido] = React.useState<string | null>(null);
  const [tramo, setTramo] = React.useState<Tramo>('antes');
  const [ejemplo, setEjemplo] = React.useState(true);
  const tipo = activos.find((t) => t.id === elegido) ?? activos[0];
  const cuantos = (id: string) => Object.entries(tiposDeudor?.asignaciones ?? {}).filter(([cid, t]) => t === id && cartera.some((c) => c.id === cid)).length;

  if (!tiposDeudor || !activos.length) {
    return (
      <>
        <div className="glass relative overflow-hidden rounded-[30px] px-6 py-14 flex flex-col items-center text-center">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-[rgb(var(--acento)/0.14)] blur-[90px]" />
          <div className="relative flex -space-x-2">
            {(Object.keys(CAUSAS) as CausaDeudor[]).map((c, i) => (
              <motion.span
                key={c}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: reduce ? 0 : i * 0.07 }}
                className="rounded-2xl ring-4 ring-white/70"
              >
                <IconoCausa causa={c} />
              </motion.span>
            ))}
          </div>
          <h3 className="relative text-[24px] text-brand-ink leading-tight mt-6">Plantillas hechas para cada tipo de deudor</h3>
          <p className="relative text-[13.5px] text-brand-ink/55 mt-2 max-w-[50ch] leading-relaxed">
            Al importar el análisis de tu cartera, aquí verás los tipos que tienes y los mensajes que recibe cada uno.
          </p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-2">
            <BotonPrincipal onClick={() => setAsistente(true)}>
              <CloudUpload size={15} /> Importar análisis
            </BotonPrincipal>
            <BotonSecundario onClick={() => setCatalogo(true)}>Ver los {TIPOS_DEUDOR.length} tipos</BotonSecundario>
          </div>
        </div>
        <AnimatePresence>{asistente && <AsistenteTiposDeudor onCerrar={() => setAsistente(false)} />}</AnimatePresence>
        {catalogo && <CatalogoTipos onCerrar={() => setCatalogo(false)} />}
      </>
    );
  }

  const mensajes = mensajesDe(tipo, tramo);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
      {/* Tipos activos */}
      <aside className="glass rounded-[28px] p-2 xl:sticky xl:top-4">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
          <span className="text-[13px] font-semibold text-brand-ink">Tipos activos</span>
          <span className="rounded-full bg-brand-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-ink/55">{activos.length}</span>
          {onIrSegmentos && (
            <button type="button" onClick={onIrSegmentos} className="ml-auto text-[11.5px] font-semibold text-brand-ink/45 hover:text-brand-ink">
              Cambiar
            </button>
          )}
        </div>
        <div className="flex xl:flex-col gap-1 overflow-x-auto xl:overflow-visible [scrollbar-width:none]">
          {activos.map((t) => {
            const on = t.id === tipo.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setElegido(t.id)}
                aria-pressed={on}
                className={`relative shrink-0 xl:w-full flex items-center gap-3 rounded-[20px] px-2.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${on ? '' : 'hover:bg-white/55'}`}
              >
                {on && (
                  <motion.span
                    layoutId={reduce ? undefined : 'tipo-plantilla'}
                    transition={SPRING}
                    className="absolute inset-0 rounded-[20px] bg-white/90 ring-1 ring-[rgb(var(--acento)/0.3)] shadow-[0_10px_26px_-16px_rgba(17,24,39,0.35)]"
                  />
                )}
                <span className="relative">
                  <IconoCausa causa={t.causa} size="sm" />
                </span>
                <span className="relative min-w-0 pr-2">
                  <span className="block text-[13px] font-semibold text-brand-ink truncate">{t.name}</span>
                  <span className="block text-[11px] text-brand-ink/45 tabular-nums">
                    {cuantos(t.id)} {cuantos(t.id) === 1 ? 'cliente' : 'clientes'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* El tipo elegido */}
      <motion.section
        key={tipo.id}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SUAVE}
        className="glass rounded-[28px] overflow-hidden min-w-0"
      >
        <div className="relative px-6 sm:px-7 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32"
            style={{ background: `linear-gradient(180deg, rgb(${CAUSAS[tipo.causa].color} / 0.1), transparent)` }}
          />
          <div className="relative flex flex-wrap items-start gap-4">
            <IconoCausa causa={tipo.causa} size="lg" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[26px] leading-tight text-brand-ink">{tipo.name}</h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <ChipCausa causa={tipo.causa} />
                <span className="rounded-full bg-brand-ink/[0.05] px-2.5 py-1 text-[11px] font-semibold text-brand-ink/60">{tipo.seg === 'B2B' ? 'Empresa' : 'Persona'}</span>
                <span className="rounded-full bg-brand-ink/[0.05] px-2.5 py-1 text-[11px] font-semibold text-brand-ink/60">Tono {tipo.tono.toLowerCase()}</span>
              </div>
            </div>
          </div>
          <p className="relative text-[13.5px] text-brand-ink/60 leading-relaxed mt-4 max-w-[70ch]">{tipo.def}</p>
          <div className="relative mt-4 flex items-start gap-3 rounded-2xl bg-white/60 ring-1 ring-brand-ink/[0.06] px-4 py-3">
            <Quote size={15} className="text-brand-gold shrink-0 mt-0.5" />
            <p className="text-[12.5px] leading-relaxed text-brand-ink/70">
              <span className="font-semibold text-brand-ink">Lo que funciona:</span> {tipo.pal}
            </p>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            <Subpestanas
              grupo="tramo-tipo"
              etiqueta="Momento del cobro"
              valor={tramo}
              onChange={setTramo}
              opciones={[
                { id: 'antes', nombre: 'Antes del vencimiento', n: 2 },
                { id: 'despues', nombre: 'Después del vencimiento', n: 4 },
              ]}
            />
            <button
              type="button"
              role="switch"
              aria-checked={ejemplo}
              onClick={() => setEjemplo((v) => !v)}
              className="ml-auto inline-flex items-center gap-2 text-[12px] font-semibold text-brand-ink/55 hover:text-brand-ink"
            >
              <span className={`relative w-8 h-[18px] rounded-full transition-colors ${ejemplo ? 'bg-brand-ink' : 'bg-brand-ink/15'}`}>
                <motion.span className="absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white" animate={{ x: ejemplo ? 14 : 0 }} transition={SPRING} />
              </span>
              Con datos de ejemplo
            </button>
          </div>
        </div>

        {/* El camino de mensajes */}
        <div className="border-t border-brand-ink/[0.06] px-6 sm:px-7 py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={`${tipo.id}-${tramo}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="relative space-y-5"
            >
              <span aria-hidden className="absolute left-[19px] top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-[rgb(var(--acento)/0.35)] to-brand-ink/[0.05]" />
              {mensajes.map((m, i) => (
                <PasoMensaje key={m.id} m={m} i={i} ejemplo={ejemplo} />
              ))}
            </motion.ol>
          </AnimatePresence>

          {tramo === 'despues' && (
            <div className="mt-6 rounded-[22px] bg-white/55 ring-1 ring-brand-ink/[0.06] p-4 sm:p-5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-ink/40">Si contesta</div>
              <div className="mt-3 space-y-2">
                <div className="flex justify-start">
                  <p className="max-w-[80%] rounded-[18px] rounded-bl-md bg-white ring-1 ring-brand-ink/[0.06] px-3.5 py-2.5 text-[13px] text-brand-ink/80">{tipo.pla.r.si}</p>
                </div>
                <div className="flex justify-end">
                  <p className="max-w-[80%] rounded-[18px] rounded-br-md bg-brand-ink text-white px-3.5 py-2.5 text-[13px] leading-relaxed">
                    <Texto texto={tipo.pla.r.resp} ejemplo={ejemplo} oscuro />
                  </p>
                </div>
              </div>
            </div>
          )}
          {tipo.pla.pnota && (
            <p className="mt-4 flex items-start gap-2 text-[11.5px] text-brand-ink/45">
              <Info size={13} className="shrink-0 mt-0.5" /> {tipo.pla.pnota}
            </p>
          )}
        </div>
      </motion.section>
    </div>
  );
}

const CANAL = {
  whatsapp: { Icono: MessageCircle, nombre: 'WhatsApp', color: 'bg-emerald-500 text-white' },
  correo: { Icono: Mail, nombre: 'Correo', color: 'bg-sky-500 text-white' },
  llamada: { Icono: Phone, nombre: 'Llamada', color: 'bg-brand-ink text-brand-gold' },
} as const;

function PasoMensaje({ m, i, ejemplo }: { key?: string; m: Mensaje; i: number; ejemplo: boolean }) {
  const reduce = useReducedMotion();
  const c = CANAL[m.canal];
  const copia = m.canal === 'llamada' ? m.guion.map((g, n) => `${n + 1}. ${g}`).join('\n') : m.canal === 'correo' ? `${m.asunto}\n\n${m.texto}` : m.texto;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_SUAVE, delay: reduce ? 0 : 0.05 + i * 0.07 }}
      className="relative flex gap-4"
    >
      <span className={`relative z-[1] w-10 h-10 shrink-0 rounded-full flex items-center justify-center ring-4 ring-white/80 ${c.color}`}>
        <c.Icono size={16} />
      </span>
      <div className="group min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[14px] font-semibold text-brand-ink">{m.titulo}</span>
          <span className="text-[11.5px] text-brand-ink/40">
            {m.etapa} · {m.cuando} · {c.nombre}
          </span>
          <span className="ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <Copiar texto={ejemplo ? llenar(copia) : copia} />
          </span>
        </div>

        {m.canal === 'whatsapp' && (
          <div className="mt-2 max-w-[560px] rounded-[20px] rounded-tl-md bg-white ring-1 ring-brand-ink/[0.06] shadow-[0_8px_22px_-16px_rgba(17,24,39,0.4)] px-4 py-3">
            <p className="text-[13px] leading-relaxed text-brand-ink/80">
              <Texto texto={m.texto} ejemplo={ejemplo} />
            </p>
          </div>
        )}
        {m.canal === 'correo' && (
          <div className="mt-2 max-w-[620px] rounded-[20px] bg-white ring-1 ring-brand-ink/[0.06] shadow-[0_8px_22px_-16px_rgba(17,24,39,0.4)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-brand-ink/[0.06] bg-sky-50/60 text-[12.5px]">
              <span className="text-brand-ink/40">Asunto: </span>
              <span className="font-semibold text-brand-ink">
                <Texto texto={m.asunto} ejemplo={ejemplo} />
              </span>
            </div>
            <p className="px-4 py-3 text-[13px] leading-relaxed text-brand-ink/75">
              <Texto texto={m.texto} ejemplo={ejemplo} />
            </p>
          </div>
        )}
        {m.canal === 'llamada' && (
          <ol className="mt-2 max-w-[620px] rounded-[20px] bg-brand-ink text-white px-4 py-3.5 space-y-2">
            {m.guion.map((g, n) => (
              <li key={n} className="flex gap-3 text-[13px] leading-relaxed">
                <span className="w-5 h-5 shrink-0 rounded-full bg-white/10 text-[10.5px] font-bold text-brand-gold flex items-center justify-center mt-0.5">{n + 1}</span>
                <span className="text-white/85">
                  <Texto texto={g} ejemplo={ejemplo} oscuro />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </motion.li>
  );
}

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard?.writeText(texto).then(() => {
          setOk(true);
          window.setTimeout(() => setOk(false), 1600);
        })
      }
      className="inline-flex items-center gap-1 rounded-full bg-white/80 ring-1 ring-brand-ink/10 px-2.5 py-1 text-[11px] font-semibold text-brand-ink/60 hover:text-brand-ink"
    >
      {ok ? <Check size={11} /> : <Copy size={11} />} {ok ? 'Copiado' : 'Copiar'}
    </button>
  );
}
