// H-UI in der Einzeldatei (file://): Direktbearbeitung, Beso-Titel, Kopie beim Ziehen (CR-H-U-05, -06, -10).
// Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerEditorTests } from './support/editor';

registerEditorTests(() => `${einzeldateiUrl('i5')}#leer`);
