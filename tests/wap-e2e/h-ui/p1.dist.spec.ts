// H-UI in der Einzeldatei (file://): P1-Eintrag in andere Spalte ziehen (UX-H-05). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerP1Tests } from './support/p1';

registerP1Tests(() => `${einzeldateiUrl('i5')}#leer`);
