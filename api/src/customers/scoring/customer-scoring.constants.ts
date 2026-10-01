/**
 * Score (0-100) a partir del cual un cliente es "buen pagador" (FR-05,
 * spec "Mejoras V1"): CollectionSequencesService lo excluye de pasos
 * agresivos (tono FIRM/URGENT o que escalan a un humano), aunque sigue
 * recibiendo los pasos GENTLE/STANDARD normales.
 */
export const GOOD_PAYER_SCORE_THRESHOLD = 95;

/**
 * Caída de puntos a partir de la cual se considera que la puntualidad de un
 * cliente "cae significativamente" (FR-04, ej. de 93% a 61% en la propia
 * especificación de Paolo) y se alerta a los admins de la organización.
 */
export const SCORE_DROP_ALERT_THRESHOLD = 15;
