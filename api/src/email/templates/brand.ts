/**
 * Constantes de marca compartidas por todas las plantillas de correo.
 * Si cambia la identidad visual de Royáltica, se actualiza SOLO aquí y se
 * propaga a todos los correos transaccionales.
 */
export const BRAND = {
  name: 'Royáltica',
  tagline: 'Inteligencia de proveedores y cumplimiento fiscal.',
  colors: {
    gold: '#C9A961',
    goldDark: '#B08D3F',
    text: '#111111',
    textMuted: '#555555',
    textFaint: '#999999',
    border: '#E8E2D5',
    surface: '#F8F5EF',
    background: '#FFFFFF',
  },
  fontHeading: 'Georgia, "Times New Roman", serif',
  fontBody:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  logoUrl: 'https://app.royaltica.com/logo-email.png',
  siteUrl: 'https://royaltica.com',
} as const;
