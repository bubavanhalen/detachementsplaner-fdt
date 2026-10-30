// Zeitspanne eines Beso-Kästchens (Vertrag E1-02d Abschnitt 2c; Beschrieb 4.6 «Beso im Detail», F-05).

import type { LevelTemplate } from '../../template';
import type { MilTime, TimeSpec } from '../../types';
import type { TimeSpan } from '../grid/types';

/** Höhe eines Kästchens der Vorlage 'fixed30' bzw. einer Zeitform ohne Dauer in Minuten (F-05). */
const BOX_MINUTES = 30;
/** Eine Frist ohne Uhrzeit liegt am Beginn des Zeitbereichs, eine Stunde nach dem Anzeigebeginn (B-F-06). */
const BAND_MINUTES = 60;

/**
 * Vorlage 'fixed30' (Kp): point [at, at+30]; range [from, from+30]; from [X, X+30]; until [X−30, X];
 * deadline mit to [to−30, to]; deadline ohne to [displayFrom+60, displayFrom+90].
 * Vorlage 'duration' (Bat, Etappe 3): range [from, to], sonst wie 'fixed30'. Wirft nie.
 */
export function besoBoxSpan(
  time: TimeSpec,
  template: LevelTemplate,
  displayFrom: MilTime,
): TimeSpan {
  switch (time.form) {
    case 'point':
      return { from: time.at, to: time.at + BOX_MINUTES };
    case 'range':
      return template.besoBox.height === 'duration'
        ? { from: time.from, to: time.to }
        : { from: time.from, to: time.from + BOX_MINUTES };
    case 'from':
      return { from: time.from, to: time.from + BOX_MINUTES };
    case 'until':
      return { from: time.to - BOX_MINUTES, to: time.to };
    case 'deadline':
      return time.to === undefined
        ? { from: displayFrom + BAND_MINUTES, to: displayFrom + BAND_MINUTES + BOX_MINUTES }
        : { from: time.to - BOX_MINUTES, to: time.to };
  }
}
