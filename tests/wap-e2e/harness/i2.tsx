// AE-005: lokaler I2-Demoeinstieg. #leer startet dieselbe App ohne mitgelieferte Pläne.
import { createRoot } from 'react-dom/client';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import { createI2DemoPlans } from '../i2/support/demo';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <I2Application {...(location.hash === '#leer' ? {} : { demoPlans: createI2DemoPlans() })} />,
  );
}
