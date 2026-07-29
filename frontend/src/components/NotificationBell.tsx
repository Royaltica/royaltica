import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell } from 'lucide-react';
import { api, type NotificationItem } from '../services/apiClient.ts';

/**
 * Campana de notificaciones flotante conectada al backend (/notifications)
 * con stream SSE en tiempo real. Reutilizable en cualquier portal.
 */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = React.useCallback(() => {
    api.getNotifications().then(r => { setItems(r.items); setUnread(r.unread); }).catch(() => { /* sin sesión: campana vacía */ });
  }, []);
  useEffect(() => { load(); }, [load]);
  // Tiempo real: cualquier push del backend recarga la lista.
  useEffect(() => {
    const es = api.notificationStream();
    if (!es) return;
    es.onmessage = () => load();
    es.onerror = () => { /* EventSource reintenta solo */ };
    return () => es.close();
  }, [load]);

  const markRead = async (id: string) => { await api.markNotificationRead(id).catch(() => {}); load(); };
  const markAll = async () => { await api.markAllNotificationsRead().catch(() => {}); load(); };
  const fmtTime = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed top-6 right-8 z-[95]">
      <button onClick={() => setOpen(o => !o)}
        className="relative w-11 h-11 rounded-2xl bg-white shadow-lg border border-brand-sand/30 flex items-center justify-center hover:bg-brand-bone/40 transition-all cursor-pointer">
        <Bell size={18} className="text-brand-ink/60" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="absolute right-0 mt-2 w-80 max-h-[70vh] bg-brand-paper rounded-2xl shadow-2xl border border-brand-sand/30 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-sand/20 flex-shrink-0">
              <h4 className="text-sm font-serif text-brand-ink">Notificaciones</h4>
              {unread > 0 && <button onClick={markAll} className="text-[9px] uppercase tracking-wider font-bold text-brand-gold hover:underline cursor-pointer">Marcar todas</button>}
            </div>
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-center text-xs text-brand-ink/40 py-10">No tienes notificaciones.</p>
              ) : items.map(n => (
                <button key={n.id} onClick={() => !n.isRead && markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-brand-sand/10 hover:bg-brand-bone/40 transition-colors flex gap-3 ${n.isRead ? 'opacity-55' : 'cursor-pointer'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-brand-gold'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-brand-ink">{n.title}</p>
                    <p className="text-[11px] text-brand-ink/50 leading-relaxed">{n.body}</p>
                    <p className="text-[9px] text-brand-ink/30 mt-0.5">{fmtTime(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
