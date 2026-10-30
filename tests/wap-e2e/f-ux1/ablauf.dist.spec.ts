// F-UX1 in der Einzeldatei (file://): dieselben Abläufe wie im Entwicklungsserver. Nur fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerFUx1Tests } from './support/ablauf';

registerFUx1Tests(() => einzeldateiUrl('i5'));
