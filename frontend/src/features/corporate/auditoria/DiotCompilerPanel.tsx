import React from 'react';
import ExcelJS from 'exceljs';
import { motion } from 'motion/react';
import {
  AlertTriangle, Bell, CheckCircle2, ChevronLeft, Clock, Cpu, Database,
  Download, FileSpreadsheet, FileText, HelpCircle, Loader2, X,
} from 'lucide-react';
import { api, isRealId } from '../../../services/apiClient.ts';
import { type DiotReport, diotRowToTxt, diotResultToReport } from '../../../lib/diot.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export function DiotCompilerPanel() {
  const [reports, setReports] = React.useState<DiotReport[]>([]);
  const [acting, setActing] = React.useState<string | null>(null);
  const [selectedReport, setSelectedReport] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'history' | 'detail'>('history');
  const [periodFilter, setPeriodFilter] = React.useState<'monthly' | 'semestral'>('monthly');
  const [diotAlertDismissed, setDiotAlertDismissed] = React.useState(false);
  // Generación REAL: período elegido (mes o semestre) + estado de la llamada.
  const nowRef = new Date();
  const [genMonth, setGenMonth] = React.useState<string>(
    `${nowRef.getFullYear()}-${String(nowRef.getMonth() + 1).padStart(2, '0')}`,
  );
  const [genYear, setGenYear] = React.useState<number>(nowRef.getFullYear());
  const [genSemester, setGenSemester] = React.useState<1 | 2>(nowRef.getMonth() < 6 ? 1 : 2);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [genMsg, setGenMsg] = React.useState<string | null>(null);

  // Carga el historial REAL de DIOT del backend (facturas → operaciones).
  const loadHistory = React.useCallback(async () => {
    try {
      const hist = await api.getDiotHistory();
      setReports(hist.map(diotResultToReport));
    } catch {
      setReports([]);
    }
  }, []);

  React.useEffect(() => { void loadHistory(); }, [loadHistory]);

  /**
   * Genera la DIOT con datos reales. En mensual usa el mes elegido; en
   * semestral genera los 6 meses del semestre (la DIOT se presenta mensual;
   * la vista semestral consolida). Al terminar, abre el detalle del período.
   */
  const handleGenerateReal = async () => {
    setGenerating(true);
    setGenError(null);
    setGenMsg(null);
    try {
      if (periodFilter === 'monthly') {
        const result = await api.generateDiot(genMonth);
        await loadHistory();
        setGenMsg(`DIOT de ${genMonth} generada con ${result.entries.length} terceros.`);
        setSelectedReport(result.id);
        setViewMode('detail');
      } else {
        const base = genSemester === 1 ? 1 : 7;
        const months = Array.from({ length: 6 }, (_, i) =>
          `${genYear}-${String(base + i).padStart(2, '0')}`,
        );
        let totalTerceros = 0;
        for (const m of months) {
          const r = await api.generateDiot(m);
          totalTerceros += r.entries.length;
        }
        await loadHistory();
        setGenMsg(`Semestre ${genSemester} de ${genYear} generado (${months.length} meses, ${totalTerceros} operaciones).`);
        setSelectedReport(`SEM${genSemester}-${genYear}`);
        setViewMode('detail');
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'No se pudo generar la DIOT.');
    } finally {
      setGenerating(false);
    }
  };

  // Presenta (submit) una DIOT mensual real ante el SAT — acción irreversible.
  const handleSubmit = async (id: string) => {
    if (!isRealId(id)) return;
    setActing(id);
    try {
      await api.submitDiot(id);
      await loadHistory();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'No se pudo presentar la DIOT.');
    } finally {
      setActing(null);
    }
  };

  // Regenera un período existente desde las facturas actuales.
  const handleGenerate = async (id: string) => {
    const rep = reports.find(r => r.id === id);
    if (!rep) return;
    setActing(id);
    try {
      await api.generateDiot(rep.period);
      await loadHistory();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'No se pudo regenerar.');
    } finally {
      setActing(null);
    }
  };

  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const OP_TYPES: Record<string, string> = { '02': 'Enaj. Bienes', '03': 'Prest. Servicios', '06': 'Uso/Goce', '07': 'Importación', '08': 'Imp. Virtual', '85': 'Otros', '87': 'Op. Globales' };
  const TERCERO_TYPES: Record<string, string> = { '04': 'Nacional', '05': 'Extranjero', '15': 'Global' };

  // ─── TXT Download (SAT pipe-separated format) ───
  const handleDownloadTxt = (rep: DiotReport) => {
    const lines = rep.rows.map(row => diotRowToTxt(row));
    const content = lines.join('\r\n');
    const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIOT_${rep.period}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Excel Download (.xlsx — Plantilla SAT 2025 exacta) ───
  const handleDownloadExcel = async (rep: DiotReport) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Royáltica';
    wb.created = new Date();
    const ws = wb.addWorksheet('DIOT SAT 2025', { views: [{ showGridLines: true }] });

    // ── Column widths (replicated from SAT template) ──
    const colWidths: Record<number, number> = {
      1: 3, 2: 16.5, 3: 15.7, 4: 32.8, 5: 18.3, 6: 15.5, 7: 21.5, 8: 15.7, 9: 19.5,
      10: 18.8, 11: 15.7, 12: 22.7, 13: 20.8, 14: 15.7, 15: 15.7, 16: 15.7, 17: 15.7, 18: 15.7, 19: 15.7,
      20: 20, 21: 15.7, 22: 18.3, 23: 15.7, 24: 22.2, 25: 15.7, 26: 18.2, 27: 22.5, 28: 17.5, 29: 19.7,
      30: 15.7, 31: 15.7, 32: 15.7, 33: 15.7, 34: 15.7, 35: 15.7, 36: 15.7, 37: 15.7, 38: 15.7, 39: 15.7,
      40: 15.7, 41: 15.7, 42: 22.2, 43: 20.8, 44: 25.2, 45: 19, 46: 20.7, 47: 19, 48: 20.7, 49: 18.5,
      50: 15.7, 51: 15.7, 52: 15.7, 53: 15.7, 54: 15.7, 55: 15.7, 56: 15.7, 57: 90.5,
    };
    for (let c = 1; c <= 57; c++) ws.getColumn(c).width = colWidths[c] || 15.7;

    // ── Row 6: Title ──
    ws.getRow(6).height = 16;
    ws.mergeCells('C6:K6');
    const titleCell = ws.getCell('C6');
    titleCell.value = 'DECLARACIÓN INFORMATIVA DE OPERACIONES CON TERCEROS (DIOT)';
    titleCell.font = { name: 'Arial', size: 12, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Rows 7-8: spacing ──
    ws.getRow(7).height = 16;
    ws.getRow(8).height = 14;

    // ── Row 9: Section headers ──
    ws.getRow(9).height = 18.75;
    const sectionFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF404040' } };
    const sectionAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
    const sections: [string, string, string][] = [
      ['B9', 'I9', 'Datos del tercero declarado'],
      ['J9', 'S9', 'Valor de actos o actividades '],
      ['T9', 'AC9', 'IVA  acreditable'],
      ['AD9', 'AW9', 'IVA no acreditable'],
      ['AX9', 'BD9', 'Datos adicionales'],
    ];
    for (const [start, end, label] of sections) {
      ws.mergeCells(`${start}:${end}`);
      const c = ws.getCell(start);
      c.value = label;
      c.font = sectionFont;
      c.alignment = sectionAlign;
    }
    // Instructions header
    const beCell = ws.getCell('BE9');
    beCell.value = 'Instrucciones';
    beCell.font = sectionFont;
    beCell.alignment = sectionAlign;

    // ── Row 10: spacing ──
    ws.getRow(10).height = 10.5;

    // ── Row 11: Column headers (156px height) ──
    ws.getRow(11).height = 156;
    const headerFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true };
    const headerAlignCenter: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const headerAlignLeft: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };

    const headerLabels: [string, string, Partial<ExcelJS.Alignment>][] = [
      ['B11', 'Total de operaciones que relaciona', headerAlignCenter],
      ['C11', 'Tipo de tercero\n\n04 - Nacional\n05 - Extranjero\n15 - Global', headerAlignLeft],
      ['D11', 'Tipo de operación\n\n02 - Enaj. de Bienes\n03 - Prest. de Serv. Prof.\n06 - Uso o goce temp. de bienes\n07 Importación de bienes o servicios\n08 Importación por transferencia virtual\n85 - Otros\n87 - Ope. globales', headerAlignLeft],
      ['E11', 'Registro federal de contribuyentes\n(Obligatorio solo si es nacional)', headerAlignLeft],
      ['F11', '\nNúmero de identificación fiscal  \n (Obligatorio solo si es extranjero)', headerAlignLeft],
      ['G11', 'Nombre del extranjero\n(Obligatorio solo si es extranjero)', headerAlignLeft],
      ['H11', 'País o jurisdicción de residencia fiscal \n(Obligatorio solo si es extranjero)', headerAlignLeft],
      ['I11', 'Especificar lugar de jurisdicción fiscal\n(Obligatorio solo si es extranjero)', headerAlignLeft],
      ['J11', 'Valor total de actos o actividades pagadas en la región fronteriza norte', headerAlignCenter],
      ['K11', 'Devoluciones, descuentos y bonificaciones en la región fronteriza norte', headerAlignCenter],
      ['L11', 'Valor total de actos o actividades pagadas en la región fronteriza sur', headerAlignCenter],
      ['M11', 'Devoluciones, descuentos y bonificaciones en la región fronteriza sur', headerAlignCenter],
      ['N11', 'Valor total de actos o actividades pagadas a la tasa del 16% de IVA', headerAlignCenter],
      ['O11', 'Devoluciones, descuentos y bonificaciones a la tasa del 16% de IVA', headerAlignCenter],
      ['P11', 'Valor total de actos o actividades pagados en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['Q11', 'Devoluciones, descuentos y bonificaciones en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['R11', 'Valor total de actos o actividades pagadas en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['S11', 'Devoluciones, descuentos y bonificaciones en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['T11', 'Exclusivamente de actividades gravadas en la región fronteriza norte', headerAlignCenter],
      ['U11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza norte', headerAlignCenter],
      ['V11', 'Exclusivamente de actividades gravadas en la región fronteriza sur', headerAlignCenter],
      ['W11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza sur', headerAlignCenter],
      ['X11', 'Exclusivamente de actividades gravadas pagados a la tasa del 16% de IVA', headerAlignCenter],
      ['Y11', 'Asociado a actividades por las cuales se aplicó una proporción pagados a la tasa del 16% de IVA', headerAlignCenter],
      ['Z11', 'Exclusivamente de actividades gravadas pagadas en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AA11', 'Asociado a actividades por las cuales se aplicó una proporción pagadas en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AB11', 'Exclusivamente de actividades gravadas pagadas en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['AC11', 'Asociado a actividades por las cuales se aplicó una proporción pagados en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['AD11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza norte', headerAlignCenter],
      ['AE11', 'Asociado a que no cumple con requisitos en la región fronteriza norte', headerAlignCenter],
      ['AF11', 'Asociado a actividades exentas en la región fronteriza norte', headerAlignCenter],
      ['AG11', 'Asociado a actividades no objeto en la región fronteriza norte', headerAlignCenter],
      ['AH11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza sur', headerAlignCenter],
      ['AI11', 'Asociado a que no cumple con requisitos en la región fronteriza sur', headerAlignCenter],
      ['AJ11', 'Asociado a actividades exentas en la región fronteriza sur', headerAlignCenter],
      ['AK11', 'Asociado a actividades no objeto en la región fronteriza sur', headerAlignCenter],
      ['AL11', 'Asociado a actividades por las cuales se aplicó una proporción a la tasa del 16% de IVA', headerAlignCenter],
      ['AM11', 'Asociado a que no cumple con requisitos a la tasa del 16% de IVA', headerAlignCenter],
      ['AN11', 'Asociado a actividades exentas a la tasa del 16% de IVA', headerAlignCenter],
      ['AO11', 'Asociado a actividades no objeto a la tasa del 16% de IVA', headerAlignCenter],
      ['AP11', 'Asociado a actividades por las cuales se aplicó una proporción en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AQ11', 'Asociado a que no cumple con requisitos en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AR11', 'Asociado a actividades exentas en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AS11', 'Asociado a actividades no objeto en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AT11', 'Asociado a actividades por las cuales se aplicó una proporción en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AU11', 'Asociado a que no cumple con requisitos en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AV11', 'Asociado a actividades exentas en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AW11', 'Asociado a actividades no objeto en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AX11', 'IVA retenido por el contribuyente pagado', headerAlignCenter],
      ['AY11', 'Valor de actos o actividades pagados en la importación de bienes y servicios por los que no se pagara el IVA (Exentos)', headerAlignCenter],
      ['AZ11', 'Valor de actos o actividades pagados por los que no se pagará el IVA (Exentos)', headerAlignCenter],
      ['BA11', 'Valor de demás actos o actividades pagados a la tasa del 0% de IVA', headerAlignCenter],
      ['BB11', 'Valor de actos o actividades no objeto del IVA realizados en territorio nacional', headerAlignCenter],
      ['BC11', 'Valor de actos o actividades no objeto del IVA por no contar con establecimiento en territorio nacional', headerAlignCenter],
      ['BD11', 'Manifiesto que se dio efectos fiscales a los comprobantes que amparan las operaciones realizadas con el proveedor, detalle', headerAlignCenter],
      ['BE11', 'Se proporciona un ejemplo práctico de como estructurar el archivo de manera correcta:\n\n1.-Copiar la columna en un bloc de notas para obtener el formato (.txt) a partir de la columna "BD9"\n2.-Los datos están separados por el carácter pipe (|).\n3.-Al momento de guardar el archivo se debe cambiar el tipo de codificación UTF-8.\n4.-Subir el archivo en el aplicativo del DIOT en línea en el campo "Agregar desde Archivo"\n5.-El archivo no permite decimales, puntos o comas, utilizar formato general.', headerAlignLeft],
    ];
    for (const [ref, val, align] of headerLabels) {
      const c = ws.getCell(ref);
      c.value = val;
      c.font = headerFont;
      c.alignment = align;
    }

    // ── Row 12: Campo # row (dark background) ──
    const campoFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const campoFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
    const campoAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center' };
    const campoLabels = ['#', ' Campo: 1', ' Campo: 2', ' Campo: 3', ' Campo: 4', ' Campo: 5', ' Campo: 6', ' Campo: 7',
      ' Campo: 8', ' Campo: 9', ' Campo: 10', ' Campo: 11', ' Campo: 12', ' Campo: 13', ' Campo: 14', ' Campo: 15',
      ' Campo: 16', ' Campo: 17', ' Campo: 18', ' Campo: 19', ' Campo: 20', ' Campo: 21', ' Campo: 22', ' Campo: 23',
      ' Campo: 24', ' Campo: 25', ' Campo: 26', ' Campo: 27', ' Campo: 28', ' Campo: 29', ' Campo: 30', ' Campo: 31',
      ' Campo: 32', ' Campo: 33', ' Campo: 34', ' Campo: 35', ' Campo: 36', ' Campo: 37', ' Campo: 38', ' Campo: 39',
      ' Campo: 40', ' Campo: 41', ' Campo: 42', ' Campo: 43', ' Campo: 44', ' Campo: 45', ' Campo: 46', ' Campo: 47',
      ' Campo: 48', ' Campo: 49', ' Campo: 50', ' Campo: 51', ' Campo: 52', ' Campo: 53', ' Campo: 54', '|'];
    for (let i = 0; i < campoLabels.length; i++) {
      const col = i + 2; // starts at B
      const c = ws.getCell(12, col);
      c.value = campoLabels[i];
      c.font = campoFont;
      c.fill = campoFill;
      c.alignment = campoAlign;
    }

    // ── Data rows (starting row 13) ──
    const dataFont: Partial<ExcelJS.Font> = { name: 'Noto Sans', size: 10 };
    const dataCenterAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
    // Column mapping: B=row#, C=campo1..BD=campo54, BE=pipe formula
    // Columns: B(2), C(3)..BD(56), BE(57)
    rep.rows.forEach((row, idx) => {
      const r = 13 + idx;
      ws.getRow(r).height = 15;
      const ivaNoAcred = row.iva_no_acred || new Array(19).fill(0);

      // B: row number
      const bCell = ws.getCell(r, 2);
      bCell.value = idx + 1;
      bCell.font = dataFont;
      bCell.alignment = dataCenterAlign;

      // Campos 1-54 → columns C(3) to BD(56)
      const campos: (string | number | null)[] = [
        row.tipo_tercero,                   // C: Campo 1
        row.tipo_operacion,                 // D: Campo 2
        row.rfc,                            // E: Campo 3
        row.num_id_fiscal || null,          // F: Campo 4
        row.nombre_extranjero || null,      // G: Campo 5
        row.pais_residencia || null,        // H: Campo 6
        row.lugar_jurisdiccion || null,     // I: Campo 7
        row.valor_frontera_norte,           // J: Campo 8
        row.dev_frontera_norte,             // K: Campo 9
        row.valor_frontera_sur,             // L: Campo 10
        row.dev_frontera_sur,               // M: Campo 11
        row.valor_16,                       // N: Campo 12
        row.dev_16,                         // O: Campo 13
        row.valor_imp_tangibles_16,         // P: Campo 14
        row.dev_imp_tangibles_16,           // Q: Campo 15
        row.valor_imp_intangibles_16,       // R: Campo 16
        row.dev_imp_intangibles_16,         // S: Campo 17
        row.iva_acred_frontera_norte,       // T: Campo 18
        row.iva_acred_prop_frontera_norte,  // U: Campo 19
        row.iva_acred_frontera_sur,         // V: Campo 20
        row.iva_acred_prop_frontera_sur,    // W: Campo 21
        row.iva_acred_16,                   // X: Campo 22
        row.iva_acred_prop_16,              // Y: Campo 23
        row.iva_acred_imp_tang_16,          // Z: Campo 24
        row.iva_acred_prop_imp_tang_16,     // AA: Campo 25
        row.iva_acred_imp_intang_16,        // AB: Campo 26
        row.iva_acred_prop_imp_intang_16,   // AC: Campo 27
        ...ivaNoAcred.slice(0, 19),         // AD-AV: Campos 28-46 (19 values)
        row.iva_no_acred?.[19] || 0,        // AW: Campo 47
        row.iva_retenido,                   // AX: Campo 48
        row.valor_exento_importacion,       // AY: Campo 49
        row.valor_exento,                   // AZ: Campo 50
        row.valor_tasa_0,                   // BA: Campo 51
        row.valor_no_objeto_nacional,       // BB: Campo 52
        row.valor_no_objeto_sin_establecimiento, // BC: Campo 53
        row.manifiesto,                     // BD: Campo 54
      ];
      for (let i = 0; i < campos.length; i++) {
        const col = 3 + i; // C=3
        const c = ws.getCell(r, col);
        c.value = campos[i] !== null && campos[i] !== undefined ? campos[i] : null;
        c.font = dataFont;
      }

      // BE: pipe-separated formula (same as SAT template)
      const colLetters = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ','AR','AS','AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD'];
      const formulaParts = colLetters.map(l => `${l}${r}`);
      const formula = '=+' + formulaParts.join('&"|"&') + '&""';
      const beDataCell = ws.getCell(r, 57);
      beDataCell.value = { formula };
      beDataCell.font = dataFont;
    });

    // ── Generate and download ──
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIOT_${rep.period}_SAT2025.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── DIOT Deadline Alert ───
  const now = new Date();
  const currentMonth = now.getMonth();
  const diotDeadline = new Date(now.getFullYear(), currentMonth + 1, 17);
  const daysUntilDiot = Math.ceil((diotDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const diotAlertLevel = daysUntilDiot <= 5 ? 'critical' : daysUntilDiot <= 15 ? 'warning' : 'ok';

  // Filter reports by period
  const filteredReports = periodFilter === 'semestral'
    ? (() => {
        const sem1 = reports.filter(r => { const m = parseInt(r.period.split('-')[1]); return m >= 1 && m <= 6; });
        const sem2 = reports.filter(r => { const m = parseInt(r.period.split('-')[1]); return m >= 7 && m <= 12; });
        return [
          ...(sem1.length > 0 ? [{
            ...sem1[0],
            id: `SEM1-${sem1[0].period.split('-')[0]}`,
            period: `${sem1[0].period.split('-')[0]}-S1`,
            total_providers: sem1.reduce((s, r) => s + r.total_providers, 0),
            total_base_16: sem1.reduce((s, r) => s + r.total_base_16, 0),
            total_iva_acred: sem1.reduce((s, r) => s + r.total_iva_acred, 0),
            total_iva_retenido: sem1.reduce((s, r) => s + r.total_iva_retenido, 0),
            rows: sem1.flatMap(r => r.rows),
            status: sem1.every(r => r.status === 'submitted') ? 'submitted' as const : sem1.some(r => r.status === 'generated') ? 'generated' as const : 'draft' as const,
          }] : []),
          ...(sem2.length > 0 ? [{
            ...sem2[0],
            id: `SEM2-${sem2[0].period.split('-')[0]}`,
            period: `${sem2[0].period.split('-')[0]}-S2`,
            total_providers: sem2.reduce((s, r) => s + r.total_providers, 0),
            total_base_16: sem2.reduce((s, r) => s + r.total_base_16, 0),
            total_iva_acred: sem2.reduce((s, r) => s + r.total_iva_acred, 0),
            total_iva_retenido: sem2.reduce((s, r) => s + r.total_iva_retenido, 0),
            rows: sem2.flatMap(r => r.rows),
            status: sem2.every(r => r.status === 'submitted') ? 'submitted' as const : sem2.some(r => r.status === 'generated') ? 'generated' as const : 'draft' as const,
          }] : []),
        ];
      })()
    : reports;

  const selectedRep = selectedReport ? filteredReports.find(r => r.id === selectedReport) || null : null;

  const formatPeriodLabel = (period: string) => {
    if (period.includes('S1')) return `1er Semestre ${period.split('-')[0]}`;
    if (period.includes('S2')) return `2do Semestre ${period.split('-')[0]}`;
    const [year, month] = period.split('-');
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
  };

  const statusBadge = (status: string) => {
    if (status === 'submitted') return <span className="text-[8px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={9}/> Presentada</span>;
    if (status === 'generated') return <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><FileText size={9}/> Generada</span>;
    return <span className="text-[8px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={9}/> Borrador</span>;
  };

  // ─── Detail View ───
  if (viewMode === 'detail' && selectedRep) {
    return (
      <div className="space-y-5">
        {/* Back + Title */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setViewMode('history'); setSelectedReport(null); }} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink/50 hover:text-brand-ink transition-all">
            <ChevronLeft size={14} /> Volver al historial
          </button>
          <div className="flex gap-2">
            {selectedRep.status === 'draft' && (
              <button onClick={() => handleGenerate(selectedRep.id)} disabled={acting === selectedRep.id} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50">
                {acting === selectedRep.id ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
                {acting === selectedRep.id ? 'Generando...' : 'Generar Layout'}
              </button>
            )}
            <button onClick={() => handleDownloadExcel(selectedRep)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all">
              <FileSpreadsheet size={12} /> Excel XLSX
            </button>
            <button onClick={() => handleDownloadTxt(selectedRep)} className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all">
              <Download size={12} /> TXT para SAT
            </button>
            {isRealId(selectedRep.id) && selectedRep.status !== 'submitted' && (
              <button onClick={() => handleSubmit(selectedRep.id)} disabled={acting === selectedRep.id} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
                {acting === selectedRep.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {acting === selectedRep.id ? 'Presentando...' : 'Presentar al SAT'}
              </button>
            )}
            {selectedRep.status === 'submitted' && (
              <span className="flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-[9px] font-bold uppercase tracking-widest"><CheckCircle2 size={12} /> Presentada</span>
            )}
          </div>
        </div>
        {genError && (
          <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {genError}</p>
        )}

        {/* Period Info Card */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50 text-center">
            <p className="text-xl font-bold font-serif text-purple-700">{formatPeriodLabel(selectedRep.period)}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-purple-500 mt-1">Periodo DIOT</p>
          </div>
          <div className="p-4 rounded-2xl border border-brand-sand/30 bg-white text-center">
            <p className="text-xl font-bold font-serif text-brand-ink">{selectedRep.rows.length}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/40 mt-1">Terceros Declarados</p>
          </div>
          <div className="p-4 rounded-2xl border border-brand-sand/30 bg-white text-center">
            <p className="text-lg font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(selectedRep.total_base_16)}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/40 mt-1">Base Gravable 16%</p>
          </div>
          <div className="p-4 rounded-2xl border border-brand-sand/30 bg-white text-center">
            <p className="text-lg font-bold font-serif text-red-600">{CURRENCY_FORMATTER.format(selectedRep.total_iva_retenido)}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/40 mt-1">IVA Retenido</p>
          </div>
        </div>

        {/* Data Preview Table */}
        <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
          <div className="px-5 py-3 bg-brand-sand/10 border-b border-brand-sand/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database size={14} className="text-purple-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">Vista Previa — Datos DIOT (Plantilla SAT 2025)</span>
            </div>
            <span className="text-[8px] text-brand-ink/40 font-mono">{selectedRep.rows.length} registros · 54 campos c/u</span>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
            <table className="w-full text-left text-[10px] min-w-[1400px]">
              <thead className="bg-white sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 sticky left-0 bg-white z-20">#</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 sticky left-[30px] bg-white z-20 min-w-[140px]">Proveedor / RFC</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-purple-600 border-b border-brand-sand/30">Tipo</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-purple-600 border-b border-brand-sand/30">Operación</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Valor 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Dev 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Acred 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Prop 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-red-500 border-b border-brand-sand/30 text-right">IVA Retenido</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Exento</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Tasa 0%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">No Objeto</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-green-600 border-b border-brand-sand/30 text-center">Manif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-sand/10">
                {selectedRep.rows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="px-3 py-2.5 text-brand-ink/30 font-mono sticky left-0 bg-white">{i + 1}</td>
                    <td className="px-3 py-2.5 sticky left-[30px] bg-white">
                      <p className="font-bold text-brand-ink text-[10px]">{row.provider_name}</p>
                      <p className="text-[8px] font-mono text-brand-ink/40">{row.rfc}</p>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[8px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{TERCERO_TYPES[row.tipo_tercero]}</span></td>
                    <td className="px-3 py-2.5 text-[9px] text-brand-ink/60">{OP_TYPES[row.tipo_operacion]}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">{row.valor_16 > 0 ? CURRENCY_FORMATTER.format(row.valor_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.dev_16 > 0 ? CURRENCY_FORMATTER.format(row.dev_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-600">{row.iva_acred_16 > 0 ? CURRENCY_FORMATTER.format(row.iva_acred_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.iva_acred_prop_16 > 0 ? CURRENCY_FORMATTER.format(row.iva_acred_prop_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-600 font-bold">{row.iva_retenido > 0 ? CURRENCY_FORMATTER.format(row.iva_retenido) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.valor_exento > 0 ? CURRENCY_FORMATTER.format(row.valor_exento) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.valor_tasa_0 > 0 ? CURRENCY_FORMATTER.format(row.valor_tasa_0) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.valor_no_objeto_nacional > 0 ? CURRENCY_FORMATTER.format(row.valor_no_objeto_nacional) : '-'}</td>
                    <td className="px-3 py-2.5 text-center"><span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${row.manifiesto === '01' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{row.manifiesto}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-brand-sand/10 border-t-2 border-brand-sand/40">
                <tr className="font-bold">
                  <td className="px-3 py-3 sticky left-0 bg-brand-sand/10" />
                  <td className="px-3 py-3 text-[9px] uppercase tracking-widest sticky left-[30px] bg-brand-sand/10">Totales</td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-right font-mono">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.valor_16, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.dev_16, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-blue-600">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.iva_acred_16, 0))}</td>
                  <td />
                  <td className="px-3 py-3 text-right font-mono text-red-600">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.iva_retenido, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.valor_exento, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.valor_tasa_0, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* TXT Preview */}
        <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
          <div className="px-5 py-3 bg-brand-ink border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={14} className="text-brand-gold" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-paper">Vista Previa TXT — Formato SAT (pipe-separated)</span>
            </div>
            <span className="text-[8px] text-brand-paper/50 font-mono">Codificación UTF-8 · Sin decimales</span>
          </div>
          <div className="bg-gray-900 p-4 overflow-x-auto" style={{ maxHeight: '200px' }}>
            <pre className="text-[9px] text-green-400 font-mono leading-relaxed whitespace-pre">
              {selectedRep.rows.slice(0, 5).map(row => diotRowToTxt(row)).join('\n')}
              {selectedRep.rows.length > 5 && `\n... (${selectedRep.rows.length - 5} registros más)`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ─── History View ───
  return (
    <div className="space-y-5">
      {/* ─── DIOT Deadline Alert ─── */}
      {!diotAlertDismissed && diotAlertLevel !== 'ok' && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${
            diotAlertLevel === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
          <div className="flex items-center gap-3">
            <Bell size={18} className={diotAlertLevel === 'critical' ? 'text-red-600 animate-bounce' : 'text-yellow-600'} />
            <div>
              <p className={`text-sm font-bold ${diotAlertLevel === 'critical' ? 'text-red-800' : 'text-yellow-800'}`}>
                DIOT próxima: {daysUntilDiot} días restantes
              </p>
              <p className={`text-[10px] ${diotAlertLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
                Fecha límite: {diotDeadline.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={() => setDiotAlertDismissed(true)} className="p-1 hover:bg-white/50 rounded-lg"><X size={14} /></button>
        </motion.div>
      )}

      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Database size={18} className="text-purple-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-brand-ink">Historial DIOT — Plantilla SAT 2025</h4>
            <p className="text-[9px] text-brand-ink/40 font-serif">Declaración Informativa de Operaciones con Terceros · {reports.length} periodos registrados</p>
          </div>
        </div>
        <div className="flex gap-1 bg-brand-sand/20 rounded-xl p-1">
          <button onClick={() => setPeriodFilter('monthly')} className={`px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${periodFilter === 'monthly' ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'}`}>
            Mensual
          </button>
          <button onClick={() => setPeriodFilter('semestral')} className={`px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${periodFilter === 'semestral' ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'}`}>
            Semestral
          </button>
        </div>
      </div>

      {/* Generar DIOT con datos REALES (mensual o semestral) — plantilla SAT */}
      <div className="editorial-card !p-4 border border-purple-200 bg-purple-50/40 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-purple-700">
            <FileSpreadsheet size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Generar DIOT {periodFilter === 'semestral' ? 'Semestral' : 'Mensual'} · datos reales
            </span>
          </div>
          {periodFilter === 'monthly' ? (
            <input
              type="month"
              value={genMonth}
              onChange={e => setGenMonth(e.target.value)}
              className="px-3 py-2 bg-white border border-purple-200 rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-purple-400"
            />
          ) : (
            <>
              <select
                value={genYear}
                onChange={e => setGenYear(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-purple-200 rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-purple-400"
              >
                {[0, 1, 2, 3].map(d => {
                  const y = nowRef.getFullYear() - d;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <select
                value={genSemester}
                onChange={e => setGenSemester(Number(e.target.value) as 1 | 2)}
                className="px-3 py-2 bg-white border border-purple-200 rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-purple-400"
              >
                <option value={1}>1er Semestre (Ene–Jun)</option>
                <option value={2}>2do Semestre (Jul–Dic)</option>
              </select>
            </>
          )}
          <button
            onClick={handleGenerateReal}
            disabled={generating}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50"
            title="Agrega las facturas del período por RFC y genera la DIOT"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
            {generating ? 'Generando...' : 'Generar DIOT'}
          </button>
        </div>
        {genMsg && (
          <p className="text-[10px] font-bold text-green-700 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> {genMsg}
          </p>
        )}
        {genError && (
          <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {genError}
          </p>
        )}
        <p className="text-[9px] text-brand-ink/40 font-serif">
          Se agregan las facturas aprobadas/pagadas del período por RFC del proveedor. Al generar se abre el detalle, donde puedes descargar el Excel/TXT con la plantilla SAT 2025 o presentar la declaración.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50 text-center">
          <p className="text-2xl font-bold font-serif text-purple-700">{filteredReports.length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-purple-500 mt-1">Periodos</p>
        </div>
        <div className="p-4 rounded-2xl border border-green-200 bg-green-50 text-center">
          <p className="text-2xl font-bold font-serif text-green-700">{filteredReports.filter(r => r.status === 'submitted').length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-green-500 mt-1">Presentadas</p>
        </div>
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50 text-center">
          <p className="text-2xl font-bold font-serif text-blue-700">{filteredReports.filter(r => r.status === 'generated').length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-blue-500 mt-1">Generadas</p>
        </div>
        <div className="p-4 rounded-2xl border border-yellow-200 bg-yellow-50 text-center">
          <p className="text-2xl font-bold font-serif text-yellow-700">{filteredReports.filter(r => r.status === 'draft').length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-yellow-500 mt-1">Borradores</p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50 shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-brand-sand/10">
            <tr>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30">Periodo</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30">Estado</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-center">Terceros</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Base 16%</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Acred.</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Ret.</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-center">Fecha Gen.</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-sand/10">
            {filteredReports.map(rep => (
              <tr key={rep.id} className="hover:bg-purple-50/30 transition-colors group">
                <td className="px-5 py-4">
                  <p className="font-bold text-brand-ink text-sm">{formatPeriodLabel(rep.period)}</p>
                  <p className="text-[8px] font-mono text-brand-ink/30 mt-0.5">{rep.id}</p>
                </td>
                <td className="px-5 py-4">{statusBadge(rep.status)}</td>
                <td className="px-5 py-4 text-center font-mono text-sm text-brand-ink">{rep.total_providers}</td>
                <td className="px-5 py-4 text-right font-serif font-bold text-brand-ink">{CURRENCY_FORMATTER.format(rep.total_base_16)}</td>
                <td className="px-5 py-4 text-right font-mono text-blue-600 text-sm">{CURRENCY_FORMATTER.format(rep.total_iva_acred)}</td>
                <td className="px-5 py-4 text-right font-mono text-red-600 text-sm">{CURRENCY_FORMATTER.format(rep.total_iva_retenido)}</td>
                <td className="px-5 py-4 text-center text-[10px] text-brand-ink/40">{rep.generated_date || '—'}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-1.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setSelectedReport(rep.id); setViewMode('detail'); }} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all">
                      Ver
                    </button>
                    {rep.status !== 'draft' && (
                      <>
                        <button onClick={() => handleDownloadTxt(rep)} className="px-3 py-1.5 bg-brand-ink text-brand-paper rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all" title="Descargar TXT para SAT">
                          TXT
                        </button>
                        <button onClick={() => handleDownloadExcel(rep)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all" title="Descargar Excel XLSX">
                          XLSX
                        </button>
                      </>
                    )}
                    {rep.status === 'draft' && (
                      <button onClick={() => handleGenerate(rep.id)} disabled={acting === rep.id} className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-yellow-600 transition-all disabled:opacity-50">
                        {acting === rep.id ? '...' : 'Generar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Instructions Card */}
      <div className="editorial-card !p-5 border border-brand-sand/30 bg-white/80">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <HelpCircle size={16} className="text-brand-gold" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-brand-ink mb-2">Instrucciones para carga al portal SAT</h5>
            <ol className="text-[10px] text-brand-ink/60 space-y-1 list-decimal pl-4 font-serif">
              <li>Genera el layout de cada periodo pendiente con el botón "Generar"</li>
              <li>Descarga el archivo <strong>TXT</strong> (formato pipe-separated, codificación UTF-8)</li>
              <li>Ingresa al portal del SAT → DIOT en línea</li>
              <li>Selecciona "Agregar desde Archivo" y sube el archivo .txt</li>
              <li>El archivo no permite decimales, puntos ni comas — Royáltica los formatea automáticamente</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
