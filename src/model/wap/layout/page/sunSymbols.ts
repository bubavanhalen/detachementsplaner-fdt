// Sonnen- und Mondsymbol der Sonnentabelle als gefüllte Vektorpfade (Vertrag E1-02e, Notiz «Ausarbeitung
// Schritt 2» Abschnitt E4 «Sonnentabelle», V-02e-8; Pfadgrammatik Vertrag E1-02c V06: nur M, L, C, Z).
// Intern: nicht über page/index.ts exportiert. Rein (R-L-02).

import type { Rect } from '../pageModel';
import { pathNumber } from './common';

const P = pathNumber;

/** Kreisbogen ab dem aktuellen Punkt (Winkel a0) bis a1 als kubische Bézier-Segmente zu höchstens 90°. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string[] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const da = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan(da / 4);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * da;
    const t1 = t0 + da;
    const x0 = cx + r * Math.cos(t0);
    const y0 = cy + r * Math.sin(t0);
    const x3 = cx + r * Math.cos(t1);
    const y3 = cy + r * Math.sin(t1);
    const x1 = x0 - k * r * Math.sin(t0);
    const y1 = y0 + k * r * Math.cos(t0);
    const x2 = x3 + k * r * Math.sin(t1);
    const y2 = y3 - k * r * Math.cos(t1);
    out.push(`C ${P(x1)} ${P(y1)} ${P(x2)} ${P(y2)} ${P(x3)} ${P(y3)}`);
  }
  return out;
}

/** Sonne: Kreis mit acht Strahlen (je ein schmales Viereck), zentriert in der Zelle. */
export function sunPath(cell: Rect): string {
  const cx = cell.x + cell.w / 2;
  const cy = cell.y + cell.h / 2;
  const s = Math.min(cell.w, cell.h);
  const r = 0.17 * s;
  const r0 = 0.25 * s;
  const r1 = 0.4 * s;
  const half = 0.03 * s;
  const parts = [`M ${P(cx + r)} ${P(cy)}`, ...arc(cx, cy, r, 0, 2 * Math.PI), 'Z'];
  for (let i = 0; i < 8; i++) {
    const t = (i * Math.PI) / 4;
    const ux = Math.cos(t);
    const uy = Math.sin(t);
    const nx = -uy * half;
    const ny = ux * half;
    const ax = cx + ux * r0;
    const ay = cy + uy * r0;
    const bx = cx + ux * r1;
    const by = cy + uy * r1;
    parts.push(
      `M ${P(ax + nx)} ${P(ay + ny)}`,
      `L ${P(bx + nx)} ${P(by + ny)}`,
      `L ${P(bx - nx)} ${P(by - ny)}`,
      `L ${P(ax - nx)} ${P(ay - ny)}`,
      'Z',
    );
  }
  return parts.join(' ');
}

/**
 * Mondsichel aus zwei Kreisbögen gleichen Radius: der äussere Bogen links herum zwischen den Schnittpunkten,
 * der innere (um d nach rechts versetzte) Kreis zurück.
 */
export function moonPath(cell: Rect): string {
  const cx = cell.x + cell.w / 2;
  const cy = cell.y + cell.h / 2;
  const r = 0.34 * Math.min(cell.w, cell.h);
  const d = 0.55 * r;
  const a = Math.acos(d / (2 * r));
  const q = Math.sqrt(r * r - (d / 2) * (d / 2));
  const start = `M ${P(cx + d / 2)} ${P(cy - q)}`;
  // Äusserer Kreis: von −a über π (links) bis +a (gleichwertig −2π + a).
  const outer = arc(cx, cy, r, -a, a - 2 * Math.PI);
  // Innerer Kreis (Mittelpunkt cx + d): vom unteren Schnittpunkt (π − a) über π zum oberen (π + a).
  const inner = arc(cx + d, cy, r, Math.PI - a, Math.PI + a);
  return [start, ...outer, ...inner, 'Z'].join(' ');
}
