// H-UI2 in der Einzeldatei (file://): Kopf- und Werkzeugleiste mit Planmenü und «Mehr …» (UX-H-03). Fiktive
// Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerLeistenTests } from './support/leisten';

registerLeistenTests(() => einzeldateiUrl('i5'));
