// F-UX2 P3 Bündig (Pixelmessung) in der Einzeldatei (file://). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerBuendigTests } from './support/buendig';

registerBuendigTests(() => einzeldateiUrl('i5'));
