import { messeEintrag, registrierteEintraege } from './harness';

declare global {
  var __wapPerf:
    | { eintraege: typeof registrierteEintraege; messe: typeof messeEintrag }
    | undefined;
}

async function initialisiere() {
  try {
    const dateien = import.meta.glob('./entries/*.ts');
    for (const name of Object.keys(dateien).sort()) await dateien[name]?.();
    globalThis.__wapPerf = { eintraege: registrierteEintraege, messe: messeEintrag };
    document.documentElement.dataset.wapPerf = 'bereit';
  } catch {
    Reflect.deleteProperty(globalThis, '__wapPerf');
    document.documentElement.dataset.wapPerf = 'fehler';
  }
}

void initialisiere();
