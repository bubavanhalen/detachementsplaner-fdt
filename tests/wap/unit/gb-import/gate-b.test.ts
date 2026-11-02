// @vitest-environment jsdom
// GB-IMPORT: Entscheide des Auftraggebers an Gate B (28.10.2026, «All as recommended»), Import und Export.
// 14 b: Der Ort bleibt Teil der Beschriftung eines Markers – der Import übernimmt die ganze Beschriftung als Art frei
// (Marker haben kein Ort-Feld, Beschrieb 4.6); keine Meldung «Ort nicht übernommen» mehr (UX-AB-14 entfällt).
// 15 a: «geändert» ist eine Markierung, kein Status – der Export der Listenansicht führt in der Spalte Status den
// Status; die Markierung bleibt im Plan (UX-AB-F-09). Fiktive Arbeitsmappen und Pläne.
import { describe, expect, it } from 'vitest';
import { listCsv, listRows } from '../../../../src/model/wap/list/index';
import type { Marker } from '../../../../src/model/wap/types';
import { block, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { entries, importWeeks } from '../import/support';

const marker = (o: ReturnType<typeof importWeeks>): Marker | undefined =>
  entries(o.result.plan).find((e): e is Marker => e.type === 'marker');

describe('GB-IMPORT 14 b: Ort in der Marker-Beschriftung (R-4.6-15, R-8.2-20)', () => {
  it('[R-4.6-15][R-8.2-20] «ABV 2330 (Halle Nord)» über zwei Zeilen → Art frei mit der ganzen Beschriftung, Zeit aus der Beschriftung, keine Meldung', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 0], '2330', '2345', [[normal('ABV 2330')], [normal('(Halle Nord)')]]),
        ],
      }),
    ]);
    expect(marker(o)).toMatchObject({
      kind: 'custom',
      customKind: 'ABV 2330 (Halle Nord)',
      at: 1410,
    });
    expect(o.report.items.filter((i) => i.kind === 'uncertainParse')).toEqual([]);
    const row = listRows(o.result.plan, 'plan').find((r) => r.typ === 'Marker');
    expect(row).toMatchObject({ titel: 'ABV 2330 (Halle Nord)', ort: '' });
  });

  it('[R-4.6-15] Gegenprobe: Beschriftung ohne Klammer bleibt Art AV/ABV/HV', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [0, 0], '2330', '2345', [[normal('ABV 2330')]])] }),
    ]);
    expect(marker(o)).toMatchObject({ kind: 'ABV', customKind: '', at: 1410 });
  });
});

describe('GB-IMPORT 15 a: «geändert» im Export (R-6-13, R-6-16)', () => {
  it('[R-6-13][R-6-16] Export der Listenansicht führt bei «geändert» den Status «bestätigt»; Plan und Listenzeile behalten die Markierung', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 0], '0800', '0900', [
            [{ text: 'Ausb fiktiv', bold: true, color: 'C00000' }],
          ]),
        ],
      }),
    ]);
    const plan = o.result.plan;
    const b = entries(plan).find((e) => e.type === 'block');
    expect(b).toMatchObject({ status: 'confirmed', changed: true });
    expect(listRows(plan, 'plan').find((r) => r.typ === 'Block')?.status).toBe('geändert');
    const [kopf, ...zeilen] = listCsv(plan, 'plan').trimEnd().split('\n');
    const i = (kopf ?? '').split(';').indexOf('Status');
    const status = zeilen.map((z) => z.split(';')[i]);
    expect(status).toContain('bestätigt');
    expect(status).not.toContain('geändert');
  });
});
