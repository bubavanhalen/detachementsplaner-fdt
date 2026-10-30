// E1-02l: lokaler Demoeinstieg «Raster ohne Kürzung und Überlappung». #leer startet dieselbe App ohne Pläne.
import { createRoot } from 'react-dom/client';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import { createE102lDemoPlans } from '../e1-02l/support/demo';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <I2Application {...(location.hash === '#leer' ? {} : { demoPlans: createE102lDemoPlans() })} />,
  );
}
