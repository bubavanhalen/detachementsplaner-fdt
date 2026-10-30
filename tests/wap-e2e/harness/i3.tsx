// I3: lokaler Demoeinstieg «Alle Eintragstypen, Seitenfeld, Einstellungen». #leer startet dieselbe App ohne
// mitgelieferte Pläne. Nur fiktive bzw. pseudonymisierte Daten.
import { createRoot } from 'react-dom/client';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import { createI3DemoPlans } from '../i3/support/demo';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <I2Application {...(location.hash === '#leer' ? {} : { demoPlans: createI3DemoPlans() })} />,
  );
}
