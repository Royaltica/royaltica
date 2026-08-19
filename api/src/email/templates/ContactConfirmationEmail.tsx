import { Section, Text, Heading } from 'react-email';
import { Layout } from './Layout';
import { BRAND } from './brand';

export interface ContactConfirmationEmailProps {
  name: string;
  message: string;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** Confirmación cuando alguien envía el formulario de contacto (POST /marketing/contact). */
export function ContactConfirmationEmail({
  name,
  message,
}: ContactConfirmationEmailProps) {
  return (
    <Layout previewText={`Recibimos tu mensaje — el equipo de ${BRAND.name} te responderá pronto.`}>
      <Heading
        as="h1"
        style={{
          fontFamily: BRAND.fontHeading,
          fontWeight: 400,
          fontSize: '24px',
          textAlign: 'center',
          margin: '8px 0 20px',
          color: BRAND.colors.text,
        }}
      >
        Recibimos tu mensaje
      </Heading>

      <Text style={{ fontSize: '15px', lineHeight: '24px', color: BRAND.colors.text }}>
        Hola {firstName(name)}, gracias por escribirnos. Un miembro del
        equipo te responderá pronto al mismo correo desde el que enviaste tu
        consulta.
      </Text>

      <Section
        style={{
          backgroundColor: BRAND.colors.surface,
          borderRadius: '8px',
          padding: '16px 20px',
          margin: '20px 0',
        }}
      >
        <Text
          style={{
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontSize: '10px',
            color: BRAND.colors.textFaint,
            margin: '0 0 8px',
            fontWeight: 700,
          }}
        >
          Tu mensaje
        </Text>
        <Text style={{ fontSize: '13px', color: BRAND.colors.textMuted, whiteSpace: 'pre-wrap', margin: 0 }}>
          {message}
        </Text>
      </Section>

      <Text style={{ fontSize: '14px', color: BRAND.colors.text, marginTop: '24px' }}>
        — El equipo de {BRAND.name}
      </Text>
    </Layout>
  );
}
