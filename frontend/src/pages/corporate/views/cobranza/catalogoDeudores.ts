// Catálogo de tipos de deudor (ROYALTICA · CxC deudores, versión 5, 3 nov 2026).
// Generado desde catalogo-deudores.html: 25 tipos con su ficha, mapa de
// empatía y plantillas por etapa. Las variables {{x}} se llenan al enviar.

export type CausaDeudor = 'nopuede' | 'noquiere' | 'friccion' | 'desacuerdo' | 'riesgo';

export type TipoDeudor = {
  id: string;
  seg: 'B2B' | 'B2C';
  name: string;
  causa: CausaDeudor;
  /** 'hoja' = venía en la hoja original; 'nuevo' = sugerido. */
  origen: 'hoja' | 'nuevo';
  mor: string;
  def: string;
  est: string[];
  sen: string[];
  tono: string;
  canal: string;
  who: string;
  ve: string[];
  esc: string[];
  pie: string[];
  sie: string[];
  hace: string[];
  dol: string[];
  nec: string;
  pal: string;
  evi: string;
  pla: {
    pre: string;
    hoy: string;
    a: string;
    b: string;
    c: { asunto: string; txt: string };
    d: string[];
    r: { si: string; resp: string };
    pnota?: string;
    /** El cliente no tiene folio a la mano (no reconoce la deuda). */
    noFolio?: boolean | string;
  };
};

export const CAUSAS: Record<CausaDeudor, { nombre: string; frase: string; color: string }> = {
  nopuede: { nombre: 'No puede', frase: 'Quiere, pero no tiene con qué.', color: '245 158 11' },
  noquiere: { nombre: 'No quiere', frase: 'Puede, pero decide no hacerlo.', color: '244 63 94' },
  friccion: { nombre: 'Fricción', frase: 'Puede y quiere, algo se interpone.', color: '14 165 233' },
  desacuerdo: { nombre: 'Desacuerdo', frase: 'No está de acuerdo con el cobro.', color: '139 92 246' },
  riesgo: { nombre: 'Riesgo', frase: 'Hay duda de que exista o responda.', color: '100 116 139' },
};

/** Valores de ejemplo para leer las plantillas como las recibiría el cliente. */
export const EJEMPLO_VARS: Record<string, string> = {
  contacto: 'Laura',
  empresa: 'Tu empresa',
  razon_social: 'Distribuidora Costa Azul',
  folio: 'F-1042',
  monto: '$12,500.00 MXN',
  saldo: '$6,250.00 MXN',
  fecha: '17 de noviembre',
  fecha_limite: '28 de noviembre',
  fecha_promesa: '20 de noviembre',
  liga: 'pago.royaltica.mx/f1042',
  dias: '20',
  telefono_oficial: '55 1234 5678',
  clabe: '0123 4567 8901 2345 67',
};

export const TIPOS_DEUDOR: TipoDeudor[] = [
 {
  "id": "fortuito-b2c",
  "seg": "B2C",
  "name": "Fortuito",
  "causa": "nopuede",
  "origen": "hoja",
  "mor": "Temporal",
  "def": "Quiere pagar pero no puede por factores externos: desempleo, salud, un imprevisto.",
  "est": [
   "Preguntar las razones.",
   "Empatizar.",
   "Llegar a pactos o negociaciones: prórroga con fecha, pago parcial inicial, plan de pagos."
  ],
  "sen": [
   "Historial limpio hasta hace poco.",
   "Responde y explica lo que pasó.",
   "El atraso empezó de golpe, no se acumuló."
  ],
  "tono": "Empático, orientado a solución",
  "canal": "WhatsApp, llamada",
  "who": "Quiere pagar pero un imprevisto (desempleo, salud, un gasto urgente) se lo impide.",
  "ve": [
   "El saldo de su cuenta casi en cero.",
   "Mensajes de cobro acumulándose.",
   "Gastos urgentes (renta, medicinas, comida) que compiten con la deuda."
  ],
  "esc": [
   "Familia: “primero lo básico”.",
   "Mensajes automáticos que no reconocen su situación.",
   "Conocidos que pasan por lo mismo."
  ],
  "pie": [
   "“Yo sí quiero pagar, solo necesito tiempo.”",
   "“Si les explico, ¿me van a entender o me van a presionar?”",
   "“En cuanto me estabilice, pago.”"
  ],
  "sie": [
   "Angustia y presión.",
   "Vergüenza de no cumplir.",
   "Alivio si alguien le ofrece una salida realista."
  ],
  "hace": [
   "Avisa o se disculpa cuando le preguntan con respeto.",
   "Paga lo que puede, aunque sea poco.",
   "Se aleja si siente que lo juzgan."
  ],
  "dol": [
   "Que lo traten como mal pagador.",
   "No ver una salida."
  ],
  "nec": "Un plan que pueda cumplir y que alguien reconozca lo que le pasó.",
  "pal": "Reconocer su situación y ofrecer opciones concretas: prórroga o plan de pagos.",
  "evi": "Reproches, amenazas o un mensaje idéntico al que recibe un moroso intencional.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, esperamos que todo marche bien. Le escribimos con tiempo: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si prefiere acomodar la fecha o dividir el pago, con gusto lo platicamos. ¿Cómo le resultaría mejor?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, ¿cómo va su día? Le escribimos por la factura {{folio}} por {{monto}}, cuya fecha de pago es hoy. Si le sirve, aquí puede revisarla: {{liga}}. Y si necesita otra opción de pago, aquí estamos para ayudarle.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, esperamos que se encuentre bien. Pasamos a saludarle por la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}}. Si surgió algún imprevisto, platíquenoslo: podemos buscar una fecha o forma de pago que le acomode. ¿Cómo le podemos ayudar?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, retomamos con gusto su factura {{folio}} por {{monto}}. Si por ahora no es posible cubrirla completa, podemos acordar pagos más pequeños. ¿Qué monto y qué fecha le resultarían más cómodos?",
   "c": {
    "asunto": "Revisemos juntos su factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, le escribimos sobre la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}} y {{dias}} días de atraso. Entendemos que pueden surgir imprevistos y preferimos acordar una solución que sí pueda cumplir. Responda a este correo con la fecha o el monto inicial que le resulte posible y lo dejamos documentado. Quedamos atentos. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Abrir con empatía: preguntar cómo está y qué ha pasado, sin interrumpir.",
    "Confirmar el saldo y proponer dos opciones: un monto inicial hoy o un plan en parcialidades.",
    "Cerrar con fecha y monto concretos y confirmarlos por WhatsApp."
   ],
   "r": {
    "si": "Perdí mi empleo, no puedo pagar ahorita.",
    "resp": "Gracias por contarnos, lamentamos la situación. Para ayudarle, ¿podría indicarnos qué monto o qué fecha sí podría cumplir? Con eso preparamos una propuesta y se la confirmamos."
   },
   "pnota": "Ofrecer planes de pago solo si el cliente de Royáltica los autorizó."
  }
 },
 {
  "id": "optimista-b2c",
  "seg": "B2C",
  "name": "Optimista",
  "causa": "noquiere",
  "origen": "hoja",
  "mor": "Crónica",
  "def": "Piensa que sí podría pagar sin cambiar sus hábitos: gasta y sigue pidiendo.",
  "est": [
   "Poner condiciones: puede seguir comprando o pidiendo solo si va pagando o saldando la deuda.",
   "Atar el límite de crédito al cumplimiento del pago."
  ],
  "sen": [
   "Pide más crédito o compras con saldo vencido.",
   "Paga mínimos o abonos pequeños.",
   "Promete pagar \"con la próxima quincena\"."
  ],
  "tono": "Firme y cordial",
  "canal": "WhatsApp",
  "who": "Cree que puede pagar sin cambiar sus hábitos: gasta y sigue pidiendo.",
  "ve": [
   "Su crédito disponible y compras recientes.",
   "Promociones que lo invitan a seguir comprando.",
   "El saldo vencido como un número “manejable”."
  ],
  "esc": [
   "Un entorno que normaliza vivir de crédito.",
   "Anuncios de “compra ahora, paga después”.",
   "Su propia voz: “ya mero cobro”."
  ],
  "pie": [
   "“Lo pago con la próxima quincena o el aguinaldo.”",
   "“No es tanto, puedo con esto.”",
   "“Si me quitan el crédito, me complican la vida.”"
  ],
  "sie": [
   "Confianza excesiva.",
   "Incomodidad leve cuando le recuerdan la deuda.",
   "Resistencia si le limitan el crédito."
  ],
  "hace": [
   "Sigue comprando mientras debe.",
   "Paga mínimos o parciales.",
   "Promete fechas optimistas."
  ],
  "dol": [
   "Que le restrinjan su consumo.",
   "Aceptar que su presupuesto no alcanza."
  ],
  "nec": "Ver con números que su ritmo de gasto no es sostenible, sin sentirse atacado.",
  "pal": "Condiciones claras y positivas: “sigue disfrutando de tu crédito si estás al corriente”.",
  "evi": "Sermones sobre sus hábitos, o aceptarle promesas sin condiciones.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos con tiempo: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Puede dejarla programada aquí: {{liga}}. ¿La deja agendada?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si ya la dejó lista, gracias; si no, aquí puede resolverla en un momento: {{liga}}. ¿Todo en orden?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, ¿cómo va todo? Queríamos confirmar si pudo revisar la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}}. Nos ayuda dejarla al corriente en nuestros registros. ¿Qué día le acomoda?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, retomamos la factura {{folio}} por {{monto}}. Nos ayuda dejar su cuenta al corriente. ¿En qué fecha podemos contar con su pago?",
   "c": {
    "asunto": "Su cuenta y la factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Le pedimos confirmar una fecha de pago esta semana; con eso dejamos su cuenta al corriente en nuestros registros. Si desea revisar las condiciones de su cuenta, una persona de {{empresa}} con gusto le atiende. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Reconocer lo positivo de la relación y plantear con claridad la política del cliente sobre nuevas compras, solo si existe por escrito.",
    "Mostrar el saldo y cuánto representa por quincena o por mes.",
    "Acordar fecha y monto y dejarlo por escrito."
   ],
   "r": {
    "si": "Pago con mi próxima quincena.",
    "resp": "Perfecto, gracias. ¿Nos confirma el día y el monto para dejarlo registrado?"
   },
   "pnota": "Mencionar el crédito solo si es política escrita del cliente de Royáltica, y con redacción neutra."
  }
 },
 {
  "id": "negador-b2c",
  "seg": "B2C",
  "name": "Negador",
  "causa": "noquiere",
  "origen": "hoja",
  "mor": "Crónica o estructural",
  "def": "Ignora las deudas y evita las llamadas.",
  "est": [
   "Cambiar de canal y mandar un mensaje corto con una sola acción (link o referencia de pago).",
   "Explicar las consecuencias reales y legales antes de ejecutarlas.",
   "Documentar cada intento de contacto."
  ],
  "sen": [
   "Cero respuestas tras 3 o más intentos.",
   "Mensajes leídos sin respuesta.",
   "Llamadas no contestadas."
  ],
  "tono": "Claro y sin amenazas",
  "canal": "Cambiar de canal; correo formal como respaldo",
  "who": "Ignora la deuda y evita llamadas y mensajes.",
  "ve": [
   "Notificaciones y llamadas que prefiere no abrir.",
   "El número de cobranza que ya reconoce.",
   "Su problema como algo que puede esperar."
  ],
  "esc": [
   "“No pasa nada si no pagas.”",
   "Conocidos que nunca fueron perseguidos.",
   "El silencio de su cabeza cuando evita pensar en eso."
  ],
  "pie": [
   "“Si no contesto, se les olvida.”",
   "“Ya lo veré después.”",
   "“Esto va a ser un trámite largo y molesto.”"
  ],
  "sie": [
   "Ansiedad que evita en lugar de enfrentar.",
   "Fastidio al ver el nombre del cobrador.",
   "Miedo difuso a las consecuencias."
  ],
  "hace": [
   "No contesta, bloquea o deja en visto.",
   "Responde solo cuando algo es inevitable."
  ],
  "dol": [
   "Sentirse perseguido.",
   "Enfrentar un número que no quiere ver."
  ],
  "nec": "Un solo paso fácil y claridad sobre qué pasa si no lo da.",
  "pal": "Mensaje corto con una sola acción y consecuencias reales explicadas con calma.",
  "evi": "Mensajes largos, insistencia a deshoras y amenazas que no se cumplen.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, un mensaje breve: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si le resulta práctico, aquí puede dejarla lista en un paso: {{liga}}. Con gusto le ayudamos si algo se complica.",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, solo para que lo tenga a la mano: hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Puede resolverla aquí en un minuto: {{liga}}. Si hay algo que lo impida, con gusto lo vemos.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, esperamos que esté bien. Intentamos saludarle por la factura {{folio}} por {{monto}}. Con una sola respuesta nos ayuda: ¿le acomoda más pagarla esta semana o prefiere que acordemos otra fecha?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, quedamos a sus órdenes para la factura {{folio}} por {{monto}}. Si hoy no es buen momento, díganos qué día le conviene que le escribamos y respetamos ese horario.",
   "c": {
    "asunto": "Seguimiento de la factura {{folio}} de {{empresa}}",
    "txt": "Estimado(a) {{contacto}}: le escribimos de parte de {{empresa}} sobre la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}}. Si ya la pagó, responda con su comprobante. Si no, puede indicarnos la fecha en que le sería posible pagarla o llamarnos al {{telefono_oficial}}. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Llamar en dos horarios distintos; si contesta, ser breve y claro.",
    "Decir qué ocurre y qué sigue, sin tono de reproche.",
    "Pedir un solo compromiso: fecha y medio de pago."
   ],
   "r": {
    "si": "Ahorita no puedo, luego les marco.",
    "resp": "Con gusto. Para no estar insistiendo, ¿qué día y a qué hora le acomoda que le escribamos o llamemos? Mientras tanto, dejamos aquí el enlace para cuando pueda: {{liga}}."
   },
   "pnota": "Documentar cada intento de contacto y respetar el horario de 8:00 a 21:00 y el tope de contactos por semana."
  }
 },
 {
  "id": "olvidadizo-b2c",
  "seg": "B2C",
  "name": "Olvidadizo",
  "causa": "friccion",
  "origen": "hoja",
  "mor": "Temporal",
  "def": "Tiene liquidez, pero se le olvida la fecha, cambió de correo o de tarjeta.",
  "est": [
   "Recordatorios amables y preventivos, antes del vencimiento.",
   "Link de pago directo.",
   "Actualizar sus datos de contacto; ofrecer domiciliación."
  ],
  "sen": [
   "Atraso de 1 a 7 días.",
   "Paga al primer recordatorio.",
   "Historial mayormente puntual."
  ],
  "tono": "Amable, ligero",
  "canal": "WhatsApp, correo",
  "who": "Tiene liquidez, pero se le pasó la fecha, cambió de correo o su tarjeta venció.",
  "ve": [
   "Una agenda llena de tareas diarias.",
   "Notificaciones que se pierden entre otras.",
   "Un correo viejo o una tarjeta que ya no usa."
  ],
  "esc": [
   "Poco: la cobranza llega a un canal que ya no revisa.",
   "Recordatorios de otras apps."
  ],
  "pie": [
   "“¿Ya pagué eso?”",
   "“¡Se me pasó!”",
   "“Mándame el link y lo pago ahorita.”"
  ],
  "sie": [
   "Pena leve.",
   "Alivio al ver que es fácil resolverlo."
  ],
  "hace": [
   "Paga casi de inmediato cuando le recuerdan.",
   "Pide el link o los datos otra vez."
  ],
  "dol": [
   "Que lo traten como moroso por un descuido.",
   "Tener que buscar datos para pagar."
  ],
  "nec": "Un recordatorio claro, a tiempo, con el pago a un clic.",
  "pal": "Ligereza y facilidad: recordatorio amable con link de pago.",
  "evi": "Tono de cobranza dura o formalidad innecesaria.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, un recordatorio amable: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Puede pagarla en un clic aquí: {{liga}}. ¡Gracias!",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, solo para recordarle que hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Aquí tiene el enlace: {{liga}}. Si ya la pagó, compártanos el comprobante y lo dejamos registrado. ¡Gracias!",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, a todos se nos pasa alguna fecha. Le dejamos a la mano la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}): {{liga}}. Si ya la pagó, compártanos el comprobante. ¿Sigue siendo este el mejor medio para contactarle?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, por si se le traspapeló, le reenviamos la factura {{folio}} por {{monto}}: {{liga}}. Si cambió de correo o de tarjeta, avísenos y actualizamos sus datos.",
   "c": {
    "asunto": "Recordatorio: factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, le recordamos que la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}) sigue abierta. Puede pagarla aquí: {{liga}}. Si ya realizó el pago, responda con su comprobante. Y si sus datos de contacto cambiaron, avísenos para actualizarlos. Gracias. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Llamada corta y amable; ofrecer enviar el enlace en ese momento.",
    "Confirmar su correo y su teléfono actuales.",
    "Ofrecer pago automático o recordatorios previos al vencimiento."
   ],
   "r": {
    "si": "¡Se me pasó! Mándame el link.",
    "resp": "Con gusto, aquí está: {{liga}}. Cuando pague, compártanos el comprobante y lo dejamos registrado. ¡Gracias, {{contacto}}!"
   }
  }
 },
 {
  "id": "insatisfecho-b2c",
  "seg": "B2C",
  "name": "Insatisfecho",
  "causa": "desacuerdo",
  "origen": "hoja",
  "mor": "Temporal",
  "def": "Frena el pago como protesta por una falla del producto o servicio.",
  "est": [
   "Identificar la causa.",
   "Llegar a una respuesta satisfactoria.",
   "Después se cobra. Pausar la cobranza mientras se resuelve."
  ],
  "sen": [
   "Menciona una queja o hay reclamo abierto.",
   "Paga parcial o nada después de un incidente."
  ],
  "tono": "Escucha y disculpa",
  "canal": "Llamada o WhatsApp con una persona",
  "who": "Frena el pago como protesta por una falla del producto o servicio.",
  "ve": [
   "La falla o el mal servicio que vivió.",
   "Evidencias: capturas, folios, correos sin respuesta.",
   "El cobro como un insulto adicional."
  ],
  "esc": [
   "Reseñas y quejas de otros clientes.",
   "Respuestas genéricas de atención al cliente.",
   "Amigos: “no pagues hasta que lo arreglen”."
  ],
  "pie": [
   "“¿Por qué voy a pagar algo que no funcionó?”",
   "“Ni me han respondido y ya me cobran.”",
   "“Quiero que alguien se haga cargo.”"
  ],
  "sie": [
   "Enojo.",
   "Sentirse ignorado.",
   "Disposición a pagar si lo escuchan."
  ],
  "hace": [
   "Reclama y adjunta evidencia.",
   "Retiene el pago como forma de presión."
  ],
  "dol": [
   "Que ignoren su queja.",
   "Que le cobren antes de resolver."
  ],
  "nec": "Que reconozcan la falla y la resuelvan primero.",
  "pal": "Escuchar, disculparse y resolver; cobrar después.",
  "evi": "Insistir en el cobro mientras la queja sigue abierta.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, esperamos que su servicio haya salido bien. La factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si hubo algún detalle que no quedó como esperaba, cuéntenos y lo atendemos primero. ¿Todo en orden?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Antes de cualquier cosa, queremos saber si su experiencia fue la esperada. Si hay algo por resolver, estamos para atenderle.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos para saber cómo le fue con el producto o servicio de la factura {{folio}} por {{monto}}. Si algo no quedó bien, cuéntenos para resolverlo de inmediato. Después vemos juntos lo demás con calma.",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, retomamos su caso. Nos gustaría dejar resuelto cualquier detalle con el servicio para cerrar la factura {{folio}} en orden. ¿Podemos llamarle hoy o mañana?",
   "c": {
    "asunto": "Atención a su comentario y factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, agradecemos su retroalimentación. Estamos dando seguimiento a su caso para darle una solución. Una vez resuelto, le pedimos regularizar la factura {{folio}} por {{monto}} ({{dias}} días de atraso). Quedamos atentos para acordar juntos cómo continuar. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Escuchar la queja completa y reconocerla; disculparse cuando proceda.",
    "Resolver o comprometer una solución con fecha.",
    "Solo después, acordar la fecha de pago de la factura."
   ],
   "r": {
    "si": "No voy a pagar hasta que arreglen el problema.",
    "resp": "Lamentamos que haya tenido esa experiencia. Cuéntenos qué ocurrió para canalizarlo con {{empresa}} y darle respuesta. Mientras no se resuelva, pausamos los recordatorios de esta factura."
   },
   "pnota": "Pausar los recordatorios automáticos mientras la queja siga abierta: requiere que el sistema lo haga."
  }
 },
 {
  "id": "intencional-b2c",
  "seg": "B2C",
  "name": "Intencional",
  "causa": "noquiere",
  "origen": "hoja",
  "mor": "Crónica",
  "def": "Conoce los tiempos pero aplaza el pago hasta las últimas consecuencias.",
  "est": [
   "Comunicación progresiva, de amistosa a formal.",
   "Fechas límite claras y consecuencias que sí se cumplen."
  ],
  "sen": [
   "Responde y promete, pero solo paga tras un aviso formal.",
   "El atraso crece hasta el siguiente nivel de cobranza."
  ],
  "tono": "Escala de amistoso a formal",
  "canal": "WhatsApp, luego correo formal",
  "who": "Conoce los tiempos y aplaza el pago hasta las últimas consecuencias.",
  "ve": [
   "Fechas y consecuencias que conoce al detalle.",
   "Su flujo: sabe que puede pagar.",
   "Otros que pagan tarde sin consecuencias."
  ],
  "esc": [
   "“El cobro legal es lento y caro.”",
   "Avisos que ya conoce de memoria."
  ],
  "pie": [
   "“Pago hasta que sea necesario.”",
   "“Mientras no me embarguen, no pasa nada.”",
   "“Mi dinero rinde más conmigo.”"
  ],
  "sie": [
   "Control.",
   "Poca urgencia.",
   "Molestia si lo tratan como si no supiera."
  ],
  "hace": [
   "Responde con evasivas.",
   "Paga justo después de un aviso formal."
  ],
  "dol": [
   "Perder la sensación de control.",
   "Consecuencias concretas (buró, juicio)."
  ],
  "nec": "Ver que las consecuencias son reales y cercanas.",
  "pal": "Fechas límite claras y consecuencias que se cumplen; que pagar sea lo más fácil.",
  "evi": "Amenazas vacías o plazos que siempre se mueven.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos con tiempo: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Dejamos aquí el enlace por si desea programarla: {{liga}}. ¿Nos confirma si todo está en orden?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Puede resolverla aquí: {{liga}}. Si va a ser en otra fecha, ¿nos indica cuál para dejarlo anotado?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos por la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}}. ¿Nos confirma en qué día quedará lista? Con ese dato dejamos anotado su compromiso.",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos al pendiente de la factura {{folio}} por {{monto}}. Para organizarnos, ¿nos confirma una fecha antes del {{fecha_limite}}? Si prefiere, también podemos platicar la mejor opción.",
   "c": {
    "asunto": "Confirmación de fecha de pago · factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, le escribimos sobre la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}}. Aún no tenemos una fecha de pago confirmada. Le agradeceremos indicarnos cuándo podría realizarlo, o si algún dato no coincide con sus registros. Si no recibimos respuesta, una persona de {{empresa}} podrá llamarle en horario hábil para resolverlo. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Ser claro y cordial: el hecho, la fecha y el siguiente paso.",
    "No aceptar fechas vagas: pedir día, monto y medio de pago.",
    "No anunciar nada que no vaya a hacerse."
   ],
   "r": {
    "si": "Ya les pago, no se preocupen.",
    "resp": "Gracias, {{contacto}}. Para dejarlo registrado, ¿nos confirma el día y el monto? Quedamos pendientes de su comprobante."
   },
   "pnota": "Anunciar solo pasos que sí se vayan a cumplir: la llamada de la etapa D debe estar programada en el flujo."
  }
 },
 {
  "id": "promesero-b2c",
  "seg": "B2C",
  "name": "Promesero",
  "causa": "noquiere",
  "origen": "nuevo",
  "mor": "Crónica",
  "def": "Dice \"mañana te deposito\" y no cumple. Muy común en cobranza mexicana.",
  "est": [
   "Cerrar cada promesa con fecha, monto y medio de pago.",
   "Confirmar el día anterior.",
   "No aceptar \"esta semana\". Tras la segunda promesa rota, pedir un pago inmediato parcial o escalar."
  ],
  "sen": [
   "2 o más promesas de pago incumplidas.",
   "Respuestas rápidas pero vagas."
  ],
  "tono": "Cordial, preciso",
  "canal": "WhatsApp (queda registro)",
  "who": "Dice “mañana te deposito” y no cumple.",
  "ve": [
   "Su compromiso de pago como algo flexible.",
   "Un calendario que va corriendo."
  ],
  "esc": [
   "Su propia frase: “mañana”.",
   "Cobradores que aceptan “esta semana”."
  ],
  "pie": [
   "“Con decirles algo los calmo.”",
   "“Ya mero me cae el dinero.”",
   "“No quiero quedar mal, pero no sé cuándo.”"
  ],
  "sie": [
   "Culpa breve.",
   "Alivio al poner distancia.",
   "Incomodidad al fallar."
  ],
  "hace": [
   "Promete rápido y vago.",
   "Desaparece el día de la fecha."
  ],
  "dol": [
   "Quedar mal otra vez.",
   "Ser confrontado por fallar."
  ],
  "nec": "Un compromiso pequeño, concreto y que alguien le recuerde.",
  "pal": "Fecha, monto y medio de pago; confirmación el día anterior.",
  "evi": "Aceptar “esta semana” o promesas sin monto.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos con tiempo: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si nos confirma desde ahora el día y el medio de pago, la dejamos agendada. Enlace: {{liga}}. ¡Gracias!",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. ¿Nos confirma a qué hora la tendrá lista? Aquí puede resolverla cuando guste: {{liga}}. ¡Gracias!",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, quedamos al pendiente de la factura {{folio}} por {{monto}}. ¿Nos confirma día, monto y medio de pago para dejarla agendada? Con eso podemos enviarle un recordatorio el día anterior.",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, ¿sigue en pie la fecha que acordamos el {{fecha_promesa}} para la factura {{folio}}? Si surgió algo, no hay problema: acordamos una nueva fecha puntual y ahí quedamos.",
   "c": {
    "asunto": "Confirmación de fecha de pago · factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, tomamos nota de la fecha de pago que nos indicó para la factura {{folio}} por {{monto}}. Aún no vemos el pago ({{dias}} días de atraso). Le pedimos confirmar por este medio una nueva fecha, con monto y forma de pago, o enviar el comprobante si ya pagó. Gracias. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Pedir la promesa con día, monto y medio de pago y repetirla en voz alta.",
    "Avisar que se enviará una confirmación el día anterior.",
    "Si falla la segunda promesa, pedir un pago parcial inmediato o escalar."
   ],
   "r": {
    "si": "Mañana les deposito.",
    "resp": "Perfecto. ¿Nos confirma el monto y a qué hora aproximadamente? Podemos escribirle mañana un recordatorio; cuando haga el depósito, compártanos su comprobante."
   },
   "pnota": "Los recordatorios del día anterior deben programarse de verdad en el flujo."
  }
 },
 {
  "id": "ingreso-variable-b2c",
  "seg": "B2C",
  "name": "Ingreso variable",
  "causa": "nopuede",
  "origen": "nuevo",
  "mor": "Temporal o crónica",
  "def": "Trabaja por cuenta propia o en la informalidad: paga cuando cobra.",
  "est": [
   "Alinear la fecha de vencimiento con su flujo.",
   "Aceptar abonos pequeños y frecuentes.",
   "Recordar el día de cobro, no el de vencimiento."
  ],
  "sen": [
   "Pagos irregulares pero recurrentes.",
   "Suele pagar cerca de quincena o fin de semana.",
   "Depósitos en efectivo."
  ],
  "tono": "Práctico, flexible",
  "canal": "WhatsApp, referencia de pago en efectivo",
  "who": "Trabaja por su cuenta o en la informalidad: paga cuando cobra.",
  "ve": [
   "Ingresos que llegan por día o por servicio.",
   "Fechas en que le pagan sus propios clientes.",
   "Un vencimiento que no coincide con su cobro."
  ],
  "esc": [
   "“Sin ingreso fijo no hay crédito.”",
   "Clientes que le pagan tarde a él."
  ],
  "pie": [
   "“Cuando me paguen, te pago.”",
   "“Dame una fecha que me acomode.”",
   "“Prefiero abonar poco antes que quedar mal.”"
  ],
  "sie": [
   "Incertidumbre.",
   "Orgullo de cumplir cuando puede.",
   "Presión cuando las fechas no coinciden."
  ],
  "hace": [
   "Paga cerca de sus cobros.",
   "Prefiere efectivo o transferencias pequeñas."
  ],
  "dol": [
   "Fechas rígidas.",
   "Penalizaciones por un atraso corto."
  ],
  "nec": "Fechas y montos que sigan su flujo real.",
  "pal": "Flexibilidad: abonos pequeños y fecha alineada a su cobro.",
  "evi": "Exigir un pago único en fecha fija sin opciones.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos con tiempo: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si le acomoda más pagar en partes o en otra fecha cercana a sus ingresos, platíquenoslo y lo ajustamos. ¿Qué le funcionaría mejor?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si puede cubrirla hoy, aquí está el enlace: {{liga}}. Y si prefiere hacerlo en abonos, díganos cuándo recibe sus ingresos y lo acomodamos.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, sabemos que sus ingresos no siempre llegan en la misma fecha. Para la factura {{folio}} por {{monto}}, ¿qué día de la semana o del mes le resulta más cómodo, y en cuántos abonos?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos al pendiente de la factura {{folio}} por {{monto}}. Podemos recibir abonos pequeños y frecuentes. ¿Cuánto le sería posible esta semana? Aquí puede hacerlo: {{liga}}.",
   "c": {
    "asunto": "Plan de abonos · factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Para facilitarle el pago, podemos acordar abonos alineados a las fechas en que recibe sus ingresos. Responda con el día y el monto que le resulten posibles y se lo confirmamos por escrito. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Preguntar cuándo recibe sus ingresos.",
    "Proponer abonos pequeños con fechas cercanas a esos ingresos.",
    "Confirmar el calendario por WhatsApp."
   ],
   "r": {
    "si": "Cuando me paguen mis clientes, te pago.",
    "resp": "Entendido. ¿Qué día calcula que recibiría ese pago? Con esa fecha dejamos agendado su abono; y si puede adelantar algo menor, lo registramos con gusto."
   }
  }
 },
 {
  "id": "sobreendeudado-b2c",
  "seg": "B2C",
  "name": "Sobreendeudado",
  "causa": "nopuede",
  "origen": "nuevo",
  "mor": "Estructural",
  "def": "Debe a tarjetas, casas comerciales y apps de crédito, y paga una con otra.",
  "est": [
   "Reestructura o quita realista.",
   "Recuperar algo de forma sostenida en lugar de presionar.",
   "Plan de largo plazo con monto que pueda cumplir."
  ],
  "sen": [
   "Menciona otras deudas.",
   "Pagos mínimos.",
   "Pide quita o reducción."
  ],
  "tono": "Comprensivo, realista",
  "canal": "Llamada, WhatsApp",
  "who": "Debe a tarjetas, casas comerciales y apps de crédito, y paga una con otra.",
  "ve": [
   "Varias deudas con distintos vencimientos.",
   "Mensajes de cobro de varias empresas a la vez.",
   "Apps que le ofrecen “más dinero”."
  ],
  "esc": [
   "Presión de varios cobradores.",
   "Promesas de “sin buró, sin aval”."
  ],
  "pie": [
   "“No me alcanza para todos.”",
   "“¿A cuál le pago primero?”",
   "“Necesito una salida, no más presión.”"
  ],
  "sie": [
   "Agobio.",
   "Miedo.",
   "Cansancio.",
   "Agradecimiento si alguien propone algo realista."
  ],
  "hace": [
   "Paga mínimos.",
   "Reparte el dinero entre acreedores.",
   "Pide quita."
  ],
  "dol": [
   "La espiral de deuda.",
   "Sentirse sin salida."
  ],
  "nec": "Un plan realista que no lo ahogue.",
  "pal": "Ser el acreedor que ofrece una reestructura viable.",
  "evi": "Presión adicional o condiciones que no puede cumplir.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos con tiempo: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si le conviene acordar pagos más pequeños, con gusto lo revisamos desde ahora. ¿Platicamos?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si por ahora no le es posible cubrirla completa, podemos buscar una opción que sí pueda sostener. ¿Le parece si lo vemos juntos?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, esperamos que esté bien. Sobre la factura {{folio}} por {{monto}}, nos interesa encontrar una forma de cerrarla que sea cómoda para usted. ¿Qué monto mensual le resultaría realista?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, retomamos la factura {{folio}} por {{monto}}. Podemos revisar un plan con pagos más pequeños y fechas claras. ¿Le parece si le proponemos un calendario?",
   "c": {
    "asunto": "Opciones para regularizar su factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Para ayudarle a regularizarla, podemos proponer un plan de pagos acorde a su capacidad. Indíquenos el monto que podría cubrir cada periodo y preparamos una propuesta por escrito. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Escuchar su panorama general sin juzgar.",
    "Proponer un plan con un monto realista, aunque sea menor.",
    "Dejar el acuerdo por escrito y la fecha del primer pago."
   ],
   "r": {
    "si": "Debo a muchos lados y no me alcanza.",
    "resp": "Gracias por la confianza de decírnoslo. Lo importante es encontrar un monto que sí pueda cumplir. ¿Qué cantidad podría abonar cada periodo? Con eso armamos una propuesta."
   },
   "pnota": "Ofrecer planes de pago solo si el cliente de Royáltica los autorizó. Definir si hay margen para reestructura o quita."
  }
 },
 {
  "id": "desconfiado-del-canal-b2c",
  "seg": "B2C",
  "name": "Desconfiado del canal",
  "causa": "friccion",
  "origen": "nuevo",
  "mor": "Temporal",
  "def": "No hace clic en links de cobro por miedo a fraude, o prefiere pagar en ventanilla o efectivo.",
  "est": [
   "Dar referencia de pago verificable (CLABE, OXXO, banco).",
   "Escribir siempre desde un número oficial y verificado.",
   "Explicar cómo reconocer un cobro legítimo."
  ],
  "sen": [
   "No abre links.",
   "Pregunta \"¿esto es real?\".",
   "Paga solo en ventanilla."
  ],
  "tono": "Transparente, tranquilizador",
  "canal": "Número oficial, llamada de verificación",
  "who": "No hace clic en links de cobro por miedo a fraude, o prefiere pagar en ventanilla o efectivo.",
  "ve": [
   "Un mensaje con un link que parece sospechoso.",
   "Noticias de fraudes por WhatsApp.",
   "Un número desconocido."
  ],
  "esc": [
   "“No hagas clic en links.”",
   "Historias de gente a quien le robaron."
  ],
  "pie": [
   "“¿Será verdad o es fraude?”",
   "“Prefiero ir al banco o pagar en tienda.”",
   "“Si es real, que me lo confirmen por un medio oficial.”"
  ],
  "sie": [
   "Desconfianza.",
   "Cautela.",
   "Tranquilidad si puede verificar."
  ],
  "hace": [
   "Pregunta si es legítimo.",
   "No abre links.",
   "Paga en ventanilla."
  ],
  "dol": [
   "Ser estafado.",
   "Que no le den forma de verificar."
  ],
  "nec": "Poder comprobar que el cobro es legítimo.",
  "pal": "Decir con claridad quién cobra y por qué, y dar una referencia de pago verificable.",
  "evi": "Links acortados, números desconocidos y urgencia exagerada.",
  "pla": {
   "pre": "Hola {{contacto}}, le escribimos desde el número autorizado por {{empresa}}: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Puede pagarla por transferencia con la referencia {{folio}}, o llamarnos al {{telefono_oficial}} para verificar este mensaje.",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si prefiere no usar enlaces, puede pagar por transferencia con la referencia {{folio}}. Para verificar este mensaje, llámenos al {{telefono_oficial}}.",
   "a": "Hola {{contacto}}, le escribimos de parte de {{empresa}} sobre la factura {{folio}} por {{monto}}. Para su tranquilidad, puede verificar este mensaje llamando al {{telefono_oficial}}. Este mensaje no le pide claves ni datos personales.",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos al pendiente de la factura {{folio}} por {{monto}}. Si lo prefiere, puede pagar por transferencia a la CLABE {{clabe}} con la referencia {{folio}}. Cualquier duda, llámenos al {{telefono_oficial}}.",
   "c": {
    "asunto": "Datos para pagar la factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: enviamos esta información desde el correo autorizado por {{empresa}}. La factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Puede pagar por transferencia a la CLABE {{clabe}} con la referencia {{folio}}, o comunicarse al {{telefono_oficial}} para verificar. Cuando pague, envíe su comprobante. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Presentarse con nombre y empresa y ofrecer que verifique llamando al número oficial.",
    "Dar la referencia de pago sin pedir datos sensibles.",
    "Confirmar que recibió el comprobante."
   ],
   "r": {
    "si": "¿Esto es real? Me da desconfianza el link.",
    "resp": "Es normal tener cuidado. Puede verificarlo llamando al {{telefono_oficial}}. También puede pagar sin usar enlaces, por transferencia a la CLABE {{clabe}} con la referencia {{folio}}. Este mensaje no le pide claves ni datos personales."
   },
   "pnota": "Requiere variables extra por cliente: teléfono oficial y CLABE. Dar la CLABE solo si el cliente de Royáltica la validó."
  }
 },
 {
  "id": "avergonzado-b2c",
  "seg": "B2C",
  "name": "Avergonzado",
  "causa": "nopuede",
  "origen": "nuevo",
  "mor": "Temporal o crónica",
  "def": "Evita el contacto por pena o por sentirse abrumado, no por mala fe.",
  "est": [
   "Abrir con empatía y una salida clara.",
   "Proponer un primer paso pequeño y fácil.",
   "No acusar; ofrecer plan."
  ],
  "sen": [
   "Evita pero reacciona a un tono empático.",
   "Respuestas cortas con disculpas."
  ],
  "tono": "Humano, sin juicio",
  "canal": "WhatsApp",
  "who": "Evita el contacto por pena o por sentirse abrumado, no por mala fe.",
  "ve": [
   "La deuda como señal de fracaso personal.",
   "Mensajes que prefiere no abrir frente a otros."
  ],
  "esc": [
   "El juicio imaginado de familia y amigos.",
   "“Un buen pagador nunca debe.”"
  ],
  "pie": [
   "“Me da pena que sepan que no puedo.”",
   "“Si respondo, me van a regañar.”",
   "“Quiero arreglarlo pero no sé cómo empezar.”"
  ],
  "sie": [
   "Vergüenza.",
   "Culpa.",
   "Alivio cuando lo tratan con respeto."
  ],
  "hace": [
   "Deja de responder.",
   "Si le hablan con empatía, responde con disculpas."
  ],
  "dol": [
   "Ser juzgado.",
   "Que otros se enteren."
  ],
  "nec": "Un primer paso fácil y sin juicio.",
  "pal": "Empatía y privacidad; proponer un plan pequeño.",
  "evi": "Reproche, tono de culpa y contactar a terceros.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, esperamos que esté muy bien. La factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si esta vez conviene ajustar algo, aquí estamos para ayudarle con calma. ¿Cómo lo vemos?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si necesita otra fecha o hacerlo en partes, con gusto lo acomodamos. Basta con responder este mensaje.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos con mucho respeto sobre la factura {{folio}} por {{monto}}. Sabemos que a veces las cosas se complican y no pasa nada. Responder este mensaje es suficiente para dar un primer paso. ¿Cómo le podemos ayudar?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, sin ninguna prisa: queremos ayudarle con la factura {{folio}} por {{monto}}. Podemos empezar con un abono pequeño o con una fecha nueva. ¿Qué le parece lo más sencillo?",
   "c": {
    "asunto": "Estamos para ayudarle · factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, sabemos que pueden surgir situaciones complicadas. Sobre la factura {{folio}} por {{monto}}, preferimos buscar con usted una solución sencilla, empezando por un abono pequeño o una nueva fecha. Basta con responder este correo para que lo atendamos con discreción. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Hablar en privado, con tono calmado; no mencionar a terceros.",
    "Normalizar la situación y pedir solo un primer paso pequeño.",
    "Agradecer y confirmar por escrito."
   ],
   "r": {
    "si": "Me da mucha pena, no he podido.",
    "resp": "No se preocupe, {{contacto}}, es más común de lo que parece y aquí estamos para ayudarle. ¿Le parece si empezamos con un abono pequeño o una nueva fecha? Usted elige lo que le resulte más fácil."
   }
  }
 },
 {
  "id": "desconoce-la-deuda-b2c",
  "seg": "B2C",
  "name": "Desconoce la deuda",
  "causa": "desacuerdo",
  "origen": "nuevo",
  "mor": "No aplica hasta validar",
  "def": "No reconoce el cargo, es la persona equivocada o hubo fraude de identidad.",
  "est": [
   "Detener la cobranza.",
   "Validar identidad y evidencia: contrato, comprobantes.",
   "Corregir el contacto. No contactar a terceros."
  ],
  "sen": [
   "\"Yo no pedí eso\".",
   "Número o nombre equivocado.",
   "Cargo no reconocido."
  ],
  "tono": "Neutral, verificador",
  "canal": "Llamada o correo con evidencia",
  "who": "No reconoce el cargo: puede ser la persona equivocada o un fraude de identidad.",
  "ve": [
   "Un cobro por algo que no reconoce.",
   "Un nombre o monto que no cuadra."
  ],
  "esc": [
   "Historias de fraude de identidad.",
   "“Seguro es un error.”"
  ],
  "pie": [
   "“Yo no pedí nada de eso.”",
   "“¿Y si me robaron la identidad?”",
   "“Me están confundiendo con otro.”"
  ],
  "sie": [
   "Sorpresa.",
   "Enojo.",
   "Miedo a que afecte su historial."
  ],
  "hace": [
   "Niega y pide pruebas.",
   "Puede presentar una queja o denuncia."
  ],
  "dol": [
   "Ser acusado injustamente.",
   "Daño a su historial."
  ],
  "nec": "Evidencia clara o que corrijan el error.",
  "pal": "Escuchar, verificar y mostrar evidencia; detener el cobro mientras se valida.",
  "evi": "Dar por hecho que la deuda es suya o contactar a terceros.",
  "pla": {
   "pre": "Hola, ¿hablamos con {{contacto}}? Le escribimos de parte de {{empresa}} para compartirle información sobre un comprobante a su nombre. Si es usted, ¿nos confirma para enviarle el detalle? Si no, disculpe y avísenos.",
   "hoy": "Hola, ¿hablamos con {{contacto}}? De parte de {{empresa}}: si prefiere revisar primero el detalle de un comprobante a su nombre, o algún dato no coincide, con gusto se lo compartimos. ¿Se lo enviamos?",
   "a": "Hola, ¿hablamos con {{contacto}}? De parte de {{empresa}}, podemos compartirle el comprobante y los datos del servicio de un comprobante a su nombre. Si hubo un error en el nombre o en los datos, lo corregimos. ¿Nos confirma que es usted la persona correcta?",
   "b": "Hola, ¿hablamos con {{contacto}}? De parte de {{empresa}}, seguimos disponibles para aclarar el comprobante a su nombre. Si no lo reconoce, responda este mensaje y lo revisamos con usted; mientras tanto, no le enviaremos más recordatorios.",
   "c": {
    "asunto": "Aclaración de la factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, en relación con la factura {{folio}} por {{monto}}, adjuntamos el detalle para su revisión. Si no reconoce el movimiento o detecta un error en sus datos, responda este correo y lo investigamos. Mientras no se aclare, no continuaremos con recordatorios. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Verificar identidad antes de hablar del saldo.",
    "Explicar el origen de la factura y ofrecer el soporte.",
    "Si no corresponde, registrar el error y detener los recordatorios."
   ],
   "r": {
    "si": "Yo no pedí eso.",
    "resp": "Gracias por avisarnos. Vamos a revisar el origen y le compartimos los comprobantes. ¿Nos confirma su nombre completo y el correo al que podemos enviarle el detalle?"
   },
   "pnota": "No dar folio ni monto hasta verificar a la persona. No contactar a terceros. Si el número es de otra persona, se detiene la gestión y se elimina el contacto. Pausar los envíos requiere que el sistema lo haga.",
   "noFolio": true
  }
 },
 {
  "id": "pagador-parcial-b2c",
  "seg": "B2C",
  "name": "Pagador parcial",
  "causa": "nopuede",
  "origen": "nuevo",
  "mor": "Crónica",
  "def": "Abona poco y sin patrón; nunca liquida.",
  "est": [
   "Convertir el goteo en un plan formal con calendario y monto fijo.",
   "Ofrecer descuento por liquidación si completa el plan."
  ],
  "sen": [
   "Abonos pequeños y variables.",
   "Saldo que casi no baja."
  ],
  "tono": "Constructivo",
  "canal": "WhatsApp",
  "who": "Abona poco y sin patrón; nunca liquida.",
  "ve": [
   "Un saldo que casi no baja.",
   "Montos que puede mover cada vez."
  ],
  "esc": [
   "“Mejor poco que nada.”",
   "Cobradores que aceptan lo que sea."
  ],
  "pie": [
   "“Con esto cumplo algo.”",
   "“No me alcanza para más.”",
   "“Cuando pueda pago el resto.”"
  ],
  "sie": [
   "Alivio parcial.",
   "Cansancio de deber."
  ],
  "hace": [
   "Abona cuando le sobra.",
   "No sigue un calendario."
  ],
  "dol": [
   "Ver que la deuda no avanza.",
   "Sentir que nunca termina."
  ],
  "nec": "Ver la meta y un camino claro de cuántos pagos faltan.",
  "pal": "Plan con monto y número de pagos; incentivo (descuento) por liquidar.",
  "evi": "Aceptar abonos sin plan o mostrar solo el saldo total.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, gracias por sus abonos anteriores. La factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si le conviene, podemos dejar un calendario con monto fijo para este pago también. ¿Lo armamos?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Gracias por seguir al pendiente. Si va a abonar, aquí puede hacerlo: {{liga}}. Con gusto le ayudamos a dejar un calendario fijo.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, gracias por los abonos que ha realizado a la factura {{folio}}. Le queda un saldo de {{saldo}}. Para ayudarle a terminarla, ¿acordamos un monto fijo y las fechas de los siguientes pagos?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, con {{saldo}} por cerrar de la factura {{folio}}, podemos terminarla en pagos iguales con fechas fijas. ¿Le sirve que le propongamos un calendario?",
   "c": {
    "asunto": "Calendario para cerrar la factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, agradecemos los abonos recibidos. El saldo pendiente de la factura {{folio}} es de {{saldo}}. Le proponemos un calendario de pagos fijos para liquidarla. Si le interesa, responda con el monto que puede cubrir por periodo. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Agradecer los abonos y mostrar cuánto falta.",
    "Convertir los abonos en un calendario fijo.",
    "Confirmar fechas y monto por escrito."
   ],
   "r": {
    "si": "Voy abonando poco a poco.",
    "resp": "Gracias por seguir pagando. Para que sea más claro cuándo termina, le proponemos un calendario con monto y fechas fijas. ¿Qué monto le funciona por periodo?"
   },
   "pnota": "Ofrecer calendarios solo si el cliente de Royáltica los autorizó. Si autoriza un descuento por liquidar, se puede añadir como incentivo."
  }
 },
 {
  "id": "burocratico-b2b",
  "seg": "B2B",
  "name": "Burocrático",
  "causa": "friccion",
  "origen": "hoja",
  "mor": "Crónica",
  "def": "Tiene el dinero, pero por sus procesos la factura se pierde, se olvida o se registra mal.",
  "est": [
   "Confirmar sus procesos desde el día 1: requisitos de facturación y ruta de aprobación.",
   "Tener el contacto del encargado de pagos.",
   "Dar seguimiento a cada paso del proceso."
  ],
  "sen": [
   "\"Ya está en proceso\".",
   "Piden reenvío de factura.",
   "Exigen orden de compra o contrarrecibo.",
   "Atraso similar cada ciclo."
  ],
  "tono": "Cordial, procedimental",
  "canal": "Correo con encargado de pagos",
  "who": "Responsable de pagos de una empresa con procesos que pierden o retrasan la factura. Tiene el dinero.",
  "ve": [
   "Facturas en bandeja pendientes de aprobación.",
   "Un flujo con varias firmas.",
   "Un ERP o portal con requisitos."
  ],
  "esc": [
   "Jefes: “sigue el proceso”.",
   "Auditoría exigiendo documentos completos.",
   "Proveedores reclamando pagos."
  ],
  "pie": [
   "“No puedo pagar sin la orden de compra.”",
   "“Seguro se quedó en autorización.”",
   "“Si me salto el proceso, me regañan.”"
  ],
  "sie": [
   "Presión de procesos.",
   "Frustración con su propia burocracia.",
   "Cautela de cometer un error."
  ],
  "hace": [
   "Pide documentos otra vez.",
   "Responde “está en proceso”."
  ],
  "dol": [
   "Ser señalado por un pago mal autorizado.",
   "Facturas rechazadas por detalles."
  ],
  "nec": "Los documentos correctos y saber en qué paso está su pago.",
  "pal": "Facilitarle el proceso: checklist, documentos completos y siguiente paso claro.",
  "evi": "Presionarlo sin conocer el proceso o escalar a su jefe de entrada.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, para que la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}) avance sin contratiempos, ¿nos confirma si ya cuenta con la orden de compra, el contrarrecibo y los documentos que necesitan? Si falta algo, lo enviamos hoy.",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. ¿Nos ayuda a confirmar en qué paso del proceso de pago va? Si falta algún documento, se lo enviamos de inmediato.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, quisiéramos dar seguimiento a la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}). ¿En qué paso del proceso de pago se encuentra y quién la tiene? Si falta algún documento, se lo enviamos de inmediato.",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos con la factura {{folio}} por {{monto}}. ¿Nos comparte el estatus de autorización y la fecha estimada de pago? Con gusto le enviamos lo que haga falta para que avance.",
   "c": {
    "asunto": "Seguimiento de pago · factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}}, registra {{dias}} días de atraso. Para ayudarles a completar el proceso interno, adjuntamos nuevamente la factura y su soporte. Les pedimos indicarnos el estatus y la fecha programada de pago esta semana. Gracias por su apoyo. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Pedir el flujo: quién autoriza, en qué paso está y qué falta.",
    "Ofrecer reenviar los documentos en el acto.",
    "Fijar fecha de revisión y quedar con una persona de contacto."
   ],
   "r": {
    "si": "Está en proceso de autorización.",
    "resp": "Gracias. ¿Nos puede decir en qué etapa va y la fecha estimada de pago? Si necesitan algún documento adicional, se lo hacemos llegar hoy."
   }
  }
 },
 {
  "id": "priorizador-b2b",
  "seg": "B2B",
  "name": "Priorizador",
  "causa": "nopuede",
  "origen": "hoja",
  "mor": "Crónica",
  "def": "Prioriza el pago a otros proveedores. No tiene para todos y decide quién va primero.",
  "est": [
   "Límites estrictos de crédito.",
   "Intereses moratorios, si el contrato los prevé.",
   "Suspender entregas o servicio hasta regularizar.",
   "Negociar un calendario donde tú entres en la prioridad."
  ],
  "sen": [
   "Pagos parciales.",
   "Atraso que sube y baja con sus ventas.",
   "Paga más rápido a otros proveedores."
  ],
  "tono": "Firme, comercial",
  "canal": "Correo, llamada al responsable",
  "who": "Tiene caja limitada y decide a qué proveedor paga primero.",
  "ve": [
   "Una lista de proveedores y vencimientos.",
   "Caja limitada.",
   "Qué proveedores amenazan con cortar."
  ],
  "esc": [
   "Proveedores reclamando al mismo tiempo.",
   "Dirección: “paga solo lo crítico”.",
   "Ventas bajas."
  ],
  "pie": [
   "“Pago primero al que me corta el servicio.”",
   "“Los que no presionan esperan.”",
   "“¿Cuánto aguanta este proveedor?”"
  ],
  "sie": [
   "Estrés de caja.",
   "Culpa moderada.",
   "Pragmatismo."
  ],
  "hace": [
   "Paga al que presiona más.",
   "Abona parcialmente."
  ],
  "dol": [
   "Quedarse sin insumos clave.",
   "Tener que elegir."
  ],
  "nec": "Una razón para que tú estés en la lista crítica.",
  "pal": "Mostrar con claridad qué pasa si no paga (suspensión) y ofrecer un calendario viable.",
  "evi": "Quedar como el proveedor que no presiona: termina al final de la lista.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, con tiempo le comentamos que la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si prefiere dejar un calendario de pagos desde ahora, con gusto lo acomodamos. ¿Qué le funcionaría?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Sabemos que hay varios compromisos; si nos comparte cuándo podría quedar lista, la dejamos agendada. ¿Qué fecha le acomoda?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, esperamos que todo marche bien. Sobre la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}), nos interesa seguir surtiéndole con normalidad. ¿Qué fecha de pago podemos esperar?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos con la factura {{folio}} por {{monto}}. Para mantener sus entregas con normalidad, nos ayuda confirmar la fecha de pago o acordar un calendario. ¿Cuál le funciona?",
   "c": {
    "asunto": "Calendario de pago · factura {{folio}}",
    "txt": "Estimados {{contacto}}: de parte de {{empresa}}, la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Nos interesa seguir trabajando con normalidad. ¿Podemos acordar una fecha de pago o un calendario parcial antes del {{fecha_limite}}? Una persona de {{empresa}} está disponible para revisarlo con ustedes. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Preguntar con franqueza qué compromisos compiten por su flujo.",
    "Proponer un calendario parcial que los ponga en su lista crítica.",
    "Fijar las condiciones de continuidad de entregas."
   ],
   "r": {
    "si": "Estamos pagando primero a otros proveedores.",
    "resp": "Gracias por la franqueza. Para seguir surtiendo con normalidad, ¿qué calendario podría comprometer? Con gusto revisamos pagos parciales con fechas claras."
   },
   "pnota": "Las condiciones de entrega solo se mencionan si el contrato las prevé y las decide el cliente."
  }
 },
 {
  "id": "intencional-b2b",
  "seg": "B2B",
  "name": "Intencional",
  "causa": "noquiere",
  "origen": "hoja",
  "mor": "Crónica",
  "def": "Tiene el dinero y decide retenerlo el mayor tiempo posible o evitar el pago. Se financia con sus proveedores.",
  "est": [
   "Suspensión de entregas.",
   "Condiciones de pago más cortas o anticipo.",
   "Penas y condiciones pactadas en contrato."
  ],
  "sen": [
   "Paga siempre al límite o después.",
   "Pide más plazo cada vez.",
   "Liquidez sana en su operación."
  ],
  "tono": "Formal, con consecuencias",
  "canal": "Correo formal, directivo",
  "who": "Tiene el dinero y retiene el pago para financiarse con sus proveedores.",
  "ve": [
   "Su flujo de caja positivo.",
   "Plazos largos con proveedores como financiamiento.",
   "El costo financiero de pagar antes."
  ],
  "esc": [
   "Finanzas: “maximiza capital de trabajo”.",
   "Pares que pagan a 90 días."
  ],
  "pie": [
   "“Mientras más tarde pague, más rinde mi dinero.”",
   "“Es costumbre del mercado.”",
   "“Ya me reclamarán cuando sea necesario.”"
  ],
  "sie": [
   "Control.",
   "Comodidad.",
   "Fastidio si le cambian las reglas."
  ],
  "hace": [
   "Pide más plazo.",
   "Paga al límite o después."
  ],
  "dol": [
   "Perder suministro.",
   "Perder capital de trabajo."
  ],
  "nec": "Que el atraso le cueste más que pagar.",
  "pal": "Condiciones claras: costo del atraso, suspensión de entregas y descuento por pronto pago.",
  "evi": "Reclamos informales cuyas consecuencias no se cumplen.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, le recordamos con tiempo que la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. ¿Nos confirma que está programada para esa fecha?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. ¿Nos confirma que el pago va en camino?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos por la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}). ¿Nos confirma la fecha en que quedará lista? Con ese dato dejamos su cuenta al día en nuestros registros.",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos con la factura {{folio}} por {{monto}}. Nos ayudaría contar con su fecha de pago antes del {{fecha_limite}} para continuar con las entregas sin cambios. ¿La podemos anotar?",
   "c": {
    "asunto": "Confirmación de fecha de pago · factura {{folio}}",
    "txt": "Estimados {{contacto}}: de parte de {{empresa}}, de acuerdo con nuestros registros la factura {{folio}} por {{monto}}, con fecha de pago el {{fecha}}, registra {{dias}} días de atraso. Les agradeceremos confirmar la fecha de pago, o indicarnos si hay alguna diferencia por aclarar. Una persona de {{empresa}} está disponible para revisar cualquier duda sobre la cuenta. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Llamar al responsable de finanzas y recordar la fecha de pago acordada.",
    "Citar el contrato solo con la cláusula exacta y si la aprobó el abogado del cliente.",
    "Pedir una fecha de pago firme y confirmarla por correo."
   ],
   "r": {
    "si": "Podemos pagar a 60 días como los demás.",
    "resp": "Según nuestros registros, la fecha de pago de la factura {{folio}} es el {{fecha}}. ¿Nos confirma cuándo podría pagarla?"
   },
   "pnota": "Si el cliente quiere citar el contrato, hacerlo con la cláusula exacta, aprobada por abogado y enviada por una persona del cliente."
  }
 },
 {
  "id": "desorganizado-b2b",
  "seg": "B2B",
  "name": "Desorganizado",
  "causa": "friccion",
  "origen": "hoja",
  "mor": "Temporal o crónica",
  "def": "No tiene controles eficientes: traspapela, pierde y no lleva registro de pagos.",
  "est": [
   "Enviar estados de cuenta de forma periódica.",
   "Mandar facturas y comprobantes cada vez.",
   "Recordatorio previo al vencimiento."
  ],
  "sen": [
   "Pide copias de facturas o comprobantes.",
   "Duda de pagos ya hechos.",
   "Pagos duplicados o faltantes."
  ],
  "tono": "Servicial",
  "canal": "Correo con estado de cuenta",
  "who": "Su empresa no tiene controles: traspapela facturas y no lleva registro de pagos.",
  "ve": [
   "Papeles y correos revueltos.",
   "Pagos sin registro claro.",
   "Excel incompletos."
  ],
  "esc": [
   "Proveedores preguntando por facturas.",
   "El contador pidiendo comprobantes."
  ],
  "pie": [
   "“¿Ya pagamos esto?”",
   "“No encuentro la factura.”",
   "“Mándame el estado de cuenta.”"
  ],
  "sie": [
   "Desbordado.",
   "Pena al descubrir un descuido.",
   "Agradecimiento si se lo ordenan."
  ],
  "hace": [
   "Pide copias.",
   "Paga duplicado o se salta una factura."
  ],
  "dol": [
   "Errores de pago.",
   "No tener control."
  ],
  "nec": "Información ordenada y fácil de usar.",
  "pal": "Estado de cuenta claro, con facturas adjuntas y una acción de pago.",
  "evi": "Reclamar como si fuera mala fe.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, le adelantamos su estado de cuenta: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Aquí puede revisarla: {{liga}}. ¡Gracias!",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Por si le sirve para su control, le dejamos aquí el detalle: {{liga}}. Si ya la pagó, compártanos el comprobante.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, le enviamos el estado de cuenta actualizado con la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}) y sus comprobantes. ¿Le ayuda si coordinamos una fecha de pago?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, por si ayuda a su control interno, le reenviamos la factura {{folio}} y el detalle de pagos recibidos. Quedan por cerrar {{saldo}}. ¿Nos confirma cuándo podría pagarlos?",
   "c": {
    "asunto": "Estado de cuenta y factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, adjuntamos su estado de cuenta con las facturas abiertas y los pagos que tenemos registrados. La factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Si algo no coincide con sus registros, avísenos y lo conciliamos juntos. Quedamos atentos a su fecha de pago. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Ofrecer conciliar juntos: leer folios y pagos.",
    "Enviar el estado de cuenta durante la llamada.",
    "Acordar enviarlo cada mes como recordatorio."
   ],
   "r": {
    "si": "No encuentro esa factura, no sé si ya la pagamos.",
    "resp": "Sin problema, se la reenviamos ahora con su comprobante de entrega. Según nuestros registros sigue abierta; si ya pagaron, compártanos el comprobante para actualizarlo."
   }
  }
 },
 {
  "id": "cfdi-mal-emitido-b2b",
  "seg": "B2B",
  "name": "CFDI mal emitido",
  "causa": "friccion",
  "origen": "nuevo",
  "mor": "Temporal",
  "def": "La factura es rechazada o corregida por datos fiscales incorrectos. Desde CFDI 4.0 RFC, nombre, régimen y código postal deben coincidir.",
  "est": [
   "Validar el CFDI antes de enviarlo: RFC, razón social, régimen, código postal, uso y método de pago.",
   "Emitir el REP al recibir un pago diferido o en parcialidades.",
   "Refacturar rápido cuando el cliente lo pida."
  ],
  "sen": [
   "Piden corregir o cancelar la factura.",
   "Falta REP en factura PPD.",
   "El pago se detiene tras recibir la factura."
  ],
  "tono": "Técnico, ágil",
  "canal": "Correo, portal de proveedores",
  "who": "Recibió una factura con datos fiscales incorrectos y no puede pagarla sin riesgo.",
  "ve": [
   "Una factura que no coincide con sus datos fiscales.",
   "Reglas del SAT que le exigen validar.",
   "Facturas rechazadas por su sistema."
  ],
  "esc": [
   "Su contador: “no pagues, no es deducible”.",
   "Auditores y SAT."
  ],
  "pie": [
   "“No puedo pagar una factura mal emitida.”",
   "“Que la corrijan y la reemitan.”",
   "“Si pago sin factura buena, tengo un problema fiscal.”"
  ],
  "sie": [
   "Cautela fiscal.",
   "Molestia por tener que reclamar.",
   "Disposición a pagar en cuanto se corrija."
  ],
  "hace": [
   "Rechaza o devuelve la factura.",
   "Pide refacturar."
  ],
  "dol": [
   "Riesgo fiscal.",
   "Perder la deducibilidad."
  ],
  "nec": "Una factura correcta, pronto.",
  "pal": "Reconocer el error propio y refacturar rápido.",
  "evi": "Insistir en cobrar la factura incorrecta.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, con tiempo: ¿podría confirmarnos que los datos fiscales de la factura {{folio}} (RFC, razón social, régimen y código postal) son correctos? Así evitamos reemitirla y llega todo en orden.",
   "hoy": "Hola {{contacto}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si algún dato fiscal requiere ajuste, avísenos y solicitamos a {{empresa}} la corrección para que no tenga contratiempos.",
   "a": "Hola {{contacto}}, vimos que la factura {{folio}} por {{monto}} puede necesitar ajustes en sus datos fiscales. ¿Nos confirma su RFC, razón social, régimen y código postal para solicitar a {{empresa}} la corrección?",
   "b": "Hola {{contacto}}, una vez corregida la factura {{folio}}, ya puede programar el pago de {{monto}}. ¿Nos confirma la fecha estimada? {{empresa}} emitirá el complemento de pago (REP) cuando corresponda.",
   "c": {
    "asunto": "Factura {{folio}} corregida y fecha de pago",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, tras los ajustes a sus datos fiscales adjuntamos la factura {{folio}} por {{monto}} corregida. Le pedimos programar su pago y confirmarnos la fecha. {{empresa}} emitirá el complemento de pago (REP) cuando corresponda. Disculpe las molestias. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Confirmar los datos fiscales exactos del receptor.",
    "Solicitar la corrección al cliente y confirmar cuando esté lista.",
    "Avisar que el REP lo emite el cliente cuando corresponda."
   ],
   "r": {
    "si": "La factura está mal, no la podemos pagar así.",
    "resp": "Tiene razón, gracias por avisarnos. ¿Nos confirma su RFC, razón social, régimen y código postal? Solicitamos la corrección a {{empresa}} y le confirmamos cuando esté lista."
   },
   "pnota": "Conviene validar el CFDI antes de enviarlo: el origen del problema suele estar del lado del cliente de Royáltica. La reemisión y el REP los hace el cliente."
  }
 },
 {
  "id": "corporativo-con-plazos-impuestos-b2b",
  "seg": "B2B",
  "name": "Corporativo con plazos impuestos",
  "causa": "friccion",
  "origen": "nuevo",
  "mor": "No es morosidad si cumple su plazo",
  "def": "Cliente grande que impone 60 a 120 días, maneja contrarrecibo, día de pago fijo y portal de proveedores.",
  "est": [
   "No presionar: cumplir los requisitos del portal.",
   "Conocer el calendario de pagos.",
   "Ofrecer factoraje, Cadenas Productivas de Nafin o descuento por pronto pago."
  ],
  "sen": [
   "Contrarrecibo con fecha futura.",
   "Portal de proveedores.",
   "Pago siempre en el mismo día del ciclo."
  ],
  "tono": "Profesional, institucional",
  "canal": "Portal, correo al área de cuentas por pagar",
  "who": "Área de cuentas por pagar de un corporativo con ciclo fijo de pago y portal de proveedores.",
  "ve": [
   "Un calendario de pagos fijo.",
   "Un portal con estados de factura.",
   "Políticas corporativas de plazos."
  ],
  "esc": [
   "Compras: “son 90 días”.",
   "Cuentas por pagar: “sigue el portal”."
  ],
  "pie": [
   "“Cumplimos nuestro plazo, no hay atraso.”",
   "“Si necesitas liquidez, usa factoraje.”",
   "“Insistir antes no cambia nada.”"
  ],
  "sie": [
   "Neutralidad.",
   "Poca urgencia.",
   "Respeto por quien cumple los requisitos."
  ],
  "hace": [
   "Paga en su ciclo.",
   "No responde fuera del portal."
  ],
  "dol": [
   "Proveedores que se saltan el proceso."
  ],
  "nec": "Que el proveedor cumpla el proceso para entrar al ciclo de pago.",
  "pal": "Cumplir los requisitos y consultar estados; ofrecer factoraje o pronto pago.",
  "evi": "Cobrar como moroso cuando está dentro de su plazo.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, confirmamos que la factura {{folio}} por {{monto}} está cargada en su portal con fecha de pago el {{fecha}}. ¿Nos ayuda a verificar que figure como aprobada para el siguiente ciclo de pago?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, la factura {{folio}} por {{monto}} tiene como fecha de pago hoy. ¿Nos confirma en qué ciclo de pago quedó incluida?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, quisiéramos confirmar el estatus de la factura {{folio}} por {{monto}} en su portal de proveedores y la fecha del ciclo de pago en que se incluirá. ¿Nos comparte esa información?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos la factura {{folio}} por {{monto}}. ¿Nos confirma si tiene alguna observación en el portal que debamos atender para incluirla en el siguiente pago?",
   "c": {
    "asunto": "Estatus de pago · factura {{folio}}",
    "txt": "Estimados {{contacto}}: de parte de {{empresa}}, solicitamos confirmar el estatus de la factura {{folio}} por {{monto}} y la fecha programada de pago. En caso de que exista alguna observación en su portal o falte algún documento, indíquenos para atenderlo de inmediato. Quedamos atentos. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Validar en el portal el estatus y la fecha del ciclo.",
    "Pedir al contacto el siguiente paso si hay observaciones.",
    "Mencionar pronto pago solo si el cliente lo tiene definido; no mencionar factoraje."
   ],
   "r": {
    "si": "Se paga en el siguiente ciclo, son 90 días.",
    "resp": "Gracias por confirmarnos. ¿Nos comparte la fecha exacta del ciclo? Si le interesa revisar un pronto pago, le compartimos las condiciones que {{empresa}} tenga vigentes."
   },
   "pnota": "Definir si el cliente de Royáltica ofrece pronto pago antes de mencionarlo. El factoraje no se menciona en mensajes: requiere un partner regulado."
  }
 },
 {
  "id": "dependiente-de-su-cobranza-b2b",
  "seg": "B2B",
  "name": "Dependiente de su cobranza",
  "causa": "nopuede",
  "origen": "nuevo",
  "mor": "Temporal o crónica",
  "def": "\"Cuando me paguen a mí te pago.\" Su liquidez depende de lo que le deben a él.",
  "est": [
   "Atar el plan de pagos a las fechas en que cobra.",
   "Preguntar quién le debe y cuándo.",
   "Pagos parciales y seguimiento de su exposición."
  ],
  "sen": [
   "Menciona a su propio cliente como causa.",
   "Paga tras cobrar.",
   "Pagos en bloque."
  ],
  "tono": "Colaborativo, atento",
  "canal": "Llamada, correo",
  "who": "Tiene liquidez ligada a lo que sus propios clientes le deben.",
  "ve": [
   "Cuentas por cobrar propias sin cobrar.",
   "Una caja que depende de sus clientes."
  ],
  "esc": [
   "Sus clientes pidiéndole más plazo.",
   "El banco: “no hay línea”."
  ],
  "pie": [
   "“Cuando me paguen, te pago.”",
   "“No es que no quiera, es que no tengo.”",
   "“Espero que me entiendas.”"
  ],
  "sie": [
   "Estrés encadenado.",
   "Vergüenza ante proveedores.",
   "Esperanza."
  ],
  "hace": [
   "Pide un plazo atado a su cobro.",
   "Paga en bloque cuando cobra."
  ],
  "dol": [
   "Ser rehén de sus clientes.",
   "Perder reputación con proveedores."
  ],
  "nec": "Un plan atado a sus fechas reales de cobro.",
  "pal": "Preguntar por sus fechas y pactar pagos ligados a ellas.",
  "evi": "Exigir fechas rígidas sin conocer su ciclo.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, con tiempo le comentamos que la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si sus ingresos del periodo llegan en otra fecha, ¿nos comparte cuál para acomodar la nuestra?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si aún espera sus propios ingresos, ¿nos indica cuándo los recibiría? Con esa fecha dejamos agendado el pago.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, sobre la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}): sabemos que sus pagos dependen de lo que usted espera recibir de sus clientes. ¿Nos comparte en qué fecha espera esos ingresos para acordar la nuestra?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, si le ayuda, para la factura {{folio}} por {{monto}} podemos pactar pagos parciales ligados a las fechas en que usted recibe sus pagos. ¿Qué fechas y montos serían realistas?",
   "c": {
    "asunto": "Plan de pago ligado a sus fechas · factura {{folio}}",
    "txt": "Estimados {{contacto}}: de parte de {{empresa}}, la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Entendemos que su flujo depende de pagos por recibir, por lo que proponemos un plan de pagos parciales alineado con sus fechas de ingreso. Indíquenos fechas y montos que puedan comprometer y los confirmamos por escrito. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Preguntar quién le debe y cuándo espera recibir ese pago.",
    "Proponer pagos parciales atados a esas fechas.",
    "Pedir aviso inmediato si esas fechas se mueven."
   ],
   "r": {
    "si": "Cuando me paguen a mí, les pago.",
    "resp": "Entendido. ¿Qué fecha espera ese pago? Con ella dejamos programado el nuestro; si puede adelantar un pago parcial, lo recibimos con gusto."
   }
  }
 },
 {
  "id": "dueno-cuello-de-botella-b2b",
  "seg": "B2B",
  "name": "Dueño cuello de botella",
  "causa": "friccion",
  "origen": "nuevo",
  "mor": "Crónica",
  "def": "En la pyme, todo pago lo libera una sola persona, cuando puede.",
  "est": [
   "Conseguir línea directa con el dueño o el contador.",
   "Fijar un día semanal de liberación de pagos.",
   "Mensaje corto con una sola acción para el dueño."
  ],
  "sen": [
   "\"El dueño tiene que autorizar\".",
   "Pagos en bloque.",
   "Contacto operativo sin poder de decisión."
  ],
  "tono": "Breve, directo",
  "canal": "WhatsApp al dueño o contador",
  "who": "Dueño de una pyme que autoriza personalmente cada pago y no da abasto.",
  "ve": [
   "Demasiadas decisiones al día.",
   "Autorizaciones de pago acumuladas.",
   "Un celular lleno de pendientes."
  ],
  "esc": [
   "Su equipo: “falta tu firma”.",
   "Clientes y proveedores pidiendo atención."
  ],
  "pie": [
   "“Eso lo reviso el viernes.”",
   "“Primero lo urgente.”",
   "“Mi gente lo resolvería pero no tiene permiso.”"
  ],
  "sie": [
   "Saturación.",
   "Culpa por dejar pendiente.",
   "Quiere resolver rápido si es simple."
  ],
  "hace": [
   "Libera pagos en bloque.",
   "Responde por WhatsApp a deshoras."
  ],
  "dol": [
   "Falta de tiempo.",
   "Que todo dependa de él."
  ],
  "nec": "Una acción simple y rápida de aprobar.",
  "pal": "Mensaje breve con monto, fecha y una referencia para pagar de inmediato.",
  "evi": "Correos largos o mensajes a su equipo operativo, que no decide.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, para ir adelantando: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si la deja autorizada con tiempo, aquí queda lista para pagar: {{liga}}. ¡Gracias!",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, un mensaje breve: hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Aquí queda lista en un paso: {{liga}}. ¿La libera hoy?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, resumen rápido: factura {{folio}}, {{monto}}, fecha de pago {{fecha}}, en espera de su autorización. Para dejarla lista en un paso: {{liga}}. ¿La libera esta semana?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, sabemos que su tiempo es limitado. ¿Qué día de la semana libera pagos para dejar agendada la factura {{folio}} por {{monto}}?",
   "c": {
    "asunto": "Pago por autorizar · factura {{folio}}",
    "txt": "Estimado(a) {{contacto}}: de parte de {{empresa}}, resumen en una línea. La factura {{folio}} por {{monto}} espera su autorización de pago y registra {{dias}} días de atraso. Para pagarla: {{liga}}. Si prefiere, indíquenos el día de la semana en que libera pagos y la dejamos agendada. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Llamar directo al dueño en el horario en que suele estar disponible.",
    "Resumir en 20 segundos: factura, monto y acción.",
    "Acordar un día fijo de liberación de pagos."
   ],
   "r": {
    "si": "Lo reviso el viernes.",
    "resp": "Perfecto. Le escribimos el viernes a primera hora con el enlace listo: {{liga}}. Gracias, {{contacto}}."
   }
  }
 },
 {
  "id": "disputador-b2b",
  "seg": "B2B",
  "name": "Disputador",
  "causa": "desacuerdo",
  "origen": "nuevo",
  "mor": "Temporal",
  "def": "Retrasa el pago por una diferencia comercial: mercancía rechazada, precio, cantidad o notas de crédito pendientes.",
  "est": [
   "Abrir una aclaración con fecha límite.",
   "Resolver con nota de crédito o reposición.",
   "Cobrar de inmediato la parte no disputada."
  ],
  "sen": [
   "Rechazo de mercancía.",
   "Pagos netos con descuentos.",
   "Menciona devoluciones o diferencias."
  ],
  "tono": "Neutral, documentado",
  "canal": "Correo con evidencia",
  "who": "Retiene el pago por una diferencia comercial: mercancía, precio, cantidad o nota de crédito.",
  "ve": [
   "Mercancía o servicio con una diferencia.",
   "Evidencia: remisiones, fotos, notas.",
   "Facturas con precios distintos a la cotización."
  ],
  "esc": [
   "Almacén: “llegó incompleto”.",
   "Compras: “no coincide con la orden”."
  ],
  "pie": [
   "“No voy a pagar lo que no corresponde.”",
   "“Hay que aclararlo primero.”",
   "“Pagaré lo que no esté en disputa.”"
  ],
  "sie": [
   "Desconfianza comercial.",
   "Firmeza.",
   "Apertura si lo resuelven."
  ],
  "hace": [
   "Retiene el pago.",
   "Pide nota de crédito o reposición."
  ],
  "dol": [
   "Pagar de más.",
   "Que ignoren su reclamo."
  ],
  "nec": "Una aclaración documentada y una solución.",
  "pal": "Abrir una aclaración con fecha límite y cobrar de inmediato lo no disputado.",
  "evi": "Mezclar lo disputado con lo que sí debe, o ignorar el reclamo.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, si hay alguna diferencia por aclarar en la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}), avísenos con tiempo y la revisamos antes de la fecha. ¿Todo en orden?",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si hubo alguna diferencia por aclarar, compártanos el detalle y lo atendemos hoy mismo. La parte sin diferencia puede programarla aquí: {{liga}}.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, sobre la factura {{folio}} por {{monto}}: entendemos que hay una diferencia por aclarar. ¿Nos comparte el detalle (cantidad, precio o producto) para revisarlo hoy? La parte sin diferencia puede programarla aquí: {{liga}}.",
   "b": "Hola {{contacto}}, para cerrar la aclaración de la factura {{folio}} necesitamos su evidencia (remisión, fotos o nota). Una vez revisada, {{empresa}} emitirá, si procede, la nota de crédito o la reposición. ¿Nos la envía antes del {{fecha_limite}}?",
   "c": {
    "asunto": "Aclaración de la factura {{folio}}",
    "txt": "Estimados {{contacto}}: de parte de {{empresa}}, damos seguimiento a la diferencia señalada en la factura {{folio}} por {{monto}}. Les pedimos la evidencia correspondiente antes del {{fecha_limite}}; {{empresa}} la revisará y, si procede, emitirá la nota de crédito o la reposición. La parte no controvertida de la factura puede programarse en su fecha. Agradecemos su atención. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Pedir la evidencia y la fecha de la diferencia.",
    "Separar la parte disputada de la que no lo está.",
    "Acordar fecha de resolución y fecha de pago de lo no disputado."
   ],
   "r": {
    "si": "Llegó incompleto, no vamos a pagar todo.",
    "resp": "Gracias por avisar. Para resolverlo, ¿nos comparte la remisión y fotos? Revisamos hoy y emitimos lo que corresponda. Mientras tanto, ¿puede programar el pago de la parte no cuestionada?"
   }
  }
 },
 {
  "id": "insolvente-b2b",
  "seg": "B2B",
  "name": "Insolvente",
  "causa": "nopuede",
  "origen": "nuevo",
  "mor": "Estructural",
  "def": "Está en crisis: ya no es un tema de voluntad ni de proceso, hay riesgo de pérdida.",
  "est": [
   "Dejar de entregar a crédito.",
   "Convenio de pago formal, garantías o pagaré, con apoyo legal.",
   "Priorizar recuperar lo que se pueda."
  ],
  "sen": [
   "Pagos que se detienen.",
   "Rotación del contacto.",
   "Cierres o noticias negativas.",
   "Atraso creciente."
  ],
  "tono": "Formal, cuidadoso",
  "canal": "Correo formal, directivo, legal",
  "who": "Empresa en crisis: ya no es cuestión de voluntad ni de proceso, hay riesgo de pérdida.",
  "ve": [
   "Cuentas sin fondos.",
   "Acreedores acumulándose.",
   "Ventas cayendo o cierre de operaciones."
  ],
  "esc": [
   "Banco, SAT, proveedores y empleados reclamando.",
   "Abogados y asesores."
  ],
  "pie": [
   "“¿Cómo salvo el negocio?”",
   "“No tengo para pagar a nadie.”",
   "“Necesito tiempo y un acuerdo.”"
  ],
  "sie": [
   "Miedo.",
   "Vergüenza.",
   "Agotamiento.",
   "Disposición a negociar para sobrevivir."
  ],
  "hace": [
   "Evade o pide convenios.",
   "Paga a quien amenaza con acción legal."
  ],
  "dol": [
   "El cierre del negocio.",
   "Responsabilidad personal."
  ],
  "nec": "Un convenio realista o una salida ordenada.",
  "pal": "Convenio formal con garantías; prioridad en recuperar lo posible.",
  "evi": "Seguir entregando a crédito o esperar sin formalizar.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}: la factura {{folio}} por {{monto}} tiene como fecha de pago el {{fecha}}. Si desea revisar fechas o formas de pago, con gusto lo platicamos.",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. Si no es posible cubrirla completa, podemos buscar una alternativa ordenada. ¿Cuándo podríamos llamarle?",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, le escribimos sobre la factura {{folio}} por {{monto}}. Nos interesa encontrar una solución viable para ambas partes. ¿Podemos platicar esta semana para revisar su situación y acordar un plan?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, retomamos la factura {{folio}} por {{monto}}. Si hoy no es posible pagarla completa, podemos dejar una propuesta de pagos por escrito. ¿Cuándo podríamos reunirnos o llamarle?",
   "c": {
    "asunto": "Opciones de pago · factura {{folio}}",
    "txt": "Estimados {{contacto}}: de parte de {{empresa}}, la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Si lo desean, podemos revisar con ustedes una propuesta de pagos por escrito, sujeta a la aprobación de {{empresa}}. ¿Les acomoda una llamada esta semana? Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Escuchar su situación real con calma.",
    "Proponer por escrito montos y fechas, sujetos a la aprobación del cliente.",
    "Evaluar garantías con el área legal y detener entregas a crédito."
   ],
   "r": {
    "si": "No tenemos flujo, estamos en problemas.",
    "resp": "Gracias por la transparencia. Preferimos buscar una salida ordenada. ¿Podemos reunirnos o llamarle esta semana para ver qué monto y fechas serían viables y dejarlo por escrito?"
   },
   "pnota": "Revisar con legal: propuesta de pagos, garantías o pagaré, y si el deudor está en concurso mercantil (detener el contacto). Detener las entregas a crédito."
  }
 },
 {
  "id": "gobierno-b2b",
  "seg": "B2B",
  "name": "Gobierno",
  "causa": "friccion",
  "origen": "nuevo",
  "mor": "Crónica",
  "def": "Paga tarde por presupuesto y trámites internos, no por mala fe.",
  "est": [
   "Seguimiento por área y calendario presupuestal.",
   "Documentación completa desde el inicio.",
   "Evitar escalamientos agresivos."
  ],
  "sen": [
   "Pagos atados a ejercicio fiscal.",
   "Múltiples áreas involucradas.",
   "Plazos largos y trámites."
  ],
  "tono": "Institucional, paciente",
  "canal": "Oficio, correo, visita",
  "who": "Servidor público que paga sujeto a presupuesto, trámites y auditorías.",
  "ve": [
   "El presupuesto y calendario del ejercicio.",
   "Trámites en varias áreas.",
   "Comprobaciones y requisitos de pago."
  ],
  "esc": [
   "Contraloría: “sin documentación no se paga”.",
   "Superiores: “cuando haya presupuesto”."
  ],
  "pie": [
   "“Mi trabajo es cumplir el procedimiento.”",
   "“No tengo autoridad para acelerar.”",
   "“Si falta un papel, se detiene todo.”"
  ],
  "sie": [
   "Cautela por responsabilidad.",
   "Poca urgencia personal.",
   "Disposición a ayudar si hay claridad."
  ],
  "hace": [
   "Pide documentos.",
   "Paga cuando el trámite avanza."
  ],
  "dol": [
   "Observaciones de auditoría.",
   "Responsabilidades administrativas."
  ],
  "nec": "Un expediente completo y seguimiento por el área correcta.",
  "pal": "Documentación impecable y seguimiento paciente por área.",
  "evi": "Presión o tono agresivo.",
  "pla": {
   "pre": "Hola {{contacto}}, de parte de {{empresa}}, con tiempo: ¿nos podría confirmar que la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}) cuenta con el expediente completo y en qué área está el trámite? Con gusto enviamos lo que falte.",
   "hoy": "Hola {{contacto}}, de parte de {{empresa}}, hoy es la fecha de pago de la factura {{folio}} por {{monto}}. ¿Nos podría indicar en qué etapa del trámite de pago va? Estamos atentos por si se requiere algún documento.",
   "a": "Hola {{contacto}}, de parte de {{empresa}}, quisiéramos dar seguimiento a la factura {{folio}} por {{monto}} (fecha de pago: {{fecha}}). ¿Nos podría indicar en qué área se encuentra el trámite y si falta algún documento?",
   "b": "Hola {{contacto}}, de parte de {{empresa}}, seguimos con el trámite de pago de la factura {{folio}} por {{monto}}. ¿Nos comparte la fecha estimada y el área responsable para dar seguimiento directo?",
   "c": {
    "asunto": "Seguimiento al trámite de pago · factura {{folio}}",
    "txt": "Estimados {{contacto}}: de parte de {{empresa}}, solicitamos amablemente informarnos sobre el estatus del trámite de pago de la factura {{folio}} por {{monto}}. Adjuntamos nuevamente el expediente por si requiere complementarse. Agradecemos de antemano su apoyo e indicarnos el área y la fecha estimada de pago. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Identificar el área y la persona que tiene el trámite.",
    "Confirmar que el expediente está completo.",
    "Acordar una fecha de seguimiento."
   ],
   "r": {
    "si": "Está sujeto a disponibilidad presupuestal.",
    "resp": "Gracias por la información. ¿Nos podría indicar el periodo estimado y el área con quien dar seguimiento? Estaremos atentos a cualquier documento que se requiera."
   }
  }
 },
 {
  "id": "ilocalizable-b2b",
  "seg": "B2B",
  "name": "Ilocalizable",
  "causa": "riesgo",
  "origen": "nuevo",
  "mor": "Estructural",
  "def": "Cambió de contacto o domicilio, o la empresa pudo haber desaparecido.",
  "est": [
   "Verificar que exista (SAT, RFC).",
   "Notificación formal.",
   "Evaluar con legal y considerar castigo."
  ],
  "sen": [
   "Teléfonos y direcciones inválidos.",
   "Sin respuesta.",
   "Posible aparición en 69-B (validar)."
  ],
  "tono": "Formal, neutral",
  "canal": "Correo y notificación formal",
  "who": "No responde: cambió de contacto o domicilio, o la empresa pudo haber desaparecido.",
  "ve": [
   "Un contacto o número que ya no usa.",
   "Un cambio de domicilio o razón social."
  ],
  "esc": [
   "Poco: los mensajes no le llegan."
  ],
  "pie": [
   "Sin datos. Si el mensaje llega: “¿quién me busca y por qué?”"
  ],
  "sie": [
   "Sin datos."
  ],
  "hace": [
   "No responde.",
   "Puede haber cambiado de razón social."
  ],
  "dol": [
   "Sin datos."
  ],
  "nec": "Que alguien confirme quién es y dónde está.",
  "pal": "Verificar que existe (SAT, RFC) y notificar por un medio formal.",
  "evi": "Insistir por el mismo canal sin verificar.",
  "pla": {
   "pre": "Hola, buscamos al área de pagos de {{razon_social}} para compartir información de una factura emitida por {{empresa}}. Si usted no es esa persona, disculpe la molestia y avísenos para no volver a escribirle.",
   "hoy": "Hola, ¿nos podría ayudar con el contacto del área de pagos de {{razon_social}}? Escribimos de parte de {{empresa}}. Si usted no es esa persona, disculpe la molestia y avísenos para no volver a escribirle.",
   "a": "Hola, seguimos buscando contacto con el área de pagos de {{razon_social}}, de parte de {{empresa}}. Si este número cambió o la persona ya no labora ahí, avísenos y lo retiramos de nuestra lista.",
   "b": "Hola, retomamos la búsqueda del contacto correcto en {{razon_social}} para {{empresa}}. ¿Nos ayuda con el correo o el teléfono del área de pagos? Gracias por su apoyo.",
   "c": {
    "asunto": "Actualización de datos de contacto",
    "txt": "Estimados: de parte de {{empresa}}, les agradeceremos confirmar el contacto vigente del área de pagos de {{razon_social}} para poder enviarles la información de una factura. Si prefiere no recibir mensajes por este medio, avísenos y lo respetamos."
   },
   "d": [
    "Verificar solo datos públicos de la empresa (RFC, estatus ante el SAT).",
    "Pedir el contacto vigente a la propia empresa; no investigar ni perfilar a personas físicas.",
    "Si no se localiza, escalar al área legal."
   ],
   "r": {
    "si": "Número equivocado, aquí ya no trabaja.",
    "resp": "Gracias por avisarnos. ¿Sabe si hay otro contacto o número de la empresa al que podamos escribir? Eliminaremos este número de nuestra lista."
   },
   "pnota": "No enviar folio ni monto a un contacto no verificado. Validar existencia (RFC, lista 69-B) antes de concluir algo. Si es número equivocado, eliminar el contacto.",
   "noFolio": true
  }
 }
];

export const tipoDeudor = (id: string): TipoDeudor | undefined => TIPOS_DEUDOR.find((t) => t.id === id);
