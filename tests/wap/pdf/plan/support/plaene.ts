// Fiktive Pläne und Bilder der Tests von Paket E1-02f (Vertrag docs/wap-planer/plan/vertraege/E1-02f.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitte H, I, J und Änderungsnotiz aus E1-02e CR-03 Nr 5). Alle Varianten
// entstehen im Testcode aus der pseudonymisierten KVK-Fixture (E1-02a) bzw. den Bausteinen von E1-02e; alle
// neuen Texte sind erfunden. Gemeinsam genutzt von tests/wap/pdf/plan/** (Vitest) und der Node-Seite der
// Paritätstests (tests/wap-e2e/parity/support/node-seite.ts, über Vite im Kindprozess).
import type { PageOptions } from '../../../../../src/model/wap/layout/page/types';
import { builtInTemplates } from '../../../../../src/model/wap/template';
import type {
  DayRemark,
  Entry,
  Id,
  ImageAsset,
  IsoDate,
  Plan,
  Week,
} from '../../../../../src/model/wap/types';
import { dayRemark } from '../../../support/model/builders';
import { KVK_WOCHE, kvk, MO, mitEintraegen, woche } from '../../../support/page/varianten';
import { base64 } from '../../../support/page/wappen';
import { PNG_SIGNATUR, pngBlock, verkette } from '../../writer/support/bilder';

/** Fester Titel aller Test-PDF dieses Pakets (Vertrag H1). */
export const PDF_TITEL = 'E1-02f Test';

/** Optionen wie in der Harness (Vertrag E): A4, Status an, mitgelieferte Vorlagen. */
export function optionen(over: Partial<PageOptions> = {}): PageOptions {
  return { paper: 'A4', showStatus: true, templates: builtInTemplates(), ...over };
}

/** `n` einzeilige Tagesbemerkungen «‹prefix› 01» … am Datum `datum` mit Ids ab `start` (Vertrag I). */
export function tagesbemerkungen(
  n: number,
  datum: IsoDate,
  start: number,
  prefix = 'Bemerkung',
): DayRemark[] {
  return Array.from({ length: n }, (_, i) =>
    dayRemark(`e${String(start + i)}`, start + i, {
      date: datum,
      text: `${prefix} ${String(i + 1).padStart(2, '0')}`,
    }),
  );
}

/** Fortsetzungsvariante (Vertrag I): KVK mit 40 einzeiligen Tagesbemerkungen am Mo, «Bemerkung 01» … */
export function fortsetzung(): Plan {
  return mitEintraegen(kvk(), tagesbemerkungen(40, MO, 600));
}

/** Woche als Kopie von `quelle` mit eigener Id, Bezeichnung, Kurzname und Beginn, ohne Wochenziele. */
export function wochenKopie(
  quelle: Week,
  id: Id,
  label: string,
  shortName: string,
  startDate: IsoDate,
): Week {
  return {
    ...quelle,
    id,
    label,
    shortName,
    startDate,
    weekGoals: [],
    heightenedReadiness: '',
    hiddenRemarkIds: [],
  };
}

/** Wochen des Drei-Wochen-Plans (P2): A = KVK-Woche, B und C fiktive Folgewochen. */
export const DREI_WOCHEN = {
  a: { id: KVK_WOCHE, label: 'Woche A', shortName: 'WoA', start: '2026-09-28' },
  b: { id: 'w801', label: 'Woche B', shortName: 'WoB', start: '2026-10-05' },
  c: { id: 'w802', label: 'Woche C', shortName: 'WoC', start: '2026-10-12' },
} as const;

/**
 * Fiktiver Drei-Wochen-Plan A, B, C (Vertrag J P2): A ist die KVK-Woche mit Bezeichnung «Woche A», B und C sind
 * Kopien ihres Rahmens eine bzw. zwei Wochen später; B hat 40 einzeilige Tagesbemerkungen an ihrem Montag und
 * damit eine Fortsetzungsseite.
 */
export function dreiWochen(): Plan {
  const p = kvk();
  const a = woche(p, KVK_WOCHE);
  const { b, c } = DREI_WOCHEN;
  const plan: Plan = {
    ...p,
    weeks: [
      { ...a, label: DREI_WOCHEN.a.label, shortName: DREI_WOCHEN.a.shortName },
      wochenKopie(a, b.id, b.label, b.shortName, b.start),
      wochenKopie(a, c.id, c.label, c.shortName, c.start),
    ],
  };
  return mitEintraegen(plan, tagesbemerkungen(40, b.start, 700, 'Hinweis'));
}

/** Plan mit einer zusätzlichen, leeren Folgewoche (Kopie des Rahmens der ersten Woche, eine Woche später). */
export function mitFolgewoche(plan: Plan): Plan {
  const erste = plan.weeks[0];
  if (erste === undefined) throw new Error('Testplan ohne Woche');
  return {
    ...plan,
    weeks: [...plan.weeks, wochenKopie(erste, 'w803', 'Folgewoche', 'Folge', '2026-10-05')],
  };
}

/** Plan mit Wappen aus den angegebenen Bytes. */
export function mitWappen(plan: Plan, mime: ImageAsset['mime'], bytes: Uint8Array): Plan {
  return { ...plan, coatOfArms: { mime, dataBase64: base64(bytes) } };
}

/** Plan mit geändertem Eintrag. */
export function mitEintrag(plan: Plan, e: Entry): Plan {
  return { ...plan, entries: { ...plan.entries, [e.id]: e } };
}

/** IHDR eines PNG mit Breite w, Höhe h, 8 Bit RGB. */
function ihdr(w: number, h: number): Uint8Array {
  const d = new Uint8Array(13);
  const v = new DataView(d.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  d.set([8, 2, 0, 0, 0], 8);
  return pngBlock('IHDR', d);
}

/** Fiktives PNG nur aus Signatur und IHDR (2 × 1 px), ohne IDAT und IEND (Änderungsnotiz CR-03 Nr 5, P9). */
export function pngNurIhdr(): Uint8Array {
  return verkette([PNG_SIGNATUR, ihdr(2, 1)]);
}

/** PNG mit IHDR (2 × 1 px), IDAT aus nicht entpackbaren Bytes und IEND (P10). */
export function pngIdatKaputt(): Uint8Array {
  return verkette([
    PNG_SIGNATUR,
    ihdr(2, 1),
    pngBlock('IDAT', Uint8Array.from([0x13, 0x57, 0x9b, 0xdf, 0x02, 0x46, 0x8a, 0xce])),
    pngBlock('IEND', new Uint8Array(0)),
  ]);
}

/**
 * PNG aus Signatur, IHDR (2 × 1 px, Tiefe 8, Farbtyp 2), einem IDAT ohne Daten (Länge 0) und IEND (Änderungsnotiz
 * Test-Review Runde 1 Nr 1): `sanitizeImageBytes` nimmt es an, pdf-lib lehnt es ab.
 */
export function pngLeeresIdat(): Uint8Array {
  return verkette([
    PNG_SIGNATUR,
    ihdr(2, 1),
    pngBlock('IDAT', new Uint8Array(0)),
    pngBlock('IEND', new Uint8Array(0)),
  ]);
}

/** Länge zweier Bytes (big endian). */
function laenge(n: number): number[] {
  return [n >> 8, n & 0xff];
}

/** JPEG-Segment 0xFF<marker> mit Längenfeld. */
function segment(marker: number, daten: readonly number[]): number[] {
  return [0xff, marker, ...laenge(daten.length + 2), ...daten];
}

/**
 * JPEG mit SOI, SOF C0 (2 × 1 px, eine Komponente), SOS mit Scan aus beliebigen Bytes und EOI (P10; ohne
 * Quantisierungs- und Huffman-Tabellen, also nicht dekodierbar).
 */
export function jpegScanBeliebig(): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    ...segment(0xc0, [8, ...laenge(1), ...laenge(2), 1, 1, 0x11, 0]),
    ...segment(0xda, [1, 1, 0x00, 0, 63, 0]),
    0x12,
    0x34,
    0x56,
    0x78,
    0x9a,
    0xff,
    0xd9,
  ]);
}
