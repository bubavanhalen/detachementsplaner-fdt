// Fiktiver, reichhaltiger Plan-Ausschnitt mit allen Elementarten für Determinismus- und Paritätstests
// (Paket E1-02c, R-L-01; Vertrag E1-02c §2.3 Nr 7, P-14). Zwei Seiten A4 quer: Kopf, Rechtecke mit und ohne
// Strichelung, Linien, Pfad mit Kurve, Läufe regular/bold, gedreht, durchgestrichen, PNG und JPEG (mit
// Metadaten, die der Schreiber entfernt). Jeder Aufruf baut neue Objekte (keine geteilte Identität).
import type { PageModel } from '../../../../../src/model/wap/layout/pageModel';
import { bleibt, entfaellt, exif, jfifOhneVorschau, jpegGrau, pngPalette } from './bilder';
import {
  A4_QUER,
  BLAU,
  fett,
  GRAU,
  GRUEN,
  lauf,
  linie,
  ORANGE,
  pfad,
  ROT,
  rechteck,
  SCHWARZ,
  seite,
  strich,
  VIOLETT,
  zeile,
} from './seiten';

export const BEISPIEL_TITEL = 'WAP Übung «KVK» Wo1 Stand 01';

export function beispielSeiten(): PageModel[] {
  const png = pngPalette({ metadaten: 'FIKTIV-BEISPIEL-PNG' }).bytes;
  const jpeg = jpegGrau({
    vorSof: [bleibt(jfifOhneVorschau()), entfaellt(exif(6, 'FIKTIV-BEISPIEL-EXIF'))],
  }).bytes;
  return [
    seite([
      rechteck({ x: 20, y: 20, w: 801.89, h: 555.28 }, null, strich(SCHWARZ, 0.96)),
      zeile({
        x: 30,
        baselineY: 45,
        sizePt: 12,
        runs: [fett('SCHWEIZER ARMEE'), lauf('  Übung Kp')],
      }),
      rechteck(
        { x: 100, y: 80, w: 120.5, h: 60.25 },
        { r: 255, g: 242, b: 204 },
        strich(GRAU, 0.48, [2, 1]),
      ),
      zeile({
        x: 104,
        baselineY: 92,
        sizePt: 5.5,
        runs: [fett('Sph Det 1 '), lauf('Ausbildung «Wache»', { color: BLAU })],
      }),
      zeile({
        x: 104,
        baselineY: 99,
        sizePt: 5,
        runs: [lauf('abgesagt', { strike: true, color: ROT }), lauf(' 0700-1200')],
      }),
      linie(80, 150, 760, 150, strich(GRAU, 0.24, [1, 2])),
      pfad(
        'M 300 80 L 420 80 L 420 140 C 380 150 340 130 300 140 Z',
        { r: 220, g: 235, b: 250 },
        strich(BLAU, 0.5),
      ),
      zeile({
        x: 60,
        baselineY: 300,
        sizePt: 6,
        rotation: 90,
        runs: [fett('FALCON'), lauf(' Zug 1')],
      }),
      zeile({
        x: 70,
        baselineY: 200,
        sizePt: 6,
        rotation: 270,
        runs: [lauf('HAWK', { strike: true })],
      }),
      zeile({
        x: 500,
        baselineY: 400,
        sizePt: 4.5,
        runs: [lauf('Ä Ö Ü ä ö ü ß é à « » – ’ ; \u2009 x')],
      }),
      {
        role: 'signature',
        kind: 'image',
        rect: { x: 600, y: 480, w: 90, h: 45 },
        mime: 'image/png',
        bytes: png,
      },
      {
        role: 'legend',
        kind: 'image',
        rect: { x: 700, y: 480, w: 40, h: 40 },
        mime: 'image/jpeg',
        bytes: jpeg,
      },
    ]),
    seite(
      [
        rechteck({ x: 40, y: 40, w: 300, h: 100 }, GRUEN, null),
        rechteck({ x: 60, y: 60, w: 100, h: 50 }, ORANGE, strich(VIOLETT, 1.5)),
        zeile({
          x: 70,
          baselineY: 85,
          sizePt: 8,
          runs: [lauf('Fortsetzung', { weight: 'bold', color: SCHWARZ })],
        }),
      ],
      A4_QUER,
      'continuation',
    ),
  ];
}
