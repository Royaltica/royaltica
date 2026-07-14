/**
 * Catálogo de eventos que Royáltica puede emitir hacia webhooks salientes.
 * Un endpoint puede suscribirse a un subconjunto o a todos (events: []).
 */
export const WEBHOOK_EVENTS = {
  INVOICE_APPROVED: 'invoice.approved',
  INVOICE_REJECTED: 'invoice.rejected',
  INVOICE_BLOCKED: 'invoice.blocked',
  PAYMENT_COMPLETED: 'payment.completed',
  FACTORAJE_DISBURSED: 'factoraje.disbursed',
  SUPPLIER_APPROVED: 'supplier.approved',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = Object.values(WEBHOOK_EVENTS);
