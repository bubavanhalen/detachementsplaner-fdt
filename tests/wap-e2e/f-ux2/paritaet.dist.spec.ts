// F-UX2 P1 in der Einzeldatei (file://): Editor-Raster = PDF bei allen Zoomstufen (R-5-01, R-5-02). Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerParitaetTests } from './support/paritaet';

registerParitaetTests(() => einzeldateiUrl('i5'));
