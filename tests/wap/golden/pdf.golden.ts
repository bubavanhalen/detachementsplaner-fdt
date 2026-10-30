// @vitest-environment node
// Golden-Bilder der PDF-Seiten, Ebene 3 (R-H-20, Prompt §7, ADR-010 §7.3; Paket F-TOOLS, Auftraggeber
// 19.10.2026 «7: ja»). Je Kandidat: Render-Kette prüfen, PDF aus dem pseudonymisierten bzw. fiktiven Fixture
// erzeugen, Seite mit pdfjs-dist und @napi-rs/canvas bei 300 dpi rendern (renderPdfPage, E1-01b) und mit der
// Baseline des Manifests vergleichen (Toleranz aus manifest.json, Vorgabe 0 Pixel). Status der Bilder bis zur
// Freigabe des Auftraggebers «vorläufig». Von der Rot-Phase ausgenommen (ADR-010 §3.3).
import { describe, it } from 'vitest';
import { renderPdfPage } from '../support/golden/render';
import { assertRenderChain, vergleicheMitGolden } from './support/golden';
import { PDF_KANDIDATEN } from './support/kandidaten';

describe('Golden-Bilder PDF (Ebene 3)', () => {
  for (const k of PDF_KANDIDATEN) {
    it(`[R-H-20] Golden-Bild ${k.name}: ${k.beschreibung}`, async () => {
      await assertRenderChain();
      const bild = await renderPdfPage(await k.pdf(), k.seite, 300);
      await vergleicheMitGolden(k, bild.png);
    }, 180_000);
  }
});
