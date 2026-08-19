import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'react-email';
import { BRAND } from './brand';

export interface LayoutProps {
  /** Texto de preview que muestran los clientes de correo (Gmail, Apple Mail) junto al asunto. */
  previewText: string;
  children: React.ReactNode;
  /**
   * Pie de página adicional (ej. "Este correo se envió a X porque..."). Se
   * agrega DESPUÉS del pie estándar de marca.
   */
  footerNote?: React.ReactNode;
}

/**
 * Layout base reutilizable para TODOS los correos transaccionales de
 * Royáltica: header con wordmark de marca, contenedor centrado con ancho
 * fijo (560px, estándar para que se vea bien en cualquier cliente de
 * correo), y pie de página consistente.
 *
 * Se usa wordmark de texto (no <Img>) a propósito: el logo definitivo aún
 * no está listo (lo está armando el equipo de diseño), y un wordmark de
 * texto nunca se rompe por un link de imagen caído o bloqueado por el
 * cliente de correo.
 */
export function Layout({ previewText, children, footerNote }: LayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: BRAND.colors.surface,
          fontFamily: BRAND.fontBody,
          margin: 0,
          padding: '32px 16px',
        }}
      >
        <Container
          style={{
            backgroundColor: BRAND.colors.background,
            maxWidth: '560px',
            margin: '0 auto',
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${BRAND.colors.border}`,
          }}
        >
          <Section style={{ padding: '32px 32px 0', textAlign: 'center' }}>
            <Text
              style={{
                textTransform: 'uppercase',
                letterSpacing: '3px',
                fontSize: '12px',
                fontWeight: 700,
                color: BRAND.colors.gold,
                margin: 0,
              }}
            >
              {BRAND.name}
            </Text>
          </Section>

          <Section style={{ padding: '8px 32px 32px' }}>{children}</Section>

          <Hr
            style={{
              borderColor: BRAND.colors.border,
              margin: '0 32px',
            }}
          />

          <Section style={{ padding: '20px 32px 32px' }}>
            <Text
              style={{
                fontSize: '11px',
                color: BRAND.colors.textFaint,
                textAlign: 'center',
                margin: '0 0 4px',
              }}
            >
              {BRAND.name} · {BRAND.tagline}
            </Text>
            {footerNote && (
              <Text
                style={{
                  fontSize: '11px',
                  color: BRAND.colors.textFaint,
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                {footerNote}
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
