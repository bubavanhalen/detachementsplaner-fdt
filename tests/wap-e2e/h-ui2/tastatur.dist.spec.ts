// H-UI2 in der Einzeldatei (file://): Tagesköpfe, Beso per Tastatur, Teilaufgaben, Zoom (UX-H-06, UX-H-09,
// SA-H-20, SA-H-22). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerTastaturTests } from './support/tastatur';

registerTastaturTests(() => einzeldateiUrl('i5'));
