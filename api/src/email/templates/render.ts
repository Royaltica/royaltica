import { render } from '@react-email/render';
import type { ReactElement } from 'react';

/**
 * Renderiza un componente de plantilla (JSX) a HTML + texto plano listos
 * para `EmailService.send()`. Centralizado aquí para que ningún módulo
 * tenga que importar `@react-email/render` directamente.
 */
export async function renderEmail(
  element: ReactElement,
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}
