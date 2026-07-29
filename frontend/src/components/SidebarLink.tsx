import React from 'react';
import { motion } from 'motion/react';

export function SidebarLink({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode, label: string, active: boolean, collapsed: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : ""}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all duration-300 relative ${
        active
        ? 'bg-brand-gold text-[var(--brand-gold-text)] shadow-sm'
        : 'text-brand-paper/60 hover:text-brand-paper hover:bg-brand-paper/8'
      }`}
    >
      <div className="flex-shrink-0 flex items-center justify-center w-5 h-5">{icon}</div>
      {!collapsed && (
        <motion.span 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="truncate whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}
    </button>
  );
}

