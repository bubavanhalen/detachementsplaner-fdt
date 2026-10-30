// H-UI2 in der Einzeldatei (file://): niedrige Punkte des ux-critic (Zeitformular, leerer Titel, Woche nach
// Neuladen, «gestrichen»). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerNiedrigTests } from './support/niedrig';

registerNiedrigTests(() => einzeldateiUrl('i5'));
