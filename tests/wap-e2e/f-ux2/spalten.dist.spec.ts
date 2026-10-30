// F-UX2 P6 Spalten im Spaltenkopf in der Einzeldatei (file://). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerSpaltenTests } from './support/spalten';

registerSpaltenTests(() => einzeldateiUrl('i5'));
