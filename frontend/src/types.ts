export interface Supplier {
  id: string;
  name: string;
  rfc: string;
  contact: string;
  isApproved: boolean;
  category: 'Logística' | 'Suministros' | 'Servicios TI' | 'Mantenimiento' | 'Marketing' | 'Consultoría' | 'Seguridad' | 'RH' | 'Legal' | 'Insumos';
  priority: 'Alta' | 'Media' | 'Baja';
  legalName: string;
  activity: string;
  seniorityYears: number;
  documents: {
    status: 'Validado' | 'Pendiente';
    type: string;
  }[];
  clabe?: string;
  bankName?: string;
  score?: number;
}

export interface AuthorizationStatus {
  name: string;
  role: string;
  status: 'approved' | 'pending';
  dateSent: string;
}

export interface InvoiceChangeLog {
  timestamp: string;
  user: string;
  action: string;
  from?: string;
  to?: string;
  reason?: string;
}

export interface Invoice {
  id: string;
  providerId: string;
  provider: string;
  amount: number;
  date: string;
  status: 'pending' | 'audited' | 'paid' | 'rejected' | 'approved';
  poNumber: string;
  description: string;
  auditScore?: number;
  paymentRoute?: 'cash' | 'fintech';
  authorizations?: AuthorizationStatus[];
  signatures?: number; // 1 or 2
  auditAnalysis?: string;
  aiRecommendation?: string;
  forensicStatus?: 'VALIDATED' | 'DISCREPANCY' | 'BLOCKED';
  forensicSolution?: string;
  paymentType?: 'PUE' | 'PPD';
  paymentMethod?: string;
  cfdiUse?: string;
  documentUrl?: string;
  // ─── CFDI / SAT Verification ───
  cfdiUUID?: string;         // Folio fiscal from TimbreFiscalDigital XML node
  satStatus?: 'Vigente' | 'Cancelado' | 'No Encontrado' | 'Pendiente';
  satVerifiedAt?: string;    // ISO timestamp of last SAT verification
  satCancelable?: string;    // "Cancelable sin aceptación" | "Cancelable con aceptación" | etc.
  // ─── Other fields ───
  changeLog?: InvoiceChangeLog[];
  rejectionReason?: string;
  notes?: string;
  paidAmount?: number;       // For partial payments (amount actually paid)
  scheduledPayDate?: string; // ISO date string for payment calendar
  paidDate?: string;         // When was it actually paid
  repStatus?: 'NA' | 'PENDING' | 'RECEIVED'; // Estatus del complemento de pago (REP)
  supportDocUrl?: string;    // Exception/support document for discrepancies
}

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: "PROV-001",
    name: "Logística Global SA",
    rfc: "LGL980214MX1",
    contact: "ventas@logistica.mx",
    isApproved: true,
    category: "Logística",
    priority: "Alta",
    legalName: "Logística Global del Norte S.A. de C.V.",
    activity: "Transporte de carga pesada y aduanas",
    seniorityYears: 12,
    documents: [{ type: "Opinión del SAT", status: "Validado" }, { type: "Acta Constitutiva", status: "Validado" }]
  },
  {
    id: "PROV-002",
    name: "Suministros Industriales",
    rfc: "SUI120510TH2",
    contact: "soporte@sumindustriales.com",
    isApproved: true,
    category: "Suministros",
    priority: "Media",
    legalName: "Suministros Industriales de México S. de R.L.",
    activity: "Venta de refacciones industriales",
    seniorityYears: 8,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-003",
    name: "Tech Solutions MX",
    rfc: "TSM150601AA0",
    contact: "admin@techsolutions.mx",
    isApproved: true,
    category: "Servicios TI",
    priority: "Alta",
    legalName: "Tecnología y Soluciones Digitales MX",
    activity: "Desarrollo de software y consultoría ERP",
    seniorityYears: 5,
    documents: [{ type: "CSF", status: "Validado" }]
  },
  {
    id: "PROV-004",
    name: "Mantenimiento Pro",
    rfc: "MPR091215KK3",
    contact: "contacto@mantenimientopro.com",
    isApproved: true,
    category: "Mantenimiento",
    priority: "Media",
    legalName: "Mantenimiento Profesional de Inmuebles SA",
    activity: "Servicios preventivos y correctivos de oficina",
    seniorityYears: 15,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-005",
    name: "Marketing Digital SC",
    rfc: "MDI180320HY9",
    contact: "info@marketingdigital.mx",
    isApproved: true,
    category: "Marketing",
    priority: "Media",
    legalName: "Marketing e Innovación Digital S.C.",
    activity: "Campañas publicitarias y SEO",
    seniorityYears: 4,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-006",
    name: "Consultores Asociados",
    rfc: "CAS140830TR1",
    contact: "legal@consultores.com",
    isApproved: true,
    category: "Consultoría",
    priority: "Alta",
    legalName: "Consultores de Negocios Asociados S.A.",
    activity: "Asesoría financiera y estratégica",
    seniorityYears: 10,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-007",
    name: "Seguridad Integral MX",
    rfc: "SIM110505BN2",
    contact: "vigilancia@seguridad.mx",
    isApproved: true,
    category: "Seguridad",
    priority: "Alta",
    legalName: "Seguridad Integral Protege S.A. de C.V.",
    activity: "Sistemas de monitoreo y guardias",
    seniorityYears: 20,
    documents: [{ type: "REPSE", status: "Validado" }]
  },
  {
    id: "PROV-008",
    name: "Recursos Humanos Express",
    rfc: "RHE151111JH5",
    contact: "rh@rhexpress.com",
    isApproved: true,
    category: "RH",
    priority: "Baja",
    legalName: "Talento y Recursos Humanos Express",
    activity: "Reclutamiento y selección de personal",
    seniorityYears: 6,
    documents: [{ type: "REPSE", status: "Validado" }]
  },
  {
    id: "PROV-009",
    name: "Papelería y Oficina",
    rfc: "POF100101AA1",
    contact: "ventas@papeleria.mx",
    isApproved: true,
    category: "Suministros",
    priority: "Baja",
    legalName: "Distribuidora de Papeles y Oficina S.A.",
    activity: "Artículos de papelería al mayoreo",
    seniorityYears: 25,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-010",
    name: "Limpieza Profunda",
    rfc: "LPR160412UI2",
    contact: "servicio@limpieza.mx",
    isApproved: true,
    category: "Mantenimiento",
    priority: "Media",
    legalName: "Servicios de Limpieza e Higiene S.A.",
    activity: "Limpieza industrial y de oficinas",
    seniorityYears: 7,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-011",
    name: "Transportes Express",
    rfc: "TEX190708OP4",
    contact: "logistica@tex.mx",
    isApproved: true,
    category: "Logística",
    priority: "Media",
    legalName: "Transportes Terrestres Express de México",
    activity: "Paquetería y mensajería empresarial",
    seniorityYears: 3,
    documents: [{ type: "Opinión del SAT", status: "Pendiente" }]
  },
  {
    id: "PROV-012",
    name: "Software & Cloud",
    rfc: "SCL130225WE8",
    contact: "aws@softwarecloud.mx",
    isApproved: true,
    category: "Servicios TI",
    priority: "Alta",
    legalName: "Servicios en la Nube y Software S.A.",
    activity: "Hosting y licencias de software",
    seniorityYears: 11,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-013",
    name: "Construcciones Modernas",
    rfc: "CMO110303GH6",
    contact: "obras@modernas.com",
    isApproved: true,
    category: "Mantenimiento",
    priority: "Baja",
    legalName: "Construcciones Modernas del Centro S.A.",
    activity: "Remodelaciones y construcción menor",
    seniorityYears: 14,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-014",
    name: "Servicios Legales Torres",
    rfc: "SLT150915TR3",
    contact: "legal@torres.mx",
    isApproved: true,
    category: "Legal",
    priority: "Media",
    legalName: "Torres y Asociados Bufete Jurídico",
    activity: "Consultoría legal empresarial",
    seniorityYears: 9,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-015",
    name: "Insumos Médicos SA",
    rfc: "IME170101SD2",
    contact: "ventas@insumosmedicos.mx",
    isApproved: true,
    category: "Insumos",
    priority: "Alta",
    legalName: "Insumos Médicos y Químicos del Bajío",
    activity: "Venta de equipo de protección personal",
    seniorityYears: 5,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-016",
    name: "Sian & Partners Legal",
    rfc: "SPL200512KL9",
    contact: "contacto@sianpartners.mx",
    isApproved: true,
    category: "Legal",
    priority: "Media",
    legalName: "Sian y Asociados Consultoría Legal S.C.",
    activity: "Derecho corporativo y patentes",
    seniorityYears: 4,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-017",
    name: "Energía Eficiente",
    rfc: "EEF120830HN5",
    contact: "ventas@energia.mx",
    isApproved: true,
    category: "Insumos",
    priority: "Alta",
    legalName: "Sistemas de Energía Eficiente S.A.",
    activity: "Instalación de paneles solares industriales",
    seniorityYears: 10,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-018",
    name: "Gourmet Corporate",
    rfc: "GCO150422NM3",
    contact: "eventos@gourmet.mx",
    isApproved: true,
    category: "Suministros",
    priority: "Baja",
    legalName: "Gourmet Eventos Corporativos S. de R.L.",
    activity: "Servicio de catering y eventos",
    seniorityYears: 8,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-019",
    name: "Arquitectura Espacio",
    rfc: "AES100315GH2",
    contact: "proyectos@arquitectura.mx",
    isApproved: true,
    category: "Mantenimiento",
    priority: "Media",
    legalName: "Arquitectura y Diseño de Espacios S.A.",
    activity: "Diseño de interiores y remodelación",
    seniorityYears: 12,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-020",
    name: "Mobiliario & Estilo",
    rfc: "MES180920TY1",
    contact: "ventas@mobiliario.mx",
    isApproved: true,
    category: "Suministros",
    priority: "Media",
    legalName: "Mobiliario y Estilo de México S.A.",
    activity: "Fabricación de muebles de oficina",
    seniorityYears: 6,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-021",
    name: "Sistemas Hidráulicos",
    rfc: "SHI140210JU4",
    contact: "soporte@hidraulicos.mx",
    isApproved: true,
    category: "Mantenimiento",
    priority: "Alta",
    legalName: "Sistemas Hidráulicos de Occidente S.A.",
    activity: "Mantenimiento de prensas y pistones",
    seniorityYears: 15,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-022",
    name: "Química Industrial MX",
    rfc: "QIM090605PL2",
    contact: "pedidos@quimicaw.mx",
    isApproved: true,
    category: "Insumos",
    priority: "Media",
    legalName: "Química Industrial de México S.A. de C.V.",
    activity: "Reactivos y solventes industriales",
    seniorityYears: 20,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-023",
    name: "Seguridad Cibernética",
    rfc: "SCI220112RE5",
    contact: "cyber@seguridad.mx",
    isApproved: true,
    category: "Servicios TI",
    priority: "Alta",
    legalName: "Seguridad Cibernética Global S.A.",
    activity: "Blindaje de redes y servidores",
    seniorityYears: 2,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-024",
    name: "Empaques Pro",
    rfc: "EPR160530NM9",
    contact: "ventas@empaquespro.mx",
    isApproved: true,
    category: "Suministros",
    priority: "Baja",
    legalName: "Empaques Profesionales del Norte S.A.",
    activity: "Cartón y embalaje industrial",
    seniorityYears: 7,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-025",
    name: "Consultoría Estratégica",
    rfc: "CES110418KP3",
    contact: "info@estrategia.mx",
    isApproved: true,
    category: "Legal",
    priority: "Media",
    legalName: "Consultoría Estratégica Global S.C.",
    activity: "Análisis de mercados y proyecciones",
    seniorityYears: 9,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-026",
    name: "Logistica Aérea MX",
    rfc: "LAM170322YT4",
    contact: "trafico@logistica.mx",
    isApproved: true,
    category: "Logística",
    priority: "Alta",
    legalName: "Logística Aérea de México S.A.",
    activity: "Carga aérea nacional e internacional",
    seniorityYears: 5,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-027",
    name: "Redes Dinámicas",
    rfc: "RDI200910LK1",
    contact: "redes@dinamicas.mx",
    isApproved: true,
    category: "Servicios TI",
    priority: "Media",
    legalName: "Redes y Telecomunicaciones Dinámicas S.A.",
    activity: "Instalación de fibra óptica",
    seniorityYears: 3,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-028",
    name: "Papelería del Sol",
    rfc: "PSO120515GH9",
    contact: "pedidos@papsol.mx",
    isApproved: true,
    category: "Suministros",
    priority: "Baja",
    legalName: "Distribuidora de Papelería del Sol S.A.",
    activity: "Insumos de oficina y papelería",
    seniorityYears: 11,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-029",
    name: "Limpieza Total",
    rfc: "LTO151120MN3",
    contact: "limpieza@servicios.mx",
    isApproved: true,
    category: "Insumos",
    priority: "Media",
    legalName: "Servicios de Limpieza Total S.A. de C.V.",
    activity: "Servicios de saneamiento industrial",
    seniorityYears: 8,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-030",
    name: "Taller Mecánico Pro",
    rfc: "TMP100312BN7",
    contact: "taller@mecanicopro.mx",
    isApproved: true,
    category: "Mantenimiento",
    priority: "Media",
    legalName: "Taller de Mantenimiento Mecánico Pro S.A.",
    activity: "Reparación de flotilla vehicular",
    seniorityYears: 14,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-031",
    name: "Soluciones de Empaque",
    rfc: "SEM140512RT3",
    contact: "ventas@empaquemx.com",
    isApproved: true,
    category: "Suministros",
    priority: "Media",
    legalName: "Soluciones de Empaque de México S.A.",
    activity: "Embalaje grado alimenticio",
    seniorityYears: 6,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-032",
    name: "Transportes Express",
    rfc: "TEX190820KL5",
    contact: "pedidos@trans-express.mx",
    isApproved: true,
    category: "Logística",
    priority: "Alta",
    legalName: "Transportes de Carga Express S.A.",
    activity: "Distribución nacional de última milla",
    seniorityYears: 4,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-033",
    name: "Software & Cloud",
    rfc: "SCL210115PQ1",
    contact: "cloud@swcloud.mx",
    isApproved: true,
    category: "Servicios TI",
    priority: "Media",
    legalName: "Software y Servicios de Nube S.A.",
    activity: "Gestión de infraestructura en la nube",
    seniorityYears: 3,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-034",
    name: "Sian Cleaners",
    rfc: "SCI130422MN9",
    contact: "servicios@sianclean.mx",
    isApproved: true,
    category: "Insumos",
    priority: "Baja",
    legalName: "Sian Servicios de Limpieza Especializada S.A.",
    activity: "Productos de limpieza biodegradable",
    seniorityYears: 10,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  },
  {
    id: "PROV-035",
    name: "LegalTech MX",
    rfc: "LTM160910BN2",
    contact: "asesoria@legaltech.mx",
    isApproved: true,
    category: "Legal",
    priority: "Alta",
    legalName: "LegalTech Consultoría Digital S.C.",
    activity: "Asesoría legal digital y contratos",
    seniorityYears: 7,
    documents: [{ type: "Opinión del SAT", status: "Validado" }]
  }
];

export const MOCK_INVOICES: Invoice[] = [
  // Generamos facturas para los proveedores
  // Proveedor 1: Logística Global SA
  { id: "FAC-01-P1", providerId: "PROV-001", provider: "Logística Global SA", amount: 15400, date: "2024-04-10", status: 'pending', poNumber: "10101", description: "Flete Internacional" },
  { id: "FAC-01-P2", providerId: "PROV-001", provider: "Logística Global SA", amount: 2800, date: "2024-04-12", status: 'pending', poNumber: "10102", description: "Despacho Aduanal" },
  { id: "FAC-01-P3", providerId: "PROV-001", provider: "Logística Global SA", amount: 9200, date: "2024-04-15", status: 'pending', poNumber: "10103", description: "Almacenaje en Seco" },
  { id: "FAC-01-P4", providerId: "PROV-001", provider: "Logística Global SA", amount: 7500, date: "2024-04-18", status: 'pending', poNumber: "10104", description: "Distribución Local" },
  { id: "FAC-01-P5", providerId: "PROV-001", provider: "Logística Global SA", amount: 3200, date: "2024-04-20", status: 'pending', poNumber: "10105", description: "Carga Consolidada" },
  { id: "FAC-01-P6", providerId: "PROV-001", provider: "Logística Global SA", amount: 5900, date: "2024-04-22", status: 'pending', poNumber: "10106", description: "Seguro de Mercancía" },
  { id: "FAC-01-P7", providerId: "PROV-001", provider: "Logística Global SA", amount: 4800, date: "2024-04-25", status: 'pending', poNumber: "10107", description: "Flete Nacional" },
  { id: "FAC-01-P8", providerId: "PROV-001", provider: "Logística Global SA", amount: 1200, date: "2024-04-26", status: 'pending', poNumber: "10108", description: "Recolección" },
  { id: "FAC-01-C1", providerId: "PROV-001", provider: "Logística Global SA", amount: 12000, date: "2024-03-01", status: 'paid', poNumber: "9901", description: "Semanas 1-2 Logística", auditScore: 100, paymentRoute: 'cash' },
  { id: "FAC-01-C2", providerId: "PROV-001", provider: "Logística Global SA", amount: 11000, date: "2024-03-15", status: 'paid', poNumber: "9915", description: "Semanas 3-4 Logística", auditScore: 98, paymentRoute: 'fintech' },
  { id: "FAC-01-C3", providerId: "PROV-001", provider: "Logística Global SA", amount: 8500, date: "2024-03-25", status: 'paid', poNumber: "9925", description: "Envíos Prioritarios Q1", auditScore: 99, paymentRoute: 'cash' },
  { id: "FAC-01-C4", providerId: "PROV-001", provider: "Logística Global SA", amount: 4500, date: "2024-03-28", status: 'paid', poNumber: "9928", description: "Logística Express", auditScore: 100, paymentRoute: 'fintech' },
  { id: "FAC-01-C5", providerId: "PROV-001", provider: "Logística Global SA", amount: 2100, date: "2024-03-30", status: 'paid', poNumber: "9930", description: "Empaque Especial", auditScore: 97, paymentRoute: 'cash' },

  // Proveedor 2: Suministros Industriales
  { id: "FAC-02-P1", providerId: "PROV-002", provider: "Suministros Industriales", amount: 45000, date: "2024-04-05", status: 'pending', poNumber: "11201", description: "Rodamientos Industriales" },
  { id: "FAC-02-P2", providerId: "PROV-002", provider: "Suministros Industriales", amount: 12000, date: "2024-04-08", status: 'pending', poNumber: "11202", description: "Bandas de Transmisión" },
  { id: "FAC-02-P3", providerId: "PROV-002", provider: "Suministros Industriales", amount: 8400, date: "2024-04-12", status: 'pending', poNumber: "11203", description: "Lubricantes Grado Alimenticio" },
  { id: "FAC-02-P4", providerId: "PROV-002", provider: "Suministros Industriales", amount: 15600, date: "2024-04-15", status: 'pending', poNumber: "11204", description: "Válvulas de Presión" },
  { id: "FAC-02-P5", providerId: "PROV-002", provider: "Suministros Industriales", amount: 4200, date: "2024-04-18", status: 'pending', poNumber: "11205", description: "Mangueras Hidráulicas" },
  { id: "FAC-02-P6", providerId: "PROV-002", provider: "Suministros Industriales", amount: 9800, date: "2024-04-20", status: 'pending', poNumber: "11206", description: "Sensores de Proximidad" },
  { id: "FAC-02-P7", providerId: "PROV-002", provider: "Suministros Industriales", amount: 3500, date: "2024-04-22", status: 'pending', poNumber: "11207", description: "Filtros de Aire" },
  { id: "FAC-02-C1", providerId: "PROV-002", provider: "Suministros Industriales", amount: 32000, date: "2024-02-28", status: 'paid', poNumber: "8801", description: "Kit de Refacciones Anual", auditScore: 97, paymentRoute: 'cash' },
  { id: "FAC-02-C2", providerId: "PROV-002", provider: "Suministros Industriales", amount: 5000, date: "2024-03-10", status: 'paid', poNumber: "8810", description: "Consumibles Taller", auditScore: 99, paymentRoute: 'fintech' },
  { id: "FAC-02-C3", providerId: "PROV-002", provider: "Suministros Industriales", amount: 1500, date: "2024-03-25", status: 'paid', poNumber: "8825", description: "Papelería Industrial", auditScore: 100, paymentRoute: 'cash' },
  { id: "FAC-02-C4", providerId: "PROV-002", provider: "Suministros Industriales", amount: 7800, date: "2024-03-30", status: 'paid', poNumber: "8830", description: "Herramientas Manuales", auditScore: 95, paymentRoute: 'fintech' },
  { id: "FAC-02-C5", providerId: "PROV-002", provider: "Suministros Industriales", amount: 12400, date: "2024-04-01", status: 'paid', poNumber: "8840", description: "Gabinete Metálico", auditScore: 98, paymentRoute: 'cash' },
  
  // Proveedor 21: Sistemas Hidráulicos
  { id: "FAC-21-P1", providerId: "PROV-021", provider: "Sistemas Hidráulicos", amount: 12500, date: "2024-04-10", status: 'pending', poNumber: "2101", description: "Reparación Prensa 4" },
  { id: "FAC-21-P2", providerId: "PROV-021", provider: "Sistemas Hidráulicos", amount: 4800, date: "2024-04-15", status: 'pending', poNumber: "2102", description: "Sello Hidráulico" },
  { id: "FAC-21-C1", providerId: "PROV-021", provider: "Sistemas Hidráulicos", amount: 22000, date: "2024-03-05", status: 'paid', poNumber: "2100", description: "Mantenimiento Preventivo Q1", auditScore: 100, paymentRoute: 'fintech' },

  // Proveedor 22: Química Industrial MX
  { id: "FAC-22-P1", providerId: "PROV-022", provider: "Química Industrial MX", amount: 84000, date: "2024-04-01", status: 'pending', poNumber: "2201", description: "Contenedor de Acetona" },
  { id: "FAC-22-C1", providerId: "PROV-022", provider: "Química Industrial MX", amount: 35000, date: "2024-02-15", status: 'paid', poNumber: "2200", description: "Reactivos Laboratorio", auditScore: 99, paymentRoute: 'cash' },

  // Proveedor 23: Seguridad Cibernética
  { id: "FAC-23-P1", providerId: "PROV-023", provider: "Seguridad Cibernética", amount: 15600, date: "2024-04-20", status: 'pending', poNumber: "2301", description: "Penetration Test Abril" },
  { id: "FAC-23-C1", providerId: "PROV-023", provider: "Seguridad Cibernética", amount: 12000, date: "2024-01-20", status: 'paid', poNumber: "2300", description: "Configuración VPN", auditScore: 100, paymentRoute: 'fintech' },

  // Proveedor 26: Logistica Aérea MX
  { id: "FAC-26-P1", providerId: "PROV-026", provider: "Logistica Aérea MX", amount: 52000, date: "2024-03-25", status: 'pending', poNumber: "2601", description: "Carga Consolidada LHR-MEX" },
  { id: "FAC-26-C1", providerId: "PROV-026", provider: "Logistica Aérea MX", amount: 18000, date: "2024-02-10", status: 'paid', poNumber: "2600", description: "Vuelo Especial Q1", auditScore: 98, paymentRoute: 'cash' },

  // Proveedor 32: Transportes Express
  { id: "FAC-32-P1", providerId: "PROV-032", provider: "Transportes Express", amount: 15400, date: "2024-04-12", status: 'pending', poNumber: "3201", description: "Ruta CDMX-MTY" },
  { id: "FAC-32-C1", providerId: "PROV-032", provider: "Transportes Express", amount: 8900, date: "2024-03-20", status: 'paid', poNumber: "3200", description: "Envío Foráneo Q1", auditScore: 97, paymentRoute: 'fintech' },

  // Proveedor 3: Tech Solutions MX
  { id: "FAC-03-P1", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 68200, date: "2024-04-01", status: 'pending', poNumber: "12301", description: "Licencias Software ERP" },
  { id: "FAC-03-P2", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 12000, date: "2024-04-10", status: 'pending', poNumber: "12302", description: "Mantenimiento Servidores" },
  { id: "FAC-03-P3", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 4500, date: "2024-04-15", status: 'pending', poNumber: "12303", description: "Soporte Técnico Remoto" },
  { id: "FAC-03-P4", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 15000, date: "2024-04-20", status: 'pending', poNumber: "12304", description: "Consultoría Ciberseguridad" },
  { id: "FAC-03-P5", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 8000, date: "2024-04-22", status: 'pending', poNumber: "12305", description: "Actualización de Firewall" },
  { id: "FAC-03-C1", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 50000, date: "2023-12-15", status: 'paid', poNumber: "7701", description: "Proyecto Migración Cloud", auditScore: 95, paymentRoute: 'fintech' },
  { id: "FAC-03-C2", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 15000, date: "2024-02-10", status: 'paid', poNumber: "7720", description: "Auditoría de Sistemas", auditScore: 100, paymentRoute: 'cash' },

  // Proveedor 4: Mantenimiento Pro
  { id: "FAC-04-P1", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 3200, date: "2024-04-05", status: 'pending', poNumber: "13401", description: "Reparación Elevador" },
  { id: "FAC-04-P2", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 1500, date: "2024-04-08", status: 'pending', poNumber: "13402", description: "Pintura Lobby" },
  { id: "FAC-04-P3", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 4800, date: "2024-04-12", status: 'pending', poNumber: "13403", description: "Instalación Eléctrica Piso 2" },
  { id: "FAC-04-P4", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 2200, date: "2024-04-15", status: 'pending', poNumber: "13404", description: "Revisión Hidráulica" },
  { id: "FAC-04-C1", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 12000, date: "2024-01-20", status: 'paid', poNumber: "6601", description: "Remodelación Comedor", auditScore: 92, paymentRoute: 'fintech' },
  { id: "FAC-04-C2", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 8000, date: "2024-02-15", status: 'paid', poNumber: "6615", description: "Mantenimiento Subestación", auditScore: 96, paymentRoute: 'cash' },

  // Proveedor 5: Marketing Digital SC
  { id: "FAC-05-P1", providerId: "PROV-005", provider: "Marketing Digital SC", amount: 15600, date: "2024-04-01", status: 'pending', poNumber: "14501", description: "Campaña Google Ads Abril" },
  { id: "FAC-05-P2", providerId: "PROV-005", provider: "Marketing Digital SC", amount: 8000, date: "2024-04-05", status: 'pending', poNumber: "14502", description: "Creación de Contenido RRSS" },
  { id: "FAC-05-P3", providerId: "PROV-005", provider: "Marketing Digital SC", amount: 12000, date: "2024-04-10", status: 'pending', poNumber: "14503", description: "Estrategia Influencers" },
  { id: "FAC-05-C1", providerId: "PROV-005", provider: "Marketing Digital SC", amount: 25000, date: "2024-02-10", status: 'paid', poNumber: "5501", description: "Diseño Web Corporativo", auditScore: 100, paymentRoute: 'fintech' },
  { id: "FAC-05-C2", providerId: "PROV-005", provider: "Marketing Digital SC", amount: 5000, date: "2024-03-05", status: 'paid', poNumber: "5520", description: "SEO Optimization Q1", auditScore: 98, paymentRoute: 'cash' },

  // Proveedor 6: Consultores Asociados
  { id: "FAC-06-P1", providerId: "PROV-006", provider: "Consultores Asociados", amount: 25000, date: "2024-04-10", status: 'pending', poNumber: "15601", description: "Auditoría Financiera" },
  { id: "FAC-06-P2", providerId: "PROV-006", provider: "Consultores Asociados", amount: 15000, date: "2024-04-15", status: 'pending', poNumber: "15602", description: "Planeación Fiscal 2024" },
  { id: "FAC-06-P3", providerId: "PROV-006", provider: "Consultores Asociados", amount: 10000, date: "2024-04-20", status: 'pending', poNumber: "15603", description: "Análisis de Riesgos" },
  { id: "FAC-06-C1", providerId: "PROV-006", provider: "Consultores Asociados", amount: 45000, date: "2023-11-20", status: 'paid', poNumber: "4401", description: "Valuación de Activos", auditScore: 100, paymentRoute: 'fintech' },
  { id: "FAC-06-C2", providerId: "PROV-006", provider: "Consultores Asociados", amount: 22000, date: "2024-01-15", status: 'paid', poNumber: "4415", description: "Consultoría de Procesos", auditScore: 97, paymentRoute: 'cash' },

  // Proveedor 7: Seguridad Integral MX
  { id: "FAC-07-P1", providerId: "PROV-007", provider: "Seguridad Integral MX", amount: 55000, date: "2024-04-01", status: 'pending', poNumber: "16701", description: "Vigilancia CDMX" },
  { id: "FAC-07-P2", providerId: "PROV-007", provider: "Seguridad Integral MX", amount: 55000, date: "2024-04-15", status: 'pending', poNumber: "16702", description: "Vigilancia Plantas Qro" },
  { id: "FAC-07-P3", providerId: "PROV-007", provider: "Seguridad Integral MX", amount: 12000, date: "2024-04-20", status: 'pending', poNumber: "16703", description: "Mantenimiento CCTV" },
  { id: "FAC-07-C1", providerId: "PROV-007", provider: "Seguridad Integral MX", amount: 110000, date: "2024-03-10", status: 'paid', poNumber: "3301", description: "Contrato Anual Escoltas", auditScore: 99, paymentRoute: 'fintech' },
  { id: "FAC-07-C2", providerId: "PROV-007", provider: "Seguridad Integral MX", amount: 4500, date: "2024-02-28", status: 'paid', poNumber: "3320", description: "Botones de Pánico", auditScore: 100, paymentRoute: 'cash' },

  // Proveedor 8: Recursos Humanos Express
  { id: "FAC-08-P1", providerId: "PROV-008", provider: "Recursos Humanos Express", amount: 8500, date: "2024-04-10", status: 'pending', poNumber: "17801", description: "Headhunting Director TI" },
  { id: "FAC-08-P2", providerId: "PROV-008", provider: "Recursos Humanos Express", amount: 4200, date: "2024-04-12", status: 'pending', poNumber: "17802", description: "Estudios Socioeconómicos" },
  { id: "FAC-08-P3", providerId: "PROV-008", provider: "Recursos Humanos Express", amount: 12000, date: "2024-04-15", status: 'pending', poNumber: "17803", description: "Capacitación Liderazgo" },
  { id: "FAC-08-P4", providerId: "PROV-008", provider: "Recursos Humanos Express", amount: 7500, date: "2024-04-20", status: 'pending', poNumber: "17804", description: "Exámenes Médicos Ingreso" },
  { id: "FAC-08-C1", providerId: "PROV-008", provider: "Recursos Humanos Express", amount: 50000, date: "2024-01-30", status: 'paid', poNumber: "2201", description: "Outsourcing Q1", auditScore: 94, paymentRoute: 'fintech' },
  { id: "FAC-08-C2", providerId: "PROV-008", provider: "Recursos Humanos Express", amount: 3500, date: "2024-02-15", status: 'paid', poNumber: "2215", description: "Uniformes Personal", auditScore: 100, paymentRoute: 'cash' },

  // Proveedor 9: Papelería y Oficina
  { id: "FAC-09-P1", providerId: "PROV-009", provider: "Papelería y Oficina", amount: 4200, date: "2024-04-10", status: 'pending', poNumber: "18901", description: "Hojas Blancas y Tóner" },
  { id: "FAC-09-P2", providerId: "PROV-009", provider: "Papelería y Oficina", amount: 1500, date: "2024-04-15", status: 'pending', poNumber: "18902", description: "Archiveros Metálicos" },
  { id: "FAC-09-P3", providerId: "PROV-009", provider: "Papelería y Oficina", amount: 800, date: "2024-04-20", status: 'pending', poNumber: "18903", description: "Cafetería y Despensa" },
  { id: "FAC-09-C1", providerId: "PROV-009", provider: "Papelería y Oficina", amount: 12000, date: "2024-01-10", status: 'paid', poNumber: "1101", description: "Sillas Ergonómicas", auditScore: 98, paymentRoute: 'fintech' },
  { id: "FAC-09-C2", providerId: "PROV-009", provider: "Papelería y Oficina", amount: 2500, date: "2024-02-05", status: 'paid', poNumber: "1120", description: "Escritorios Gerencia", auditScore: 100, paymentRoute: 'cash' },

  // Proveedor 10: Limpieza Profunda
  { id: "FAC-10-P1", providerId: "PROV-010", provider: "Limpieza Profunda", amount: 18000, date: "2024-04-15", status: 'pending', poNumber: "19001", description: "Limpieza Industrial Planta" },
  { id: "FAC-10-P2", providerId: "PROV-010", provider: "Limpieza Profunda", amount: 4500, date: "2024-04-18", status: 'pending', poNumber: "19002", description: "Insumos Sanitizantes" },
  { id: "FAC-10-P3", providerId: "PROV-010", provider: "Limpieza Profunda", amount: 7200, date: "2024-04-20", status: 'pending', poNumber: "19003", description: "Limpieza de Vidrios Altura" },
  { id: "FAC-10-C1", providerId: "PROV-010", provider: "Limpieza Profunda", amount: 22000, date: "2024-01-15", status: 'paid', poNumber: "0010", description: "Fumigación General", auditScore: 96, paymentRoute: 'fintech' },
  { id: "FAC-10-C2", providerId: "PROV-010", provider: "Limpieza Profunda", amount: 12000, date: "2024-02-15", status: 'paid', poNumber: "0020", description: "Lavado de Alfombras", auditScore: 100, paymentRoute: 'cash' },

  // Proveedor 11: Transportes Express
  { id: "FAC-11-P1", providerId: "PROV-011", provider: "Transportes Express", amount: 3500, date: "2024-04-10", status: 'pending', poNumber: "20101", description: "Mensajería Urgente" },
  { id: "FAC-11-P2", providerId: "PROV-011", provider: "Transportes Express", amount: 1200, date: "2024-04-12", status: 'pending', poNumber: "20102", description: "Distribución Guadalajara" },
  { id: "FAC-11-P3", providerId: "PROV-011", provider: "Transportes Express", amount: 8000, date: "2024-04-15", status: 'pending', poNumber: "20103", description: "Seguro de Carga" },
  { id: "FAC-11-C1", providerId: "PROV-011", provider: "Transportes Express", amount: 15000, date: "2024-01-20", status: 'paid', poNumber: "0111", description: "Paquetería Internacional", auditScore: 99, paymentRoute: 'fintech' },
  { id: "FAC-11-C2", providerId: "PROV-011", provider: "Transportes Express", amount: 5000, date: "2024-02-25", status: 'paid', poNumber: "0122", description: "Caja Seca Monterrey", auditScore: 100, paymentRoute: 'cash' },

  // Proveedor 12: Software & Cloud
  { id: "FAC-12-P1", providerId: "PROV-012", provider: "Software & Cloud", amount: 12400, date: "2024-04-05", status: 'pending', poNumber: "21201", description: "Consumo Azure Abril" },
  { id: "FAC-12-P2", providerId: "PROV-012", provider: "Software & Cloud", amount: 3500, date: "2024-04-10", status: 'pending', poNumber: "21202", description: "Certificado SSL Anual" },
  { id: "FAC-12-P3", providerId: "PROV-012", provider: "Software & Cloud", amount: 18000, date: "2024-04-15", status: 'pending', poNumber: "21203", description: "Backup de Datos" },
  { id: "FAC-12-C1", providerId: "PROV-012", provider: "Software & Cloud", amount: 50000, date: "2023-12-20", status: 'paid', poNumber: "0212", description: "Licenciamiento Oracle", auditScore: 100, paymentRoute: 'fintech' },
  { id: "FAC-12-C2", providerId: "PROV-012", provider: "Software & Cloud", amount: 15000, date: "2024-01-15", status: 'paid', poNumber: "0225", description: "Soporte Infraestructura", auditScore: 97, paymentRoute: 'cash' },

  // Proveedor 13: Construcciones Modernas
  { id: "FAC-13-P1", providerId: "PROV-013", provider: "Construcciones Modernas", amount: 45000, date: "2024-04-01", status: 'pending', poNumber: "22301", description: "Ampliación Bodega A" },
  { id: "FAC-13-P2", providerId: "PROV-013", provider: "Construcciones Modernas", amount: 12000, date: "2024-04-10", status: 'pending', poNumber: "22302", description: "Aplanados y Yeso" },
  { id: "FAC-13-P3", providerId: "PROV-013", provider: "Construcciones Modernas", amount: 8500, date: "2024-04-15", status: 'pending', poNumber: "22303", description: "Impermeabilización" },
  { id: "FAC-13-C1", providerId: "PROV-013", provider: "Construcciones Modernas", amount: 150000, date: "2023-10-01", status: 'paid', poNumber: "0313", description: "Cimentación Nave Industrial", auditScore: 98, paymentRoute: 'fintech' },
  { id: "FAC-13-C2", providerId: "PROV-013", provider: "Construcciones Modernas", amount: 25000, date: "2024-02-10", status: 'paid', poNumber: "0326", description: "Cerramiento Perimetral", auditScore: 100, paymentRoute: 'cash' },

  // Proveedor 14: Servicios Legales Torres
  { id: "FAC-14-P1", providerId: "PROV-014", provider: "Servicios Legales Torres", amount: 15000, date: "2024-04-10", status: 'pending', poNumber: "23401", description: "Juicio Mercantil X" },
  { id: "FAC-14-P2", providerId: "PROV-014", provider: "Servicios Legales Torres", amount: 8000, date: "2024-04-15", status: 'pending', poNumber: "23402", description: "Asesoría Laboral" },
  { id: "FAC-14-P3", providerId: "PROV-014", provider: "Servicios Legales Torres", amount: 22000, date: "2024-04-20", status: 'pending', poNumber: "23403", description: "Registro de Marcas" },
  { id: "FAC-14-C1", providerId: "PROV-014", provider: "Servicios Legales Torres", amount: 35000, date: "2024-01-15", status: 'paid', poNumber: "0414", description: "Constitución Subsidiaria", auditScore: 100, paymentRoute: 'fintech' },
  { id: "FAC-14-C2", providerId: "PROV-014", provider: "Servicios Legales Torres", amount: 12000, date: "2024-02-28", status: 'paid', poNumber: "0428", description: "Poderes Notariales", auditScore: 99, paymentRoute: 'cash' },

  // Proveedor 15: Insumos Médicos SA
  { id: "FAC-15-P1", providerId: "PROV-015", provider: "Insumos Médicos SA", amount: 5400, date: "2024-04-26", status: 'pending', poNumber: "10050", description: "Gel Antibacterial" },
  { id: "FAC-15-P2", providerId: "PROV-015", provider: "Insumos Médicos SA", amount: 2500, date: "2024-04-28", status: 'pending', poNumber: "10051", description: "Guantes de Nitrilo" },
  { id: "FAC-15-P3", providerId: "PROV-015", provider: "Insumos Médicos SA", amount: 3800, date: "2024-05-02", status: 'pending', poNumber: "10052", description: "Batas Desechables" },
  { id: "FAC-15-C1", providerId: "PROV-015", provider: "Insumos Médicos SA", amount: 12000, date: "2024-03-05", status: 'paid', poNumber: "0515", description: "Equipo de Emergencia", auditScore: 98, paymentRoute: 'fintech' },
  { id: "FAC-15-C2", providerId: "PROV-015", provider: "Insumos Médicos SA", amount: 4500, date: "2024-03-20", status: 'paid', poNumber: "0520", description: "Reposición Botiquines", auditScore: 100, paymentRoute: 'cash' },
  { id: "FAC-AI-01", providerId: "PROV-001", provider: "Logística Global SA", amount: 85400, date: "2024-04-01", status: 'audited', poNumber: "90001", description: "Consolidación de Carga Q1", auditScore: 100, forensicStatus: 'VALIDATED', signatures: 2 },
  { id: "FAC-AI-02", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 3500, date: "2024-04-02", status: 'audited', poNumber: "90002", description: "Soporte Incidencia Nivel 3", auditScore: 100, forensicStatus: 'VALIDATED', signatures: 2 },
  { id: "FAC-AI-03", providerId: "PROV-012", provider: "Software & Cloud", amount: 92000, date: "2024-04-25", status: 'audited', poNumber: "90003", description: "Renovación Anual Licencias", auditScore: 100, forensicStatus: 'VALIDATED', signatures: 2 },
  { id: "FAC-DISC-001", providerId: "PROV-002", provider: "Suministros Industriales", amount: 15600, date: "2024-04-10", status: 'pending', poNumber: "11220", description: "Filtros de Aire Premium", auditScore: 75, forensicStatus: 'DISCREPANCY', forensicSolution: 'Se requiere subir comprobante de actualización de precios o nota de crédito por la diferencia.', auditAnalysis: 'Variación de precio +12% detectada vs historial.' },
  { id: "FAC-BLOC-001", providerId: "PROV-001", provider: "Logística Global SA", amount: 12000, date: "2024-04-22", status: 'pending', poNumber: "10101", description: "Flete Internacional DUPLICADO", auditScore: 0, forensicStatus: 'BLOCKED', forensicSolution: 'Eliminar esta factura del sistema o contactar al proveedor para aclaración de duplicidad.', auditAnalysis: 'DUPLICADO DETECTADO: El número de factura ya existe en el registro histórico.' },
  { id: "FAC-AUTH-001", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 6200, date: "2024-04-24", status: 'audited', poNumber: "13410", description: "Mantenimiento AC", auditScore: 83, forensicStatus: 'VALIDATED', signatures: 1 },
  { id: "FAC-03-A1", providerId: "PROV-003", provider: "Tech Solutions MX", amount: 12500, date: "2024-04-20", status: 'audited', poNumber: "12310", description: "Infraestructura Cloud Q2", auditScore: 83, forensicStatus: 'VALIDATED', signatures: 1 },
  { id: "FAC-07-A1", providerId: "PROV-007", provider: "Seguridad Integral MX", amount: 45000, date: "2024-04-18", status: 'audited', poNumber: "16710", description: "Servicios de Patrullaje", auditScore: 100, forensicStatus: 'VALIDATED', signatures: 2 },
  { id: "FAC-01-A1", providerId: "PROV-001", provider: "Logística Global SA", amount: 18400, date: "2024-04-22", status: 'audited', poNumber: "10120", description: "Distribución Multimodal", auditScore: 100, forensicStatus: 'VALIDATED', signatures: 2 },
  { id: "FAC-04-A1", providerId: "PROV-004", provider: "Mantenimiento Pro", amount: 6200, date: "2024-04-24", status: 'audited', poNumber: "13410", description: "Mantenimiento AC", auditScore: 83, forensicStatus: 'VALIDATED', signatures: 1 },
  { id: "FAC-02-A1", providerId: "PROV-002", provider: "Suministros Industriales", amount: 12000, date: "2024-04-25", status: 'audited', poNumber: "11220", description: "Refacciones Críticas", auditScore: 100, forensicStatus: 'VALIDATED', signatures: 2 },
  { id: "FAC-06-A2", providerId: "PROV-006", provider: "Papelería Central", amount: 3500, date: "2024-04-26", status: 'audited', poNumber: "15520", description: "Insumos Oficina", auditScore: 83, forensicStatus: 'VALIDATED', signatures: 1 },
].map((inv, idx) => {
  const h = inv.id.replace(/[^a-zA-Z0-9]/g, '').padEnd(8, '0').slice(0, 8);
  const n = String(idx + 1).padStart(4, '0');
  const cfdiUUID = `${h}-${n}-4${String((idx * 7) % 1000).padStart(3, '0')}-a${String((idx * 13) % 1000).padStart(3, '0')}-${h}${n}`.toUpperCase();
  return { ...inv, cfdiUUID } as Invoice;
});
