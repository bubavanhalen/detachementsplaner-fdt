// F-UX2 P4 in der Einzeldatei (file://): Messung «falscher Eintrag getroffen» (dichte Woche, Det). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerTrefferTests } from './support/treffer';

registerTrefferTests(() => einzeldateiUrl('i5'), 'test-results/wap/f-ux2-treffer-dist.json');
