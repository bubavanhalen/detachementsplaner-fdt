// F-DOKU im Entwicklungsserver (http://): Gegentest zum Hinweis zum gemeinsamen Speicher (R-L-09). Fiktive Daten.
import { registerSpeicherhinweisTests } from './support/speicherhinweis';

registerSpeicherhinweisTests(() => '/tests/wap-e2e/harness/i5.html', false);
