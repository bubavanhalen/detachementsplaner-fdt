// H-UI in der Einzeldatei (file://): Feldtasten im Seitenfeld (UX-H-13). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerFeldtastenTests } from './support/feldtasten';

registerFeldtastenTests(() => `${einzeldateiUrl('i5')}#leer`);
