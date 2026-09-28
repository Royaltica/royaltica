import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Reveal, BlockTitle } from './primitives.tsx';
import { Chip } from './CampanasPanel.tsx';
import { PLANTILLAS, type Plantilla } from './mockV1.ts';

/**
 * Plantillas aprobadas por etapa. La IA ya no redacta libre: elige la
 * plantilla de la etapa y solo llena variables ({{monto}}, {{fecha}}…).
 * Así todo mensaje que sale ya pasó revisión legal y de Meta.
 */
const GRUPOS: Plantilla['grupo'][] = ['Preventiva', 'Vencida', 'Servicio', 'Especial'];

/** Resalta las variables {{...}} para que se vea qué se llena solo. */
function TextoConVariables({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\{\{\w+\}\})/g).map((parte, i) =>
        /^\{\{\w+\}\}$/.test(parte) ? (
          <span key={i} className="px-1 rounded bg-brand-gold/15 text-brand-ink font-semibold">
            {parte.slice(2, -2)}
          </span>
        ) : (
          <React.Fragment key={i}>{parte}</React.Fragment>
        ),
      )}
    </>
  );
}

export function PlantillasPanel() {
  const [grupo, setGrupo] = React.useState<Plantilla['grupo']>('Preventiva');
  const lista = PLANTILLAS.filter((p) => p.grupo === grupo);

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-brand-cream border border-brand-gold/30">
          <ShieldCheck size={18} className="text-brand-gold shrink-0 mt-0.5" />
          <p className="text-sm text-brand-ink/70 leading-relaxed max-w-[80ch]">
            <span className="font-semibold text-brand-ink">Solo se envían plantillas aprobadas.</span>{' '}
            La IA elige la plantilla de cada etapa y llena los datos resaltados; no redacta texto
            libre. Cada plantilla se revisa contra el lenguaje permitido de cobranza (sin amenazas,
            sin exhibir la deuda a terceros, solo en horario permitido) y la aprueba Meta antes de
            usarse por WhatsApp.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="flex flex-wrap gap-2">
          {GRUPOS.map((g) => (
            <Chip key={g} activo={grupo === g} onClick={() => setGrupo(g)}>
              {g} · {PLANTILLAS.filter((p) => p.grupo === g).length}
            </Chip>
          ))}
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {lista.map((p, i) => (
          <Reveal key={p.id} delay={0.08 + i * 0.04}>
            <article className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <BlockTitle>{p.etapa} · {p.canal}</BlockTitle>
                  <h4 className="text-lg font-serif text-brand-ink mt-1">{p.nombre}</h4>
                </div>
                <span
                  className={`audit-badge shrink-0 ${
                    p.estado === 'Aprobada' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {p.estado === 'Aprobada' ? 'Aprobada · Legal y Meta' : 'En revisión de Meta'}
                </span>
              </div>
              <p className="text-sm text-brand-ink/70 leading-relaxed mt-4 flex-1">
                <TextoConVariables texto={p.texto} />
              </p>
              <div className="mt-4 pt-3 border-t border-brand-ink/8 text-[11px] text-brand-ink/40">
                Editar crea una nueva versión que vuelve a revisión.
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
