// F-DOKU in der Einzeldatei (file://): Hinweis zum gemeinsamen Speicher (R-L-09). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerSpeicherhinweisTests } from './support/speicherhinweis';

registerSpeicherhinweisTests(() => einzeldateiUrl('i5'), true);
