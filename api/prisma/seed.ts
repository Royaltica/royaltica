import {
  PrismaClient,
  Plan,
  UserRole,
  UserStatus,
  DocumentType,
  DocumentStatus,
  InvoiceStatus,
  InvoiceDirection,
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

// ─── Cuentas por Cobrar (CxC) — organización canadiense de ejemplo ───────
// Royáltica también sirve a organizaciones tipo Tradespace (cobranza/AR
// fuera de México): Customer en vez de Supplier, Invoice con
// direction=RECEIVABLE, moneda CAD. Canadá no tiene CFDI/SAT, así que
// cfdiUuid/rfcEmisor/rfcReceptor (requeridos a nivel de columna en Invoice)
// llevan valores sintéticos — es lo mismo que hace el backend hoy para
// datos no-mexicanos, documentado en docs/plan-100-funcional.md.
const CUSTOMER_SEED = [
  {
    name: 'Northwind Traders',
    rfc: 'CA-BN-123456789',
    legalName: 'Northwind Traders Ltd.',
    email: 'ap@northwindtraders.ca',
    category: 'Retail',
    creditLimitDays: 30,
  },
  {
    name: 'Maple Ridge Logistics',
    rfc: 'CA-BN-987654321',
    legalName: 'Maple Ridge Logistics Inc.',
    email: 'accounts@mapleridge.ca',
    category: 'Logística',
    creditLimitDays: 45,
  },
  {
    name: 'Harbourfront Construction',
    rfc: 'CA-BN-555112233',
    legalName: 'Harbourfront Construction Group Inc.',
    email: 'billing@harbourfrontcg.ca',
    category: 'Construcción',
    creditLimitDays: 60,
  },
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
  // CustomerPortalAccess tiene onDelete: Cascade desde Customer, así que se
  // limpia solo al borrar los customers — no hace falta un deleteMany aparte.
  await prisma.customer.deleteMany();
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

  // ─── Organización CxC (Canadá) ─────────────────────────────
  console.log('🍁 Creando organización canadiense (CxC)...');
  const orgCA = await prisma.organization.create({
    data: {
      name: 'Tradespace Demo',
      rfc: 'CA-BN-000000001',
      legalName: 'Tradespace Demo Inc.',
      locale: 'en-CA',
      currency: 'CAD',
      plan: Plan.ENTERPRISE,
      settings: { costRatio: 0.6, opexRatio: 0.18, taxRatio: 0.26 },
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firebaseUid: 'seed-ca-admin-uid',
      organizationId: orgCA.id,
      role: UserRole.CORPORATE_ADMIN,
      email: 'director@tradespacedemo.ca',
      name: 'AR Director',
      isActive: true,
      status: UserStatus.ACTIVE,
      permissions: [],
    },
  });

  console.log('🧑‍💼 Creando clientes (CxC)...');
  const customers = [];
  for (const c of CUSTOMER_SEED) {
    const customer = await prisma.customer.create({
      data: {
        organizationId: orgCA.id,
        name: c.name,
        rfc: c.rfc,
        legalName: c.legalName,
        email: c.email,
        category: c.category,
        creditLimitDays: c.creditLimitDays,
        isActive: true,
      },
    });
    customers.push(customer);
  }

  console.log('🧾 Creando facturas por cobrar (CAD)...');
  // Estatus variados para poder probar aging/riesgo/DSO con datos reales:
  // algunas pagadas, algunas por vencer, algunas ya vencidas por >30 días.
  const receivableStatuses: InvoiceStatus[] = [
    InvoiceStatus.PAID,
    InvoiceStatus.PENDING,
    InvoiceStatus.PENDING,
    InvoiceStatus.APPROVED,
    InvoiceStatus.PENDING,
  ];
  for (let i = 0; i < 15; i++) {
    const customer = customers[i % customers.length];
    const status = receivableStatuses[i % receivableStatuses.length];
    const subtotal = 8_000 + i * 950;
    const tax = Math.round(subtotal * 0.13); // HST aprox. (Ontario)
    const total = subtotal + tax;
    const isPaid = status === InvoiceStatus.PAID;
    // Mezcla de vencimientos: algunas en el futuro (al corriente), algunas
    // ya vencidas por distintos rangos de días (para poblar cubetas de aging).
    const dueInDays = [20, 10, -5, -35, -65][i % 5];

    await prisma.invoice.create({
      data: {
        organizationId: orgCA.id,
        direction: InvoiceDirection.RECEIVABLE,
        customerId: customer.id,
        folio: `AR-${3000 + i}`,
        // Canadá no tiene CFDI/SAT: UUID sintético con el mismo formato que
        // exige la columna (única globalmente), y RFC emisor/receptor con el
        // "Business Number" en vez del RFC mexicano — ver
        // docs/plan-100-funcional.md, sección Canadá, sobre por qué esto
        // hoy solo es posible desde el seed (Prisma) y no vía la API
        // pública (CreateCustomerDto/CreateReceivableDto exigen formato
        // RFC/CFDI mexicano).
        cfdiUuid: `SEED-CA-${String(i).padStart(4, '0')}-${customer.rfc}`,
        rfcEmisor: orgCA.rfc,
        rfcReceptor: customer.rfc,
        subtotal,
        iva: tax,
        total,
        currency: 'CAD',
        date: daysFromNow(-(30 - dueInDays)),
        dueDate: daysFromNow(dueInDays),
        status,
        poNumber: `PO-CA-${4000 + i}`,
        description: `Servicios facturados a ${customer.name}`,
        paidDate: isPaid ? daysFromNow(dueInDays - 3) : null,
        forensicStatus: ForensicStatus.VALIDATED,
        signatures: isPaid ? 2 : 0,
      },
    });
  }

  console.log('✅ Seed completado:');
  console.log(`   - 2 organizaciones: CxP México (${org.name}) y CxC Canadá (${orgCA.name})`);
  console.log('   - 3 usuarios CxP (admin, analista, proveedor) + 1 admin CxC');
  console.log(`   - ${suppliers.length} proveedores con expedientes KYC mixtos (CxP)`);
  console.log('   - 20 facturas por pagar con estatus y forensicStatus variados (CxP, MXN)');
  console.log(`   - ${customers.length} clientes CxC (Canadá)`);
  console.log('   - 15 facturas por cobrar con aging variado (CxC, CAD)');
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
