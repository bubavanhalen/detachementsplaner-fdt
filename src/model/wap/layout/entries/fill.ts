// Füllfarben und Schriftfarbe auf Füllungen (Vertrag E1-02d Abschnitt 2e, 2f; Beschrieb 4.6, 4.7; R-4.6-09).

import type { Id, Plan, Rgb } from '../../types';

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/**
 * Farbe der Kategorie in `plan.legend`; null oder unbekannt → Farbe der ersten Kategorie mit
 * `neutral: true`, sonst Weiss {255, 255, 255} (R-4.7-04, R-4.6-48). Wirft nie.
 */
export function categoryFill(plan: Plan, categoryId: Id | null): Rgb {
  const hit = categoryId === null ? undefined : plan.legend.find((c) => c.id === categoryId);
  const color = hit?.color ?? plan.legend.find((c) => c.neutral)?.color ?? WHITE;
  return { r: color.r, g: color.g, b: color.b };
}

/** sRGB-Kanal 0–255 → linearer Anteil nach WCAG 2.x (Schwelle 0,03928). */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function checkChannel(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(
      'textColorForFill: Jeder Farbkanal muss eine ganze Zahl von 0 bis 255 sein.',
    );
  }
}

/**
 * Schwarz {0, 0, 0} oder Weiss {255, 255, 255} mit dem höheren WCAG-Kontrastverhältnis zur Füllung,
 * bei Gleichstand Schwarz.
 * @throws RangeError, wenn ein Kanal keine ganze Zahl 0–255 ist.
 */
export function textColorForFill(fill: Rgb): Rgb {
  checkChannel(fill.r);
  checkChannel(fill.g);
  checkChannel(fill.b);
  const luminance = 0.2126 * linear(fill.r) + 0.7152 * linear(fill.g) + 0.0722 * linear(fill.b);
  const againstBlack = (luminance + 0.05) / 0.05;
  const againstWhite = 1.05 / (luminance + 0.05);
  const color = againstBlack >= againstWhite ? BLACK : WHITE;
  return { r: color.r, g: color.g, b: color.b };
}
