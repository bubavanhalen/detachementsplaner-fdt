// F-UX2 P4/P5 in der Einzeldatei (file://): Zonen, Zeiger, Hervorhebung, Auffüllen. Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerZonenTests } from './support/zonen';

registerZonenTests(() => einzeldateiUrl('i5'));
