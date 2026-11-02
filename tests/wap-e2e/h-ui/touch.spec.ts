// H-UI im Entwicklungsserver: Touch auf dem Raster (UX-H-02), Touch-Emulation. Fiktive Daten.
import { test } from '../support/fixtures';
import { registerTouchTests } from './support/touch';

test.use({ hasTouch: true });
registerTouchTests(() => '/tests/wap-e2e/harness/i5.html#leer');
