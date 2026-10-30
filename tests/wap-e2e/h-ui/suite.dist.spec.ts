// H-UI in der Einzeldatei (file://, offline): der WAP-Planer in der ganzen Suite (S-1 bis S-3), nur fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerSuiteTests } from './support/suite';

registerSuiteTests(() => einzeldateiUrl('h-ui'));
