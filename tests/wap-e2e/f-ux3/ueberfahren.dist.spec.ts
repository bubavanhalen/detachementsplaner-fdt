// F-UX3 in der Einzeldatei (file://): Zonen beim Überfahren für jeden Block, Ziehen ohne vorheriges Wählen. Fiktive
// Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerUeberfahrenTests } from './support/ueberfahren';

registerUeberfahrenTests(() => einzeldateiUrl('i5'));
