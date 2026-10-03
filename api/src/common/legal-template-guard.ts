import { BadRequestException } from '@nestjs/common';

/**
 * FR-10 (spec "Mejoras V1", sección "Alertas de Cumplimiento y Buenas
 * Prácticas"): "El motor de plantillas restringirá la edición de campos
 * legales sensibles, permitiendo solo la concatenación de variables
 * dinámicas (Nombre, Monto, Fecha) en estructuras aprobadas por el área
 * jurídica."
 *
 * Interpretación implementada (Royáltica no tiene un área jurídica propia
 * que "apruebe" estructuras desde una UI en V1, así que el motor de
 * plantillas aplica la regla de forma automática y conservadora):
 *
 *  1. Lista blanca de variables dinámicas: solo {{customerName}}, {{amount}},
 *     {{dueDate}}, {{daysOverdue}} (ver message-template.util.ts). Cualquier
 *     otro placeholder `{{...}}` se rechaza — nadie puede inyectar campos no
 *     previstos por el motor de renderizado.
 *  2. Lista negra de lenguaje de alto riesgo legal en cobranza en México
 *     (prácticas que CONDUSEF/PROFECO consideran abusivas o que exponen a la
 *     organización a responsabilidad civil/penal): amenazas de violencia,
 *     amenazas de acción penal por una deuda civil, amenazas de exhibición
 *     pública/a terceros (vecinos, trabajo, redes sociales), y afirmaciones
 *     de que ya existe una acción legal en curso cuando el motor no tiene
 *     forma de verificarlo. Si el texto de la plantilla contiene alguna de
 *     estas expresiones, se rechaza con el motivo explícito.
 */

const ALLOWED_PLACEHOLDER_RE = /\{\{\s*(customerName|amount|dueDate|daysOverdue)\s*\}\}/gi;
const ANY_PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Frases/patrones de alto riesgo legal, agrupadas por motivo (para el
 * mensaje de error). Case-insensitive, sin distinguir acentos. */
const FORBIDDEN_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  {
    reason: 'amenaza de violencia o daño físico',
    pattern: /\b(te vamos a (golpear|lastimar|romper)|violencia física|mandaremos a alguien a tu casa)\b/i,
  },
  {
    reason: 'amenaza de acción penal por una deuda civil (prohibido: el impago de una deuda civil no es delito en México)',
    pattern: /(c[aá]rcel|orden de aprehensión|proceso penal|demanda penal|arresto inminente)/i,
  },
  {
    reason: 'amenaza de exhibición pública o a terceros ajenos a la deuda',
    pattern: /(avisaremos a tu (jefe|familia|vecinos)|publicaremos tu deuda|exhibi(remos|ción) (pública|en redes))/i,
  },
  {
    reason: 'afirmación de una acción legal ya iniciada que el motor no puede verificar automáticamente',
    pattern: /\b(ya (iniciamos|presentamos) (la )?demanda|tu caso ya está en los tribunales|orden judicial ya emitida)\b/i,
  },
];

export interface LegalTemplateViolation {
  type: 'UNAPPROVED_PLACEHOLDER' | 'FORBIDDEN_LANGUAGE';
  detail: string;
}

/** Revisa una plantilla y regresa las violaciones encontradas (vacío si es
 * válida). Expuesto por separado de assertLegalTemplateCompliant para poder
 * probarlo sin depender de excepciones de Nest en los tests unitarios. */
export function checkLegalTemplateCompliance(template: string): LegalTemplateViolation[] {
  const violations: LegalTemplateViolation[] = [];

  for (const match of template.matchAll(ANY_PLACEHOLDER_RE)) {
    const isAllowed = ALLOWED_PLACEHOLDER_RE.test(`{{${match[1]}}}`);
    ALLOWED_PLACEHOLDER_RE.lastIndex = 0; // regex global: resetear estado entre pruebas
    if (!isAllowed) {
      violations.push({
        type: 'UNAPPROVED_PLACEHOLDER',
        detail: `La variable "{{${match[1]}}}" no está en la lista aprobada (customerName, amount, dueDate, daysOverdue).`,
      });
    }
  }

  for (const { reason, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(template)) {
      violations.push({ type: 'FORBIDDEN_LANGUAGE', detail: reason });
    }
  }

  return violations;
}

/** Lanza BadRequestException si la plantilla viola FR-10. Se llama antes de
 * persistir messageTemplate en CollectionSequenceStep (create y update). */
export function assertLegalTemplateCompliant(template: string): void {
  const violations = checkLegalTemplateCompliance(template);
  if (violations.length === 0) return;
  throw new BadRequestException({
    message: 'La plantilla de mensaje no cumple con la regulación jurídica de cobranza (FR-10).',
    violations,
  });
}
