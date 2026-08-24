/**
 * Renderizado de plantillas de mensaje de cobranza (placeholders simples,
 * sin motor de templates). Extraído de CollectionSequencesService para
 * poder reutilizarse también en scripts de simulación/QA sin duplicar la
 * lógica de reemplazo.
 */
export interface MessageTemplateContext {
  customerName: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
}

export function renderMessageTemplate(
  template: string,
  ctx: MessageTemplateContext,
): string {
  return template
    .replace(/\{\{\s*customerName\s*\}\}/g, ctx.customerName)
    .replace(/\{\{\s*amount\s*\}\}/g, ctx.amount)
    .replace(/\{\{\s*dueDate\s*\}\}/g, ctx.dueDate)
    .replace(/\{\{\s*daysOverdue\s*\}\}/g, String(ctx.daysOverdue));
}
