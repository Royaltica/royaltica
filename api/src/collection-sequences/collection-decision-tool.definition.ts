import type { FunctionDeclaration } from '@google-cloud/vertexai';

/**
 * Única función que Gemini puede invocar en una llamada de decisión autónoma
 * de cobranza. Se fuerza con toolConfig.functionCallingConfig.mode = 'ANY'
 * (ver GeminiService.generateFunctionCall), de modo que el modelo SIEMPRE
 * responde con esta forma estructurada en vez de prosa libre — igual que
 * AI_TOOL_DECLARATIONS fuerza las herramientas del chat, pero aquí solo hay
 * una función posible y es obligatoria.
 */
const T = {
  STRING: 'string',
  OBJECT: 'object',
} as const;

export const EMIT_DECISION_TOOL = {
  name: 'emit_decision',
  description:
    'Emite la decisión final sobre qué hacer con este contacto de cobranza: ' +
    'enviar el mensaje (con el canal/tono sugerido o el del paso configurado), ' +
    'esperar sin contactar (HOLD), o escalar a una persona del equipo de ' +
    'cobranza (ESCALATE). Debes invocar esta función exactamente una vez.',
  parameters: {
    type: T.OBJECT,
    properties: {
      action: {
        type: T.STRING,
        enum: ['SEND', 'HOLD', 'ESCALATE'],
        description:
          'SEND = enviar el mensaje de cobranza ahora. HOLD = no contactar ' +
          'en esta corrida (ej. la relación es valiosa y presionar más podría ' +
          'dañarla, o el cliente ya está gestionando el pago). ESCALATE = ' +
          'este caso requiere el criterio de una persona del equipo de ' +
          'cobranza (montos altos, atraso severo, cliente de alto valor o ' +
          'riesgo evidente de romper la relación).',
      },
      channel: {
        type: T.STRING,
        enum: ['EMAIL', 'WHATSAPP', 'SMS', 'PHONE'],
        description:
          'Solo si action=SEND y sugieres CAMBIAR el canal configurado en el ' +
          'paso de la secuencia. Omite este campo para usar el canal por ' +
          'defecto del paso. NUNCA sugieras un canal o momento fuera de la ' +
          'ventana horaria permitida ni en una fecha de blackout: eso lo ' +
          'valida el sistema de todas formas, pero tu sugerencia debe ya ' +
          'respetarlo.',
      },
      tone: {
        type: T.STRING,
        enum: ['GENTLE', 'STANDARD', 'FIRM', 'URGENT'],
        description:
          'Solo si action=SEND y sugieres CAMBIAR el tono configurado en el ' +
          'paso. Omite este campo para usar el tono por defecto del paso. ' +
          'Calibra según el historial de pago y el valor/antigüedad de la ' +
          'relación: un buen pagador con un atraso puntual amerita GENTLE o ' +
          'STANDARD; solo usa FIRM/URGENT con evidencia real de morosidad ' +
          'recurrente.',
      },
      reasoning: {
        type: T.STRING,
        description:
          'Explicación breve (1-3 oraciones) y concreta de la decisión, ' +
          'basada ÚNICAMENTE en los datos numéricos del contexto que recibiste ' +
          '(días de atraso, % de puntualidad histórica, monto, riesgo, valor ' +
          'de la relación). Se guarda tal cual en el registro de auditoría.',
      },
    },
    required: ['action', 'reasoning'],
  },
} as unknown as FunctionDeclaration;
