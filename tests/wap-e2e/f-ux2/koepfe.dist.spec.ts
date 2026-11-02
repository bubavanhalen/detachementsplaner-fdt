// F-UX2 Runde 2 in der Einzeldatei (file://): Köpfe und Termine wie im PDF (VQA-2-01/-02). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerKoepfeTests } from './support/koepfe';

registerKoepfeTests(() => einzeldateiUrl('i5'));
