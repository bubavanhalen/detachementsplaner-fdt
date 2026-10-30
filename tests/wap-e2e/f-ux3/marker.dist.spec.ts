// F-UX3 in der Einzeldatei (file://): Marker immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026).
// Fiktive Daten.
import { einzeldateiUrl } from '../support/fixtures';
import { registerMarkerTests } from './support/marker';

registerMarkerTests(() => einzeldateiUrl('i5'));
