// @vitest-environment node
// I2b-B B5/B8: Dateinamen nach Konvention (Beschrieb 6) und Speicheranzeige / Erinnerung beim Schliessen
// (Beschrieb 5.6 Pkt 1 und 3; UI-Richtlinie 11.3, F-19). Lokale Zeit, fiktive Pläne.
import { describe, expect, it } from 'vitest';
import {
  fileSaveAge,
  namingPlan,
  needsSaveReminder,
  planFileNameFor,
  saveIsStale,
  workingDaysSince,
} from '../../../../src/components/wap/i2/fileNames';
import { pdfFileName } from '../../../../src/model/wap/stand/fileName';
import { basePlan } from '../../support/model/builders';

describe('I2b-B B8 Dateinamen nach Konvention', () => {
  it('[R-5.5-07] PDF «‹Beilage›_WAP_‹Dienst›_‹Kurzname›_Stand_‹Datum›»; vor dem ersten Stand «_Entwurf»', () => {
    const plan = basePlan({ beilage: 'Beilage 01-02', service: 'FDT 2099' });
    const week = { kind: 'week', weekId: 'w27' } as const;
    expect(pdfFileName(namingPlan(plan), week, 1)).toBe('01_02_WAP_FDT_2099_Wow27_Entwurf.pdf');
    const stand = { ...plan, stand: { date: '2099-09-17', version: 1 } };
    expect(pdfFileName(namingPlan(stand), week, 1)).toBe(
      '01_02_WAP_FDT_2099_Wow27_Stand_2099-09-17.pdf',
    );
    // Ohne Dienst steht der Planname an seiner Stelle.
    const named = basePlan({ service: '', exerciseName: 'Übung Säntis' });
    expect(pdfFileName(namingPlan(named), { kind: 'week', weekId: 'w26' }, 1)).toBe(
      'WAP_Übung_Säntis_KVK_Entwurf.pdf',
    );
  });

  it('[R-5.5-07] Plan-Datei mit Planname, Datum und Uhrzeit (eindeutig)', () => {
    const plan = basePlan({ service: 'FDT 2099', exerciseName: 'Probe Nord' });
    expect(planFileNameFor(plan, new Date(2099, 9, 13, 14, 32))).toBe(
      'WAP_FDT_2099_Probe_Nord_Plan_2099-10-13_1432.wap.json',
    );
    expect(
      planFileNameFor(
        basePlan({ service: '', exerciseName: 'Probe/Süd' }),
        new Date(2099, 0, 2, 7, 5),
      ),
    ).toBe('WAP_Probe_Süd_Plan_2099-01-02_0705.wap.json');
    // Gleicher Name wie der Dienst: nur einmal.
    expect(
      planFileNameFor(
        basePlan({ service: 'FDT', exerciseName: 'FDT' }),
        new Date(2099, 0, 2, 7, 5),
      ),
    ).toBe('WAP_FDT_Plan_2099-01-02_0705.wap.json');
  });
});

describe('I2b-B B5 Speicheranzeige und Erinnerung', () => {
  it('[R-5.6-02] «noch nie», «heute», «gestern», «vor n Tagen»', () => {
    const now = new Date(2026, 9, 15, 9, 0);
    expect(fileSaveAge(null, now)).toBe('noch nie');
    expect(fileSaveAge(new Date(2026, 9, 15, 7, 0).toISOString(), now)).toBe('heute');
    expect(fileSaveAge(new Date(2026, 9, 14, 23, 0).toISOString(), now)).toBe('gestern');
    expect(fileSaveAge(new Date(2026, 9, 12, 12, 0).toISOString(), now)).toBe('vor 3 Tagen');
  });

  it('[R-5.6-02] Arbeitstage Mo–Fr nach dem Tag der Sicherung', () => {
    expect(workingDaysSince(new Date(2026, 9, 12), new Date(2026, 9, 13))).toBe(1);
    expect(workingDaysSince(new Date(2026, 9, 9), new Date(2026, 9, 12))).toBe(1);
    expect(workingDaysSince(new Date(2026, 9, 9), new Date(2026, 9, 13))).toBe(2);
    expect(workingDaysSince(new Date(2026, 9, 13), new Date(2026, 9, 13, 23))).toBe(0);
  });

  it('[R-5.6-01] Erinnerung nur mit ungesicherten Änderungen und nach mehr als einem Arbeitstag', () => {
    const fr = new Date(2026, 9, 9, 16).toISOString();
    const state = {
      lastFileSaveAt: fr,
      modifiedAt: new Date(2026, 9, 9, 17).toISOString(),
      firstChangeAt: fr,
    };
    expect(needsSaveReminder(state, new Date(2026, 9, 12, 18))).toBe(false);
    expect(needsSaveReminder(state, new Date(2026, 9, 13, 8))).toBe(true);
    expect(needsSaveReminder({ ...state, modifiedAt: fr }, new Date(2026, 9, 20))).toBe(false);
    const never = { lastFileSaveAt: null, modifiedAt: fr, firstChangeAt: fr };
    expect(needsSaveReminder(never, new Date(2026, 9, 13, 8))).toBe(true);
    expect(needsSaveReminder({ ...never, firstChangeAt: null }, new Date(2026, 9, 30))).toBe(false);
    expect(saveIsStale(state, new Date(2026, 9, 10, 18))).toBe(true);
    expect(saveIsStale(state, new Date(2026, 9, 9, 20))).toBe(false);
  });
});
