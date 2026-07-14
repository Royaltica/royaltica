# CLAUDE.md — Proyecto Royáltica

## Descripción del Proyecto
Royáltica es una plataforma fintech B2B de orquestación de pagos y auditoría fiscal automatizada para corporativos en México. Opera como una **capa de eficiencia** entre proveedores y el ERP corporativo (Aspel). NO interactúa directamente con el SAT ni realiza timbrado; delega esa responsabilidad al ERP del cliente.

## Stack Tecnológico
- **Frontend:** React 19 + TypeScript + Vite 6
- **Estilos:** TailwindCSS v4 (via `@tailwindcss/vite` plugin)
- **Animaciones:** Framer Motion (`motion` package)
- **Íconos:** Lucide React
- **Gráficas:** Recharts
- **IA:** Google Gemini API (`@google/genai`) para auditoría forense de facturas
- **Auth:** Firebase Auth (Google sign-in)
- **DB:** Firebase Firestore (configurado pero estado actual en memoria)

## Estructura de Archivos
```
/
├── index.html                    # Entry HTML
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript config (ES2022, bundler resolution)
├── vite.config.ts                # Vite config con TailwindCSS + React plugins
├── .env.example                  # Variables de entorno template
├── firebase-applet-config.json   # Firebase project config (pública, no sensible)
├── firestore.rules               # Reglas de seguridad Firestore
├── GUIA_INICIO.md                # Guía de inicio para el desarrollador
├── PRESUPUESTO_APIS.md           # Presupuesto de producción (referencia)
└── src/
    ├── main.tsx                  # Entry point React
    ├── App.tsx                   # ⚠️ ARCHIVO PRINCIPAL (~4800 líneas) — Contiene TODA la UI
    ├── ErrorBoundary.tsx         # Error boundary global
    ├── index.css                 # Estilos globales + design tokens
    ├── types.ts                  # Tipos TypeScript + datos mock (MOCK_INVOICES, MOCK_SUPPLIERS, etc.)
    ├── lib/
    │   └── firebase.ts           # Inicialización Firebase
    └── services/
        └── geminiService.ts      # Servicio de IA para auditoría forense (con fallback mock)
```

## Comandos
```bash
npm install          # Instalar dependencias
npm run dev          # Dev server en puerto 3000
npm run build        # Build de producción
npm run lint         # Type checking con tsc --noEmit
npm run clean        # Limpiar dist/
```

## Arquitectura de la App (App.tsx)
El archivo `App.tsx` es un monolito que contiene toda la lógica de la aplicación. Está organizado internamente así:

### Flujo de Navegación
1. **Pantalla de Selección de Rol** → "Corporativo" o "Proveedor"
2. **Portal Corporativo** (sidebar con pestañas):
   - Dashboard (estadísticas y gráficas)
   - Validación (IA Triple Match para facturas)
   - Facturas por Pagar (tesorería, selección múltiple, pagos)
   - Financiamiento (routing de pagos cash/fintech)
   - Auditoría (Motor REP PPD, DIOT, Webhooks ERP, Pagos Globales)
   - Configuración (expedientes de proveedores, KYC)
3. **Portal de Proveedores** (autenticación por RFC):
   - Dashboard del proveedor
   - Facturas (con importación ERP y selección múltiple)

### Servicios In-Memory (Simulados)
- `DualLoggerService` — Registro dual inmutable de eventos fiscales
- `REPMotorService` — Motor automático de Complementos de Pago (PPD)
- `DiotService` — Compilador de layouts TXT para la DIOT (estándar A29 SAT)
- `WebhookERPService` — Webhooks bancarios y conciliación con ERP
- `PagosGlobalesService` — Orquestador de pagos globales multi-proveedor

### Componentes Importantes
- `InvoiceDetailModal` — Modal reutilizable para ver respaldo fiscal de facturas
- `ImportInvoicesModal` — Simulación de importación desde ERP
- `SchedulePaymentModal` — Calendario para programar pagos
- `PendingInvoicesView` — Vista de tesorería con selección masiva (drag-select)
- `ProviderInvoicesView` — Vista de facturas del proveedor con multi-select

## Variables de Entorno
```
GEMINI_API_KEY=<tu_api_key>     # Para la IA de auditoría (opcional, hay fallback mock)
```

## Convenciones de Código
- **Idioma UI:** Español (México)
- **Design System:** Colores `brand-ink`, `brand-paper`, `brand-gold`, `brand-sand`, `brand-bone`, `brand-cream`
- **Tipografía:** Google Fonts — DM Serif Display (headers), Inter (body)
- **Estilo visual:** Editorial/luxury, bordes redondeados (2xl-3xl), glassmorphism sutil
- **Patrones:** Observer pattern para servicios reactivos, AnimatePresence para transiciones

## Estado Actual
- La app es 100% funcional como **demo/MVP frontend**
- Todos los datos son mocks en memoria (no persisten)
- La IA de auditoría funciona con Gemini API o en modo simulación
- Para producción se necesita: Backend (Node.js + PostgreSQL), integración real con Aspel, motor de pagos SPEI (STP), y OCR (Google Document AI)

## Notas para el Asistente de IA
- App.tsx es MUY grande (~4800 líneas). Usa búsquedas específicas antes de editar.
- Los tipos principales están en `types.ts` (Invoice, Supplier, etc.)
- Al editar, preservar siempre el design system existente (clases `brand-*`)
- Framer Motion se importa como `motion` desde el paquete `motion`
- El archivo usa `import React` implícito (React 19 JSX transform)
