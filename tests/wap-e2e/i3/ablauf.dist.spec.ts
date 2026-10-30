// I3 in der Einzeldatei (file://, offline): dieselben Abläufe wie im Entwicklungsserver.
import { einzeldateiUrl } from '../support/fixtures';
import { registerI3Tests } from './support/ablauf';

registerI3Tests(() => einzeldateiUrl('i3'));
