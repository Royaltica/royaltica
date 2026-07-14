import {
  PrismaClient,
  Plan,
  UserRole,
  UserStatus,
  DocumentType,
  DocumentStatus,
  InvoiceStatus,
  PaymentRoute,
  PaymentType,
  ForensicStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const daysFromNow = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const SUPPLIER_SEED = [
  {
    name: 'Logística Andrade',
    rfc: 'LAN180423QF1',
    legalName: 'Logística Andrade S.A. de C.V.',
    category: 'Logística',
    activity: 'Transporte de carga terrestre',
    seniorityYears: 8,
    isApproved: true,
    capitalAmount: 2_016_000,
  },
  {
    name: 'TecnoSoluciones MX',
    rfc: 'TSM200115HD9',
    legalName: 'TecnoSoluciones de México S.A.P.I.',
    category: 'Servicios TI',
    activity: 'Desarrollo de software',
    seniorityYears: 5,
    isApproved: true,
    capitalAmount: 1_440_000,
  },
  {
    name: 'Suministros del Bajío',
    rfc: 'SBA150630PK4',
    legalName: 'Suministros del Bajío S. de R.L.',
    category: 'Suministros',
    activity: 'Venta de insumos industriales',
    seniorityYears: 12,
    isApproved: true,
    capitalAmount: 2_592_000,
  },
  {
    name: 'Consultoría Vértice',
    rfc: 'CVE190820MN2',
    legalName: 'Consultoría Vértice S.C.',
    category: 'Consultoría',
    activity: 'Servicios de consultoría administrativa',
    seniorityYears: 4,
    isApproved: false,
    capitalAmount: 936_000,
  },
  {
    name: 'Mantenimiento Integral Rivera',
    rfc: 'MIR170510TX7',
    legalName: 'Mantenimiento Integral Rivera S.A.',
    category: 'Mantenimiento',
    activity: 'Mantenimiento de instalaciones',
    seniorityYears: 7,
    isApproved: true,
    capitalAmount: 1_260_000,
  },
];

// Documentos KYC mixtos por proveedor (índice = posición en SUPPLIER_SEED)
const DOCS_BY_SUPPLIER: Record<
  number,
  { type: DocumentType; status: DocumentStatus; expiresInDays: number | null }[]
> = {
  0: [
    { type: DocumentType.CONSTANCIA_SF, status: DocumentStatus.VALIDATED, expiresInDays: 200 },
    { type: DocumentType.OPINION_32D, status: DocumentStatus.VALIDATED, expiresInDays: 8 }, // por vencer
    { type: DocumentType.ACTA_CONSTITUTIVA, status: DocumentStatus.VALIDATED, expiresInDays: null },
  ],
  1: [
    { type: DocumentType.CONSTANCIA_SF, status: DocumentStatus.VALIDATED, expiresInDays: 150 },
    { type: DocumentType.OPINION_32D, status: DocumentStatus.EXPIRED, expiresInDays: -5 }, // vencido
  ],
  2: [
    { type: DocumentType.CONSTANCIA_SF, status: DocumentStatus.VALIDATED, expiresInDays: 90 },
    { type: DocumentType.COMPROBANTE_DOMICILIO, status: DocumentStatus.VALIDATED, expiresInDays: 12 }, // por vencer
    { type: DocumentType.PODER_NOTARIAL, status: DocumentStatus.VALIDATED, expiresInDays: null },
  ],
  3: [
    { type: DocumentType.CONSTANCIA_SF, status: DocumentStatus.PENDING, expiresInDays: null },
    { type: DocumentType.ACTA_CONSTITUTIVA, status: DocumentStatus.PENDING, expiresInDays: null },
  ],
  4: [
    { type: DocumentType.CONSTANCIA_SF, status: DocumentStatus.VALIDATED, expiresInDays: 300 },
    { type: DocumentType.IDENTIFICACION, status: DocumentStatus.VALIDATED, expiresInDays: 25 }, // por vencer
  ],
};

const INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.PENDING,
  InvoiceStatus.AUDITED,
  InvoiceStatus.APPROVED,
  InvoiceStatus.PAID,
  InvoiceStatus.REJECTED,
];

const FORENSIC_STATUSES: ForensicStatus[] = [
  ForensicStatus.PENDING,
  ForensicStatus.VALIDATED,
  ForensicStatus.DISCREPANCY,
  ForensicStatus.BLOCKED,
];

async function main(): Promise<void> {
  console.log('🌱 Limpiando datos previos...');
  // Orden respetando FKs
  await prisma.invoiceAuditLog.deleteMany();
  await prisma.factorajeRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.diotDeclaration.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.supplierDocument.deleteMany();
  await prisma.user.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.organization.deleteMany();

  console.log('🏢 Creando organización...');
  const org = await prisma.organization.create({
    data: {
      name: 'Royáltica Demo',
      rfc: 'RDE240101AA1',
      legalName: 'Royáltica Demo S.A. de C.V.',
      plan: Plan.ENTERPRISE,
      settings: { costRatio: 0.65, opexRatio: 0.15, taxRatio: 0.3 },
      isActive: true,
    },
  });

  console.log('👥 Creando proveedores y expedientes...');
  const suppliers = [];
  for (let i = 0; i < SUPPLIER_SEED.length; i++) {
    const s = SUPPLIER_SEED[i];
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        name: s.name,
        rfc: s.rfc,
        legalName: s.legalName,
        contact: `Contacto ${s.name}`,
        email: `contacto@${s.rfc.toLowerCase()}.mx`,
        category: s.category,
        activity: s.activity,
        seniorityYears: s.seniorityYears,
        isApproved: s.isApproved,
        capitalAmount: s.capitalAmount,
        clabeInterbancaria: `0141806556001234${String(i).padStart(2, '0')}`,
        bankName: 'BBVA Bancomer',
      },
    });
    suppliers.push(supplier);

    const docs = DOCS_BY_SUPPLIER[i] ?? [];
    for (const d of docs) {
      await prisma.supplierDocument.create({
        data: {
          supplierId: supplier.id,
          type: d.type,
          fileName: `${d.type}_${s.rfc}.pdf`,
          storageUrl: `seed://documents/${supplier.id}/${d.type}.pdf`,
          status: d.status,
          expiresAt: d.expiresInDays === null ? null : daysFromNow(d.expiresInDays),
        },
      });
    }
  }

  console.log('🔑 Creando usuarios...');
  // Admin corporativo: ve TODAS las áreas (permissions se ignora para su rol).
  await prisma.user.create({
    data: {
      firebaseUid: 'seed-admin-uid',
      organizationId: org.id,
      role: UserRole.CORPORATE_ADMIN,
      email: 'director@royaltica.com',
      name: 'Director Financiero',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
      isActive: true,
      status: UserStatus.ACTIVE,
      permissions: [],
    },
  });

  // Usuario por área: solo finanzas, pagos y estados (demo multi-usuario).
  await prisma.user.create({
    data: {
      firebaseUid: 'seed-user-uid',
      organizationId: org.id,
      role: UserRole.CORPORATE_USER,
      email: 'analista@royaltica.com',
      name: 'Analista de Cuentas',
      isActive: true,
      status: UserStatus.ACTIVE,
      permissions: ['finanzas', 'pagos', 'estados'],
    },
  });

  // Usuario PROVIDER asociado al primer proveedor (usa el portal de proveedor).
  const providerUser = await prisma.user.create({
    data: {
      firebaseUid: 'seed-provider-uid',
      organizationId: org.id,
      role: UserRole.PROVIDER,
      email: 'proveedor@logisticaandrade.mx',
      name: 'Logística Andrade',
      isActive: true,
      status: UserStatus.ACTIVE,
      permissions: [],
      supplierId: suppliers[0].id,
    },
  });

  console.log('🧾 Creando facturas...');
  for (let i = 0; i < 20; i++) {
    const supplier = suppliers[i % suppliers.length];
    const status = INVOICE_STATUSES[i % INVOICE_STATUSES.length];
    const forensicStatus = FORENSIC_STATUSES[i % FORENSIC_STATUSES.length];
    const subtotal = 50_000 + i * 7_500;
    const iva = Math.round(subtotal * 0.16);
    const total = subtotal + iva;
    const isPaid = status === InvoiceStatus.PAID;

    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        folio: `F-${1000 + i}`,
        cfdiUuid: `SEED-${String(i).padStart(4, '0')}-UUID-${supplier.rfc}`,
        rfcEmisor: supplier.rfc,
        rfcReceptor: org.rfc,
        subtotal,
        iva,
        total,
        date: daysFromNow(-((i + 1) * 5)),
        dueDate: daysFromNow(30 - i),
        status,
        paymentRoute: PaymentRoute.TRANSFER,
        paymentType: i % 2 === 0 ? PaymentType.PPD : PaymentType.PUE,
        poNumber: `PO-${2000 + i}`,
        description: `Servicios / suministros ${supplier.category}`,
        satStatus: 'Vigente',
        paidDate: isPaid ? daysFromNow(-((i + 1) * 3)) : null,
        scheduledPayDate: status === InvoiceStatus.APPROVED ? daysFromNow(7) : null,
        forensicStatus,
        forensicScore:
          forensicStatus === ForensicStatus.VALIDATED
            ? 95
            : forensicStatus === ForensicStatus.DISCREPANCY
              ? 60
              : forensicStatus === ForensicStatus.BLOCKED
                ? 20
                : null,
        signatures: status === InvoiceStatus.APPROVED || isPaid ? 2 : 0,
      },
    });
  }

  console.log('🔔 Creando notificaciones...');
  const notifSeed = [
    { type: 'INVOICE_RECEIVED', title: 'Nueva factura recibida', body: 'F-1003 entró al sistema.' },
    { type: 'INVOICE_STATUS_CHANGED', title: 'Factura aprobada', body: 'F-1002 fue aprobada para pago.' },
    { type: 'DOCUMENT_EXPIRING', title: 'Documento por vencer', body: 'Opinión 32D de Logística Andrade vence en 8 días.' },
    { type: 'PAYMENT_PROCESSED', title: 'Pago procesado', body: 'Se liquidó la factura F-1004.' },
    { type: 'FACTORAJE_APPROVED', title: 'Anticipo aprobado', body: 'Tu solicitud de factoraje fue aprobada.' },
  ];
  for (const n of notifSeed) {
    await prisma.notification.create({
      data: { userId: providerUser.id, type: n.type, title: n.title, body: n.body },
    });
  }

  console.log('✅ Seed completado:');
  console.log(`   - 1 organización (${org.name})`);
  console.log('   - 3 usuarios (admin, analista, proveedor)');
  console.log(`   - ${suppliers.length} proveedores con expedientes KYC mixtos`);
  console.log('   - 20 facturas con estatus y forensicStatus variados');
  console.log('   - 5 notificaciones');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
