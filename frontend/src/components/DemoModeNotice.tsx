import { Info } from 'lucide-react';

export function DemoModeNotice({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-amber-700">
      <Info size={13} className="flex-shrink-0" />
      {label} — datos simulados, no persisten en el backend
    </div>
  );
}
