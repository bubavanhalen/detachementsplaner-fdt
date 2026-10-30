// I5: lokaler Demoeinstieg «Stand, Prüfregeln, Layout-Ergänzungen, Abläufe». #leer startet ohne mitgelieferte Pläne;
// «gate» im Hash hält das Rendern des Stand-PDF an, bis der Test window.__wapTestGate.open() aufruft (R-L-07,
// deterministisch ohne Zeitabhängigkeit; kein Testcode im Produkt). Nur fiktive bzw. pseudonymisierte Daten.
import { createRoot } from 'react-dom/client';
import { defaultStandRenderers } from '../../../src/components/wap/flows/support';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import type { StandRenderers } from '../../../src/io/wap-plan/standStore';
import { createI5DemoPlans } from '../i5/support/demo';

declare global {
  interface Window {
    __wapTestGate?: { open(): void; waiting(): number };
  }
}

function gatedRenderers(): StandRenderers {
  let opened = false;
  const waiters: (() => void)[] = [];
  window.__wapTestGate = {
    open() {
      opened = true;
      for (const w of waiters.splice(0)) w();
    },
    waiting: () => waiters.length,
  };
  const wait = () =>
    opened ? Promise.resolve() : new Promise<void>((resolve) => waiters.push(resolve));
  const base = defaultStandRenderers();
  return {
    week: async (plan, weekId, title) => {
      await wait();
      return base.week(plan, weekId, title);
    },
    plan: async (plan, title) => {
      await wait();
      return base.plan(plan, title);
    },
  };
}

const hash = location.hash;
const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <I2Application
      {...(hash.includes('leer') ? {} : { demoPlans: createI5DemoPlans() })}
      {...(hash.includes('gate') ? { standRenderers: gatedRenderers() } : {})}
    />,
  );
}
