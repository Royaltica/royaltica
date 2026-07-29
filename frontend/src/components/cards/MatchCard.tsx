import { CheckCircle2 } from 'lucide-react';

export function MatchCard({ label, value, verified }: { label: string, value: string, verified: boolean }) {
  return (
    <div className={`flex-1 border p-8 rounded-[2rem] bg-brand-cream transition-all ${verified ? 'border-brand-gold shadow-lg shadow-brand-gold/5' : 'border-brand-sand/30 opacity-60'}`}>
      <div className="label-caps !tracking-[0.2em] !opacity-20 mb-6">{label}</div>
      <div className="text-xl font-serif text-brand-ink leading-tight">{value}</div>
      <div className={`text-[9px] mt-4 uppercase font-extrabold tracking-[0.2em] flex items-center gap-1.5 ${verified ? 'text-green-600' : 'text-brand-ink/20'}`}>
        {verified ? <><CheckCircle2 size={12} /> Datos Verificados</> : 'Esperando Entrada'}
      </div>
    </div>
  );
}
