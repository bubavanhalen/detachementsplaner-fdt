// F-UX2 Runde 5 in der Einzeldatei (file://; ux-critic Runde 3, UX-3-01 bis -03). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerRunde5Tests } from './support/runde5';

registerRunde5Tests(() => einzeldateiUrl('i5'));
