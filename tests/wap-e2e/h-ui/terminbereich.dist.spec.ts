// H-UI in der Einzeldatei (file://): Terminbereich aus der Layout-Schicht (CR-H-U-04). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerTerminbereichTests } from './support/terminbereich';

registerTerminbereichTests(() => `${einzeldateiUrl('i5')}#leer`);
