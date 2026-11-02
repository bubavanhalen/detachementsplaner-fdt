// I2b-B in der Einzeldatei (file://, offline): dieselben Abläufe wie im Entwicklungsserver.
import { einzeldateiUrl } from '../support/fixtures';
import { registerI2cTests } from './support/ablauf';

registerI2cTests(() => einzeldateiUrl('i2c'));
