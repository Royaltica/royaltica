import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Search, X, Database, Activity, ArrowUpRight, Webhook, History, Printer, DollarSign } from 'lucide-react';
import { DualLoggerService, type FiscalAuditEvent, type AuditSubscriber } from '../../../services/mockServices.ts';
import { DemoModeNotice } from '../../../components/DemoModeNotice.tsx';
import { RepRegistrationPanel } from '../../../features/corporate/auditoria/RepRegistrationPanel.tsx';
import { FactorajeCorporativoPanel } from '../../../features/corporate/auditoria/FactorajeCorporativoPanel.tsx';
import { DiotCompilerPanel } from '../../../features/corporate/auditoria/DiotCompilerPanel.tsx';
import { ConectividadERPPanel } from '../../../features/corporate/auditoria/ConectividadERPPanel.tsx';
import { REPMotorPanel } from '../../../features/corporate/auditoria/REPMotorPanel.tsx';
import { HistorialPagosPanel } from './HistorialPagosPanel.tsx';

export function FiscalAuditDashboard() {
  const [ledger, setLedger] = React.useState<FiscalAuditEvent[]>(DualLoggerService.getLedger());
  const [trails, setTrails] = React.useState<Record<string, FiscalAuditEvent[]>>(DualLoggerService.getTrails());
  const [activeSection, setActiveSection] = React.useState<'diot' | 'erp' | 'rep_motor' | 'pagos_globales' | 'factoraje'>('rep_motor');
  const [filter, setFilter] = React.useState('');
  const [isInjecting, setIsInjecting] = React.useState(false);
  const [lastInjected, setLastInjected] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handler: AuditSubscriber = (l, t) => { setLedger([...l]); setTrails({ ...t }); };
    DualLoggerService.subscribe(handler);
    return () => DualLoggerService.unsubscribe(handler);
  }, []);

  const handleInjectTest = () => {
    setIsInjecting(true);
    setTimeout(() => {
      const evt = DualLoggerService.logFiscalEvent({
        provider_id: 'PROV-001',
        provider_name: 'Logística Global SA',
        event_type: 'REP',
        cfdi_uuid: `TEST-${Date.now().toString(36).toUpperCase()}`,
        amount: Math.floor(Math.random() * 50000) + 5000,
        storage_url: '/docs/test_rep.pdf',
        status: 'Reportado al SAT',
      });
      setLastInjected(evt.id);
      setIsInjecting(false);
    }, 800);
  };

  const EVENT_CONFIG: Record<FiscalAuditEvent['event_type'], { label: string; color: string; bg: string }> = {
    REP:             { label: 'REP',           color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
    DIOT:            { label: 'DIOT',          color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    PAGO_GLOBAL:     { label: 'Pago Global',   color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    ERP_SYNC:        { label: 'ERP Sync',      color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-200' },
    CFDI_TIMBRADO:   { label: 'CFDI',          color: 'text-brand-gold', bg: 'bg-brand-gold/10 border-brand-gold/30' },
    PAGO_EFECTUADO:  { label: 'Pago',          color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  };

  const STATUS_STYLES: Record<FiscalAuditEvent['status'], string> = {
    'Reportado al SAT': 'bg-green-100 text-green-700',
    'Pendiente SAT':    'bg-yellow-100 text-yellow-700',
    'Sincronizado ERP': 'bg-teal-100 text-teal-700',
    'Error':            'bg-red-100 text-red-700',
  };

  const filtered = ledger.filter(e =>
    filter === '' ||
    e.provider_name.toLowerCase().includes(filter.toLowerCase()) ||
    e.cfdi_uuid.toLowerCase().includes(filter.toLowerCase()) ||
    e.event_type.toLowerCase().includes(filter.toLowerCase())
  );

  const byType = (type: FiscalAuditEvent['event_type']) => filtered.filter(e => e.event_type === type);

  const sections = [
    { id: 'rep_motor',      label: 'Motor REP PPD',      icon: <Activity size={14} /> },
    { id: 'diot',            label: 'DIOT',               icon: <Database size={14} /> },
    { id: 'factoraje',       label: 'Anticipos',          icon: <DollarSign size={14} /> },
    { id: 'erp',             label: 'Conectividad ERP',   icon: <Webhook size={14} /> },
    { id: 'pagos_globales',  label: 'Historial de Pagos', icon: <History size={14} /> },
  ] as const;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="label-caps mb-2 block">Registro Dual Inmutable</span>
          <h2 className="text-4xl font-serif text-brand-ink">Auditoría Fiscal</h2>
          <p className="text-sm text-brand-ink/40 font-serif mt-1">
            Trazabilidad completa de REPs, DIOT, Historial de Pagos y Sincronización ERP reportados al SAT.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 flex-wrap">
          {(['REP', 'DIOT', 'PAGO_GLOBAL', 'ERP_SYNC'] as FiscalAuditEvent['event_type'][]).map(type => (
            <div key={type} className={`px-4 py-2.5 rounded-2xl border text-center min-w-[80px] ${EVENT_CONFIG[type].bg}`}>
              <p className={`text-[18px] font-bold font-serif ${EVENT_CONFIG[type].color}`}>{byType(type).length}</p>
              <p className={`text-[8px] uppercase font-bold tracking-widest ${EVENT_CONFIG[type].color} opacity-70`}>{EVENT_CONFIG[type].label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Section tabs */}
        <div className="flex gap-2 p-1 bg-brand-bone border border-brand-sand/30 rounded-2xl w-fit flex-wrap">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeSection === s.id
                  ? 'bg-brand-ink text-brand-bone shadow-lg shadow-brand-ink/20'
                  : 'text-brand-ink/40 hover:text-brand-ink hover:bg-white'
              }`}
            >
              {s.icon}{s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={14} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar proveedor, UUID, tipo..."
              className="pl-9 pr-4 py-2.5 bg-white border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold shadow-sm w-64"
            />
          </div>
          <button
            onClick={() => {
              // Generate executive audit summary and download
              const lines: string[] = [];
              lines.push('═══════════════════════════════════════════');
              lines.push('    RESUMEN EJECUTIVO DE AUDITORÍA FISCAL');
              lines.push('    Royáltica — Plataforma de Orquestación');
              lines.push(`    Generado: ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`);
              lines.push('═══════════════════════════════════════════');
              lines.push('');
              lines.push(`Total de eventos registrados: ${ledger.length}`);
              lines.push('');
              (['REP', 'DIOT', 'PAGO_GLOBAL', 'ERP_SYNC'] as FiscalAuditEvent['event_type'][]).forEach(type => {
                const items = ledger.filter(e => e.event_type === type);
                const total = items.reduce((s, e) => s + e.amount, 0);
                lines.push(`[${type}] ${items.length} eventos — Total: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
              });
              lines.push('');
              lines.push('─── Detalle por Proveedor ───');
              const byProvider = new Map<string, FiscalAuditEvent[]>();
              ledger.forEach(e => {
                const list = byProvider.get(e.provider_name) || [];
                list.push(e);
                byProvider.set(e.provider_name, list);
              });
              byProvider.forEach((events, name) => {
                const total = events.reduce((s, e) => s + e.amount, 0);
                lines.push(`  ${name}: ${events.length} eventos, $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
              });
              lines.push('');
              lines.push('═══ FIN DEL RESUMEN ═══');

              const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Resumen_Auditoria_${new Date().toISOString().split('T')[0]}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-all shadow-sm"
          >
            <Printer size={14} /> Resumen Ejecutivo
          </button>
          <button
            onClick={handleInjectTest}
            disabled={isInjecting}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-sm disabled:opacity-60"
          >
            {isInjecting
              ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-brand-ink/30 border-t-brand-ink rounded-full" />
              : <ArrowUpRight size={14} />
            }
            Inyectar Log de Prueba
          </button>
        </div>
      </div>

      {/* Last injected notification */}
      <AnimatePresence>
        {lastInjected && (
          <motion.div
            key={lastInjected}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700"
          >
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
            <span>Log <strong>{lastInjected}</strong> inyectado y registrado en ambas pestañas (Ledger Maestro + Expediente del proveedor en Configuración).</span>
            <button onClick={() => setLastInjected(null)} className="ml-auto text-green-400 hover:text-green-600"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table or New Panel */}
      {activeSection === 'rep_motor' ? (
        <div className="space-y-6">
          <RepRegistrationPanel />
          <DemoModeNotice label="Vista previa · Motor de riesgo REP" />
          <REPMotorPanel />
        </div>
      ) : activeSection === 'pagos_globales' ? (
        <HistorialPagosPanel />
      ) : activeSection === 'diot' ? (
        <DiotCompilerPanel />
      ) : activeSection === 'factoraje' ? (
        <FactorajeCorporativoPanel />
      ) : activeSection === 'erp' ? (
        <div className="space-y-4">
          <DemoModeNotice label="Vista previa · Conectividad ERP (el conector real está en Stub, ver Configuración → ERP)" />
          <ConectividadERPPanel />
        </div>
      ) : null}
    </div>
  );
}

