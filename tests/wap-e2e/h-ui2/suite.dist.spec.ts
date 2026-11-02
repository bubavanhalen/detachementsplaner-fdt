// H-UI2 in der Einzeldatei (file://): WAP-Befehle in der Suite-Palette, Kontrast der Seitenleiste (UX-H-08,
// SA-H-11, SA-H-21). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerSuiteTests } from './support/suite';

registerSuiteTests(() => einzeldateiUrl('h-ui2'), true);
