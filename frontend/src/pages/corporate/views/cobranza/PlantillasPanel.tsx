import React from 'react';
import { Check, Copy, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { Reveal, BlockTitle } from './primitives.tsx';
import { Subpestanas } from './vidrio.tsx';
import { BTN_SEC } from './clientes.tsx';
import { PLANTILLAS, llenarPlantilla, type Plantilla } from './mockV1.ts';
import { useCobranza, type CuentaViva } from './store.tsx';

/** Administrador de plantillas de WhatsApp en Meta (ahí se editan y reenvían a revisión). */
const META_PLANTILLAS = 'https://business.facebook.com/wa/manage/message-templates/';

/** Valor de cada variable para un cliente real (las mismas llaves que usa el backend). */
const valoresDe = (c: CuentaViva): Record<string, string> =>
  Object.fromEntries(['cliente', 'contacto', 'folio', 'monto', 'fecha', 'dias', 'oferta', 'liga'].map((k) => [k, llenarPlantilla(`{{${k}}}`, c)]));

/** Texto tal como lo recibiría el cliente (para copiar). */
function textoLleno(texto: string, vars?: string[], valores?: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const nombre = vars && /^\d+$/.test(k) ? (vars[Number(k) - 1] ?? k) : k;
    return valores?.[nombre] ?? `{{${nombre}}}`;
  });
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => {
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 1800);
        });
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-ink/12 text-[11px] font-semibold text-brand-ink/65 hover:bg-white/70 transition-colors"
    >
      {copiado ? <Check size={11} /> : <Copy size={11} />} {copiado ? 'Copiado' : 'Copiar texto'}
    </button>
  );
}
import { api, type WaTemplatesStatus } from '../../../../services/apiClient.ts';
import { PlantillasPorTipo } from './PlantillasTipo.tsx';

/**
 * Plantillas por etapa. Las de WhatsApp son las REALES (las mismas que manda
 * el WhatsApp de cada cliente, ver api/src/whatsapp/collection-templates.ts)
 * con su estado de aprobación en Meta. Correo y llamada no pasan por Meta.
 * Las de servicio y campañas todavía son borradores (no están en Meta).
 */
const GRUPOS: Plantilla['grupo'][] = ['Preventiva', 'Vencida', 'Servicio', 'Especial'];
const NOMBRE_GRUPO: Record<Plantilla['grupo'], string> = {
  Preventiva: 'Antes del vencimiento',
  Vencida: 'Después del vencimiento',
  Servicio: 'Servicio',
  Especial: 'Campañas',
};
/** Nivel → grupo (las de WhatsApp reales). */
const GRUPO_DE_NIVEL: Record<string, Plantilla['grupo']> = { N0: 'Preventiva', N1: 'Preventiva', N2: 'Preventiva', N3: 'Preventiva', N4: 'Preventiva', A: 'Vencida', B: 'Vencida' };

type Real = WaTemplatesStatus['templates'][number];

const ESTADO_META: Record<string, { texto: string; clase: string }> = {
  APPROVED: { texto: 'Aprobada por Meta', clase: 'bg-emerald-50 text-emerald-700' },
  PENDING: { texto: 'En revisión de Meta', clase: 'bg-amber-50 text-amber-700' },
  IN_APPEAL: { texto: 'En apelación', clase: 'bg-amber-50 text-amber-700' },
  REJECTED: { texto: 'Rechazada por Meta', clase: 'bg-rose-50 text-rose-700' },
  PAUSED: { texto: 'Pausada por Meta', clase: 'bg-rose-50 text-rose-700' },
  DISABLED: { texto: 'Desactivada por Meta', clase: 'bg-rose-50 text-rose-700' },
  MISSING: { texto: 'No está en Meta', clase: 'bg-rose-50 text-rose-700' },
};

/** Resalta las variables para que se vea qué se llena solo. */
function TextoConVariables({ texto, vars, valores }: { texto: string; vars?: string[]; valores?: Record<string, string> }) {
  return (
    <>
      {texto.split(/(\{\{\w+\}\})/g).map((parte, i) => {
        const m = /^\{\{(\w+)\}\}$/.exec(parte);
        if (!m) return <React.Fragment key={i}>{parte}</React.Fragment>;
        const nombre = vars && /^\d+$/.test(m[1]) ? (vars[Number(m[1]) - 1] ?? m[1]) : m[1];
        return (
          <span key={i} className="px-1 rounded bg-brand-gold/15 text-brand-ink font-semibold">
            {valores?.[nombre] ?? nombre}
          </span>
        );
      })}
    </>
  );
}

export function PlantillasPanel({ onIrSegmentos }: { onIrSegmentos?: () => void } = {}) {
  const [vista, setVista] = React.useState<'tipos' | 'meta'>('tipos');
  return (
    <div className="space-y-5">
      <Subpestanas
        grupo="plantillas-vista"
        etiqueta="Qué plantillas ver"
        valor={vista}
        onChange={setVista}
        opciones={[
          { id: 'tipos', nombre: 'Por tipo de deudor' },
          { id: 'meta', nombre: 'WhatsApp aprobadas por Meta' },
        ]}
      />
      {vista === 'tipos' ? <PlantillasPorTipo onIrSegmentos={onIrSegmentos} /> : <PlantillasMeta />}
    </div>
  );
}

function PlantillasMeta() {
  const [grupo, setGrupo] = React.useState<Plantilla['grupo']>('Preventiva');
  const [estado, setEstado] = React.useState<WaTemplatesStatus | null | undefined>(undefined);
  const { cartera } = useCobranza();
  // Vista previa con los datos de un cliente real.
  const [clienteId, setClienteId] = React.useState('');
  const muestra = cartera.find((c) => c.id === clienteId);
  const valores = muestra ? valoresDe(muestra) : undefined;
  React.useEffect(() => {
    api.getWaTemplates().then(setEstado).catch(() => setEstado(null));
  }, []);

  const reales = (estado?.templates ?? []).filter((t) => GRUPO_DE_NIVEL[t.level] === grupo);
  // Del prototipo solo queda lo que NO es WhatsApp de una etapa (correo,
  // llamada) y lo de servicio/campañas: lo demás ya es la plantilla real.
  const otras = PLANTILLAS.filter(
    (p) => p.grupo === grupo && !(p.canal === 'WhatsApp' && (p.grupo === 'Preventiva' || p.grupo === 'Vencida')),
  );
  const cuenta = (g: Plantilla['grupo']) =>
    (estado?.templates ?? []).filter((t) => GRUPO_DE_NIVEL[t.level] === g).length +
    PLANTILLAS.filter((p) => p.grupo === g && !(p.canal === 'WhatsApp' && (g === 'Preventiva' || g === 'Vencida'))).length;

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="glass flex items-start gap-3 px-5 py-4 rounded-[24px]">
          <ShieldCheck size={18} className="text-brand-gold shrink-0 mt-0.5" />
          <p className="text-sm text-brand-ink/70 leading-relaxed max-w-[80ch]">
            <span className="font-semibold text-brand-ink">Por WhatsApp, el primer contacto de cada etapa es su plantilla aprobada.</span>{' '}
            Se llenan solos los datos resaltados. Cuando el cliente contesta, la IA redacta la respuesta y una persona la aprueba.{' '}
            {estado === undefined
              ? ''
              : estado?.metaConectado
                ? 'El estado de cada plantilla viene de Meta.'
                : 'Falta conectar con Meta (WHATSAPP_TOKEN y WHATSAPP_WABA_ID) para ver si cada una ya está aprobada.'}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="flex flex-wrap items-center gap-2">
          <Subpestanas
            grupo="plantillas"
            etiqueta="Grupo de plantillas"
            valor={grupo}
            onChange={setGrupo}
            opciones={GRUPOS.map((g) => ({ id: g, nombre: NOMBRE_GRUPO[g], n: cuenta(g) }))}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-brand-ink/50" htmlFor="plantilla-muestra">
              Ver con los datos de
            </label>
            <select
              id="plantilla-muestra"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="px-3 py-1.5 rounded-2xl glass-campo text-[12px] font-semibold text-brand-ink outline-none focus:border-brand-gold/60"
            >
              <option value="">Variables (sin cliente)</option>
              {cartera.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cliente}
                </option>
              ))}
            </select>
            <a
              href={META_PLANTILLAS}
              target="_blank"
              rel="noreferrer"
              className={BTN_SEC}
            >
              <ExternalLink size={11} /> Abrir en Meta
            </a>
          </div>
        </div>
      </Reveal>

      {estado === undefined && (grupo === 'Preventiva' || grupo === 'Vencida') && (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-brand-ink/40" />
        </div>
      )}
      {estado === null && (grupo === 'Preventiva' || grupo === 'Vencida') && (
        <p className="text-sm text-brand-ink/50">No se pudo conectar con el servidor para leer las plantillas de WhatsApp.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reales.map((t, i) => (
          <Reveal key={t.name} delay={0.08 + i * 0.04}>
            <TarjetaReal t={t} valores={valores} />
          </Reveal>
        ))}
        {otras.map((p, i) => (
          <Reveal key={p.id} delay={0.08 + (reales.length + i) * 0.04}>
            <TarjetaOtra p={p} cuenta={muestra} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function TarjetaReal({ t, valores }: { t: Real; valores?: Record<string, string> }) {
  const rechazada = t.metaStatus === 'REJECTED' || t.metaStatus === 'PAUSED' || t.metaStatus === 'DISABLED' || t.metaStatus === 'MISSING';
  const [nivel, nombre] = t.label.split(' · ');
  const est = t.metaStatus ? (ESTADO_META[t.metaStatus] ?? { texto: t.metaStatus, clase: 'bg-brand-ink/5 text-brand-ink/60' }) : null;
  return (
    <article className="glass rounded-[28px] p-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BlockTitle>{nivel} · WhatsApp</BlockTitle>
          <h4 className="text-lg font-serif text-brand-ink mt-1">{nombre}</h4>
          <p className="text-[11px] text-brand-ink/40 font-mono mt-0.5">{t.name}</p>
        </div>
        <span className={`audit-badge shrink-0 ${est ? est.clase : 'bg-brand-ink/5 text-brand-ink/50'}`}>
          {est ? est.texto : 'Sin conexión con Meta'}
        </span>
      </div>
      <p className="text-sm text-brand-ink/70 leading-relaxed mt-4 flex-1">
        <TextoConVariables texto={t.body} vars={t.vars} valores={valores} />
      </p>
      {rechazada && (
        <div className="mt-3 text-[12px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-relaxed">
          {t.metaStatus === 'MISSING'
            ? 'Esta plantilla no existe en Meta: hay que crearla con este mismo nombre para que salga.'
            : `Meta no la está enviando${t.rejectedReason ? `: ${t.rejectedReason}` : '.'} Corrígela y reenvíala a revisión desde Meta.`}
          <a href={META_PLANTILLAS} target="_blank" rel="noreferrer" className="ml-1 font-semibold underline">
            Ir a Meta
          </a>
        </div>
      )}
      {t.buttons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {t.buttons.map((b) => (
            <span key={b} className="px-2 py-1 rounded-lg bg-brand-bone text-[11px] font-semibold text-sky-800">
              {b}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-brand-ink/8 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-brand-ink/40 flex-1 min-w-[180px]">
          Es la que sale como primer contacto de esta etapa. Cambiar el texto requiere volver a aprobarla en Meta.
        </span>
        <BotonCopiar texto={textoLleno(t.body, t.vars, valores)} />
      </div>
    </article>
  );
}

function TarjetaOtra({ p, cuenta }: { p: Plantilla; cuenta?: CuentaViva }) {
  const porWhatsapp = p.canal === 'WhatsApp';
  return (
    <article className="glass rounded-[28px] p-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BlockTitle>{p.etapa} · {p.canal}</BlockTitle>
          <h4 className="text-lg font-serif text-brand-ink mt-1">{p.nombre}</h4>
        </div>
        <span className={`audit-badge shrink-0 ${porWhatsapp ? 'bg-amber-50 text-amber-700' : 'bg-brand-ink/5 text-brand-ink/60'}`}>
          {porWhatsapp ? 'Borrador · falta subir a Meta' : 'No requiere Meta'}
        </span>
      </div>
      <p className="text-sm text-brand-ink/70 leading-relaxed mt-4 flex-1">
        <TextoConVariables texto={p.texto} valores={cuenta ? valoresDe(cuenta) : undefined} />
      </p>
      <div className="mt-4 pt-3 border-t border-brand-ink/8 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-brand-ink/40 flex-1 min-w-[180px]">
          {p.canal === 'Llamada' ? 'Guion para la persona que llama.' : porWhatsapp ? 'Antes de usarla por WhatsApp hay que someterla a Meta.' : 'Sale por correo.'}
        </span>
        <BotonCopiar texto={cuenta ? llenarPlantilla(p.texto, cuenta) : p.texto} />
      </div>
    </article>
  );
}
