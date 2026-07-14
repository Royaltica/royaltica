/**
 * Validadores puros de formato (RFC, CLABE). Sin dependencias de React ni de
 * estado — extraídos de App.tsx como parte de la Fase A de la división del
 * archivo monolítico (ver docs/plan-division-apptsx.md en la carpeta del
 * equipo, fuera de este repo). Código idéntico al original, solo reubicado.
 */

export function validateRFC(
  rfc: string,
): { valid: boolean; type?: 'moral' | 'fisica'; error?: string } {
  const rfcClean = rfc.toUpperCase().trim();

  // Moral person: 3 letters + 6 digits + 3 alphanumeric
  const moralRegex = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;
  // Physical person: 4 letters + 6 digits + 3 alphanumeric
  const fisicaRegex = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;

  if (moralRegex.test(rfcClean)) {
    // Validate date portion (positions 3-8)
    const dateStr = rfcClean.substring(3, 9);
    const year = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { valid: false, error: 'Fecha inválida en el RFC' };
    }
    return { valid: true, type: 'moral' };
  }

  if (fisicaRegex.test(rfcClean)) {
    const dateStr = rfcClean.substring(4, 10);
    const year = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { valid: false, error: 'Fecha inválida en el RFC' };
    }
    return { valid: true, type: 'fisica' };
  }

  if (rfcClean.length < 12) return { valid: false, error: 'RFC demasiado corto (mín. 12 caracteres)' };
  if (rfcClean.length > 13) return { valid: false, error: 'RFC demasiado largo (máx. 13 caracteres)' };
  return { valid: false, error: 'Formato de RFC inválido. Verifica letras y dígitos.' };
}

export function validateCLABE(
  clabe: string,
): { valid: boolean; bank?: string; error?: string } {
  if (!/^\d{18}$/.test(clabe)) return { valid: false, error: 'Debe tener exactamente 18 dígitos' };

  // Bank codes (first 3 digits)
  const BANK_CODES: Record<string, string> = {
    '002': 'BBVA', '012': 'BBVA Bancomer', '014': 'Santander', '021': 'HSBC',
    '030': 'Bajío', '036': 'Inbursa', '042': 'Mifel', '044': 'Scotiabank',
    '058': 'Banregio', '059': 'Invex', '060': 'Bansi', '062': 'Afirme',
    '072': 'Banorte', '106': 'Bank of America', '108': 'MUFG', '112': 'Bmonex',
    '113': 'Ve por Más', '127': 'Azteca', '128': 'Autofin', '130': 'Compartamos',
    '136': 'Intercam', '137': 'Bancoppel', '138': 'ABC Capital', '140': 'Consubanco',
    '141': 'Volkswagen', '143': 'CIBanco', '145': 'Bbase', '166': 'BanCrea',
    '168': 'Hipotecaria Federal', '600': 'Monex', '602': 'Masari', '606': 'Arcus',
    '616': 'Finamex', '617': 'Valmex', '620': 'Profuturo', '630': 'CB Intercam',
    '631': 'CI Bolsa', '634': 'Fincomún', '638': 'Nu México', '646': 'STP',
    '659': 'Fondos Únicos', '670': 'Libertad Serv. Fin.', '684': 'Transfer',
    '722': 'Mercado Pago', '706': 'Arcus', '902': 'Indeval', '903': 'CoDi',
  };

  const bankCode = clabe.substring(0, 3);
  const bank = BANK_CODES[bankCode];
  if (!bank) return { valid: false, error: `Código de banco desconocido: ${bankCode}` };

  // Verify check digit (modulo 10)
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (parseInt(clabe[i]) * weights[i]) % 10;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== parseInt(clabe[17])) {
    return { valid: false, error: `Dígito verificador inválido (esperado: ${checkDigit})` };
  }

  return { valid: true, bank };
}
