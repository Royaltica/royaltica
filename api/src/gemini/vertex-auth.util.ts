import { Logger } from '@nestjs/common';

const logger = new Logger('VertexAuth');

/**
 * Construye las opciones de autenticación de GCP para el SDK de Vertex AI
 * a partir de las variables de entorno disponibles.
 *
 * Soporta dos formas de pasar la credencial de la cuenta de servicio:
 *
 * 1. `VERTEX_KEY_JSON`: el contenido COMPLETO del archivo JSON de la
 *    cuenta de servicio, como string, en una sola variable de entorno.
 *    Es la forma recomendada en plataformas como Railway, donde no hay
 *    manera sencilla de montar un archivo en disco — se pega el JSON
 *    completo como valor de la variable y aquí se parsea.
 * 2. `VERTEX_KEY_FILE`: ruta a un archivo JSON en disco. Útil en
 *    desarrollo local, donde sí es fácil tener el archivo descargado
 *    en el filesystem.
 *
 * Si no hay ninguna de las dos, se devuelve `undefined` y el SDK cae de
 * vuelta a Application Default Credentials (ADC) — funciona solo si el
 * proceso ya corre en un entorno de GCP con identidad propia, que no es
 * el caso de un despliegue en Railway.
 */
export function buildVertexAuthOptions(
  keyJson: string | undefined,
  keyFile: string | undefined,
): { credentials: Record<string, unknown> } | { keyFilename: string } | undefined {
  if (keyJson) {
    try {
      const credentials = JSON.parse(keyJson) as Record<string, unknown>;
      return { credentials };
    } catch {
      logger.error(
        'VERTEX_KEY_JSON está configurado pero no es JSON válido. ' +
          'Verifica que se haya pegado el contenido completo del archivo ' +
          'de la cuenta de servicio, sin recortar ni escapar de más.',
      );
      return undefined;
    }
  }
  if (keyFile) {
    return { keyFilename: keyFile };
  }
  return undefined;
}
