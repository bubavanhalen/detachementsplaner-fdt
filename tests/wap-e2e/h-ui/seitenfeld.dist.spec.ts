// H-UI in der Einzeldatei (file://): Übernahme im Seitenfeld (UX-H-01). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerSeitenfeldTests } from './support/seitenfeld';

registerSeitenfeldTests(() => `${einzeldateiUrl('i5')}#leer`);
