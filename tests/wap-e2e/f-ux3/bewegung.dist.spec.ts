// F-UX3 in der Einzeldatei (file://; Auffüllen hält an Markern, Ziehen auf eigener Ebene, Shift/Alt). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerBewegungTests } from './support/bewegung';

registerBewegungTests(() => einzeldateiUrl('i5'));
