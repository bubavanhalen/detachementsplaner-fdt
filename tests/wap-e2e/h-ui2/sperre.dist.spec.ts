// H-UI2 in der Einzeldatei (file://): Sperrdialoge schliessen nie per Esc (SA-H-06, SA-H-19). Nur fiktive Texte.
import { einzeldateiUrl } from '../support/fixtures';
import { registerSperreTests } from './support/sperre';

registerSperreTests((art) => `${einzeldateiUrl('h-ui2-sperre')}#${art}`);
