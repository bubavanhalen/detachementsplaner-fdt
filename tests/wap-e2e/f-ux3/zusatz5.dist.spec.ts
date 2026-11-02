// F-UX3 Zusatz zu Runde 5 in der Einzeldatei (file://; Bedienungsprüfung ux-critic F-UX3). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerZusatz5Tests } from './support/zusatz5';

registerZusatz5Tests(() => einzeldateiUrl('i5'));
