import { COLLECTION_TEMPLATES, DEBTOR_TYPE_TEMPLATES } from './collection-templates';

describe('plantillas de WhatsApp (fuente de verdad)', () => {
  const todas = [...COLLECTION_TEMPLATES, ...DEBTOR_TYPE_TEMPLATES];

  it.each(todas.map((t) => [t.name, t] as const))('%s: las variables {{n}} coinciden con vars', (_n, t) => {
    const usados = [...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    expect([...new Set(usados)].sort((a, b) => a - b)).toEqual(t.vars.map((_, i) => i + 1));
  });

  it('los nombres no se repiten', () => {
    expect(new Set(todas.map((t) => t.name)).size).toBe(todas.length);
  });

  it('hay dos plantillas (previo y vencida) por cada tipo de deudor del piloto', () => {
    const porTipo = new Map<string, string[]>();
    for (const t of DEBTOR_TYPE_TEMPLATES) porTipo.set(t.debtorType, [...(porTipo.get(t.debtorType) ?? []), t.stage]);
    expect(porTipo.size).toBe(5);
    for (const etapas of porTipo.values()) expect(etapas.sort()).toEqual(['previo', 'vencida']);
  });

  it.each(DEBTOR_TYPE_TEMPLATES.map((t) => [t.name, t] as const))('%s: dice de parte de quién y no usa lenguaje de presión', (_n, t) => {
    expect(t.vars).toContain('empresa');
    expect(t.body).not.toMatch(/deuda|adeudo|moros|descuento|oferta|urgente|último aviso|legal|suspen/i);
    expect(t.buttons.length).toBeLessThanOrEqual(3);
  });
});
