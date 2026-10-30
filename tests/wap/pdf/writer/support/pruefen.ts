// Vergleiche mit Toleranz für die PDF-Tests (Paket E1-02c; Vertrag E1-02c §5: Lage, Breite, Seitengrösse
// ± 0,01 pt).
import { expect } from 'vitest';
import type { Rect } from '../../../../../src/model/wap/layout/pageModel';

/** Toleranz für Lage, Breite, Strichbreite und Seitengrösse im PDF (Vertrag E1-02c §5). */
export const TOL_PT = 0.01;

export function nahe(
  ist: number | undefined,
  soll: number,
  name: string,
  tol: number = TOL_PT,
): void {
  expect(ist, `${name}: fehlt`).toBeTypeOf('number');
  expect(
    Math.abs((ist ?? Number.NaN) - soll),
    `${name}: ist ${String(ist)}, soll ${String(soll)}`,
  ).toBeLessThanOrEqual(tol);
}

export function rechteckNahe(
  ist: Rect | undefined,
  soll: Rect,
  name: string,
  tol: number = TOL_PT,
): void {
  expect(ist, `${name}: fehlt`).toBeDefined();
  nahe(ist?.x, soll.x, `${name}.x`, tol);
  nahe(ist?.y, soll.y, `${name}.y`, tol);
  nahe(ist?.w, soll.w, `${name}.w`, tol);
  nahe(ist?.h, soll.h, `${name}.h`, tol);
}

export function zahlenNahe(
  ist: readonly number[] | null | undefined,
  soll: readonly number[],
  name: string,
  tol: number = TOL_PT,
): void {
  expect(ist, `${name}: fehlt`).not.toBeNull();
  expect(ist?.length, `${name}: Anzahl`).toBe(soll.length);
  soll.forEach((s, i) => {
    nahe(ist?.[i], s, `${name}[${String(i)}]`, tol);
  });
}
