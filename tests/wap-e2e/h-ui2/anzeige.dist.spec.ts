// H-UI2 in der Einzeldatei (file://): Terminbereich per Tastatur, Hinweis «enthält interne Notizen», «geändert» nach
// dem Stand (SA-H-07, SA-H-08, SA-H-09). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerAnzeigeTests } from './support/anzeige';

registerAnzeigeTests(() => einzeldateiUrl('i5'));
