/**
 * Traduce el error que devuelve la API de WhatsApp (Meta) a una causa y un
 * siguiente paso en español, para mostrarlo en pantalla sin tener que ir a
 * los registros del servidor. Lista de códigos:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export interface MetaSendError {
  /** Código de Meta (131030, 132001…) o el HTTP si no vino uno. */
  code: number | null;
  /** Qué pasó y qué hacer, en español. */
  message: string;
  /** Texto original de Meta (corto), por si hace falta soporte. */
  detail: string | null;
}

/** Error de la API de Meta con su respuesta ya leída (lo lanza sendViaMeta/sendTemplate). */
export class MetaApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Meta API respondió ${status}: ${body}`);
  }
}

const POR_CODIGO: Record<number, string> = {
  131030:
    'Ese número no está en la lista de destinatarios permitidos de tu cuenta de prueba de Meta. Agrégalo en Meta → WhatsApp → Configuración de la API, o usa un número de producción.',
  131026: 'No se pudo entregar: el número no tiene WhatsApp o no es válido.',
  131047:
    'Pasaron más de 24 horas desde que el cliente escribió: solo se puede enviar una plantilla, no texto libre.',
  131042: 'Tu cuenta de WhatsApp Business no tiene un método de pago configurado en Meta (se necesita para enviar plantillas).',
  131031: 'Tu cuenta de WhatsApp Business está bloqueada por Meta. Revísala en el Administrador de WhatsApp.',
  131056: 'Se mandaron demasiados mensajes seguidos a ese mismo número. Espera unos minutos.',
  132000: 'La plantilla espera un número distinto de variables al que se mandó.',
  132001: 'La plantilla no existe con ese nombre e idioma (es_MX) en tu cuenta de Meta. Revisa que el nombre sea idéntico y que esté aprobada.',
  132005: 'El texto de la plantilla, ya con los datos, es demasiado largo.',
  132007: 'La plantilla viola las políticas de formato de Meta.',
  132012: 'Alguna variable de la plantilla tiene un formato que Meta no acepta (por ejemplo saltos de línea o espacios de más).',
  132015: 'La plantilla está pausada por Meta (baja calidad).',
  132016: 'La plantilla está desactivada por Meta.',
  133010: 'El número de WhatsApp de la empresa no está registrado. Revísalo en Meta.',
  130429: 'Se alcanzó el límite de mensajes por segundo. Intenta de nuevo en un momento.',
  80007: 'Se alcanzó el límite de uso de la API de Meta. Intenta más tarde.',
  368: 'Meta bloqueó temporalmente el envío por políticas de la cuenta.',
};

export function describeMetaError(status: number, body: string): MetaSendError {
  let code: number | null = null;
  let detail: string | null = null;
  try {
    const e = (JSON.parse(body) as { error?: { code?: number; message?: string; error_data?: { details?: string } } }).error;
    if (e) {
      code = typeof e.code === 'number' ? e.code : null;
      detail = (e.error_data?.details ?? e.message ?? null)?.slice(0, 240) ?? null;
    }
  } catch {
    detail = body.slice(0, 240) || null;
  }

  if (code !== null && POR_CODIGO[code]) return { code, message: POR_CODIGO[code], detail };

  // Token: Meta usa 190 (vencido/ inválido), 401 HTTP, o subcódigos 463/467.
  if (code === 190 || status === 401) {
    return {
      code: code ?? status,
      message: 'El token de WhatsApp es inválido o venció. Los tokens temporales duran 24 horas: genera uno permanente (usuario del sistema) y actualiza WHATSAPP_TOKEN.',
      detail,
    };
  }
  // 100 con "does not exist" suele ser el Phone ID equivocado o sin permiso.
  if (code === 100 && /does not exist|cannot be loaded|missing permissions/i.test(detail ?? '')) {
    return {
      code,
      message: 'Meta no encontró el número de WhatsApp (Phone ID) o el token no tiene permiso sobre él. Revisa WHATSAPP_PHONE_ID y que el token sea de esa cuenta.',
      detail,
    };
  }
  return {
    code: code ?? status,
    message: `Meta rechazó el mensaje${code ? ` (código ${code})` : ` (HTTP ${status})`}.`,
    detail,
  };
}
