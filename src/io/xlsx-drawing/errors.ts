// Fehler des gemeinsamen XLSX-Lesemoduls (Vertrag E1-07 §2a). Neutral: keine Abhängigkeit
// zu src/model; die Meldung enthält nur den Code, nie Dateiinhalte, Blattnamen oder Texte.

/** Stabile Codes; der WAP-Import (E1-08) bildet sie auf ImportError und den Meldungskatalog ab. */
export type XlsxErrorCode =
  | 'notXlsx'
  | 'oldXlsFormat'
  | 'corrupt'
  | 'unsupported'
  | 'shapeIndexMismatch'
  | 'calibrationFailed'
  | 'tooLarge';

/** Erwarteter Fehler beim Lesen einer Arbeitsmappe. */
export class XlsxError extends Error {
  readonly code: XlsxErrorCode;

  constructor(code: XlsxErrorCode, options?: { cause?: unknown }) {
    super(`xlsx: ${code}`, options);
    this.name = 'XlsxError';
    this.code = code;
  }
}
