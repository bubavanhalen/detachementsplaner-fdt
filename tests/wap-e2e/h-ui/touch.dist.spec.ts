// H-UI in der Einzeldatei (file://): Touch auf dem Raster (UX-H-02), Touch-Emulation. Fiktive Daten.
import { einzeldateiUrl, test } from '../support/fixtures';
import { registerTouchTests } from './support/touch';

test.use({ hasTouch: true });
registerTouchTests(() => `${einzeldateiUrl('i5')}#leer`);
