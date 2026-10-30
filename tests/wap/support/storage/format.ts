// Testformate für die Prüfnaht F1 (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2»
// Abschnitte F1, F5, L R-H-33 Nr 4, 4a, 5 und M1): Folgeversion 2 mit wählbarer Migration. «Motto-Migration»
// (fiktiv, strukturell, `additive: false`): hängt « (v2)» an das Motto und wirft bei einem Kennwort im Motto.
// «Identitätsmigration» (`additive: true`): liefert das Dokument unverändert; E4 lässt in Etappe 1 kein weiteres Feld
// zu, eine echt ergänzende Migration ist deshalb nicht baubar (Nr 4a). Keine E1-04-Logik.
import type { FormatMigration, PlanFormat } from '../../../../src/io/wap-plan/planFile';

/** Zusatz der Motto-Migration. */
export const MOTTO_ZUSATZ = ' (v2)';
/** Kennwort im Motto, bei dem die Motto-Migration wirft (R-H-33 Nr 5). */
export const KENNWORT = 'UMSTELLUNG-SCHEITERT';

/** Motto-Migration: `motto` + « (v2)»; wirft bei `KENNWORT` im Motto. Rein. */
export function mottoMigration(plan: unknown): unknown {
  const p = plan as Record<string, unknown>;
  const m = typeof p.motto === 'string' ? p.motto : '';
  if (m.includes(KENNWORT)) throw new Error('Testmigration: Kennwort im Motto');
  return { ...p, motto: `${m}${MOTTO_ZUSATZ}` };
}

/** Identitätsmigration: liefert das Dokument unverändert (ausdrücklich so benannt, R-H-33 Nr 4a). */
export function identitaetsMigration(plan: unknown): unknown {
  return plan;
}

/** Testformat Version 2 mit einer Migration von 1 nach 2 (Prüfnaht F1). */
export function testFormatV2(migrate: (plan: unknown) => unknown, additive: boolean): PlanFormat {
  const m: FormatMigration = { fromVersion: 1, additive, migrate };
  return { version: 2, migrations: [m] };
}

/** Testformat v2 mit Motto-Migration, strukturell (`additive: false`). */
export function mottoFormat(): PlanFormat {
  return testFormatV2(mottoMigration, false);
}

/** Testformat v2 mit Identitätsmigration, ergänzend (`additive: true`). */
export function identitaetsFormat(): PlanFormat {
  return testFormatV2(identitaetsMigration, true);
}
