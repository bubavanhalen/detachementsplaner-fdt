// F-UX2 P2 in der Einzeldatei (file://): Direktbearbeitung im Block (Beschrieb 5.1, UI-Richtlinie 5.4). Fiktive
// Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerDirektTests } from './support/direkt';

registerDirektTests(() => einzeldateiUrl('i5'));
