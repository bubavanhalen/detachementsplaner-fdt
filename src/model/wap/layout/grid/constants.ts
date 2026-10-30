// Feste Werte des Raster-Layouts (Vertrag E1-02d Abschnitt 1, 2c–2e; Anhang B-Kp B-Kp-66).

export const GRID_CONSTANTS: {
  /** Innenabstand der Textfläche zusätzlich zur halben Rahmenbreite (V-02d-9). */
  readonly textInsetPt: 0.5;
  /** Schritt beim Verkleinern bis zur Mindestgrösse (V-02d-8). */
  readonly sizeStepPt: 0.25;
  /** Höchsthöhe eines an den Rand des Zeitbereichs gelegten Teilstücks in Minuten (V-02d-5). */
  readonly maxEdgeMinutes: 30;
  /** Höhe des Marker-Felds in Minuten (0,25 h, B-Kp-66). */
  readonly markerFieldMinutes: 15;
  /** Mindestbreite des Marker-Felds in Gewichtseinheiten des Tages (B-Kp-66). */
  readonly markerFieldUnits: 2;
  /** Abstand Marker-Linie (Mitte) zum Feld in pt (B-Kp-66). */
  readonly markerFieldGapPt: 0.5;
  /** Kürzungszeichen der Rückfallregel (R-10-41). */
  readonly ellipsis: '…';
} = {
  textInsetPt: 0.5,
  sizeStepPt: 0.25,
  maxEdgeMinutes: 30,
  markerFieldMinutes: 15,
  markerFieldUnits: 2,
  markerFieldGapPt: 0.5,
  ellipsis: '…',
};
