// I4: Testeinstieg mit Excel-Import wie die Suite-Seite /wap (datenfreier Erststart), nur im Entwicklungsserver.
import { createRoot } from 'react-dom/client';
import { I2Application } from '../../../../src/components/wap/i2/I2Application';
import { excelImportEngine } from '../../../../src/components/wap/import/engine';

const root = document.getElementById('root');
if (root !== null) createRoot(root).render(<I2Application importEngine={excelImportEngine} />);
