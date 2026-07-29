import React from 'react';

export function StatCard({ label, value, subValue, icon }: { label: string, value: string, subValue: string, icon: React.ReactNode }) {
  return (
    <div className="editorial-card !p-8 shadow-md border-brand-sand/20 group hover:border-brand-gold transition-colors">
      <div className="flex justify-between items-start mb-6">
        <span className="label-caps !opacity-40">{label}</span>
        <div className="p-2 bg-brand-bone rounded-xl group-hover:bg-brand-gold/10 transition-colors">
          {icon}
        </div>
      </div>
      <div className="text-5xl font-serif text-brand-ink mb-1">
        {typeof value === 'string' && value.length === 1 && !isNaN(Number(value)) ? `0${value}` : value}
      </div>
      <div className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{subValue}</div>
    </div>
  );
}
