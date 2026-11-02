// I4: lokaler Einstieg «Listenansicht» mit Demoplänen (pseudonymisierte KVK-Daten, fiktive FDT-Wochen); #leer
// startet dieselbe App ohne mitgelieferte Pläne. Ohne Excel-Import: die Einzeldatei bleibt ohne fflate
// (Werkzeug-Regel «kein Worker in der Einzeldatei»); den Import zeigt die Suite-Seite /wap.
import { createRoot } from 'react-dom/client';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import { createI4DemoPlans } from '../i4/support/demo';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <I2Application {...(location.hash === '#leer' ? {} : { demoPlans: createI4DemoPlans() })} />,
  );
}
