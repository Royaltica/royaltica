import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../common/prisma/prisma.service';
import { LEVEL_PLAN_STEPS } from '../collection-sequences/collection-sequences.service';
import { PILOT_NAME, PILOT_ORGANIZATION_ID, PILOT_RFC, resetPilot, seedPilot } from './pilot-seed';

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;
const NOW = new Date('2026-11-18T16:00:00Z');

/** BD en memoria: respeta filtros y unicidad, revierte fallos y simula las FK en cascada. */
function database() {
  const names = [
    'organization', 'user', 'customer', 'invoice', 'collectionPolicy',
    'collectionSequenceStep', 'bankStatementImport', 'bankTransaction',
    'aiFeedback', 'collectionReport',
  ] as const;
  const rows = Object.fromEntries(names.map((name) => [name, new Map<string, Row>()])) as
    Record<typeof names[number], Map<string, Row>>;
  const matches = (row: Row, where: Where): boolean => Object.entries(where).every(([key, value]) => {
    if (key === 'collectionPolicy') {
      const policy = rows.collectionPolicy.get(row.collectionPolicyId as string);
      return !!policy && matches(policy, value as Where);
    }
    return row[key] === value;
  });
  const tx = Object.fromEntries(names.map((name) => [name, {
    upsert: jest.fn(async ({ where, create, update }: { where: Where; create: Row; update: Where }) => {
      const existing = [...rows[name].values()].find((row) => matches(row, where));
      if (existing) {
        const updated = { ...existing, ...update };
        rows[name].set(existing.id, updated);
        return updated;
      }
      const uniqueFields = name === 'organization' ? ['id', 'rfc'] : name === 'user' ? ['id', 'email', 'firebaseUid'] : ['id'];
      if ([...rows[name].values()].some((row) => uniqueFields.some((field) => row[field] === create[field]))) {
        throw new Error('Registro único en conflicto');
      }
      rows[name].set(create.id, create);
      return create;
    }),
    findUnique: jest.fn(async ({ where }: { where: Where }) =>
      [...rows[name].values()].find((row) => matches(row, where)) ?? null),
    deleteMany: jest.fn(async ({ where }: { where: Where }) => {
      for (const row of rows[name].values()) {
        if (matches(row, where)) rows[name].delete(row.id);
      }
    }),
    delete: jest.fn(async ({ where }: { where: Where }) => {
      const row = [...rows[name].values()].find((item) => matches(item, where));
      if (!row) throw new Error('Registro inexistente');
      if (name === 'organization') {
        const policyIds = [...rows.collectionPolicy.values()]
          .filter((policy) => policy.organizationId === row.id).map((policy) => policy.id);
        for (const childName of names.filter((child) => !['organization', 'aiFeedback', 'collectionReport'].includes(child))) {
          for (const child of rows[childName].values()) {
            if (child.organizationId === row.id || policyIds.includes(child.collectionPolicyId as string)) {
              rows[childName].delete(child.id);
            }
          }
        }
      }
      rows[name].delete(row.id);
      return row;
    }),
  }]));
  const withOrg = jest.fn(async <T>(orgId: string, fn: (client: Prisma.TransactionClient) => Promise<T>) => {
    expect(orgId).toBe(PILOT_ORGANIZATION_ID);
    const snapshot = Object.fromEntries(names.map((name) => [name, new Map(rows[name])])) as typeof rows;
    try {
      return await fn(tx as unknown as Prisma.TransactionClient);
    } catch (error) {
      for (const name of names) rows[name] = snapshot[name];
      throw error;
    }
  });
  return { rows, tx, withOrg, prisma: { withOrg } as unknown as PrismaService };
}

describe('Semilla del piloto', () => {
  const envKeys = ['NODE_ENV', 'DATABASE_URL', 'PILOT_SEED_ALLOW_HOST'] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://localhost/piloto';
    delete process.env.PILOT_SEED_ALLOW_HOST;
  });
  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('crea cartera, equipo, niveles y estado de cuenta sin duplicarlos al repetir', async () => {
    const db = database();
    await seedPilot(db.prisma, NOW);
    const firstInvoices = [...db.rows.invoice.values()];
    await seedPilot(db.prisma, new Date('2026-11-19T16:00:00Z'));

    expect([...db.rows.organization.values()]).toEqual([
      expect.objectContaining({ name: PILOT_NAME, rfc: PILOT_RFC, settings: { product: 'CXC', multiUserEnabled: true } }),
    ]);
    expect(db.rows.user.size).toBe(3);
    expect([...db.rows.user.values()].map((u) => [u.role, u.operationalProfile])).toEqual([
      ['CORPORATE_ADMIN', 'ADMINISTRADOR_DATA'],
      ['CORPORATE_USER', 'SUPERVISOR_GERENTE'],
      ['CORPORATE_USER', 'AGENTE_EJECUTIVO'],
    ]);
    for (const user of db.rows.user.values()) {
      expect(user.email).toMatch(/@piloto\.invalid$/);
      expect(user.firebaseUid).toMatch(/^piloto-demo-/);
    }
    expect(db.rows.customer.size).toBe(10);
    const agent = [...db.rows.user.values()].find((u) => u.operationalProfile === 'AGENTE_EJECUTIVO')!;
    for (const customer of db.rows.customer.values()) {
      expect(customer.phone).toMatch(/^\+5200\d{8}$/);
      expect(customer.financeContactPhone).toBe(customer.phone);
      expect(customer.assignedAgentId).toBe(agent.id);
    }
    expect(db.rows.invoice.size).toBe(25);
    expect([...db.rows.invoice.values()]).toEqual(firstInvoices);
    const dates = firstInvoices.map((invoice) => (invoice.dueDate as Date).getTime());
    expect(Math.min(...dates)).toBeLessThan(NOW.getTime());
    expect(Math.max(...dates)).toBeGreaterThan(NOW.getTime());
    for (const invoice of firstInvoices) {
      expect(invoice).toMatchObject({ organizationId: PILOT_ORGANIZATION_ID, direction: 'RECEIVABLE', status: 'PENDING' });
      expect(db.rows.customer.has(invoice.customerId as string)).toBe(true);
    }
    expect(db.rows.collectionPolicy.size).toBe(1);
    expect([...db.rows.collectionPolicy.values()][0]).toMatchObject({ shadowMode: true, autoSend: false });
    expect([...db.rows.collectionSequenceStep.values()]).toEqual(LEVEL_PLAN_STEPS.map((step, i) =>
      expect.objectContaining({ ...step, stepOrder: i + 1 })));
    expect(db.rows.bankStatementImport.size).toBe(1);
    expect([...db.rows.bankStatementImport.values()][0]).toMatchObject({ totalTransactions: 4, unmatchedCount: 4 });
    expect([...db.rows.bankTransaction.values()].map((row) => row.isDebit)).toEqual([false, false, true, true]);
    expect(db.withOrg).toHaveBeenCalledTimes(2);
    for (const [name, delegate] of Object.entries(db.tx)) {
      for (const [args] of delegate.upsert.mock.calls) {
        if (name === 'organization') expect(args.where).toMatchObject({ id: PILOT_ORGANIZATION_ID, rfc: PILOT_RFC });
        else if (name === 'collectionSequenceStep') expect(args.where).toMatchObject({ collectionPolicy: { organizationId: PILOT_ORGANIZATION_ID } });
        else expect(args.where).toMatchObject({ organizationId: PILOT_ORGANIZATION_ID });
      }
    }
  });

  it('restaura modo sombra y desactiva el envío automático al repetir la semilla', async () => {
    const db = database();
    await seedPilot(db.prisma, NOW);
    const policy = [...db.rows.collectionPolicy.values()][0];
    db.rows.collectionPolicy.set(policy.id, { ...policy, shadowMode: false, autoSend: true });
    await seedPilot(db.prisma, NOW);
    expect(db.rows.collectionPolicy.get(policy.id)).toMatchObject({ shadowMode: true, autoSend: false });
  });

  it('no toma usuarios ajenos y revierte la semilla si un correo ya está ocupado', async () => {
    const db = database();
    const existing = { id: 'otra-persona', organizationId: 'otra-org', email: 'admin@piloto.invalid', firebaseUid: 'otra-persona' };
    db.rows.user.set(existing.id, existing);
    await expect(seedPilot(db.prisma, NOW)).rejects.toThrow('conflicto');
    expect([...db.rows.user.values()]).toEqual([existing]);
    expect(db.rows.organization.size).toBe(0);
  });

  it('no toma una organización ajena que ya tiene el RFC reservado', async () => {
    const db = database();
    const existing = { id: 'ajena', name: PILOT_NAME, rfc: PILOT_RFC };
    db.rows.organization.set(existing.id, existing);
    await expect(seedPilot(db.prisma, NOW)).rejects.toThrow('conflicto');
    expect([...db.rows.organization.values()]).toEqual([existing]);
    expect(db.rows.user.size).toBe(0);
  });

  it('reinicia solo el RFC reservado y conserva otra organización con el mismo nombre', async () => {
    const db = database();
    await seedPilot(db.prisma, NOW);
    for (const [name, rows] of Object.entries(db.rows)) {
      const row = { id: `otra-${name}`, organizationId: 'otra-org', name: PILOT_NAME, rfc: 'OTRA00000000' };
      rows.set(row.id, row);
    }
    db.rows.aiFeedback.set('piloto-feedback', { id: 'piloto-feedback', organizationId: PILOT_ORGANIZATION_ID });
    db.rows.collectionReport.set('piloto-reporte', { id: 'piloto-reporte', organizationId: PILOT_ORGANIZATION_ID });

    await expect(resetPilot(db.prisma)).resolves.toBe(true);
    for (const [name, rows] of Object.entries(db.rows)) {
      expect([...rows.keys()]).toEqual([`otra-${name}`]);
    }
    expect(db.tx.organization.findUnique).toHaveBeenCalledWith({ where: { rfc: PILOT_RFC } });
    expect(db.tx.organization.delete).toHaveBeenCalledWith({ where: { id: PILOT_ORGANIZATION_ID, rfc: PILOT_RFC } });
    expect(db.tx.aiFeedback.deleteMany).toHaveBeenCalledWith({ where: { organizationId: PILOT_ORGANIZATION_ID } });
    expect(db.tx.collectionReport.deleteMany).toHaveBeenCalledWith({ where: { organizationId: PILOT_ORGANIZATION_ID } });
    await expect(resetPilot(db.prisma)).resolves.toBe(false);
    await seedPilot(db.prisma, NOW);
    expect(db.rows.invoice.size).toBe(26);
  });

  it.each([
    { id: 'ajena', name: PILOT_NAME },
    { id: PILOT_ORGANIZATION_ID, name: 'Otra organización' },
  ])('rechaza borrar si el RFC reservado tiene otra identidad (%s)', async (identity) => {
    const db = database();
    db.rows.organization.set(identity.id, { ...identity, rfc: PILOT_RFC });
    await expect(resetPilot(db.prisma)).rejects.toThrow('otra organización');
    expect(db.tx.organization.delete).not.toHaveBeenCalled();
    expect(db.tx.aiFeedback.deleteMany).not.toHaveBeenCalled();
    expect(db.rows.organization.size).toBe(1);
  });

  it('revierte el reinicio completo si falla el borrado de la organización', async () => {
    const db = database();
    await seedPilot(db.prisma, NOW);
    db.rows.aiFeedback.set('piloto-feedback', { id: 'piloto-feedback', organizationId: PILOT_ORGANIZATION_ID });
    db.tx.organization.delete.mockRejectedValueOnce(new Error('Fallo de borrado'));
    await expect(resetPilot(db.prisma)).rejects.toThrow('Fallo de borrado');
    expect(db.rows.aiFeedback.has('piloto-feedback')).toBe(true);
    expect(db.rows.invoice.size).toBe(25);
  });

  it.each([seedPilot, resetPilot])('bloquea la operación en producción antes de consultar datos', async (operation) => {
    const db = database();
    process.env.NODE_ENV = 'production';
    await expect(operation(db.prisma)).rejects.toThrow('producción');
    expect(db.withOrg).not.toHaveBeenCalled();
  });

  describe.each([
    ['semilla', seedPilot],
    ['reinicio', resetPilot],
  ] as const)('Protección del destino: %s', (_name, operation) => {
    it.each(['localhost', '127.0.0.1', '[::1]'])('permite el host local %s', async (host) => {
      const db = database();
      process.env.DATABASE_URL = `postgresql://${host}:5432/piloto`;
      await operation(db.prisma);
      expect(db.withOrg).toHaveBeenCalledTimes(1);
    });

    it.each([undefined, 'development', 'test'])('bloquea hosts remotos incluso con NODE_ENV=%s, sin exponer credenciales', async (nodeEnv) => {
      const db = database();
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
      const databaseUrl = new URL('postgresql://db.staging.invalid:5432/piloto');
      databaseUrl.username = randomUUID();
      databaseUrl.password = randomUUID();
      process.env.DATABASE_URL = databaseUrl.href;
      let message = '';
      try {
        await operation(db.prisma);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain('Host bloqueado para el piloto: db.staging.invalid.');
      expect(message).not.toContain(databaseUrl.href);
      expect(message).not.toContain(databaseUrl.username);
      expect(message).not.toContain(databaseUrl.password);
      expect(db.withOrg).not.toHaveBeenCalled();
    });

    it('permite el host remoto cuando PILOT_SEED_ALLOW_HOST coincide exactamente', async () => {
      const db = database();
      process.env.DATABASE_URL = 'postgresql://db.staging.invalid/piloto';
      process.env.PILOT_SEED_ALLOW_HOST = 'db.staging.invalid';
      await operation(db.prisma);
      expect(db.withOrg).toHaveBeenCalledTimes(1);
    });

    it.each(['*', 'staging.invalid', 'otra.staging.invalid', 'DB.STAGING.INVALID', ' db.staging.invalid', 'db.staging.invalid ', 'db.staging.invalid:5432', 'postgresql://db.staging.invalid/piloto', 'db.staging.invalid,otra.staging.invalid'])('rechaza permisos que no coinciden exactamente: %s', async (allowedHost) => {
      const db = database();
      process.env.DATABASE_URL = 'postgresql://db.staging.invalid/piloto';
      process.env.PILOT_SEED_ALLOW_HOST = allowedHost;
      await expect(operation(db.prisma)).rejects.toThrow('Host bloqueado para el piloto: db.staging.invalid.');
      expect(db.withOrg).not.toHaveBeenCalled();
    });

    it.each([undefined, '', 'no-es-url', 'postgresql://', 'https://localhost/piloto', 'postgresql://localhost/piloto?host=db.staging.invalid'])('bloquea una URL inválida o un destino ambiguo (%s) sin imprimirla', async (databaseUrl) => {
      const db = database();
      if (databaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = databaseUrl;
      process.env.PILOT_SEED_ALLOW_HOST = 'db.staging.invalid';
      await expect(operation(db.prisma)).rejects.toThrow('DATABASE_URL no es una URL válida de PostgreSQL con un host explícito. No se ejecutó la operación.');
      expect(db.withOrg).not.toHaveBeenCalled();
    });

    it('mantiene el bloqueo de producción aunque el host remoto esté autorizado', async () => {
      const db = database();
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://db.staging.invalid/piloto';
      process.env.PILOT_SEED_ALLOW_HOST = 'db.staging.invalid';
      await expect(operation(db.prisma)).rejects.toThrow('producción');
      expect(db.withOrg).not.toHaveBeenCalled();
    });
  });
});
