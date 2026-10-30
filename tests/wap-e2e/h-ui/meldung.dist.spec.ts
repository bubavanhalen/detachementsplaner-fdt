// H-UI in der Einzeldatei (file://): veraltete Löschmeldung (UX-H-15). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerMeldungTests } from './support/meldung';

registerMeldungTests(() => `${einzeldateiUrl('i5')}#leer`);
