import { render } from '@react-email/render';
import { DemoConfirmationEmail } from './DemoConfirmationEmail';

/**
 * Prueba de humo de la plantilla: renderiza a HTML real (no mock) y verifica
 * que el contenido variable llegue correctamente al output — esto es lo
 * único que realmente puede romperse en una plantilla JSX (un typo en un
 * prop, un condicional mal armado, etc.).
 */
describe('DemoConfirmationEmail', () => {
  it('incluye el nombre, la empresa y la fecha preferida cuando se proveen', async () => {
    const html = await render(
      DemoConfirmationEmail({
        name: 'María López',
        company: 'Grupo Tradespace',
        email: 'maria@tradespace.com',
        preferredDate: '2026-08-25',
        preferredTime: '10:00-12:00',
      }),
    );

    expect(html).toContain('María');
    expect(html).toContain('Grupo Tradespace');
    expect(html).toContain('2026-08-25');
    expect(html).toContain('10:00-12:00');
    expect(html).toContain('Royáltica');
  });

  it('omite la mención de fecha preferida cuando no se provee', async () => {
    const html = await render(
      DemoConfirmationEmail({
        name: 'Juan Pérez',
        company: 'Acme Inc',
        email: 'juan@acme.com',
      }),
    );

    expect(html).not.toContain('tomamos en cuenta');
    expect(html).toContain('Juan');
  });
});
