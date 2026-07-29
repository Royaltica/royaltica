import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Building2, CheckCircle2, AlertCircle, Search, Clock, FileText, UploadCloud,
  Download, FolderSync, AlertTriangle, ListChecks, Sparkles, FileBarChart, Loader2,
  TrendingUp, History, DollarSign, RefreshCw, Scale, HelpCircle, Gauge,
} from 'lucide-react';
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, AreaChart, Area,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { type Invoice } from '../../../types.ts';
import { api, type FinancialRatios } from '../../../services/apiClient.ts';
import { CURRENCY_FORMATTER } from '../../../utils/format.ts';

// ─────────────────────────────────────────────────────────────────────────────
// ─── ContabilidadView ─────────────────────────────────────────────────────────
export function ContabilidadView({ invoices }: { invoices: Invoice[] }) {
  const [activeSection, setActiveSection] = React.useState<'estado_resultados' | 'razones_cxp' | 'razones' | 'importar_erp'>('estado_resultados');

  // Razones financieras de Cuentas por Pagar reales (backend). Null al cargar.
  const [financialRatios, setFinancialRatios] = React.useState<FinancialRatios | null>(null);
  React.useEffect(() => {
    api
      .getFinancialRatios()
      .then(setFinancialRatios)
      .catch((err) => console.warn('No se pudieron cargar razones CxP:', err.message));
  }, []);
  const [capitalTip, setCapitalTip] = React.useState(false);
  const capitalRef = React.useRef<HTMLDivElement>(null);
  const [capitalTipPos, setCapitalTipPos] = React.useState({ top: 0, left: 0, width: 0 });

  // ─── Derive accounting data from invoices ───
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const auditedInvoices = invoices.filter(i => i.status === 'audited');

  const totalPaid = paidInvoices.reduce((s, i) => s + i.amount, 0);
  const totalPending = pendingInvoices.reduce((s, i) => s + i.amount, 0);
  const totalAudited = auditedInvoices.reduce((s, i) => s + i.amount, 0);

  // ─── Historical Monthly Periods ───
  type PeriodData = {
    id: string; label: string; shortLabel: string; closed: boolean;
    er: { ventasNetas: number; otrosIngresos: number; ingresosFinancieros: number; costoVentas: number; depreciacion: number; sueldos: number; servicios: number; renta: number; marketing: number; tecnologia: number; otros: number };
    bg: { efectivo: number; cuentasCobrar: number; inventarios: number; anticipos: number; mobiliario: number; equipo: number; depAcumulada: number; proveedores: number; impuestos: number; prestamosCP: number; creditoLP: number; arrendamiento: number; capitalSocial: number };
  };

  const HISTORICAL_PERIODS: PeriodData[] = React.useMemo(() => [
    { id: '2024-01', label: 'Enero 2024', shortLabel: 'Ene', closed: true,
      er: { ventasNetas: 750_000, otrosIngresos: 18_000, ingresosFinancieros: 5_200, costoVentas: 375_000, depreciacion: 30_000, sueldos: 102_000, servicios: 42_000, renta: 32_500, marketing: 12_000, tecnologia: 23_500, otros: 11_000 },
      bg: { efectivo: 980_000, cuentasCobrar: 720_000, inventarios: 395_000, anticipos: 40_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -290_000, proveedores: 520_000, impuestos: 42_000, prestamosCP: 350_000, creditoLP: 900_000, arrendamiento: 270_000, capitalSocial: 1_500_000 } },
    { id: '2024-02', label: 'Febrero 2024', shortLabel: 'Feb', closed: true,
      er: { ventasNetas: 810_000, otrosIngresos: 20_000, ingresosFinancieros: 5_800, costoVentas: 400_000, depreciacion: 30_000, sueldos: 103_000, servicios: 45_000, renta: 32_500, marketing: 14_000, tecnologia: 23_500, otros: 11_500 },
      bg: { efectivo: 1_020_000, cuentasCobrar: 760_000, inventarios: 405_000, anticipos: 45_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -320_000, proveedores: 490_000, impuestos: 48_000, prestamosCP: 340_000, creditoLP: 880_000, arrendamiento: 265_000, capitalSocial: 1_500_000 } },
    { id: '2024-03', label: 'Marzo 2024', shortLabel: 'Mar', closed: true,
      er: { ventasNetas: 890_000, otrosIngresos: 22_000, ingresosFinancieros: 6_100, costoVentas: 445_000, depreciacion: 30_000, sueldos: 104_000, servicios: 48_000, renta: 32_500, marketing: 15_000, tecnologia: 23_800, otros: 11_800 },
      bg: { efectivo: 1_100_000, cuentasCobrar: 810_000, inventarios: 410_000, anticipos: 50_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -350_000, proveedores: 470_000, impuestos: 56_000, prestamosCP: 330_000, creditoLP: 860_000, arrendamiento: 260_000, capitalSocial: 1_500_000 } },
    { id: '2024-04', label: 'Abril 2024', shortLabel: 'Abr', closed: true,
      er: { ventasNetas: 830_000, otrosIngresos: 20_000, ingresosFinancieros: 6_000, costoVentas: 415_000, depreciacion: 30_000, sueldos: 105_000, servicios: 50_000, renta: 32_500, marketing: 14_500, tecnologia: 24_000, otros: 11_200 },
      bg: { efectivo: 1_180_000, cuentasCobrar: 850_000, inventarios: 415_000, anticipos: 55_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -370_000, proveedores: 480_000, impuestos: 52_000, prestamosCP: 320_000, creditoLP: 840_000, arrendamiento: 255_000, capitalSocial: 1_500_000 } },
    { id: '2024-05', label: 'Mayo 2024', shortLabel: 'May', closed: true,
      er: { ventasNetas: 860_000, otrosIngresos: 21_000, ingresosFinancieros: 5_900, costoVentas: 425_000, depreciacion: 30_000, sueldos: 103_000, servicios: 47_000, renta: 32_500, marketing: 14_000, tecnologia: 23_500, otros: 11_400 },
      bg: { efectivo: 1_220_000, cuentasCobrar: 870_000, inventarios: 418_000, anticipos: 60_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -375_000, proveedores: 460_000, impuestos: 55_000, prestamosCP: 310_000, creditoLP: 820_000, arrendamiento: 252_000, capitalSocial: 1_500_000 } },
    { id: '2024-06', label: 'Junio 2024', shortLabel: 'Jun', closed: false,
      er: { ventasNetas: 710_000, otrosIngresos: 19_000, ingresosFinancieros: 5_500, costoVentas: 365_000, depreciacion: 30_000, sueldos: 103_000, servicios: totalPaid || 53_000, renta: 32_500, marketing: 14_500, tecnologia: 23_700, otros: 11_100 },
      bg: { efectivo: 1_250_000, cuentasCobrar: 890_000, inventarios: 420_000, anticipos: 65_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -380_000, proveedores: totalPending || 450_000, impuestos: 58_000, prestamosCP: 300_000, creditoLP: 800_000, arrendamiento: 250_000, capitalSocial: 1_500_000 } },
  ], [totalPaid, totalPending]);

  const [selectedPeriod, setSelectedPeriod] = React.useState('acumulado');
  // 'acumulado' = Ene–Jun summed, or a specific month id like '2024-01'

  // ─── Compute selected period data ───
  const isAccumulated = selectedPeriod === 'acumulado';
  const selectedPeriodData = React.useMemo(() => {
    if (isAccumulated) {
      const allPeriods = HISTORICAL_PERIODS;
      return {
        er: {
          ventasNetas: allPeriods.reduce((s, p) => s + p.er.ventasNetas, 0),
          otrosIngresos: allPeriods.reduce((s, p) => s + p.er.otrosIngresos, 0),
          ingresosFinancieros: allPeriods.reduce((s, p) => s + p.er.ingresosFinancieros, 0),
          costoVentas: allPeriods.reduce((s, p) => s + p.er.costoVentas, 0),
          depreciacion: allPeriods.reduce((s, p) => s + p.er.depreciacion, 0),
          sueldos: allPeriods.reduce((s, p) => s + p.er.sueldos, 0),
          servicios: allPeriods.reduce((s, p) => s + p.er.servicios, 0),
          renta: allPeriods.reduce((s, p) => s + p.er.renta, 0),
          marketing: allPeriods.reduce((s, p) => s + p.er.marketing, 0),
          tecnologia: allPeriods.reduce((s, p) => s + p.er.tecnologia, 0),
          otros: allPeriods.reduce((s, p) => s + p.er.otros, 0),
        },
        // BG always uses the LATEST period snapshot
        bg: allPeriods[allPeriods.length - 1].bg,
        label: 'Enero – Junio 2024',
        closed: false,
      };
    }
    const p = HISTORICAL_PERIODS.find(p => p.id === selectedPeriod)!;
    return { er: p.er, bg: p.bg, label: p.label, closed: p.closed };
  }, [selectedPeriod, HISTORICAL_PERIODS, isAccumulated]);

  const prevPeriodData = React.useMemo(() => {
    if (isAccumulated) return null;
    const idx = HISTORICAL_PERIODS.findIndex(p => p.id === selectedPeriod);
    return idx > 0 ? HISTORICAL_PERIODS[idx - 1] : null;
  }, [selectedPeriod, HISTORICAL_PERIODS, isAccumulated]);

  // ─── Derive P&L from selected period ───
  const d = selectedPeriodData;
  const ingresos = {
    ventasNetas: d.er.ventasNetas,
    otrosIngresos: d.er.otrosIngresos,
    ingresosFinancieros: d.er.ingresosFinancieros,
    total: d.er.ventasNetas + d.er.otrosIngresos + d.er.ingresosFinancieros,
  };
  const costos = {
    costoVentas: d.er.costoVentas,
    depreciacion: d.er.depreciacion,
    total: d.er.costoVentas + d.er.depreciacion,
  };
  const gastosOp = {
    sueldos: d.er.sueldos,
    servicios: d.er.servicios,
    renta: d.er.renta,
    marketing: d.er.marketing,
    tecnologia: d.er.tecnologia,
    otros: d.er.otros,
    total: d.er.sueldos + d.er.servicios + d.er.renta + d.er.marketing + d.er.tecnologia + d.er.otros,
  };
  const utilidadBruta = ingresos.total - costos.total;
  const utilidadOperativa = utilidadBruta - gastosOp.total;
  const isr = utilidadOperativa * 0.30;
  const ptu = utilidadOperativa * 0.10;
  const utilidadNeta = utilidadOperativa - isr - ptu;
  const ebitda = utilidadOperativa + costos.depreciacion;
  const margenBruto = (utilidadBruta / ingresos.total) * 100;
  const margenOperativo = (utilidadOperativa / ingresos.total) * 100;
  const margenNeto = (utilidadNeta / ingresos.total) * 100;
  const margenEbitda = (ebitda / ingresos.total) * 100;

  // Var% vs previous period
  const varVsAnterior = React.useMemo(() => {
    if (!prevPeriodData) return null;
    const prevTotal = prevPeriodData.er.ventasNetas + prevPeriodData.er.otrosIngresos + prevPeriodData.er.ingresosFinancieros;
    return prevTotal > 0 ? ((ingresos.total - prevTotal) / prevTotal * 100) : 0;
  }, [prevPeriodData, ingresos.total]);

  // ─── Derive BG from selected period ───
  const b = selectedPeriodData.bg;
  const activoCirculante = {
    efectivo: b.efectivo,
    cuentasCobrar: b.cuentasCobrar,
    inventarios: b.inventarios,
    anticipos: b.anticipos,
    total: b.efectivo + b.cuentasCobrar + b.inventarios + b.anticipos,
  };
  const activoFijo = {
    mobiliario: b.mobiliario,
    equipo: b.equipo,
    depAcumulada: b.depAcumulada,
    total: b.mobiliario + b.equipo + b.depAcumulada,
  };
  const totalActivo = activoCirculante.total + activoFijo.total;

  const pasivoCorto = {
    proveedores: b.proveedores,
    impuestos: b.impuestos,
    prestamos: b.prestamosCP,
    total: b.proveedores + b.impuestos + b.prestamosCP,
  };
  const pasivoLargo = {
    creditoBancario: b.creditoLP,
    arrendamiento: b.arrendamiento,
    total: b.creditoLP + b.arrendamiento,
  };
  const totalPasivo = pasivoCorto.total + pasivoLargo.total;

  const capital = {
    capitalSocial: b.capitalSocial,
    utilidadesRetenidas: totalActivo - totalPasivo - b.capitalSocial - utilidadNeta,
    utilidadEjercicio: utilidadNeta,
    total: totalActivo - totalPasivo,
  };

  // ─── Razones Financieras ───
  const razones = {
    liquidez: {
      razonCirculante: activoCirculante.total / pasivoCorto.total,
      pruebaAcida: (activoCirculante.total - activoCirculante.inventarios) / pasivoCorto.total,
      capitalTrabajo: activoCirculante.total - pasivoCorto.total,
    },
    deuda: {
      razonDeuda: totalPasivo / totalActivo,
      apalancamiento: totalPasivo / capital.total,
      cobertura: utilidadOperativa / (pasivoCorto.prestamos + pasivoLargo.creditoBancario) * 12,
    },
    rendimiento: {
      roa: (utilidadNeta / totalActivo) * 100,
      roe: (utilidadNeta / capital.total) * 100,
      margenUtilidad: margenNeto,
      margenEbitda: margenEbitda,
    },
  };

  // ─── Period Selector Component ───
  const PeriodSelector = () => (
    <div className="flex items-center gap-1 bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-brand-sand/20">
      <button
        onClick={() => setSelectedPeriod('acumulado')}
        className={`px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
          selectedPeriod === 'acumulado' ? 'bg-brand-gold text-white shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink/70'
        }`}
      >
        Acumulado
      </button>
      {HISTORICAL_PERIODS.map(p => (
        <button
          key={p.id}
          onClick={() => setSelectedPeriod(p.id)}
          className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
            selectedPeriod === p.id ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink/70'
          }`}
        >
          {p.shortLabel}
          {p.closed && <CheckCircle2 size={8} className={selectedPeriod === p.id ? 'text-green-300' : 'text-green-400/50'} />}
        </button>
      ))}
    </div>
  );

  // ─── Chart data derived from historical periods ───
  const plMonthlyData = HISTORICAL_PERIODS.map(p => {
    const ing = p.er.ventasNetas + p.er.otrosIngresos + p.er.ingresosFinancieros;
    const gastos = p.er.costoVentas + p.er.depreciacion + p.er.sueldos + p.er.servicios + p.er.renta + p.er.marketing + p.er.tecnologia + p.er.otros;
    return { mes: p.shortLabel, ingresos: ing, gastos, utilidad: ing - gastos };
  });

  const balanceComposition = [
    { name: 'Efectivo', value: activoCirculante.efectivo, color: '#C5A059' },
    { name: 'CxC', value: activoCirculante.cuentasCobrar, color: '#8B7355' },
    { name: 'Inventarios', value: activoCirculante.inventarios, color: '#D4C5A9' },
    { name: 'Act. Fijo', value: activoFijo.total, color: '#6B5B3E' },
  ];

  const pasivoComposition = [
    { name: 'Proveedores', value: pasivoCorto.proveedores, color: '#C5A059' },
    { name: 'Impuestos', value: pasivoCorto.impuestos, color: '#8B7355' },
    { name: 'Préstamos CP', value: pasivoCorto.prestamos, color: '#D4C5A9' },
    { name: 'Deuda LP', value: pasivoLargo.total, color: '#6B5B3E' },
    { name: 'Capital', value: capital.total, color: '#3D3525' },
  ];

  const fmt = (n: number) => n < 0
    ? `(${Math.abs(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })})`
    : n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
  const fmtK = (n: number) => `$${(n / 1_000).toFixed(0)}K`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtRatio = (n: number) => n.toFixed(2);

  // ─── Importar ERP State ───
  const [erpDataView, setErpDataView] = React.useState<'home' | 'catalogo' | 'polizas' | 'activos'>('home');
  const [catalogoFilter, setCatalogoFilter] = React.useState('');
  const [polizasFilter, setPolizasFilter] = React.useState('');
  const [polizasType, setPolizasType] = React.useState('Todos');
  const [selectedPoliza, setSelectedPoliza] = React.useState<string | null>(null);
  const [erpConnection, setErpConnection] = React.useState<{ system: string; status: 'disconnected' | 'connecting' | 'connected'; lastSync?: string }>({ system: 'Aspel COI', status: 'disconnected' });
  const [importHistory, setImportHistory] = React.useState<{ id: string; type: string; date: string; records: number; status: 'success' | 'partial' | 'error'; detail: string }[]>([
    { id: 'IMP-001', type: 'Catálogo de Cuentas', date: '2024-04-20 09:15', records: 342, status: 'success', detail: 'Aspel COI v14.0 — 342 cuentas importadas' },
    { id: 'IMP-002', type: 'Pólizas Contables', date: '2024-04-20 09:18', records: 1204, status: 'success', detail: 'Período Ene–Mar 2024 — 1,204 pólizas' },
    { id: 'IMP-003', type: 'Saldos Activos Fijos', date: '2024-04-19 14:30', records: 87, status: 'partial', detail: '87 de 92 activos — 5 sin clasificar' },
    { id: 'IMP-004', type: 'Pólizas Contables', date: '2024-03-31 18:00', records: 986, status: 'success', detail: 'Cierre mensual Marzo — 986 pólizas' },
    { id: 'IMP-005', type: 'Catálogo de Cuentas', date: '2024-03-15 10:00', records: 338, status: 'success', detail: 'Aspel COI v14.0 — 338 cuentas importadas' },
  ]);
  const [importLoading, setImportLoading] = React.useState<string | null>(null);

  const simulateImport = (type: string, records: number, detail: string) => {
    setImportLoading(type);
    setTimeout(() => {
      setImportHistory(prev => [{
        id: `IMP-${String(prev.length + 1).padStart(3, '0')}`,
        type,
        date: new Date().toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        records,
        status: 'success',
        detail,
      }, ...prev]);
      setImportLoading(null);
    }, 2500);
  };

  const simulateConnect = () => {
    setErpConnection(prev => ({ ...prev, status: 'connecting' }));
    setTimeout(() => {
      setErpConnection({ system: 'Aspel COI', status: 'connected', lastSync: new Date().toLocaleString('es-MX') });
    }, 2000);
  };

  // ─── Mock ERP Data ───
  const MOCK_CATALOGO = [
    { cuenta: '1000', nombre: 'ACTIVO', clase: 'Activo', tipo: 'Acumulativa', nivel: 1, saldo: 4_295_000, destino: 'BG', mapeada: true },
    { cuenta: '1100', nombre: 'ACTIVO CIRCULANTE', clase: 'Activo', tipo: 'Acumulativa', nivel: 2, saldo: 2_625_000, destino: 'BG', mapeada: true },
    { cuenta: '1101', nombre: 'Caja y Bancos', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 1_250_000, destino: 'BG', mapeada: true },
    { cuenta: '1102', nombre: 'Clientes', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 890_000, destino: 'BG', mapeada: true },
    { cuenta: '1103', nombre: 'Inventarios', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 420_000, destino: 'BG', mapeada: true },
    { cuenta: '1104', nombre: 'Anticipo a Proveedores', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 65_000, destino: 'BG', mapeada: true },
    { cuenta: '1200', nombre: 'ACTIVO FIJO', clase: 'Activo', tipo: 'Acumulativa', nivel: 2, saldo: 1_670_000, destino: 'BG', mapeada: true },
    { cuenta: '1201', nombre: 'Mobiliario y Equipo de Oficina', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 850_000, destino: 'BG', mapeada: true },
    { cuenta: '1202', nombre: 'Equipo de Cómputo', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 1_200_000, destino: 'BG', mapeada: true },
    { cuenta: '1299', nombre: 'Depreciación Acumulada', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: -380_000, destino: 'BG', mapeada: true },
    { cuenta: '2000', nombre: 'PASIVO', clase: 'Pasivo', tipo: 'Acumulativa', nivel: 1, saldo: 2_046_910, destino: 'BG', mapeada: true },
    { cuenta: '2100', nombre: 'PASIVO A CORTO PLAZO', clase: 'Pasivo', tipo: 'Acumulativa', nivel: 2, saldo: 996_910, destino: 'BG', mapeada: true },
    { cuenta: '2101', nombre: 'Proveedores', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 548_910, destino: 'BG', mapeada: true },
    { cuenta: '2102', nombre: 'Impuestos por Pagar (ISR/PTU)', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 148_000, destino: 'BG', mapeada: true },
    { cuenta: '2103', nombre: 'Préstamos Bancarios CP', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 300_000, destino: 'BG', mapeada: true },
    { cuenta: '2200', nombre: 'PASIVO A LARGO PLAZO', clase: 'Pasivo', tipo: 'Acumulativa', nivel: 2, saldo: 1_050_000, destino: 'BG', mapeada: true },
    { cuenta: '2201', nombre: 'Crédito Bancario LP', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 800_000, destino: 'BG', mapeada: true },
    { cuenta: '2202', nombre: 'Arrendamiento Financiero', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 250_000, destino: 'BG', mapeada: true },
    { cuenta: '3000', nombre: 'CAPITAL CONTABLE', clase: 'Capital', tipo: 'Acumulativa', nivel: 1, saldo: 2_248_090, destino: 'BG', mapeada: true },
    { cuenta: '3001', nombre: 'Capital Social', clase: 'Capital', tipo: 'Detalle', nivel: 2, saldo: 1_500_000, destino: 'BG', mapeada: true },
    { cuenta: '3002', nombre: 'Utilidades Retenidas', clase: 'Capital', tipo: 'Detalle', nivel: 2, saldo: 407_800, destino: 'BG', mapeada: true },
    { cuenta: '3003', nombre: 'Utilidad del Ejercicio', clase: 'Capital', tipo: 'Detalle', nivel: 2, saldo: 340_290, destino: 'BG', mapeada: true },
    { cuenta: '4000', nombre: 'INGRESOS', clase: 'Resultado', tipo: 'Acumulativa', nivel: 1, saldo: 5_005_000, destino: 'ER', mapeada: true },
    { cuenta: '4001', nombre: 'Ventas Netas', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 4_850_000, destino: 'ER', mapeada: true },
    { cuenta: '4002', nombre: 'Otros Ingresos', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 120_000, destino: 'ER', mapeada: true },
    { cuenta: '4003', nombre: 'Ingresos Financieros', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 35_000, destino: 'ER', mapeada: true },
    { cuenta: '5000', nombre: 'COSTO DE VENTAS', clase: 'Resultado', tipo: 'Acumulativa', nivel: 1, saldo: 2_425_000, destino: 'ER', mapeada: true },
    { cuenta: '5001', nombre: 'Costo Directo de Servicios', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 2_245_000, destino: 'ER', mapeada: true },
    { cuenta: '5002', nombre: 'Depreciación Aplicada', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 180_000, destino: 'ER', mapeada: true },
    { cuenta: '6000', nombre: 'GASTOS DE OPERACIÓN', clase: 'Resultado', tipo: 'Acumulativa', nivel: 1, saldo: 1_395_000, destino: 'ER', mapeada: true },
    { cuenta: '6001', nombre: 'Sueldos y Salarios', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 620_000, destino: 'ER', mapeada: true },
    { cuenta: '6002', nombre: 'Servicios Profesionales', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 285_000, destino: 'ER', mapeada: true },
    { cuenta: '6003', nombre: 'Rentas', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 195_000, destino: 'ER', mapeada: true },
    { cuenta: '6004', nombre: 'Marketing y Publicidad', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 85_000, destino: 'ER', mapeada: true },
    { cuenta: '6005', nombre: 'Tecnología y Licencias', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 142_000, destino: 'ER', mapeada: true },
    { cuenta: '6006', nombre: 'Otros Gastos Operativos', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 68_000, destino: 'ER', mapeada: true },
  ];

  const MOCK_POLIZAS = [
    { id: 'POL-0241', tipo: 'Ingreso', fecha: '2024-04-25', concepto: 'Cobro cliente Nexus Corp — Fac F-0891', cargo: 0, abono: 245_000, cuenta: '4001', ref: 'TRF-4521', status: 'aplicada' },
    { id: 'POL-0240', tipo: 'Egreso', fecha: '2024-04-25', concepto: 'Pago a Logística Global SA — Fac FAC-01-C5', cargo: 38_100, abono: 0, cuenta: '5001', ref: 'SPEI-8820', status: 'aplicada' },
    { id: 'POL-0239', tipo: 'Diario', fecha: '2024-04-24', concepto: 'Depreciación mensual equipo de cómputo', cargo: 30_000, abono: 30_000, cuenta: '5002', ref: 'DEP-0424', status: 'aplicada' },
    { id: 'POL-0238', tipo: 'Egreso', fecha: '2024-04-24', concepto: 'Pago nómina quincenal 2a quincena Abril', cargo: 310_000, abono: 0, cuenta: '6001', ref: 'NOM-0424B', status: 'aplicada' },
    { id: 'POL-0237', tipo: 'Ingreso', fecha: '2024-04-23', concepto: 'Cobro anticipo proyecto Beta Industries', cargo: 0, abono: 180_000, cuenta: '4001', ref: 'TRF-4498', status: 'aplicada' },
    { id: 'POL-0236', tipo: 'Egreso', fecha: '2024-04-22', concepto: 'Pago renta oficina Abril 2024', cargo: 65_000, abono: 0, cuenta: '6003', ref: 'CFDI-RNT-04', status: 'aplicada' },
    { id: 'POL-0235', tipo: 'Diario', fecha: '2024-04-20', concepto: 'Provisión ISR mensual estimado', cargo: 74_000, abono: 74_000, cuenta: '2102', ref: 'PROV-ISR-04', status: 'aplicada' },
    { id: 'POL-0234', tipo: 'Egreso', fecha: '2024-04-19', concepto: 'Pago a TechParts MX — Fac FAC-02-P1 parcial', cargo: 20_000, abono: 0, cuenta: '5001', ref: 'SPEI-8791', status: 'aplicada' },
    { id: 'POL-0233', tipo: 'Ingreso', fecha: '2024-04-18', concepto: 'Intereses cuenta inversión BANAMEX', cargo: 0, abono: 8_500, cuenta: '4003', ref: 'INT-BNM-04', status: 'aplicada' },
    { id: 'POL-0232', tipo: 'Diario', fecha: '2024-04-15', concepto: 'Ajuste diferencia tipo de cambio USD', cargo: 12_000, abono: 12_000, cuenta: '4002', ref: 'TC-ADJ-04', status: 'aplicada' },
    { id: 'POL-0231', tipo: 'Egreso', fecha: '2024-04-15', concepto: 'Pago licencias SaaS (Adobe, GitHub, AWS)', cargo: 48_000, abono: 0, cuenta: '6005', ref: 'CFDI-TEC-04', status: 'aplicada' },
    { id: 'POL-0230', tipo: 'Egreso', fecha: '2024-04-10', concepto: 'Pago servicio marketing digital Q2', cargo: 42_500, abono: 0, cuenta: '6004', ref: 'CFDI-MKT-04', status: 'aplicada' },
  ];

  const MOCK_ACTIVOS = [
    { cuenta: '1201-001', nombre: 'Escritorios Ejecutivos (10 pzas)', categoria: 'Mobiliario', fechaAdq: '2022-01-15', costoAdq: 85_000, depAnual: 17_000, depAcum: 34_000, valorNeto: 51_000, vidaUtil: 5, vidaRestante: 3, metodo: 'Línea Recta', ubicacion: 'Piso 3 - Gerencias' },
    { cuenta: '1201-002', nombre: 'Sillas Ergonómicas (25 pzas)', categoria: 'Mobiliario', fechaAdq: '2022-01-15', costoAdq: 62_500, depAnual: 12_500, depAcum: 25_000, valorNeto: 37_500, vidaUtil: 5, vidaRestante: 3, metodo: 'Línea Recta', ubicacion: 'Todas las áreas' },
    { cuenta: '1201-003', nombre: 'Sala de Juntas (mesa + sillas)', categoria: 'Mobiliario', fechaAdq: '2022-03-01', costoAdq: 145_000, depAnual: 29_000, depAcum: 55_100, valorNeto: 89_900, vidaUtil: 5, vidaRestante: 2.8, metodo: 'Línea Recta', ubicacion: 'Piso 4 - Sala A' },
    { cuenta: '1202-001', nombre: 'Laptops MacBook Pro (12 pzas)', categoria: 'Equipo Cómputo', fechaAdq: '2023-02-10', costoAdq: 360_000, depAnual: 72_000, depAcum: 78_000, valorNeto: 282_000, vidaUtil: 5, vidaRestante: 4.1, metodo: 'Línea Recta', ubicacion: 'Desarrollo / Finanzas' },
    { cuenta: '1202-002', nombre: 'Servidor Dell PowerEdge R750', categoria: 'Equipo Cómputo', fechaAdq: '2023-01-20', costoAdq: 280_000, depAnual: 56_000, depAcum: 60_667, valorNeto: 219_333, vidaUtil: 5, vidaRestante: 4.2, metodo: 'Línea Recta', ubicacion: 'Cuarto de Servidores' },
    { cuenta: '1202-003', nombre: 'Switches y Router Core', categoria: 'Equipo Cómputo', fechaAdq: '2023-01-20', costoAdq: 95_000, depAnual: 19_000, depAcum: 20_583, valorNeto: 74_417, vidaUtil: 5, vidaRestante: 4.2, metodo: 'Línea Recta', ubicacion: 'Infraestructura de Red' },
    { cuenta: '1202-004', nombre: 'Impresoras (3 pzas) + Escáner', categoria: 'Equipo Cómputo', fechaAdq: '2022-06-01', costoAdq: 48_000, depAnual: 9_600, depAcum: 18_400, valorNeto: 29_600, vidaUtil: 5, vidaRestante: 2.6, metodo: 'Línea Recta', ubicacion: 'Área Administrativa' },
    { cuenta: '1202-005', nombre: 'Pantallas Monitoreo (8 pzas)', categoria: 'Equipo Cómputo', fechaAdq: '2023-04-15', costoAdq: 72_000, depAnual: 14_400, depAcum: 13_200, valorNeto: 58_800, vidaUtil: 5, vidaRestante: 4.7, metodo: 'Línea Recta', ubicacion: 'NOC / Operaciones' },
    { cuenta: '1202-006', nombre: 'UPS y Reguladores de Voltaje', categoria: 'Equipo Cómputo', fechaAdq: '2023-01-20', costoAdq: 45_000, depAnual: 9_000, depAcum: 9_750, valorNeto: 35_250, vidaUtil: 5, vidaRestante: 4.2, metodo: 'Línea Recta', ubicacion: 'Cuarto de Servidores' },
    { cuenta: '1202-007', nombre: 'Teléfonos IP (20 pzas)', categoria: 'Equipo Cómputo', fechaAdq: '2022-04-01', costoAdq: 40_000, depAnual: 8_000, depAcum: 16_000, valorNeto: 24_000, vidaUtil: 5, vidaRestante: 2.8, metodo: 'Línea Recta', ubicacion: 'Todas las áreas' },
    { cuenta: '1201-SIN', nombre: 'Locker área común (sin clasificar)', categoria: 'Mobiliario', fechaAdq: '2024-01-10', costoAdq: 18_000, depAnual: 3_600, depAcum: 1_200, valorNeto: 16_800, vidaUtil: 5, vidaRestante: 4.9, metodo: 'Pendiente', ubicacion: 'Sin asignar' },
  ];

  const sections = [
    { id: 'estado_resultados' as const, label: 'Estado de Resultados', icon: <FileBarChart size={14} /> },
    { id: 'razones_cxp' as const, label: 'Razones de Cuentas por Pagar', icon: <DollarSign size={14} /> },
    { id: 'razones' as const, label: 'Razones Financieras', icon: <TrendingUp size={14} /> },
    { id: 'importar_erp' as const, label: 'Importar ERP', icon: <FolderSync size={14} /> },
  ];

  // Gauge component for ratios — tooltip renders via React Portal to escape ALL stacking contexts
  const RatioGauge = ({ label, value, format, min, max, ideal, unit, color, tooltip }: {
    label: string; value: number; format: string; min: number; max: number; ideal?: string; unit?: string; color: string;
    tooltip?: { status: 'saludable' | 'precaución' | 'riesgo'; title: string; explanation: string; recommendation: string };
  }) => {
    const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
    const [showTip, setShowTip] = React.useState(false);
    const gaugeRef = React.useRef<HTMLDivElement>(null);
    const [tipPos, setTipPos] = React.useState({ top: 0, left: 0, width: 0, placement: 'below' as 'below' | 'above' });
    const tipStatusConfig = {
      saludable: { icon: '✅', bgStyle: { background: '#f0fdf4', borderColor: '#bbf7d0' }, titleColor: '#15803d', badgeBg: '#dcfce7', badgeText: '#166534', label: 'Saludable' },
      precaución: { icon: '⚠️', bgStyle: { background: '#fffbeb', borderColor: '#fde68a' }, titleColor: '#b45309', badgeBg: '#fef3c7', badgeText: '#92400e', label: 'Precaución' },
      riesgo: { icon: '🔴', bgStyle: { background: '#fef2f2', borderColor: '#fecaca' }, titleColor: '#b91c1c', badgeBg: '#fee2e2', badgeText: '#991b1b', label: 'Riesgo' },
    };

    const handleMouseEnter = () => {
      if (gaugeRef.current && tooltip) {
        const rect = gaugeRef.current.getBoundingClientRect();
        const tipHeight = 240;
        const spaceBelow = window.innerHeight - rect.bottom;
        const placement = spaceBelow < tipHeight + 16 ? 'above' : 'below';
        setTipPos({
          top: placement === 'above' ? rect.top - tipHeight - 10 : rect.bottom + 10,
          left: rect.left,
          width: Math.max(rect.width, 320),
          placement,
        });
      }
      setShowTip(true);
    };

    return (
      <motion.div
        ref={gaugeRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-brand-sand/30 cursor-default"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTip(false)}
      >
        <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/40 mb-3 flex items-center gap-1.5">
          {label}
          {tooltip && <HelpCircle size={10} className="text-brand-ink/20" />}
        </p>
        <div className="flex items-end gap-2 mb-3">
          <span className="font-serif text-2xl tracking-tight text-brand-ink">{format}</span>
          {unit && <span className="text-[9px] text-brand-ink/40 font-bold uppercase mb-1">{unit}</span>}
        </div>
        <div className="w-full h-2 bg-brand-sand/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        {ideal && <p className="text-[7px] text-brand-ink/30 mt-2 uppercase tracking-wider">Ideal: {ideal}</p>}

        {/* Portal Tooltip — renders at document.body, fully escapes all parent stacking contexts */}
        {showTip && tooltip && ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              top: tipPos.top,
              left: tipPos.left,
              width: tipPos.width,
              zIndex: 99999,
              pointerEvents: 'none',
              ...tipStatusConfig[tooltip.status].bgStyle,
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1)',
              animation: 'fadeInTip 0.18s ease-out',
            }}
          >
            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '2px 8px', borderRadius: 9999,
                background: tipStatusConfig[tooltip.status].badgeBg,
                color: tipStatusConfig[tooltip.status].badgeText,
              }}>
                {tipStatusConfig[tooltip.status].icon} {tipStatusConfig[tooltip.status].label}
              </span>
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(0,0,0,0.3)' }}>{format} {unit || ''}</span>
            </div>

            {/* Title */}
            <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: tipStatusConfig[tooltip.status].titleColor }}>
              {tooltip.title}
            </p>

            {/* Explanation */}
            <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 12 }}>
              {tooltip.explanation}
            </p>

            {/* Recommendation */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 10,
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <Sparkles size={12} style={{ color: '#C5A059', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', marginBottom: 2 }}>Recomendación</p>
                <p style={{ fontSize: 9, color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>{tooltip.recommendation}</p>
              </div>
            </div>
          </div>,
          document.body
        )}
      </motion.div>
    );
  };

  // P&L Row component
  const PLRow = ({ label, amount, bold, indent, highlight, border }: {
    label: string; amount: number; bold?: boolean; indent?: boolean; highlight?: boolean; border?: boolean;
  }) => (
    <div className={`flex justify-between items-center py-2.5 px-4 ${border ? 'border-t border-brand-sand/40' : ''} ${highlight ? 'bg-brand-gold/5 rounded-xl' : ''}`}>
      <span className={`text-[10px] tracking-wider ${bold ? 'font-bold uppercase text-brand-ink' : 'text-brand-ink/60'} ${indent ? 'pl-6' : ''}`}>
        {label}
      </span>
      <span className={`font-serif text-sm tracking-tight ${bold ? 'text-brand-ink font-bold' : amount < 0 ? 'text-red-500' : 'text-brand-ink/80'}`}>
        ${fmt(amount)}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl tracking-tight text-brand-ink">Contabilidad</h2>
          <p className="text-[9px] uppercase tracking-[.25em] text-brand-ink/40 font-bold mt-1">
            Información financiera · {selectedPeriodData.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Datos derivados del ERP</span>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/40 backdrop-blur-sm p-1 rounded-2xl border border-brand-sand/20 w-fit">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] uppercase tracking-[.15em] font-bold transition-all duration-300 ${
              activeSection === s.id
                ? 'bg-brand-ink text-brand-paper shadow-lg'
                : 'text-brand-ink/40 hover:text-brand-ink/70 hover:bg-white/50'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════════════ ESTADO DE RESULTADOS ═══════════════════ */}
        {activeSection === 'estado_resultados' && (
          <motion.div
            key="er"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Period Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PeriodSelector />
                {selectedPeriodData.closed && !isAccumulated && (
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={10} /> Período cerrado
                  </span>
                )}
                {!selectedPeriodData.closed && !isAccumulated && (
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    <Clock size={10} /> Período abierto
                  </span>
                )}
              </div>
              <p className="text-[9px] text-brand-ink/30 font-bold uppercase tracking-wider">{selectedPeriodData.label}</p>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Ingresos Totales', value: fmtM(ingresos.total), sub: varVsAnterior !== null ? `${varVsAnterior >= 0 ? '+' : ''}${varVsAnterior.toFixed(1)}% vs anterior` : isAccumulated ? '6 meses acumulados' : 'Primer período', color: 'text-brand-ink' },
                { label: 'Utilidad Bruta', value: fmtM(utilidadBruta), sub: `Margen ${fmtPct(margenBruto)}`, color: 'text-brand-ink' },
                { label: 'EBITDA', value: fmtM(ebitda), sub: `Margen ${fmtPct(margenEbitda)}`, color: 'text-brand-gold' },
                { label: 'Utilidad Neta', value: fmtM(utilidadNeta), sub: `Margen ${fmtPct(margenNeto)}`, color: utilidadNeta > 0 ? 'text-green-600' : 'text-red-500' },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-brand-sand/20"
                >
                  <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/40">{kpi.label}</p>
                  <p className={`font-serif text-2xl tracking-tight mt-2 ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-[8px] text-brand-ink/30 mt-1 font-medium">{kpi.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Two columns: P&L Table + Chart */}
            <div className="grid grid-cols-5 gap-6">
              {/* P&L Statement */}
              <div className="col-span-3 bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-sand/20">
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Estado de Resultados</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Período: {selectedPeriodData.label}</p>
                </div>
                <div className="p-4 space-y-0.5">
                  <PLRow label="Ventas Netas" amount={ingresos.ventasNetas} bold />
                  <PLRow label="Otros Ingresos" amount={ingresos.otrosIngresos} indent />
                  <PLRow label="Ingresos Financieros" amount={ingresos.ingresosFinancieros} indent />
                  <PLRow label="Total Ingresos" amount={ingresos.total} bold highlight border />

                  <div className="h-3" />
                  <PLRow label="Costo de Ventas" amount={-costos.costoVentas} indent />
                  <PLRow label="Depreciación" amount={-costos.depreciacion} indent />
                  <PLRow label="Utilidad Bruta" amount={utilidadBruta} bold highlight border />

                  <div className="h-3" />
                  <PLRow label="Sueldos y Salarios" amount={-gastosOp.sueldos} indent />
                  <PLRow label="Servicios Profesionales" amount={-gastosOp.servicios} indent />
                  <PLRow label="Rentas" amount={-gastosOp.renta} indent />
                  <PLRow label="Marketing" amount={-gastosOp.marketing} indent />
                  <PLRow label="Tecnología" amount={-gastosOp.tecnologia} indent />
                  <PLRow label="Otros Gastos" amount={-gastosOp.otros} indent />
                  <PLRow label="Total Gastos Operativos" amount={-gastosOp.total} bold border />

                  <div className="h-3" />
                  <PLRow label="Utilidad Operativa" amount={utilidadOperativa} bold highlight border />
                  <PLRow label="ISR (30%)" amount={-isr} indent />
                  <PLRow label="PTU (10%)" amount={-ptu} indent />
                  <PLRow label="Utilidad Neta" amount={utilidadNeta} bold highlight border />
                </div>
              </div>

              {/* Trend Chart */}
              <div className="col-span-2 space-y-4">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-5">
                  <h4 className="text-[9px] uppercase tracking-[.2em] font-bold text-brand-ink/40 mb-4">Tendencia Mensual</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={plMonthlyData}>
                      <defs>
                        <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C5A059" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#C5A059" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradUtilidad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8D3C4" strokeOpacity={0.3} />
                      <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#1A1A1A80' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 8, fill: '#1A1A1A50' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
                      <RechartsTooltip
                        contentStyle={{ background: '#FFFDF5', border: '1px solid #D8D3C4', borderRadius: 12, fontSize: 10 }}
                        formatter={(v: number) => [`$${(v/1000).toFixed(0)}K`, '']}
                      />
                      <Area type="monotone" dataKey="ingresos" stroke="#C5A059" fill="url(#gradIngresos)" strokeWidth={2} name="Ingresos" />
                      <Area type="monotone" dataKey="utilidad" stroke="#22c55e" fill="url(#gradUtilidad)" strokeWidth={2} name="Utilidad" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Margin cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Margen Bruto', value: margenBruto, color: '#C5A059' },
                    { label: 'Margen Operativo', value: margenOperativo, color: '#8B7355' },
                    { label: 'Margen EBITDA', value: margenEbitda, color: '#6B5B3E' },
                    { label: 'Margen Neto', value: margenNeto, color: '#22c55e' },
                  ].map((m, i) => (
                    <motion.div
                      key={m.label}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-brand-sand/20"
                    >
                      <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/35">{m.label}</p>
                      <div className="flex items-end gap-1 mt-2">
                        <span className="font-serif text-xl tracking-tight text-brand-ink">{m.value.toFixed(1)}</span>
                        <span className="text-[9px] text-brand-ink/40 mb-0.5 font-bold">%</span>
                      </div>
                      <div className="w-full h-1.5 bg-brand-sand/20 rounded-full mt-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(m.value, 100)}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════ RAZONES DE CUENTAS POR PAGAR ═══════════════════ */}
        {activeSection === 'razones_cxp' && (
          <motion.div key="razones_cxp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="label-caps !text-brand-gold">Análisis · Cuentas por Pagar</span>
                <h3 className="text-2xl font-serif text-brand-ink">Razones de Cuentas por Pagar</h3>
                <p className="text-[10px] text-brand-ink/40 mt-1">Métricas operativas y de riesgo calculadas con tus datos reales de tesorería.</p>
              </div>
              {financialRatios && (
                <span className="text-[9px] text-brand-ink/40 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Datos en vivo
                </span>
              )}
            </div>

            {!financialRatios ? (
              <div className="editorial-card text-center py-16 text-brand-ink/40 text-sm">Cargando razones de cuentas por pagar…</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="editorial-card !p-6 space-y-2">
                    <div className="flex items-center gap-2 text-brand-ink/40"><Clock size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Días Promedio de Pago</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.dpo.value}<span className="text-lg text-brand-ink/40 ml-1.5 font-sans">días</span></p>
                    <p className="text-[10px] text-brand-ink/40">Promedio sobre {financialRatios.dpo.basis} factura(s) pagada(s)</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-3">
                    <div className="flex items-center gap-2 text-brand-ink/40"><CheckCircle2 size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Pagadas a Tiempo</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.punctuality.onTimePct}<span className="text-lg text-brand-ink/40 ml-1 font-sans">%</span></p>
                    <div className="w-full h-2 bg-brand-sand/40 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${financialRatios.punctuality.onTimePct}%` }} />
                    </div>
                    <p className="text-[10px] text-brand-ink/40">{financialRatios.punctuality.onTime} a tiempo · {financialRatios.punctuality.late} tarde</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-2">
                    <div className="flex items-center gap-2 text-brand-ink/40"><RefreshCw size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Rotación de CxP</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.turnover.value}<span className="text-lg text-brand-ink/40 ml-1.5 font-sans">veces</span></p>
                    <p className="text-[10px] text-brand-ink/40">Compras {CURRENCY_FORMATTER.format(financialRatios.turnover.compras)} / CxP {CURRENCY_FORMATTER.format(financialRatios.turnover.cxpActual)}</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-2">
                    <div className="flex items-center gap-2 text-brand-ink/40"><DollarSign size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Costo de Factoraje</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.factorajeCost.costPct}<span className="text-lg text-brand-ink/40 ml-1 font-sans">%</span></p>
                    <p className="text-[10px] text-brand-ink/40">{CURRENCY_FORMATTER.format(financialRatios.factorajeCost.totalFee)} en comisiones · {financialRatios.factorajeCost.operations} op.</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-2 md:col-span-2 !bg-brand-ink">
                    <div className="flex items-center gap-2 text-brand-paper/50"><ShieldCheck size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Protegido por Auditoría Forense</span></div>
                    <p className="text-5xl font-serif text-brand-paper leading-none">{CURRENCY_FORMATTER.format(financialRatios.forensicSavings.blockedAmount)}</p>
                    <p className="text-[10px] text-brand-paper/50">{financialRatios.forensicSavings.blockedCount} factura(s) bloqueada(s) por fraude o duplicado · {financialRatios.forensicSavings.discrepancyCount} con discrepancia ({CURRENCY_FORMATTER.format(financialRatios.forensicSavings.discrepancyAmount)})</p>
                  </div>
                </div>

                <div className="editorial-card !p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-brand-ink/40"><Scale size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Concentración de Proveedores</span></div>
                    <p className="text-sm font-bold text-brand-ink">{financialRatios.supplierConcentration.concentrationPct}% en top {financialRatios.supplierConcentration.top.length}</p>
                  </div>
                  <div className="space-y-3">
                    {financialRatios.supplierConcentration.top.map((s, i) => (
                      <div key={s.supplierId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-brand-ink font-medium truncate max-w-[55%]">{s.name}</span>
                          <span className="text-brand-ink/50">{CURRENCY_FORMATTER.format(s.amount)} · {s.sharePct}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-brand-sand/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${s.sharePct}%`, backgroundColor: i === 0 ? '#D4AF37' : i === 1 ? '#C9A227' : i === 2 ? '#B8941F' : '#A8841A' }} />
                        </div>
                      </div>
                    ))}
                    {financialRatios.supplierConcentration.top.length === 0 && (
                      <p className="text-[10px] text-brand-ink/40">Sin cuentas por pagar pendientes para analizar.</p>
                    )}
                  </div>
                  {financialRatios.supplierConcentration.concentrationPct >= 70 && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>Alta concentración: una parte grande de tu deuda depende de pocos proveedores. Considera diversificar para reducir el riesgo operativo.</span>
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ═══════════════════ RAZONES FINANCIERAS ═══════════════════ */}
        {activeSection === 'razones' && (
          <motion.div
            key="razones"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Liquidez */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <DollarSign size={16} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Liquidez</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Capacidad para cumplir obligaciones a corto plazo</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <RatioGauge
                  label="Razón Circulante"
                  value={razones.liquidez.razonCirculante}
                  format={fmtRatio(razones.liquidez.razonCirculante)}
                  min={0} max={4}
                  ideal="1.5 – 2.5"
                  unit="veces"
                  color={razones.liquidez.razonCirculante >= 1.5 ? '#22c55e' : razones.liquidez.razonCirculante >= 1 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.liquidez.razonCirculante >= 2.5 ? {
                    status: 'saludable',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} es excelente`,
                    explanation: `Por cada $1 de deuda a corto plazo, tienes $${fmtRatio(razones.liquidez.razonCirculante)} en activos circulantes. Esto significa que puedes cubrir tus obligaciones ${fmtRatio(razones.liquidez.razonCirculante)} veces sin problemas.`,
                    recommendation: 'Podrías usar parte del excedente de liquidez para inversión a corto plazo o pago anticipado a proveedores con descuento por pronto pago.',
                  } : razones.liquidez.razonCirculante >= 1.5 ? {
                    status: 'saludable',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} está en rango saludable`,
                    explanation: `Tienes $${fmtRatio(razones.liquidez.razonCirculante)} en activos circulantes por cada $1 de pasivos a corto plazo. Es un balance adecuado entre liquidez y eficiencia de capital.`,
                    recommendation: 'Mantén este nivel. Monitorea mensualmente y asegúrate de que tus cuentas por cobrar se estén convirtiendo en efectivo a tiempo.',
                  } : razones.liquidez.razonCirculante >= 1 ? {
                    status: 'precaución',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} está por debajo del ideal`,
                    explanation: `Aunque puedes cubrir tus deudas a corto plazo, el margen es estrecho. Cualquier retraso en cobranza o gasto imprevisto podría generar tensión de liquidez.`,
                    recommendation: 'Acelera la cobranza de facturas vencidas, negocia plazos más largos con proveedores, o considera una línea de crédito revolvente como colchón.',
                  } : {
                    status: 'riesgo',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} indica riesgo de liquidez`,
                    explanation: `Tus pasivos a corto plazo superan tus activos circulantes. Esto significa que no tienes suficientes recursos líquidos para cubrir tus deudas próximas.`,
                    recommendation: 'Urgente: reestructura deuda de corto a largo plazo, inyecta capital, o liquida activos no esenciales. Considera factoraje para convertir cuentas por cobrar en efectivo inmediato.',
                  }}
                />
                <RatioGauge
                  label="Prueba Ácida"
                  value={razones.liquidez.pruebaAcida}
                  format={fmtRatio(razones.liquidez.pruebaAcida)}
                  min={0} max={3}
                  ideal="1.0 – 1.5"
                  unit="veces"
                  color={razones.liquidez.pruebaAcida >= 1 ? '#22c55e' : razones.liquidez.pruebaAcida >= 0.7 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.liquidez.pruebaAcida >= 1.5 ? {
                    status: 'saludable',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — liquidez inmediata excelente`,
                    explanation: `Sin contar inventarios, tienes $${fmtRatio(razones.liquidez.pruebaAcida)} en activos líquidos por cada $1 de deuda a corto plazo. Puedes pagar tus compromisos sin vender inventario.`,
                    recommendation: 'Excelente posición. El excedente de liquidez podría destinarse a inversiones de corto plazo (CETES, reporto) para generar rendimiento.',
                  } : razones.liquidez.pruebaAcida >= 1 ? {
                    status: 'saludable',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — adecuada`,
                    explanation: `Puedes cubrir tus deudas a corto plazo con efectivo y cuentas por cobrar, sin depender de vender inventario. La diferencia con la razón circulante (${fmtRatio(razones.liquidez.razonCirculante)}) muestra cuánto de tu liquidez está en inventarios.`,
                    recommendation: 'Buen nivel. Vigila la rotación de cuentas por cobrar para asegurar que se conviertan en efectivo rápidamente.',
                  } : razones.liquidez.pruebaAcida >= 0.7 ? {
                    status: 'precaución',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — dependes del inventario`,
                    explanation: `Sin inventarios, no alcanzas a cubrir tus deudas a corto plazo 1 a 1. Esto sugiere que gran parte de tu liquidez está atada en mercancía almacenada.`,
                    recommendation: 'Reduce niveles de inventario, mejora la rotación de producto, y acelera la cobranza. Si tienes facturas por cobrar, el factoraje puede liberarte liquidez inmediata.',
                  } : {
                    status: 'riesgo',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — insuficiente`,
                    explanation: `Tus activos más líquidos (efectivo + cuentas por cobrar) solo cubren el ${Math.round(razones.liquidez.pruebaAcida * 100)}% de tus pasivos a corto plazo. Dependes completamente del inventario.`,
                    recommendation: 'Prioridad: cobrar facturas vencidas, negociar plazos con proveedores y evaluar financiamiento puente. No adquieras más inventario hasta mejorar este indicador.',
                  }}
                />
                {(() => {
                  const ct = razones.liquidez.capitalTrabajo;
                  const ctTip = ct > 500000 ? {
                    status: 'saludable' as const,
                    title: `$${fmt(ct)} de capital de trabajo — holgura financiera`,
                    explanation: `Tienes un excedente significativo de activos circulantes sobre pasivos a corto plazo. Esto te da flexibilidad para invertir, pagar anticipadamente, o absorber imprevistos sin estrés.`,
                    recommendation: 'Considera invertir el excedente en instrumentos de bajo riesgo o en mejoras operativas que incrementen tu rentabilidad.',
                  } : ct > 0 ? {
                    status: 'precaución' as const,
                    title: `$${fmt(ct)} de capital de trabajo — margen ajustado`,
                    explanation: `Aunque es positivo, el colchón es pequeño. Un retraso en la cobranza o un gasto imprevisto podría dejarte sin liquidez para operar.`,
                    recommendation: 'Fortalece tu posición reduciendo gastos no esenciales, acelerando cobranza, o asegurando una línea de crédito revolvente como respaldo.',
                  } : {
                    status: 'riesgo' as const,
                    title: `Capital de trabajo negativo: -$${fmt(Math.abs(ct))}`,
                    explanation: `Tus deudas a corto plazo superan tus activos circulantes. La empresa no puede cubrir sus compromisos inmediatos con lo que tiene disponible.`,
                    recommendation: 'Acción inmediata: negocia extensión de plazos con proveedores, cobra facturas vencidas con urgencia, y evalúa si necesitas inyección de capital o reestructura de deuda.',
                  };
                  const ctBgClass = ctTip.status === 'saludable' ? 'bg-green-50 border-green-200' : ctTip.status === 'precaución' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                  const ctBadgeClass = ctTip.status === 'saludable' ? 'bg-green-100 text-green-800' : ctTip.status === 'precaución' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
                  const ctTextClass = ctTip.status === 'saludable' ? 'text-green-700' : ctTip.status === 'precaución' ? 'text-amber-700' : 'text-red-700';
                  const ctIcon = ctTip.status === 'saludable' ? '✅' : ctTip.status === 'precaución' ? '⚠️' : '🔴';
                  const ctLabel = ctTip.status === 'saludable' ? 'Saludable' : ctTip.status === 'precaución' ? 'Precaución' : 'Riesgo';
                  return (
                    <motion.div
                      ref={capitalRef}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-brand-sand/30 relative cursor-default"
                      onMouseEnter={() => {
                        if (capitalRef.current) {
                          const rect = capitalRef.current.getBoundingClientRect();
                          const tipH = 220;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setCapitalTipPos({
                            top: spaceBelow < tipH + 12 ? rect.top - tipH - 8 : rect.bottom + 8,
                            left: rect.left,
                            width: rect.width,
                          });
                        }
                        setCapitalTip(true);
                      }}
                      onMouseLeave={() => setCapitalTip(false)}
                    >
                      <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/40 mb-3 flex items-center gap-1.5">
                        Capital de Trabajo <HelpCircle size={10} className="text-brand-ink/20" />
                      </p>
                      <div className="flex items-end gap-1">
                        <span className="font-serif text-2xl tracking-tight text-brand-ink">${fmt(ct)}</span>
                      </div>
                      <p className="text-[8px] text-brand-ink/30 mt-2">
                        {ct > 0
                          ? 'Positivo — la empresa puede cubrir sus deudas de corto plazo'
                          : 'Negativo — riesgo de insolvencia'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-3">
                        {ct > 0
                          ? <CheckCircle2 size={10} className="text-green-500" />
                          : <AlertTriangle size={10} className="text-red-500" />}
                        <span className={`text-[7px] font-bold uppercase tracking-wider ${ct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {ct > 0 ? 'Saludable' : 'Atención'}
                        </span>
                      </div>

                      {/* Portal tooltip — renders at document.body */}
                      {capitalTip && ReactDOM.createPortal(
                        <div style={{
                          position: 'fixed',
                          top: capitalTipPos.top,
                          left: capitalTipPos.left,
                          width: Math.max(capitalTipPos.width, 320),
                          zIndex: 99999,
                          pointerEvents: 'none',
                          background: ctTip.status === 'saludable' ? '#f0fdf4' : ctTip.status === 'precaución' ? '#fffbeb' : '#fef2f2',
                          borderColor: ctTip.status === 'saludable' ? '#bbf7d0' : ctTip.status === 'precaución' ? '#fde68a' : '#fecaca',
                          borderWidth: 1, borderStyle: 'solid', borderRadius: 12, padding: 16,
                          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1)',
                          animation: 'fadeInTip 0.18s ease-out',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{
                              fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                              padding: '2px 8px', borderRadius: 9999,
                              background: ctTip.status === 'saludable' ? '#dcfce7' : ctTip.status === 'precaución' ? '#fef3c7' : '#fee2e2',
                              color: ctTip.status === 'saludable' ? '#166534' : ctTip.status === 'precaución' ? '#92400e' : '#991b1b',
                            }}>
                              {ctIcon} {ctLabel}
                            </span>
                            <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(0,0,0,0.3)' }}>${fmt(ct)}</span>
                          </div>
                          <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: ctTip.status === 'saludable' ? '#15803d' : ctTip.status === 'precaución' ? '#b45309' : '#b91c1c' }}>
                            {ctTip.title}
                          </p>
                          <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 12 }}>
                            {ctTip.explanation}
                          </p>
                          <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 10,
                            border: '1px solid rgba(0,0,0,0.06)',
                          }}>
                            <Sparkles size={12} style={{ color: '#C5A059', flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', marginBottom: 2 }}>Recomendación</p>
                              <p style={{ fontSize: 9, color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>{ctTip.recommendation}</p>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </motion.div>
                  );
                })()}
              </div>
            </div>

            {/* Deuda */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Scale size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Endeudamiento</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Estructura de capital y apalancamiento</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <RatioGauge
                  label="Razón de Deuda"
                  value={razones.deuda.razonDeuda * 100}
                  format={fmtPct(razones.deuda.razonDeuda * 100)}
                  min={0} max={100}
                  ideal="< 60%"
                  color={razones.deuda.razonDeuda < 0.5 ? '#22c55e' : razones.deuda.razonDeuda < 0.7 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.deuda.razonDeuda < 0.4 ? {
                    status: 'saludable',
                    title: `Solo el ${fmtPct(razones.deuda.razonDeuda * 100)} de tus activos están financiados con deuda`,
                    explanation: `Tu empresa tiene un perfil conservador. La mayor parte de tus activos se financian con capital propio, lo que te da estabilidad y capacidad de pedir crédito si lo necesitas.`,
                    recommendation: 'Podrías apalancar más para crecer. Evalúa créditos con tasa preferencial si hay oportunidades de expansión que justifiquen el costo financiero.',
                  } : razones.deuda.razonDeuda < 0.6 ? {
                    status: 'saludable',
                    title: `Razón de deuda de ${fmtPct(razones.deuda.razonDeuda * 100)} — nivel moderado`,
                    explanation: `Poco más de la mitad de tus activos se financian con recursos de terceros. Es un nivel aceptable para la mayoría de las industrias en México.`,
                    recommendation: 'Mantén este nivel. Si planeas tomar más deuda, asegúrate de que el rendimiento esperado supere la tasa de interés.',
                  } : razones.deuda.razonDeuda < 0.7 ? {
                    status: 'precaución',
                    title: `${fmtPct(razones.deuda.razonDeuda * 100)} de deuda sobre activos — nivel elevado`,
                    explanation: `Más del 60% de tus activos están comprometidos con acreedores. Esto limita tu capacidad para obtener financiamiento adicional y aumenta la presión sobre el flujo de efectivo.`,
                    recommendation: 'Prioriza reducir pasivos: liquida deuda de mayor tasa primero, evita nuevos compromisos, y destina excedentes de efectivo al pago de capital.',
                  } : {
                    status: 'riesgo',
                    title: `Razón de deuda de ${fmtPct(razones.deuda.razonDeuda * 100)} — sobreendeudamiento`,
                    explanation: `La mayoría de tus activos están financiados por terceros. Un cambio en las tasas de interés o una caída en ingresos podría generar incumplimiento.`,
                    recommendation: 'Acción urgente: reestructura de deuda, venta de activos no esenciales, o inyección de capital fresco. Evita absolutamente nueva deuda.',
                  }}
                />
                <RatioGauge
                  label="Apalancamiento"
                  value={razones.deuda.apalancamiento}
                  format={fmtRatio(razones.deuda.apalancamiento)}
                  min={0} max={5}
                  ideal="< 2.0"
                  unit="veces"
                  color={razones.deuda.apalancamiento < 1.5 ? '#22c55e' : razones.deuda.apalancamiento < 2.5 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.deuda.apalancamiento < 1 ? {
                    status: 'saludable',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — empresa poco apalancada`,
                    explanation: `Tu deuda total es menor que tu capital contable. Los accionistas tienen más en juego que los acreedores, lo que da confianza a bancos y proveedores.`,
                    recommendation: 'Buena posición para negociar créditos en términos favorables. Si hay oportunidades de crecimiento, puedes apalancarte con bajo riesgo.',
                  } : razones.deuda.apalancamiento < 2 ? {
                    status: 'saludable',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — equilibrado`,
                    explanation: `Por cada $1 de capital, tienes $${fmtRatio(razones.deuda.apalancamiento)} de deuda. Es un nivel manejable que balancea crecimiento con estabilidad.`,
                    recommendation: 'Mantén el apalancamiento en este rango. Antes de tomar nueva deuda, verifica que la cobertura de intereses se mantenga por encima de 2x.',
                  } : razones.deuda.apalancamiento < 3 ? {
                    status: 'precaución',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — alto`,
                    explanation: `Tu deuda duplica o triplica tu capital. Los acreedores tienen más exposición que los socios, lo que complica obtener nuevo financiamiento.`,
                    recommendation: 'Reduce deuda progresivamente. Capitaliza utilidades en lugar de distribuir dividendos para fortalecer el capital contable.',
                  } : {
                    status: 'riesgo',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — peligrosamente alto`,
                    explanation: `Tu deuda supera 3 veces tu capital. Cualquier variación negativa en ingresos puede llevar a insolvencia técnica. Bancos difícilmente prestarán más.`,
                    recommendation: 'Requiere reestructura de capital inmediata: inyección de socios, conversión de deuda a capital, o venta estratégica de activos.',
                  }}
                />
                <RatioGauge
                  label="Cobertura de Deuda"
                  value={razones.deuda.cobertura}
                  format={fmtRatio(razones.deuda.cobertura)}
                  min={0} max={10}
                  ideal="> 2.0"
                  unit="veces"
                  color={razones.deuda.cobertura > 2 ? '#22c55e' : razones.deuda.cobertura > 1 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.deuda.cobertura > 4 ? {
                    status: 'saludable',
                    title: `Cobertura de ${fmtRatio(razones.deuda.cobertura)}x — tu operación genera de sobra para pagar deuda`,
                    explanation: `Tu utilidad operativa cubre ${fmtRatio(razones.deuda.cobertura)} veces el servicio de tu deuda. Tienes un margen amplio de seguridad ante caídas en ventas.`,
                    recommendation: 'Excelente. Podrías considerar inversiones productivas o renegociar tu deuda existente en mejores términos dado el bajo riesgo.',
                  } : razones.deuda.cobertura > 2 ? {
                    status: 'saludable',
                    title: `Cobertura de ${fmtRatio(razones.deuda.cobertura)}x — nivel adecuado`,
                    explanation: `Generas suficiente utilidad operativa para cubrir tus obligaciones de deuda más de 2 veces. Es el mínimo recomendado por la banca.`,
                    recommendation: 'Buen nivel. Mantén vigilancia mensual. Si la cobertura baja de 2x, considera pausar nuevas inversiones financiadas con deuda.',
                  } : razones.deuda.cobertura > 1 ? {
                    status: 'precaución',
                    title: `Cobertura de ${fmtRatio(razones.deuda.cobertura)}x — margen estrecho`,
                    explanation: `Tu operación genera apenas lo suficiente para cubrir el servicio de deuda. Una baja en ventas del ${Math.round((1 - 1/razones.deuda.cobertura) * 100)}% te pondría en riesgo de impago.`,
                    recommendation: 'No tomes deuda adicional. Enfócate en mejorar márgenes operativos y reducir gastos fijos para ampliar este colchón.',
                  } : {
                    status: 'riesgo',
                    title: `Cobertura menor a 1x — no generas suficiente para pagar tu deuda`,
                    explanation: `Tu utilidad operativa no alcanza a cubrir los pagos de deuda. Estás consumiendo capital o reservas para cumplir con acreedores.`,
                    recommendation: 'Situación crítica: renegocia plazos y tasas con bancos inmediatamente. Reduce costos operativos agresivamente y evalúa si necesitas una reestructura formal.',
                  }}
                />
              </div>
            </div>

            {/* Rendimiento */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                  <TrendingUp size={16} className="text-green-500" />
                </div>
                <div>
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Rendimiento</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Rentabilidad y eficiencia operativa</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <RatioGauge
                  label="ROA"
                  value={razones.rendimiento.roa}
                  format={fmtPct(razones.rendimiento.roa)}
                  min={0} max={30}
                  ideal="> 5%"
                  color={razones.rendimiento.roa > 5 ? '#22c55e' : razones.rendimiento.roa > 2 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.roa > 8 ? {
                    status: 'saludable',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — tus activos generan buen rendimiento`,
                    explanation: `Por cada $100 invertidos en activos totales, la empresa genera $${razones.rendimiento.roa.toFixed(1)} de utilidad neta. Supera el benchmark de la industria en México.`,
                    recommendation: 'Excelente eficiencia de activos. Analiza cuáles activos generan mayor retorno y considera desinvertir en los que no contribuyen.',
                  } : razones.rendimiento.roa > 5 ? {
                    status: 'saludable',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — rendimiento aceptable`,
                    explanation: `Generas ${razones.rendimiento.roa.toFixed(1)} centavos de utilidad por cada peso en activos. Es un nivel razonable que supera la inflación.`,
                    recommendation: 'Busca mejorar la rotación de activos: reduce inventario ocioso, cobra más rápido, y evalúa si todos tus activos fijos están productivos.',
                  } : razones.rendimiento.roa > 2 ? {
                    status: 'precaución',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — rendimiento bajo`,
                    explanation: `Tus activos no están generando suficiente utilidad. Un ROA menor al 5% indica que podrías obtener mejor retorno invirtiendo en CETES o instrumentos de bajo riesgo.`,
                    recommendation: 'Revisa la eficiencia operativa: reduce costos, mejora márgenes, o vende activos improductivos que no contribuyen al negocio.',
                  } : {
                    status: 'riesgo',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — tus activos casi no generan valor`,
                    explanation: `La utilidad que producen tus activos es mínima. Es probable que tengas activos sobredimensionados o márgenes de utilidad muy comprimidos.`,
                    recommendation: 'Diagnóstico profundo necesario: identifica activos improductivos, revisa la estructura de costos completa, y evalúa si el modelo de negocio es sostenible.',
                  }}
                />
                <RatioGauge
                  label="ROE"
                  value={razones.rendimiento.roe}
                  format={fmtPct(razones.rendimiento.roe)}
                  min={0} max={40}
                  ideal="> 15%"
                  color={razones.rendimiento.roe > 15 ? '#22c55e' : razones.rendimiento.roe > 8 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.roe > 20 ? {
                    status: 'saludable',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — alta rentabilidad para accionistas`,
                    explanation: `Los socios obtienen un retorno del ${razones.rendimiento.roe.toFixed(1)}% sobre su inversión. Esto es superior a la mayoría de las alternativas de inversión disponibles en México.`,
                    recommendation: 'Verifica que el alto ROE no sea solo por exceso de apalancamiento (compáralo con ROA). Si es por eficiencia operativa genuina, el negocio es muy atractivo.',
                  } : razones.rendimiento.roe > 15 ? {
                    status: 'saludable',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — retorno atractivo`,
                    explanation: `Los accionistas obtienen ${razones.rendimiento.roe.toFixed(1)} centavos por cada peso invertido. Es un rendimiento que justifica mantener la inversión en el negocio.`,
                    recommendation: 'Buen rendimiento. Reinvierte utilidades para crecer o distribuye dividendos según las necesidades de capitalización.',
                  } : razones.rendimiento.roe > 8 ? {
                    status: 'precaución',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — rendimiento moderado`,
                    explanation: `El retorno para los accionistas es inferior al 15%. Un inversionista podría obtener rendimientos similares en instrumentos financieros con menos riesgo.`,
                    recommendation: 'Mejora márgenes operativos, optimiza la estructura de capital, o considera si necesitas cambiar la estrategia de precios para ser más rentable.',
                  } : {
                    status: 'riesgo',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — el negocio no está siendo rentable para los socios`,
                    explanation: `El capital de los accionistas genera un retorno mínimo. Mantener dinero en el negocio tiene un costo de oportunidad alto.`,
                    recommendation: 'Evalúa si la empresa necesita una reestructuración profunda: ajustar precios, eliminar líneas de negocio no rentables, o reducir la base de capital.',
                  }}
                />
                <RatioGauge
                  label="Margen de Utilidad"
                  value={razones.rendimiento.margenUtilidad}
                  format={fmtPct(razones.rendimiento.margenUtilidad)}
                  min={0} max={30}
                  ideal="> 10%"
                  color={razones.rendimiento.margenUtilidad > 10 ? '#22c55e' : razones.rendimiento.margenUtilidad > 5 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.margenUtilidad > 15 ? {
                    status: 'saludable',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — alta rentabilidad operativa`,
                    explanation: `De cada $100 que vendes, te quedan $${razones.rendimiento.margenUtilidad.toFixed(1)} de utilidad neta después de todos los gastos, impuestos e intereses.`,
                    recommendation: 'Excelente margen. Protégelo manteniendo disciplina en gastos y monitorea que tu costo de ventas no crezca más rápido que tus ingresos.',
                  } : razones.rendimiento.margenUtilidad > 10 ? {
                    status: 'saludable',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — competitivo`,
                    explanation: `Conservas ${razones.rendimiento.margenUtilidad.toFixed(1)} centavos de cada peso vendido. Es un margen saludable para empresas B2B en México.`,
                    recommendation: 'Mantén este nivel. Busca pequeñas eficiencias en gastos administrativos y negocia mejores términos con proveedores clave.',
                  } : razones.rendimiento.margenUtilidad > 5 ? {
                    status: 'precaución',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — margen delgado`,
                    explanation: `Solo conservas ${razones.rendimiento.margenUtilidad.toFixed(1)} centavos por peso vendido. Un incremento en costos o una baja en ventas podría llevarte a pérdidas.`,
                    recommendation: 'Revisa tu estructura de costos línea por línea. Identifica gastos prescindibles, renegocia con proveedores, y evalúa si puedes subir precios sin perder clientes.',
                  } : {
                    status: 'riesgo',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — crítico`,
                    explanation: `Tu utilidad neta es casi nula o negativa. La operación apenas cubre sus costos, sin dejar margen para crecimiento o contingencias.`,
                    recommendation: 'Revisión urgente: audita cada línea del estado de resultados. Elimina gastos no esenciales, renegocia deuda, y evalúa si necesitas ajustar tu modelo de precios.',
                  }}
                />
                <RatioGauge
                  label="Margen EBITDA"
                  value={razones.rendimiento.margenEbitda}
                  format={fmtPct(razones.rendimiento.margenEbitda)}
                  min={0} max={50}
                  ideal="> 20%"
                  color={razones.rendimiento.margenEbitda > 20 ? '#22c55e' : razones.rendimiento.margenEbitda > 10 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.margenEbitda > 25 ? {
                    status: 'saludable',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — operación muy eficiente`,
                    explanation: `Antes de intereses, impuestos, depreciación y amortización, conservas el ${razones.rendimiento.margenEbitda.toFixed(1)}% de tus ventas. Esto refleja una operación con buena estructura de costos.`,
                    recommendation: 'Excelente generación de flujo operativo. Este margen te da capacidad para servir deuda, invertir y distribuir utilidades simultáneamente.',
                  } : razones.rendimiento.margenEbitda > 15 ? {
                    status: 'saludable',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — generación de caja sana`,
                    explanation: `Tu operación genera ${razones.rendimiento.margenEbitda.toFixed(1)} centavos de flujo operativo por cada peso vendido. Es el indicador preferido por bancos para evaluar capacidad de pago.`,
                    recommendation: 'Buen nivel para acceder a crédito bancario. Si la diferencia entre EBITDA y utilidad neta es grande, revisa que tu carga financiera no sea excesiva.',
                  } : razones.rendimiento.margenEbitda > 10 ? {
                    status: 'precaución',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — generación moderada`,
                    explanation: `Tu flujo operativo antes de intereses e impuestos es modesto. Si tienes deuda significativa, este margen puede no ser suficiente para cubrirla cómodamente.`,
                    recommendation: 'Enfócate en mejorar la eficiencia operativa: automatiza procesos, reduce desperdicios, y negocia mejores precios de insumos.',
                  } : {
                    status: 'riesgo',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — generación insuficiente`,
                    explanation: `Tu operación genera muy poco flujo antes de cargos financieros. Esto limita severamente tu capacidad de pagar deuda, invertir y crecer.`,
                    recommendation: 'Reestructura operativa necesaria: reduce gastos fijos, evalúa si hay líneas de negocio deficitarias que debes eliminar, y busca incrementar volumen o precio.',
                  }}
                />
              </div>
            </div>

            {/* Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-brand-ink to-brand-ink/90 rounded-2xl p-6 text-brand-paper"
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles size={18} className="text-brand-gold" />
                <h3 className="font-serif text-lg tracking-tight">Diagnóstico Financiero</h3>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${razones.liquidez.razonCirculante >= 1.5 ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[9px] uppercase tracking-[.15em] font-bold text-brand-paper/60">Liquidez</span>
                  </div>
                  <p className="text-[10px] text-brand-paper/80 leading-relaxed">
                    {razones.liquidez.razonCirculante >= 1.5
                      ? 'Posición sólida. La empresa tiene suficiente liquidez para cubrir sus obligaciones a corto plazo sin estrés financiero.'
                      : 'Posición ajustada. Considerar mejorar ciclo de cobro o reducir pasivos de corto plazo.'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${razones.deuda.razonDeuda < 0.6 ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[9px] uppercase tracking-[.15em] font-bold text-brand-paper/60">Deuda</span>
                  </div>
                  <p className="text-[10px] text-brand-paper/80 leading-relaxed">
                    {razones.deuda.razonDeuda < 0.6
                      ? 'Nivel de endeudamiento conservador. Hay margen para apalancamiento adicional si se requiere inversión.'
                      : 'Endeudamiento moderado-alto. Monitorear capacidad de pago y evitar compromisos adicionales sin plan de reducción.'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${razones.rendimiento.roe > 15 ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[9px] uppercase tracking-[.15em] font-bold text-brand-paper/60">Rendimiento</span>
                  </div>
                  <p className="text-[10px] text-brand-paper/80 leading-relaxed">
                    {razones.rendimiento.roe > 15
                      ? 'Rentabilidad atractiva. El retorno sobre capital justifica la operación y genera valor para accionistas.'
                      : 'Rentabilidad por debajo del benchmark. Explorar optimización de costos operativos o incremento de márgenes.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════════ IMPORTAR ERP ═══════════════════ */}
        {activeSection === 'importar_erp' && (
          <motion.div
            key="importar_erp"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* ── Top bar: connection + data-view nav ── */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between gap-4">
                {/* ERP status pill */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                    <FolderSync size={18} className="text-brand-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-ink">Aspel COI · NOI · SAE</p>
                    <p className="text-[8px] text-brand-ink/30">v14.0 · 192.168.1.50:3306</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider ml-2 ${
                    erpConnection.status === 'connected' ? 'bg-green-50 text-green-600' :
                    erpConnection.status === 'connecting' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      erpConnection.status === 'connected' ? 'bg-green-400 animate-pulse' :
                      erpConnection.status === 'connecting' ? 'bg-amber-400 animate-spin' : 'bg-red-300'
                    }`} />
                    {erpConnection.status === 'connected' ? `Conectado · ${erpConnection.lastSync}` : erpConnection.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                  </div>
                </div>

                {/* Data-view tabs (only when connected) */}
                {erpConnection.status === 'connected' && (
                  <div className="flex gap-1 bg-brand-bone/50 p-1 rounded-xl">
                    {[
                      { id: 'home', icon: <UploadCloud size={12} />, label: 'Importar' },
                      { id: 'catalogo', icon: <ListChecks size={12} />, label: 'Catálogo' },
                      { id: 'polizas', icon: <FileText size={12} />, label: 'Pólizas' },
                      { id: 'activos', icon: <Building2 size={12} />, label: 'Activos Fijos' },
                    ].map(v => (
                      <button key={v.id} onClick={() => setErpDataView(v.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
                          erpDataView === v.id ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'
                        }`}>
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                )}

                {erpConnection.status !== 'connected' ? (
                  <button onClick={simulateConnect} disabled={erpConnection.status === 'connecting'}
                    className="px-4 py-2 bg-brand-ink text-brand-paper text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-ink/80 transition-all disabled:opacity-50">
                    Conectar ERP
                  </button>
                ) : (
                  <button onClick={() => { setErpConnection({ system: 'Aspel COI', status: 'disconnected' }); setErpDataView('home'); }}
                    className="px-4 py-2 bg-red-50 text-red-500 text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-red-100 transition-all">
                    Desconectar
                  </button>
                )}
              </div>
            </div>

            <AnimatePresence mode="wait">

              {/* ────────────────── HOME: import actions + history ────────────────── */}
              {(erpDataView === 'home' || erpConnection.status !== 'connected') && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { icon: <ListChecks size={20} />, title: 'Catálogo de Cuentas', desc: 'Plan de cuentas con mapeo automático a NIF. Alimenta Balance General y Estado de Resultados.', records: '342 cuentas', action: () => { simulateImport('Catálogo de Cuentas', 342, 'Aspel COI v14.0 — 342 cuentas con mapeo NIF'); }, loading: importLoading === 'Catálogo de Cuentas', view: 'catalogo' },
                      { icon: <FileText size={20} />, title: 'Pólizas Contables', desc: 'Pólizas de diario, ingresos, egresos y cheques del período. Actualiza saldos del ER automáticamente.', records: '1,247 pólizas', action: () => { simulateImport('Pólizas Contables', 1247, 'Período Abr 2024 — 1,247 pólizas'); }, loading: importLoading === 'Pólizas Contables', view: 'polizas' },
                      { icon: <Building2 size={20} />, title: 'Saldos Activos Fijos', desc: 'Activos con costo de adquisición, depreciación acumulada y valor neto. Actualiza el Balance General.', records: '92 activos', action: () => { simulateImport('Saldos Activos Fijos', 92, 'Aspel COI — 92 activos fijos con depreciación'); }, loading: importLoading === 'Saldos Activos Fijos', view: 'activos' },
                    ].map((item, i) => (
                      <motion.div key={item.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-5 flex flex-col">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-bone flex items-center justify-center text-brand-gold">{item.icon}</div>
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">{item.title}</h4>
                            <p className="text-[8px] text-brand-ink/30">{item.records}</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-brand-ink/50 leading-relaxed mb-3 flex-1">{item.desc}</p>
                        <div className="flex gap-2">
                          <button onClick={item.action} disabled={erpConnection.status !== 'connected' || !!importLoading}
                            className="flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 flex items-center justify-center gap-1.5 bg-brand-ink text-brand-paper hover:bg-brand-ink/80">
                            {item.loading ? <><Loader2 size={11} className="animate-spin" />Importando...</> : <><Download size={11} />Importar</>}
                          </button>
                          {erpConnection.status === 'connected' && (
                            <button onClick={() => setErpDataView(item.view as any)}
                              className="px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider bg-brand-bone text-brand-ink hover:bg-brand-sand/40 transition-all">
                              Ver
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-6 py-4 border-b border-brand-sand/10 flex items-center justify-between">
                      <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">Historial de Importaciones</h3>
                        <p className="text-[8px] text-brand-ink/30 mt-0.5">{importHistory.length} importaciones · registro inmutable</p>
                      </div>
                      <History size={14} className="text-brand-ink/20" />
                    </div>
                    <div className="divide-y divide-brand-sand/10">
                      {importHistory.map((imp, i) => (
                        <motion.div key={imp.id} initial={i === 0 ? { opacity: 0, x: -16 } : {}} animate={{ opacity: 1, x: 0 }}
                          className="px-6 py-3 flex items-center gap-4 hover:bg-brand-bone/30 transition-colors">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${imp.status === 'success' ? 'bg-green-50 text-green-500' : imp.status === 'partial' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'}`}>
                            {imp.status === 'success' ? <CheckCircle2 size={13} /> : imp.status === 'partial' ? <AlertTriangle size={13} /> : <AlertCircle size={13} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-brand-ink">{imp.type}</span>
                              <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${imp.status === 'success' ? 'bg-green-50 text-green-600' : imp.status === 'partial' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                {imp.status === 'success' ? 'Completado' : imp.status === 'partial' ? 'Parcial' : 'Error'}
                              </span>
                            </div>
                            <p className="text-[8px] text-brand-ink/40 truncate">{imp.detail}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-serif text-sm text-brand-ink">{imp.records.toLocaleString()}</p>
                            <p className="text-[7px] text-brand-ink/25 uppercase">registros</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[8px] text-brand-ink/40">{imp.date}</p>
                            <p className="text-[7px] text-brand-ink/20 font-mono">{imp.id}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ────────────────── CATÁLOGO DE CUENTAS ────────────────── */}
              {erpDataView === 'catalogo' && erpConnection.status === 'connected' && (
                <motion.div key="catalogo" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl tracking-tight text-brand-ink">Catálogo de Cuentas</h3>
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Aspel COI v14.0 · {MOCK_CATALOGO.length} cuentas · NIF mapeadas</p>
                    </div>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                      <input value={catalogoFilter} onChange={e => setCatalogoFilter(e.target.value)} placeholder="Buscar cuenta o nombre..."
                        className="pl-8 pr-4 py-2 text-[10px] bg-white/70 border border-brand-sand/20 rounded-xl outline-none w-60" />
                    </div>
                  </div>

                  {/* Summary pills */}
                  <div className="flex gap-3">
                    {['Activo','Pasivo','Capital','Resultado'].map(clase => {
                      const items = MOCK_CATALOGO.filter(c => c.clase === clase);
                      const colors: Record<string,string> = { Activo: 'bg-blue-50 text-blue-600', Pasivo: 'bg-red-50 text-red-500', Capital: 'bg-green-50 text-green-600', Resultado: 'bg-amber-50 text-amber-600' };
                      return (
                        <div key={clase} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${colors[clase]}`}>
                          <span>{clase}</span>
                          <span className="opacity-60">{items.length} cuentas</span>
                        </div>
                      );
                    })}
                    <div className="ml-auto flex items-center gap-2 text-[8px] text-brand-ink/30 font-bold uppercase tracking-wider">
                      <CheckCircle2 size={12} className="text-green-400" />
                      {MOCK_CATALOGO.filter(c => c.mapeada).length} mapeadas a ER/BG
                    </div>
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-12 gap-2 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                      <span className="col-span-1">Cuenta</span>
                      <span className="col-span-4">Nombre</span>
                      <span className="col-span-1">Clase</span>
                      <span className="col-span-1">Tipo</span>
                      <span className="col-span-1">Niv.</span>
                      <span className="col-span-2 text-right">Saldo</span>
                      <span className="col-span-1">Destino</span>
                      <span className="col-span-1">Estado</span>
                    </div>
                    <div className="divide-y divide-brand-sand/5 max-h-[480px] overflow-y-auto">
                      {MOCK_CATALOGO.filter(c =>
                        catalogoFilter === '' ||
                        c.cuenta.includes(catalogoFilter) ||
                        c.nombre.toLowerCase().includes(catalogoFilter.toLowerCase())
                      ).map((c, i) => {
                        const claseColor: Record<string,string> = { Activo: 'text-blue-500', Pasivo: 'text-red-400', Capital: 'text-green-500', Resultado: 'text-amber-500' };
                        return (
                          <motion.div key={c.cuenta} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                            className={`px-5 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-brand-bone/30 transition-colors ${c.nivel === 1 ? 'bg-brand-bone/20' : ''}`}>
                            <span className={`col-span-1 font-mono text-[9px] font-bold ${c.nivel === 1 ? 'text-brand-ink' : 'text-brand-ink/50'}`}>{c.cuenta}</span>
                            <span className={`col-span-4 text-[10px] ${c.nivel === 1 ? 'font-bold text-brand-ink' : c.nivel === 2 ? 'font-semibold text-brand-ink/80 pl-3' : 'text-brand-ink/60 pl-6'}`}>{c.nombre}</span>
                            <span className={`col-span-1 text-[8px] font-bold uppercase ${claseColor[c.clase]}`}>{c.clase.slice(0,3)}</span>
                            <span className="col-span-1 text-[8px] text-brand-ink/40">{c.tipo === 'Acumulativa' ? 'Acum.' : 'Det.'}</span>
                            <span className="col-span-1 text-[9px] text-brand-ink/30 font-mono">{c.nivel}</span>
                            <span className={`col-span-2 text-right font-serif text-sm ${c.saldo < 0 ? 'text-red-500' : 'text-brand-ink'}`}>
                              {c.saldo < 0 ? `(${Math.abs(c.saldo).toLocaleString()})` : c.saldo.toLocaleString()}
                            </span>
                            <span className={`col-span-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md w-fit ${c.destino === 'ER' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{c.destino}</span>
                            <span className="col-span-1">
                              {c.mapeada
                                ? <CheckCircle2 size={12} className="text-green-400" />
                                : <AlertCircle size={12} className="text-amber-400" />}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-brand-ink/5 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles size={14} className="text-brand-gold mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-brand-ink/60 leading-relaxed">
                      Las cuentas marcadas como <strong className="text-brand-ink">ER</strong> alimentan automáticamente el <strong className="text-brand-ink">Estado de Resultados</strong> (ingresos y gastos).
                      Las marcadas <strong className="text-brand-ink">BG</strong> alimentan el <strong className="text-brand-ink">Balance General</strong> (activos, pasivos y capital).
                      Puedes modificar el mapeo para ajustar qué cuentas aparecen en cada estado financiero.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ────────────────── PÓLIZAS CONTABLES ────────────────── */}
              {erpDataView === 'polizas' && erpConnection.status === 'connected' && (
                <motion.div key="polizas" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-xl tracking-tight text-brand-ink">Pólizas Contables</h3>
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Período Abril 2024 · {MOCK_POLIZAS.length} pólizas importadas</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={polizasType} onChange={e => setPolizasType(e.target.value)}
                        className="text-[9px] px-3 py-2 rounded-xl border border-brand-sand/20 bg-white/70 outline-none">
                        {['Todos','Ingreso','Egreso','Diario'].map(t => <option key={t}>{t}</option>)}
                      </select>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                        <input value={polizasFilter} onChange={e => setPolizasFilter(e.target.value)} placeholder="Buscar concepto o ref..."
                          className="pl-8 pr-4 py-2 text-[10px] bg-white/70 border border-brand-sand/20 rounded-xl outline-none w-56" />
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Ingresos', value: MOCK_POLIZAS.filter(p => p.tipo === 'Ingreso').reduce((s,p) => s + p.abono, 0), color: 'text-green-600' },
                      { label: 'Total Egresos', value: MOCK_POLIZAS.filter(p => p.tipo === 'Egreso').reduce((s,p) => s + p.cargo, 0), color: 'text-red-500' },
                      { label: 'Pólizas Diario', value: MOCK_POLIZAS.filter(p => p.tipo === 'Diario').length, color: 'text-brand-ink', suffix: 'pólizas' },
                    ].map((s,i) => (
                      <div key={i} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-4">
                        <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/30">{s.label}</p>
                        <p className={`font-serif text-xl tracking-tight mt-1 ${s.color}`}>
                          {s.suffix ? s.value : `$${s.value.toLocaleString()}`}
                          {s.suffix && <span className="text-sm text-brand-ink/40 ml-1">{s.suffix}</span>}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-12 gap-2 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                      <span className="col-span-1">ID</span>
                      <span className="col-span-1">Tipo</span>
                      <span className="col-span-1">Fecha</span>
                      <span className="col-span-4">Concepto</span>
                      <span className="col-span-1">Cuenta</span>
                      <span className="col-span-1 text-right">Cargo</span>
                      <span className="col-span-1 text-right">Abono</span>
                      <span className="col-span-1">Referencia</span>
                      <span className="col-span-1">Estado</span>
                    </div>
                    <div className="divide-y divide-brand-sand/5">
                      {MOCK_POLIZAS.filter(p =>
                        (polizasType === 'Todos' || p.tipo === polizasType) &&
                        (polizasFilter === '' || p.concepto.toLowerCase().includes(polizasFilter.toLowerCase()) || p.ref.toLowerCase().includes(polizasFilter.toLowerCase()))
                      ).map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          onClick={() => setSelectedPoliza(selectedPoliza === p.id ? null : p.id)}
                          className="cursor-pointer">
                          <div className="px-5 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-brand-bone/30 transition-colors">
                            <span className="col-span-1 font-mono text-[8px] text-brand-ink/40">{p.id}</span>
                            <span className={`col-span-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md w-fit ${
                              p.tipo === 'Ingreso' ? 'bg-green-50 text-green-600' : p.tipo === 'Egreso' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                            }`}>{p.tipo}</span>
                            <span className="col-span-1 text-[8px] text-brand-ink/50">{p.fecha}</span>
                            <span className="col-span-4 text-[9px] text-brand-ink/80 truncate">{p.concepto}</span>
                            <span className="col-span-1 font-mono text-[9px] text-brand-gold">{p.cuenta}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-brand-ink/70">{p.cargo > 0 ? `$${p.cargo.toLocaleString()}` : '—'}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-green-600">{p.abono > 0 ? `$${p.abono.toLocaleString()}` : '—'}</span>
                            <span className="col-span-1 font-mono text-[8px] text-brand-ink/40 truncate">{p.ref}</span>
                            <span className="col-span-1"><CheckCircle2 size={12} className="text-green-400" /></span>
                          </div>
                          {/* Expandable detail */}
                          <AnimatePresence>
                            {selectedPoliza === p.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="px-5 pb-3 bg-brand-bone/30 overflow-hidden">
                                <div className="grid grid-cols-3 gap-4 pt-3">
                                  <div>
                                    <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30 mb-1">Movimientos</p>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[9px]">
                                        <span className="text-brand-ink/60">{p.cuenta} {p.tipo === 'Egreso' ? '(Cargo)' : '(Abono)'}</span>
                                        <span className="font-serif">${(p.cargo || p.abono).toLocaleString()}</span>
                                      </div>
                                      {p.cargo > 0 && p.abono > 0 && (
                                        <div className="flex justify-between text-[9px]">
                                          <span className="text-brand-ink/60">Cuenta complementaria</span>
                                          <span className="font-serif text-green-600">${p.abono.toLocaleString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30 mb-1">Referencia Fiscal</p>
                                    <p className="text-[9px] text-brand-ink/60">{p.ref}</p>
                                    <p className="text-[8px] text-brand-ink/30 mt-1">Período: {p.fecha.slice(0,7)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30 mb-1">Impacto en ER/BG</p>
                                    <p className="text-[9px] text-brand-ink/60">
                                      {p.cuenta.startsWith('4') ? '↑ Incrementa Ingresos en ER' :
                                       p.cuenta.startsWith('5') || p.cuenta.startsWith('6') ? '↑ Incrementa Gastos en ER' :
                                       p.cuenta.startsWith('1') ? '↔ Modifica Activo en BG' :
                                       p.cuenta.startsWith('2') ? '↔ Modifica Pasivo en BG' : '↔ Afecta Capital en BG'}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-brand-ink/5 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles size={14} className="text-brand-gold mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-brand-ink/60 leading-relaxed">
                      Cada póliza actualiza automáticamente los saldos del <strong className="text-brand-ink">Estado de Resultados</strong> y el <strong className="text-brand-ink">Balance General</strong>.
                      Haz clic en cualquier póliza para ver el detalle del movimiento y su impacto contable.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ────────────────── ACTIVOS FIJOS ────────────────── */}
              {erpDataView === 'activos' && erpConnection.status === 'connected' && (
                <motion.div key="activos" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl tracking-tight text-brand-ink">Saldos de Activos Fijos</h3>
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Aspel COI v14.0 · {MOCK_ACTIVOS.length} activos · Método línea recta</p>
                    </div>
                  </div>

                  {/* KPI row */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Costo Total Adquisición', value: `$${MOCK_ACTIVOS.reduce((s,a) => s+a.costoAdq,0).toLocaleString()}` },
                      { label: 'Dep. Acumulada Total', value: `$${MOCK_ACTIVOS.reduce((s,a) => s+a.depAcum,0).toLocaleString()}`, sub: 'aplicada al período' },
                      { label: 'Valor Neto Total', value: `$${MOCK_ACTIVOS.reduce((s,a) => s+a.valorNeto,0).toLocaleString()}`, sub: 'en BG' },
                      { label: 'Sin Clasificar', value: MOCK_ACTIVOS.filter(a => a.metodo === 'Pendiente').length, sub: 'activos pendientes', color: 'text-amber-500' },
                    ].map((k,i) => (
                      <div key={i} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-4">
                        <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/30">{k.label}</p>
                        <p className={`font-serif text-xl tracking-tight mt-1 ${(k as any).color || 'text-brand-ink'}`}>{k.value}</p>
                        {k.sub && <p className="text-[7px] text-brand-ink/25 mt-0.5">{k.sub}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-12 gap-2 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                      <span className="col-span-1">Cuenta</span>
                      <span className="col-span-3">Activo</span>
                      <span className="col-span-1">Categoría</span>
                      <span className="col-span-1 text-right">Costo Adq.</span>
                      <span className="col-span-1 text-right">Dep. Anual</span>
                      <span className="col-span-1 text-right">Dep. Acum.</span>
                      <span className="col-span-1 text-right">Valor Neto</span>
                      <span className="col-span-2">Vida Útil</span>
                      <span className="col-span-1">Método</span>
                    </div>
                    <div className="divide-y divide-brand-sand/5">
                      {MOCK_ACTIVOS.map((a, i) => {
                        const pctDepreciado = (a.depAcum / a.costoAdq) * 100;
                        return (
                          <motion.div key={a.cuenta} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                            className="px-5 py-3 grid grid-cols-12 gap-2 items-center hover:bg-brand-bone/30 transition-colors">
                            <span className="col-span-1 font-mono text-[8px] text-brand-ink/40">{a.cuenta}</span>
                            <div className="col-span-3">
                              <p className="text-[10px] font-bold text-brand-ink leading-tight">{a.nombre}</p>
                              <p className="text-[7px] text-brand-ink/30">{a.ubicacion}</p>
                            </div>
                            <span className={`col-span-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md w-fit ${a.categoria === 'Mobiliario' ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'}`}>
                              {a.categoria === 'Mobiliario' ? 'Mob.' : 'Cómp.'}
                            </span>
                            <span className="col-span-1 text-right font-serif text-sm text-brand-ink">${a.costoAdq.toLocaleString()}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-brand-ink/50">${a.depAnual.toLocaleString()}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-red-400">${a.depAcum.toLocaleString()}</span>
                            <span className="col-span-1 text-right font-serif text-sm font-bold text-brand-ink">${a.valorNeto.toLocaleString()}</span>
                            <div className="col-span-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[8px] text-brand-ink/50">{a.vidaRestante.toFixed(1)} / {a.vidaUtil} años</span>
                              </div>
                              <div className="w-full h-1.5 bg-brand-sand/20 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pctDepreciado}%` }} transition={{ duration: 1, delay: i * 0.05 }}
                                  className={`h-full rounded-full ${pctDepreciado > 70 ? 'bg-red-400' : pctDepreciado > 40 ? 'bg-amber-400' : 'bg-green-400'}`} />
                              </div>
                              <span className="text-[7px] text-brand-ink/25">{pctDepreciado.toFixed(0)}% depreciado</span>
                            </div>
                            <span className={`col-span-1 text-[8px] font-bold ${a.metodo === 'Pendiente' ? 'text-amber-500' : 'text-brand-ink/40'}`}>
                              {a.metodo === 'Pendiente' ? '⚠ Pendiente' : 'L. Recta'}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-brand-ink/5 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles size={14} className="text-brand-gold mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-brand-ink/60 leading-relaxed">
                      El <strong className="text-brand-ink">Valor Neto</strong> de todos los activos ($1,670,000) se refleja automáticamente en el <strong className="text-brand-ink">Balance General → Activo Fijo</strong>.
                      La <strong className="text-brand-ink">Depreciación Anual</strong> alimenta el <strong className="text-brand-ink">Estado de Resultados → cuenta 5002</strong>.
                      Los activos marcados en <span className="text-amber-500 font-bold">amarillo</span> requieren clasificación antes del cierre mensual.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

