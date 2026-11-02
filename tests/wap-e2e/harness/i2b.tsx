// I2b-A: lokaler Demoeinstieg «Handhabung». #leer startet dieselbe App ohne mitgelieferte Pläne.
import { createRoot } from 'react-dom/client';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import { createI2bDemoPlans } from '../i2b/support/demo';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <I2Application {...(location.hash === '#leer' ? {} : { demoPlans: createI2bDemoPlans() })} />,
  );
}
