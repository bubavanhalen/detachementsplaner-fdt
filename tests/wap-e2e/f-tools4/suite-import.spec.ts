// F-TOOLS4 im Entwicklungsserver: die echte Suite (index.html → src/main.tsx → src/App.tsx) unter #/wap, damit
// src/pages/WapPage.tsx in der E2E-Abdeckung (V2-e2e, Projekt edge) gemessen wird (FT3-02). Nur fiktive Daten.
import { registerSuiteImportTests } from './support/suite-import';

registerSuiteImportTests(() => '/#/wap', 'entwicklungsserver');
