// H-UI2 im Entwicklungsserver: Sperrdialoge schliessen nie per Esc (SA-H-06, SA-H-19). Nur fiktive Texte.
import { registerSperreTests } from './support/sperre';

registerSperreTests((art) => `/tests/wap-e2e/harness/h-ui2-sperre.html#${art}`);
