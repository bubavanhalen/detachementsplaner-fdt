// @vitest-environment jsdom
// Marker-Beschriftung (Vertrag E1-02a Abschnitt 3 derive/marker.ts, 8 P-11; Beschrieb 4.6; F-55).
import { describe, expect, it } from 'vitest';
import { markerLabel } from '../../../../src/model/wap/derive/marker';
import type { MarkerLabelSetting } from '../../../../src/model/wap/types';
import { basePlan, marker } from '../../support/model/builders';

describe('markerLabel', () => {
  const plan = basePlan();

  it('[R-4.6-14] (F-55) Vorgabe: ABV 2330 → «ABV 2330», AV 0700 → «AV», HV 1900 → «HV»', () => {
    expect(markerLabel(marker('e1', 1, { kind: 'ABV', at: 1410 }), plan)).toBe('ABV 2330');
    expect(markerLabel(marker('e2', 2, { kind: 'AV', at: 420 }), plan)).toBe('AV');
    expect(markerLabel(marker('e3', 3, { kind: 'HV', at: 1140 }), plan)).toBe('HV');
  });

  it('[R-4.6-14] (F-55) Einstellung für AV auf «mit Zeit» → «AV 0700»; ABV auf «ohne Zeit» → «ABV»', () => {
    const labels: MarkerLabelSetting[] = [
      { kind: 'AV', withTime: true },
      { kind: 'ABV', withTime: false },
      { kind: 'HV', withTime: false },
      { kind: 'custom', withTime: false },
    ];
    const p = { ...plan, markerLabels: labels };
    expect(markerLabel(marker('e1', 1, { kind: 'AV', at: 420 }), p)).toBe('AV 0700');
    expect(markerLabel(marker('e2', 2, { kind: 'ABV', at: 1410 }), p)).toBe('ABV');
  });

  it('[R-4.6-14] Art «frei» zeigt ihre Bezeichnung, mit Zeit gemäss Einstellung', () => {
    const m = marker('e1', 1, { kind: 'custom', customKind: 'Appell', at: 435 });
    expect(markerLabel(m, plan)).toBe('Appell');
    const p = { ...plan, markerLabels: [{ kind: 'custom', withTime: true } as const] };
    expect(markerLabel(m, p)).toBe('Appell 0715');
  });

  it('[R-4.6-14] fehlt die Einstellung für eine Art, steht sie ohne Zeit; ABV um 2400 → «ABV 2400»', () => {
    const p = { ...plan, markerLabels: [] };
    expect(markerLabel(marker('e1', 1, { kind: 'ABV', at: 1410 }), p)).toBe('ABV');
    expect(markerLabel(marker('e2', 2, { kind: 'ABV', at: 1440 }), plan)).toBe('ABV 2400');
  });
});
