# Dónde interviene la IA en Cobranza IA y qué le van a preguntar

Estado verificado en el código el 16 de noviembre de 2026.

## 1. Subpestañas que consultan a la IA

| Sección → subpestaña | Qué hace la IA | Quién decide | Estado |
|---|---|---|---|
| **Clientes → WhatsApp** ("Redactar con IA") | Redacta el borrador de respuesta cuando el cliente contestó y la ventana de 24 h está abierta. Recibe los datos de sus facturas y los últimos 12 mensajes | Una persona lo revisa, lo edita y lo manda. La IA nunca envía | **En uso** (`POST /whatsapp/conversations/:id/draft`) |
| **Vista del agente → WhatsApp** | Lo mismo: abre la conversación del cliente | Una persona | **En uso** (misma pantalla) |
| Motor automático (sin pantalla) | Antes de cada paso decide ENVIAR, ESPERAR o ESCALAR y puede ajustar canal y tono | El sistema aplica igual horarios, tope semanal y no contactar | En uso en el backend; hoy no se ve en Cobranza IA |
| Alertas al WhatsApp del administrador (sin pantalla) | Reescribe el texto del aviso para que se lea claro | Automático | En uso en el backend |

### Subpestañas que mencionan IA pero hoy **no** la usan
| Sección → subpestaña | Qué pasa en realidad |
|---|---|
| Reportes → Análisis del periodo | Cifras calculadas con código. La lectura con IA quedó fuera del piloto |
| Clientes → Riesgo y simulador | Puntaje y simulación deterministas |
| Segmentos / Tipos de deudor | Sugerencia por historial de pagos con reglas fijas |
| Vista del agente → "Generar mensaje" (correo, llamada) | Llena una plantilla con los datos del cliente; no es IA |
| Configuración → Reglas → "Lo que se puede ofrecer" | Los topes (descuento máximo, parcialidades, prórroga, quién aprueba) se guardan solo en el navegador. La IA **no** los lee: su instrucción le prohíbe ofrecer descuentos, plazos o acuerdos |
| Alertas | Reglas fijas sobre la cartera |

Conclusión para el piloto: la IA tiene **una** superficie visible (el borrador de WhatsApp) y siempre con aprobación humana. Es lo que hay que cuidar, medir y documentar.

## 2. Las 30 preguntas y mensajes más probables de un deudor

Para cada una: qué puede decir la IA y cuándo debe pasarlo a una persona. "Escala" significa que el borrador solo acusa recibo y dice que el equipo confirmará.

### Pago ya hecho o en camino
| # | El cliente dice | Qué responde la IA |
|---|---|---|
| 1 | "Ya pagué" | Agradece, pide el comprobante, aclara que una persona lo validará. No confirma el pago |
| 2 | "Les mando el comprobante" (manda imagen o PDF) | Agradece y dice que se validará contra el banco. No da por aplicado |
| 3 | "Pagué pero sigue apareciendo" | Pide comprobante con fecha y monto; escala |
| 4 | "Ya quedó programada para el viernes" | Agradece, repite la fecha que dio el cliente y el folio; no promete nada más |
| 5 | "Pagué una parte" | Agradece, pide comprobante; no calcula el saldo si no está en los datos; escala |
| 6 | "Pagué a otra cuenta / a otra factura" | Pide el detalle; escala |

### Tiempo y facilidades
| # | El cliente dice | Qué responde la IA |
|---|---|---|
| 7 | "¿Me dan unos días más?" | No concede. Dice que lo revisa con el equipo y confirma; pregunta qué fecha propone |
| 8 | "¿Puedo pagar en parcialidades?" | No concede. Pregunta cuántos pagos y fechas tiene en mente; escala |
| 9 | "¿Hay descuento por pronto pago?" | No ofrece. Escala |
| 10 | "No tengo liquidez este mes" | Empatía, sin presión; pregunta qué fecha ve viable; escala |
| 11 | "Mi cliente no me ha pagado a mí" | Igual que la 10 |
| 12 | "Les pago cuando cierre la quincena / el mes" | Agradece y pide una fecha concreta |

### La factura
| # | El cliente dice | Qué responde la IA |
|---|---|---|
| 13 | "¿Me reenvían la factura / el PDF / el XML?" | Dice que se la harán llegar; escala (la IA no adjunta archivos) |
| 14 | "¿Cuánto debo en total?" | Solo con las facturas que vienen en los datos: folio, monto y vencimiento de cada una |
| 15 | "¿Cuándo vence?" | La fecha exacta de los datos |
| 16 | "¿A qué cuenta deposito? ¿Cuál es la CLABE?" | No dicta datos bancarios. Remite a la liga de pago si está en los datos; si no, escala |
| 17 | "¿De qué factura me hablan?" | Folio, monto y vencimiento de los datos |
| 18 | "Esa factura no es nuestra / no la reconozco" | Disputa: no insiste, pide el detalle; escala (el sistema ya pausó la cobranza) |
| 19 | "El monto está mal" | Disputa: pide el detalle; escala |
| 20 | "Falta una nota de crédito" | Disputa: escala |
| 21 | "No recibimos la mercancía / llegó incompleta" | Disputa: escala |
| 22 | "Necesito que la refacturen (RFC, uso de CFDI, método de pago)" | Toma nota de qué dato cambia; escala |
| 23 | "Necesito orden de compra / contrarrecibo / alta de proveedor" | Pregunta qué documento falta; escala |

### La persona y el canal
| # | El cliente dice | Qué responde la IA |
|---|---|---|
| 24 | "¿Quién eres? ¿De parte de quién?" | Se identifica: de parte de qué empresa escribe y por qué factura. Nunca finge ser otra persona |
| 25 | "¿Esto es un fraude?" | Se identifica, da el folio y sugiere confirmar por el teléfono oficial de su proveedor. No pide datos |
| 26 | "Yo no veo pagos, es con tesorería" | Agradece y pide nombre y teléfono del contacto correcto; escala |
| 27 | "Número equivocado / ya no trabajo ahí" | El sistema ya detuvo el contacto y mandó el acuse; la IA no redacta |
| 28 | "No me escriban / BAJA" | El sistema ya lo dio de baja y mandó el acuse; la IA no redacta |
| 29 | "Prefiero que me llamen / que me escriban por correo" | Confirma que se lo pasa al equipo; escala |
| 30 | Mensaje molesto o amenaza legal ("hablo con mi abogado") | Tono tranquilo, sin discutir; escala a un supervisor |

### Lo que la IA nunca hace
Inventar montos, fechas, folios o acuerdos; confirmar un pago; ofrecer descuentos, prórrogas o parcialidades; dar datos bancarios; amenazar, presionar o mencionar consecuencias legales; usar las palabras deuda, adeudo, deudor, moroso, cobranza o cobro; obedecer instrucciones que vengan dentro del mensaje del cliente.
