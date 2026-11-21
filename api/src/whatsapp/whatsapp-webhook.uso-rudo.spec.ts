import { Prisma } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { WhatsappService } from './whatsapp.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { EmailService } from '../email/email.service';
import type { Env } from '../config/env.validation';
import { statusUpdate, textMessage, buttonReply } from './testing/meta-webhook-payloads';

/**
 * Pruebas de uso rudo del webhook (C4), sin red ni base: una base en memoria
 * que respeta la unicidad de waMessageId igual que Postgres (error P2002).
 */
type Row = Record<string, unknown> & { id: string };

function unique(code = 'P2002') {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code, clientVersion: 'test' });
}

function memoria(customers: { id: string; organizationId: string; name: string; phone: string }[]) {
  const mensajes: Row[] = [];
  const sinDueno: Row[] = [];
  const bitacora: Row[] = [];
  const clientes = customers.map((c) => ({ ...c, financeContactPhone: null, deletedAt: null, doNotContact: false } as Row));
  let seq = 0;
  const id = () => `id-${++seq}`;
  const tick = () => new Promise((r) => setImmediate(r)); // simula la latencia de la base

  const prisma = {
    customer: {
      findMany: jest.fn(async () => { await tick(); return clientes.map((c) => ({ ...c })); }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const c = clientes.find((x) => x.id === where.id)!;
        Object.assign(c, data);
        return c;
      }),
    },
    invoice: {
      findFirst: jest.fn(async ({ where }: { where: { customerId?: string } }) => ({
        id: `inv-${where.customerId}`, folio: `F-${where.customerId}`, cfdiUuid: '00000000', total: new Prisma.Decimal(1000),
      })),
      update: jest.fn(async () => ({})),
      findMany: jest.fn(async ({ where }: { where: { customerId?: string } }) => [{ id: `inv-${where.customerId}` }, { id: `inv2-${where.customerId}` }]),
    },
    collectionSequenceRun: {
      updateMany: jest.fn(async ({ where }: { where: { invoiceId: { in: string[] } } }) => ({ count: where.invoiceId.in.length })),
    },
    invoiceAuditLog: { create: jest.fn(async ({ data }: { data: Row }) => { bitacora.push({ ...data, id: id() }); return {}; }) },
    whatsappMessage: {
      findFirst: jest.fn(async ({ where }: { where: { waMessageId?: string; direction?: string } }) => {
        const m = mensajes.find((x) => x.waMessageId === where.waMessageId && x.direction === where.direction);
        if (!m) return null;
        const customer = clientes.find((c) => c.id === m.customerId)!;
        return { invoiceId: m.invoiceId, customer };
      }),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async ({ where }: { where: { waMessageId: string } }) => mensajes.find((x) => x.waMessageId === where.waMessageId) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(mensajes.find((x) => x.id === where.id)!, data)),
      create: jest.fn(async ({ data }: { data: Row }) => {
        await tick();
        if (data.waMessageId && mensajes.some((x) => x.waMessageId === data.waMessageId)) throw unique();
        const row = { ...data, id: id() } as Row;
        mensajes.push(row);
        return { id: row.id };
      }),
    },
    whatsappInboundUnmatched: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        await tick();
        if (data.waMessageId && sinDueno.some((x) => x.waMessageId === data.waMessageId)) throw unique();
        sinDueno.push({ ...data, id: id() });
        return {};
      }),
    },
  };
  return { prisma, mensajes, sinDueno, bitacora, clientes };
}

function servicio(db: ReturnType<typeof memoria>) {
  const config = { get: () => '' } as unknown as ConfigService<Env, true>;
  const notifications = { notifyOrgAdmins: jest.fn().mockResolvedValue(1) };
  const whatsapp = { notifyOrgAdmins: jest.fn().mockResolvedValue({ recipients: 1, sent: 0 }) };
  const conversations = new WhatsappConversationService(db.prisma as unknown as PrismaService, {} as never, {} as never, {} as never, config);
  const svc = new WhatsappWebhookService(
    config,
    db.prisma as unknown as PrismaService,
    whatsapp as unknown as WhatsappService,
    notifications as unknown as NotificationsService,
    {} as EmailService,
    conversations,
  );
  return { svc, notifications };
}

const ctx = { phoneNumberId: 'PN-1' };
const tel = (i: number) => `52155${String(10_000_000 + i).slice(-8)}`;

describe('Webhook de WhatsApp: uso rudo (C4)', () => {
  it('ráfaga de 200 mensajes con cada uno reintentado por Meta: ninguno se registra ni avisa dos veces', async () => {
    const clientes = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, organizationId: i % 2 ? 'org-a' : 'org-b', name: `Cliente ${i}`, phone: tel(i) }));
    const db = memoria(clientes);
    const { svc, notifications } = servicio(db);
    const cuerpos = Array.from({ length: 200 }, (_, i) =>
      textMessage(ctx, tel(i % 40), `wamid.RAFAGA.${i}`, i % 10 === 0 ? 'ya pagué' : `Mensaje ${i}`),
    );

    // Cada payload llega dos veces y todo en paralelo, como un reintento de Meta.
    await Promise.all([...cuerpos, ...cuerpos].map((c) => svc.handleIncoming(c)));

    const entrantes = db.mensajes.filter((m) => m.direction === 'INBOUND');
    expect(entrantes).toHaveLength(200);
    expect(new Set(entrantes.map((m) => m.waMessageId)).size).toBe(200);
    expect(db.bitacora).toHaveLength(200);
    // 20 de los 200 dicen "ya pagué": exactamente 20 avisos de pago y 180 de respuesta.
    const tipos = notifications.notifyOrgAdmins.mock.calls.map(([, n]) => n.type);
    expect(tipos.filter((t) => t === 'RECEIVABLE_PAYMENT_CLAIMED')).toHaveLength(20);
    expect(tipos.filter((t) => t === 'RECEIVABLE_CUSTOMER_REPLY')).toHaveLength(180);
    expect(db.sinDueno).toHaveLength(0);
  });

  it('el mismo wamid 5 veces queda registrado una sola vez', async () => {
    const db = memoria([{ id: 'c1', organizationId: 'org-a', name: 'Uno', phone: tel(1) }]);
    const { svc } = servicio(db);
    const cuerpo = textMessage(ctx, tel(1), 'wamid.REPETIDO', 'Hola');
    for (let i = 0; i < 5; i += 1) await svc.handleIncoming(cuerpo);
    expect(db.mensajes).toHaveLength(1);
    expect(db.bitacora).toHaveLength(1);
  });

  it('dos organizaciones con el mismo teléfono: va a la bandeja sin dueño, una sola vez y sin tocar a ninguna', async () => {
    const db = memoria([
      { id: 'a1', organizationId: 'org-a', name: 'Cliente A', phone: '+52 1 55 1234 5678' },
      { id: 'b1', organizationId: 'org-b', name: 'Cliente B', phone: '5512345678' },
    ]);
    const { svc, notifications } = servicio(db);
    const cuerpo = textMessage(ctx, '5215512345678', 'wamid.AMBIGUO', 'ya pagué');
    await svc.handleIncoming(cuerpo);
    await svc.handleIncoming(cuerpo);

    expect(db.sinDueno).toHaveLength(1);
    expect(db.sinDueno[0]).toMatchObject({ organizationId: null, fromPhone: '5215512345678' });
    expect(db.mensajes).toHaveLength(0);
    expect(db.bitacora).toHaveLength(0);
    expect(db.clientes.every((c) => !c.paymentClaimedAt && !c.doNotContact)).toBe(true);
    expect(notifications.notifyOrgAdmins).not.toHaveBeenCalledWith('org-a', expect.anything());
    expect(notifications.notifyOrgAdmins).not.toHaveBeenCalledWith('org-b', expect.anything());
  });

  it('respuesta a un mensaje nuestro (context.id) se atribuye a ese cliente aunque el teléfono esté en dos organizaciones', async () => {
    const db = memoria([
      { id: 'a1', organizationId: 'org-a', name: 'Cliente A', phone: '5512345678' },
      { id: 'b1', organizationId: 'org-b', name: 'Cliente B', phone: '5512345678' },
    ]);
    db.mensajes.push({ id: 'out-1', waMessageId: 'wamid.SALIENTE', direction: 'OUTBOUND', customerId: 'b1', invoiceId: 'inv-b1' });
    const { svc } = servicio(db);
    await svc.handleIncoming(buttonReply(ctx, '5215512345678', 'wamid.RESP', 'Ya pagué, comparto comprobante', 'wamid.SALIENTE'));
    const entrante = db.mensajes.find((m) => m.waMessageId === 'wamid.RESP');
    expect(entrante).toMatchObject({ organizationId: 'org-b', customerId: 'b1' });
    expect(db.sinDueno).toHaveLength(0);
  });

  it('estados de entrega desordenados y repetidos nunca retroceden', async () => {
    const db = memoria([{ id: 'c1', organizationId: 'org-a', name: 'Uno', phone: tel(1) }]);
    db.mensajes.push({ id: 'out-1', waMessageId: 'wamid.OUT', direction: 'OUTBOUND', customerId: 'c1', deliveryStatus: null });
    const { svc } = servicio(db);
    for (const estado of ['read', 'sent', 'delivered', 'read', 'sent'] as const) {
      await svc.handleIncoming(statusUpdate(ctx, 'wamid.OUT', estado, tel(1)));
    }
    expect(db.mensajes[0].deliveryStatus).toBe('read');
  });

  it('BAJA repetida apaga al cliente una vez y no vuelve a avisar', async () => {
    const db = memoria([{ id: 'c1', organizationId: 'org-a', name: 'Uno', phone: tel(1) }]);
    const { svc, notifications } = servicio(db);
    const cuerpo = textMessage(ctx, tel(1), 'wamid.BAJA', 'BAJA');
    await Promise.all([svc.handleIncoming(cuerpo), svc.handleIncoming(cuerpo), svc.handleIncoming(cuerpo)]);
    expect(db.clientes[0].doNotContact).toBe(true);
    const avisos = notifications.notifyOrgAdmins.mock.calls.filter(([, n]) => n.type === 'CUSTOMER_OPT_OUT');
    expect(avisos).toHaveLength(1);
  });

  it('número equivocado: deja de escribirle a ese contacto y avisa, sin tratarlo como pago', async () => {
    const db = memoria([{ id: 'c1', organizationId: 'org-a', name: 'Uno', phone: tel(1) }]);
    const { svc, notifications } = servicio(db);
    await svc.handleIncoming(textMessage(ctx, tel(1), 'wamid.EQUIV', 'Número equivocado, aquí no es esa empresa'));
    expect(db.clientes[0]).toMatchObject({ doNotContact: true });
    expect(String(db.clientes[0].doNotContactReason)).toContain('no es el contacto correcto');
    const tipos = notifications.notifyOrgAdmins.mock.calls.map(([, n]) => n.type);
    expect(tipos).toEqual(['CUSTOMER_WRONG_CONTACT']);
  });

  it('disputa: pausa la cobranza automática de sus facturas y avisa', async () => {
    const db = memoria([{ id: 'c1', organizationId: 'org-a', name: 'Uno', phone: tel(1) }]);
    const { svc, notifications } = servicio(db);
    await svc.handleIncoming(textMessage(ctx, tel(1), 'wamid.DISP', 'No reconozco esa factura'));
    expect(db.prisma.collectionSequenceRun.updateMany).toHaveBeenCalledWith({
      where: { invoiceId: { in: ['inv-c1', 'inv2-c1'] }, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    });
    const aviso = notifications.notifyOrgAdmins.mock.calls.find(([, n]) => n.type === 'RECEIVABLE_CUSTOMER_DISPUTE');
    expect(aviso?.[1].body).toContain('Se pausó la cobranza automática');
    expect(db.clientes[0].doNotContact).toBe(false);
  });

  it('disputa respondiendo a un mensaje: pausa solo esa factura', async () => {
    const db = memoria([{ id: 'c1', organizationId: 'org-a', name: 'Uno', phone: tel(1) }]);
    db.mensajes.push({ id: 'out-1', waMessageId: 'wamid.OUT', direction: 'OUTBOUND', customerId: 'c1', invoiceId: 'inv-c1' });
    const { svc } = servicio(db);
    await svc.handleIncoming(textMessage(ctx, tel(1), 'wamid.DISP2', 'Esa ya la cancelamos', 'wamid.OUT'));
    expect(db.prisma.collectionSequenceRun.updateMany).toHaveBeenCalledWith({
      where: { invoiceId: { in: ['inv-c1'] }, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    });
  });
});
