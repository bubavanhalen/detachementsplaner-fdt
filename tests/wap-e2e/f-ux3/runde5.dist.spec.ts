// F-UX3 Runde 5 in der Einzeldatei (file://; Code-Review F-UX3). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerRunde5Tests } from './support/runde5';

registerRunde5Tests(() => einzeldateiUrl('i5'));
