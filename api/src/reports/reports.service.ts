import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
} from '../organization/organization.constants';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

export interface CollectionReportRange {
  from: Date;
  to: Date;
}

const AGING_ROWS: { key: keyof AgingBuckets; label: string }[] = [
  { key: 'current', label: 'Vigente' },
  { key: 'd1_30', label: '1-30 días' },
  { key: 'd31_60', label: '31-60 días' },
  { key: 'd61_90', label: '61-90 días' },
  { key: 'd90_plus', label: '90+ días' },
];

interface AgingBuckets {
  current: { amount: number; count: number };
  d1_30: { amount: number; count: number };
  d31_60: { amount: number; count: number };
  d61_90: { amount: number; count: number };
  d90_plus: { amount: number; count: number };
}

const TOP_AT_RISK = 10;

/**
 * Genera reportes de cobranza en PDF para envío periódico (semanal/etc.) a
 * la dirección financiera del tenant — pedido explícito de Tradespace.
 *
 * Usa pdfkit (JS puro, sin Chromium/Puppeteer) para no inflar la imagen
 * Docker del backend; ver api/Dockerfile, que no trae dependencias de
 * navegador headless.
 *
 * Reutiliza los cálculos ya existentes en DashboardService (digest, aging,
 * clientes en riesgo) en vez de reimplementar consultas — un solo lugar de
 * verdad para las cifras que también se ven en el dashboard.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  /**
   * Arma el PDF de cobranza de una organización para el período indicado.
   * Devuelve el buffer completo (no hace streaming a disco/HTTP): se usa
   * tanto para adjuntar por correo como para pruebas.
   */
  async generateCollectionReportPdf(
    organizationId: string,
    range: CollectionReportRange,
  ): Promise<Buffer> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, locale: true, currency: true },
    });
    const locale = org?.locale ?? DEFAULT_LOCALE;
    const currency = org?.currency ?? DEFAULT_CURRENCY;
    const orgName = org?.name ?? 'Organización';

    const asUser = { organizationId } as AuthenticatedUser;
    const [digest, aging, atRisk] = await Promise.all([
      this.dashboard.getReceivablesDigest(asUser, {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
      this.dashboard.getReceivablesAging(asUser),
      this.dashboard.getAtRiskCustomers(asUser),
    ]);

    const money = (n: number) =>
      n.toLocaleString(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      });
    const dateFmt = (d: Date) =>
      d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

    return this.renderPdf({
      orgName,
      periodFrom: range.from,
      periodTo: range.to,
      digest,
      aging,
      atRisk: atRisk.customers.slice(0, TOP_AT_RISK),
      money,
      dateFmt,
    });
  }

  /**
   * Registra en bitácora que se generó (y opcionalmente envió) un reporte.
   * No persiste el PDF en sí (se genera al vuelo cada vez); solo deja
   * rastro de auditoría de qué se generó y para qué período.
   */
  async recordReportSent(
    organizationId: string,
    range: CollectionReportRange,
    recipientCount: number,
  ): Promise<void> {
    try {
      await this.prisma.collectionReport.create({
        data: {
          organizationId,
          periodFrom: range.from,
          periodTo: range.to,
          emailSent: recipientCount > 0,
          recipientCount,
        },
      });
    } catch (err) {
      // No queremos que un fallo de bitácora tumbe el envío del reporte.
      this.logger.warn(
        `No se pudo registrar CollectionReport para org ${organizationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── render ────────────────────────────────────────────────

  private renderPdf(input: {
    orgName: string;
    periodFrom: Date;
    periodTo: Date;
    digest: Awaited<ReturnType<DashboardService['getReceivablesDigest']>>;
    aging: Awaited<ReturnType<DashboardService['getReceivablesAging']>>;
    atRisk: Awaited<ReturnType<DashboardService['getAtRiskCustomers']>>['customers'];
    money: (n: number) => string;
    dateFmt: (d: Date) => string;
  }): Promise<Buffer> {
    const { orgName, periodFrom, periodTo, digest, aging, atRisk, money, dateFmt } =
      input;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── encabezado ──
      doc
        .fontSize(18)
        .fillColor('#101828')
        .text('Reporte de cobranza', { continued: false });
      doc
        .fontSize(12)
        .fillColor('#475467')
        .text(orgName)
        .text(`Período: ${dateFmt(periodFrom)} — ${dateFmt(periodTo)}`);
      doc.moveDown(1);
      doc
        .strokeColor('#EAECF0')
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(1);

      // ── KPIs ──
      doc.fontSize(13).fillColor('#101828').text('Resumen', { underline: false });
      doc.moveDown(0.3);
      doc.fontSize(10.5).fillColor('#344054');
      doc.text(
        `Cobrado en el período: ${money(digest.collected.amount)} (${digest.collected.count} factura${digest.collected.count === 1 ? '' : 's'})`,
      );
      doc.text(
        `Pendiente por cobrar: ${money(digest.outstanding.amount)} (${digest.outstanding.count} factura${digest.outstanding.count === 1 ? '' : 's'})`,
      );
      doc.text(
        `Recordatorios enviados: ${digest.reminders.total} (${digest.reminders.whatsapp} WhatsApp, ${digest.reminders.email} correo)`,
      );
      doc.moveDown(1);

      // ── antigüedad de saldos ──
      doc.fontSize(13).fillColor('#101828').text('Antigüedad de saldos');
      doc.moveDown(0.3);
      this.drawTable(
        doc,
        ['Rango', 'Facturas', 'Monto'],
        AGING_ROWS.map(({ key, label }) => [
          label,
          String(aging.buckets[key].count),
          money(aging.buckets[key].amount),
        ]),
        [220, 100, 150],
      );
      doc.moveDown(1);

      // ── clientes en riesgo ──
      doc.fontSize(13).fillColor('#101828').text('Clientes en riesgo (top)');
      doc.moveDown(0.3);
      if (atRisk.length === 0) {
        doc.fontSize(10.5).fillColor('#475467').text('Sin clientes en riesgo en este período.');
      } else {
        this.drawTable(
          doc,
          ['Cliente', 'Vencido', 'Días máx.', 'Motivo'],
          atRisk.map((c) => [
            c.name,
            money(c.overdueAmount),
            String(c.maxDaysOverdue),
            c.reason,
          ]),
          [150, 100, 70, 150],
        );
      }

      // ── pie ──
      doc
        .fontSize(8.5)
        .fillColor('#98A2B3')
        .text(
          `Generado automáticamente por Royáltica el ${dateFmt(new Date())}.`,
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom - 20,
          { align: 'left' },
        );

      doc.end();
    });
  }

  /** Tabla simple: encabezado + filas, columnas de ancho fijo. */
  private drawTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    colWidths: number[],
  ): void {
    const startX = doc.page.margins.left;
    let y = doc.y;
    const rowHeight = 18;

    doc.fontSize(9.5).fillColor('#667085');
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: colWidths[i], continued: false });
      x += colWidths[i];
    });
    y += rowHeight;
    doc
      .strokeColor('#EAECF0')
      .moveTo(startX, y - 4)
      .lineTo(x, y - 4)
      .stroke();

    doc.fontSize(9.5).fillColor('#344054');
    for (const row of rows) {
      // Salto de página si no cabe la siguiente fila.
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      x = startX;
      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += rowHeight;
    }
    doc.y = y;
  }
}
