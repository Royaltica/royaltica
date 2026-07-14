import type { GenerateContentResponse } from '@google-cloud/vertexai';

/** Concatena todas las partes de texto de la primera respuesta candidata. */
export function extractText(response: GenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? '')
    .join('')
    .trim();
}

/** Extrae las llamadas a función de la primera respuesta candidata. */
export function extractFunctionCalls(
  response: GenerateContentResponse,
): { name: string; args: unknown }[] {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => p.functionCall)
    .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args }));
}
