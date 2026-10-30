// H-UI2 im Entwicklungsserver: niedrige Punkte des ux-critic (Zeitformular, leerer Titel, Woche nach Neuladen,
// «gestrichen»). Fiktive Daten.
import { registerNiedrigTests } from './support/niedrig';

registerNiedrigTests(() => '/tests/wap-e2e/harness/i5.html');
