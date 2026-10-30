// E1-02l: Demopläne wie I2b (pseudonymisierte KVK-Daten, fiktive FDT-Woche, Belastungstest). Die FDT-Woche zeigt
// Sa und So wie die KVK-Woche (kompakt, Spaltensatz des Wochenendes), wie eine echte Ausbildungswoche (Beschrieb 4.4,
// 10 «kompakte Tage»).

import type { Plan } from '../../../../src/model/wap/types';
import { createI2bDemoPlans } from '../../i2b/support/demo';

export function createE102lDemoPlans(): readonly Plan[] {
  const [realistic, stress] = createI2bDemoPlans();
  if (realistic === undefined || stress === undefined) return createI2bDemoPlans();
  const kvk = realistic.weeks[0];
  const weeks = realistic.weeks.map((week, index) =>
    index === 0 || kvk === undefined
      ? week
      : {
          ...week,
          days: week.days.map((day, i) => {
            const vorbild = kvk.days[i];
            return (day.weekday === 'Sa' || day.weekday === 'So') && vorbild !== undefined
              ? { ...day, display: vorbild.display, columnSetId: vorbild.columnSetId }
              : day;
          }) as unknown as typeof week.days,
        },
  );
  return [
    { ...realistic, id: 'e1-02l-demo-realistisch', weeks },
    { ...stress, id: 'e1-02l-demo-belastung' },
  ];
}
