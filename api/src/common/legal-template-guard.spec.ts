import { BadRequestException } from '@nestjs/common';
import {
  assertLegalTemplateCompliant,
  checkLegalTemplateCompliance,
} from './legal-template-guard';

describe('legal-template-guard (FR-10, spec "Mejoras V1")', () => {
  it('acepta una plantilla con solo variables aprobadas y lenguaje neutro', () => {
    const template =
      'Hola {{customerName}}, tu saldo de {{amount}} venció el {{dueDate}} ({{daysOverdue}} días).';
    expect(checkLegalTemplateCompliance(template)).toEqual([]);
    expect(() => assertLegalTemplateCompliant(template)).not.toThrow();
  });

  it('rechaza una variable no aprobada ({{socialSecurityNumber}})', () => {
    const template = 'Hola {{customerName}}, tu CURP es {{socialSecurityNumber}}.';
    const violations = checkLegalTemplateCompliance(template);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('UNAPPROVED_PLACEHOLDER');
    expect(() => assertLegalTemplateCompliant(template)).toThrow(BadRequestException);
  });

  it('rechaza amenazas de acción penal por una deuda civil', () => {
    const template = 'Si no pagas {{amount}} hoy vas a la cárcel, {{customerName}}.';
    const violations = checkLegalTemplateCompliance(template);
    expect(violations.some((v) => v.type === 'FORBIDDEN_LANGUAGE')).toBe(true);
  });

  it('rechaza amenazas de exhibición pública/a terceros', () => {
    const template = 'Le avisaremos a tu jefe que debes {{amount}}, {{customerName}}.';
    const violations = checkLegalTemplateCompliance(template);
    expect(violations.some((v) => v.type === 'FORBIDDEN_LANGUAGE')).toBe(true);
  });

  it('acepta texto firme pero sin amenazas prohibidas', () => {
    const template =
      'Estimado {{customerName}}, tu factura por {{amount}} tiene {{daysOverdue}} días de atraso. Contáctanos para evitar recargos.';
    expect(checkLegalTemplateCompliance(template)).toEqual([]);
  });
});
