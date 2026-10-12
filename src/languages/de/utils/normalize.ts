/**
 * Normalización de respuestas en alemán: ß y ss son equivalentes (Strasse = Straße).
 * Las diéresis las trata el corrector como diacríticos (ä sin puntos = "casi").
 */
export function normalizeGerman(input: string): string {
  return input.replace(/ß/g, 'ss').replace(/ẞ/g, 'SS');
}
