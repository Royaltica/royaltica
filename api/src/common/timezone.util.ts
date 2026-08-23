/**
 * Utilidades de zona horaria compartidas para evaluar ventanas de contacto
 * permitido (cobranza por email/WhatsApp/SMS, y llamadas con IA). Extraído
 * de CollectionSequencesService para reutilizarse también en el guardrail
 * de llamadas (CallGuardrailsService) sin duplicar la lógica.
 */

/** Hora local (0-23) de `date` en la zona horaria IANA `timezone`. */
export function localHour(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
    // Algunos runtimes devuelven "24" para la medianoche.
    return Number(hourPart) % 24;
  } catch {
    // Zona horaria inválida: no bloquea el envío, usa la hora UTC.
    return date.getUTCHours();
  }
}

/** Clave YYYY-MM-DD de `date` en la zona horaria indicada (para comparar blackout dates). */
export function dateKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** `true` si `date` cae en alguna de las `blackoutDates` (comparando por día, en `timezone`). */
export function isBlackoutDate(
  date: Date,
  blackoutDates: Date[],
  timezone: string,
): boolean {
  const key = dateKey(date, timezone);
  return blackoutDates.some((d) => dateKey(d, timezone) === key);
}

/** `true` si la hora local de `date` cae dentro de [startHour, endHour). */
export function isWithinContactWindow(
  date: Date,
  timezone: string,
  startHour: number,
  endHour: number,
): boolean {
  const hour = localHour(date, timezone);
  return hour >= startHour && hour < endHour;
}
