// H-UI2 in der Einzeldatei (file://): Befehlspalette, Speicheranzeige, Hinweis zum gemeinsamen Speicher (UX-H-08,
// SA-H-11). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerPaletteTests } from './support/palette';

registerPaletteTests(() => einzeldateiUrl('i5'), true);
