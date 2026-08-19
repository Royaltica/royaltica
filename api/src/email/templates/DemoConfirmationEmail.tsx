import { Button, Heading, Section, Text } from 'react-email';
import { Layout } from './Layout';
import { BRAND } from './brand';

export interface DemoConfirmationEmailProps {
  name: string;
  company: string;
  email: string;
  preferredDate?: string;
  preferredTime?: string;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

const bullet = { margin: '0 0 10px', fontSize: '14px', lineHeight: '22px' };

/**
 * Correo de confirmación cuando alguien agenda una demo desde royaltica.com
 * (POST /marketing/demo). Reemplaza la plantilla de string plano anterior:
 * misma información, ahora con una plantilla React reutilizable/tipada,
 * consistente con el resto de correos vía `Layout`.
 */
export function DemoConfirmationEmail({
  name,
  company,
  preferredDate,
  preferredTime,
}: DemoConfirmationEmailProps) {
  return (
    <Layout
      previewText={`Gracias por tu interés en ${BRAND.name} — recibimos tu solicitud de demo.`}
      footerNote={`Este correo se envió porque solicitaste una demo en ${BRAND.siteUrl.replace('https://', '')} en representación de ${company}.`}
    >
      <Heading
        as="h1"
        style={{
          fontFamily: BRAND.fontHeading,
          fontWeight: 400,
          fontSize: '26px',
          textAlign: 'center',
          margin: '8px 0 20px',
          color: BRAND.colors.text,
        }}
      >
        Hola {firstName(name)} 👋
      </Heading>

      <Text style={{ fontSize: '15px', lineHeight: '24px', color: BRAND.colors.text }}>
        Gracias por tu interés en <strong>{BRAND.name}</strong>. Recibimos tu
        solicitud de demo para <strong>{company}</strong> y nuestro equipo te
        contactará dentro de las próximas <strong>24 horas hábiles</strong>{' '}
        para coordinar la sesión
        {preferredDate ? (
          <>
            {' '}
            (tomamos en cuenta tu preferencia del{' '}
            <strong>
              {preferredDate}
              {preferredTime ? ` ${preferredTime}` : ''}
            </strong>
            )
          </>
        ) : null}
        .
      </Text>

      <Section
        style={{
          backgroundColor: BRAND.colors.surface,
          borderRadius: '8px',
          padding: '20px 20px 4px',
          margin: '20px 0',
        }}
      >
        <Text
          style={{
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontSize: '11px',
            color: BRAND.colors.textMuted,
            margin: '0 0 12px',
            fontWeight: 700,
          }}
        >
          En la demo verás
        </Text>
        <Text style={bullet}>
          · Cómo Royáltica orquesta el flujo de aprobación de facturas y REP.
        </Text>
        <Text style={bullet}>
          · Automatización de DIOT y validación 69-B contra el SAT.
        </Text>
        <Text style={bullet}>
          · Portal de proveedores y auditoría forense con IA.
        </Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        <Button
          href={`${BRAND.siteUrl}/contacto`}
          style={{
            backgroundColor: BRAND.colors.gold,
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 700,
            padding: '13px 28px',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          ¿Necesitas mover la fecha?
        </Button>
      </Section>

      <Text
        style={{
          fontSize: '13px',
          color: BRAND.colors.textMuted,
          textAlign: 'center',
        }}
      >
        Si necesitas urgencia, puedes responder directo a este correo.
      </Text>

      <Text
        style={{
          fontSize: '14px',
          color: BRAND.colors.text,
          marginTop: '24px',
        }}
      >
        Un abrazo,
        <br />
        El equipo de {BRAND.name}
      </Text>
    </Layout>
  );
}
