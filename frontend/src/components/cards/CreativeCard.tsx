import React from 'react';

export function CreativeCard({ icon, label, value, subValue, theme, onClick }: {
  icon: React.ReactNode,
  label: string,
  value: number | string,
  subValue: string,
  theme: 'green' | 'gold' | 'red' | 'orange' | 'dark',
  onClick?: () => void
}) {
  const themeStyles = {
    green: 'bg-green-50/50 border-green-100 text-green-700',
    gold: 'bg-brand-gold/5 border-brand-gold/20 text-brand-ink',
    red: 'bg-red-50/50 border-red-100 text-red-700',
    orange: 'bg-orange-50/50 border-orange-100 text-orange-700',
    dark: 'bg-brand-bone border-brand-sand/50 text-brand-ink'
  };

  return (
    <div onClick={onClick} className={`p-8 rounded-[2.5rem] border ${themeStyles[theme]} shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="w-12 h-12 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30">{label}</div>
      </div>
      
      <div className="relative z-10">
        <div className="text-5xl font-serif mb-2">
          {typeof value === 'number' && value < 10 && value >= 0 ? `0${value}` : value}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">{subValue}</div>
      </div>

      <div className="absolute bottom-0 right-0 p-4 transform translate-x-2 translate-y-2 opacity-5 scale-150 rotate-12">
        {icon}
      </div>
    </div>
  );
}
