// Zeichnet vorberechnete Flächen und Zeilen der Layout-Schicht im Bildschirmraster (Paket E1-02l; ADR-004 Punkt 4,
// Änderungsnotiz E1-02c Code-Review): Formen als Elemente in px der Zoomstufe (Pfade als SVG in pt), jede Zeile ein Element mit `white-space: pre` an ihrer
// Grundlinie, Schriftgrösse in px der Zoomstufe. Der Browser bricht nie selbst um.

import { type CSSProperties, type JSX, memo } from 'react';
import type { PageItem, Stroke, TextItem } from '../../../model/wap/layout/pageModel';
import { STRIKE_EM } from '../../../model/wap/layout/pageModel';
import type { Rgb } from '../../../model/wap/types';
import type { LayoutRender, ScreenLine, ScreenShapes } from './layoutViews';

function rgb(c: Rgb): string {
  return `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`;
}

function strokeProps(s: Stroke | null) {
  return s === null
    ? { stroke: 'none' }
    : {
        stroke: rgb(s.color),
        strokeWidth: s.widthPt,
        strokeLinecap: 'butt' as const,
        strokeLinejoin: 'miter' as const,
        strokeMiterlimit: 10,
        ...(s.dash === null ? {} : { strokeDasharray: s.dash.join(' ') }),
      };
}

/**
 * Rundung auf Gerätepixel (F-UX2 P3): `x`/`y` = wahre Lage des Ursprungs der Ansicht im Inhalt des Rasters, `ex`/`ey`
 * = gerundete Lage des Elements der Ansicht. Rechtecke und gerade Linien liegen dann wie die Rasterlinien: Kante bei
 * round(x), Strich der Stärke s ab round(x) − ⌊s/2⌋.
 */
export interface PixelSnap {
  readonly x: number;
  readonly y: number;
  readonly ex: number;
  readonly ey: number;
  readonly dpr: number;
}

function snapper(p: PixelSnap | undefined) {
  if (p === undefined) return null;
  const r = (v: number) => Math.round(v * p.dpr) / p.dpr;
  return {
    x: (v: number) => r(p.x + v) - p.ex,
    y: (v: number) => r(p.y + v) - p.ey,
    w: (v: number) => (v <= 0 ? 0 : Math.max(1, Math.round(v * p.dpr)) / p.dpr),
    half: (w: number) => Math.floor((w * p.dpr) / 2) / p.dpr,
  };
}

/**
 * Eine Form der Layout-Schicht. Rechtecke und waagrechte bzw. senkrechte Linien als einfache Elemente (viele SVG-Wurzeln
 * mit eigener Skalierung machten das Ziehen träge, I2b-A A3); nur Pfade (diagonal geteilt, gewellt, offene Kanten) als
 * SVG. Der Strich liegt wie im PDF mittig auf der Kante.
 */
function Shape({
  item,
  shapes,
  snap,
}: {
  readonly item: Exclude<PageItem, TextItem>;
  readonly shapes: ScreenShapes;
  readonly snap?: PixelSnap | undefined;
}): JSX.Element | null {
  const { x0, y0, factor: f } = shapes;
  const sn = snapper(snap);
  if (item.kind === 'image') return null;
  if (item.kind === 'rect') {
    const sw = item.stroke?.widthPt ?? 0;
    const bw = sn === null ? sw * f : sn.w(sw * f);
    const box =
      sn === null
        ? {
            left: (item.rect.x - x0 - sw / 2) * f,
            top: (item.rect.y - y0 - sw / 2) * f,
            width: (item.rect.w + sw) * f,
            height: (item.rect.h + sw) * f,
          }
        : (() => {
            const l = sn.x((item.rect.x - x0) * f) - sn.half(bw);
            const t = sn.y((item.rect.y - y0) * f) - sn.half(bw);
            const r = sn.x((item.rect.x - x0 + item.rect.w) * f) - sn.half(bw) + bw;
            const b = sn.y((item.rect.y - y0 + item.rect.h) * f) - sn.half(bw) + bw;
            return { left: l, top: t, width: Math.max(bw, r - l), height: Math.max(bw, b - t) };
          })();
    const style: CSSProperties = {
      ...box,
      ...(item.fill === null ? {} : { background: rgb(item.fill) }),
      ...(item.stroke === null
        ? {}
        : {
            borderWidth: bw,
            borderStyle: item.stroke.dash === null ? 'solid' : 'dashed',
            borderColor: rgb(item.stroke.color),
          }),
    };
    return (
      <span
        className="i2-grid-shape"
        style={style}
        {...(item.fill === null ? {} : { 'data-flaeche': '' })}
      />
    );
  }
  if (
    item.kind === 'line' &&
    (item.x1 === item.x2 || item.y1 === item.y2) &&
    item.stroke.dash === null
  ) {
    const sw = item.stroke.widthPt;
    const x = Math.min(item.x1, item.x2) - (item.x1 === item.x2 ? sw / 2 : 0);
    const y = Math.min(item.y1, item.y2) - (item.y1 === item.y2 ? sw / 2 : 0);
    const w = item.x1 === item.x2 ? sw : Math.abs(item.x2 - item.x1);
    const h = item.y1 === item.y2 ? sw : Math.abs(item.y2 - item.y1);
    let style: CSSProperties = {
      left: (x - x0) * f,
      top: (y - y0) * f,
      width: w * f,
      height: h * f,
    };
    if (sn !== null) {
      const lw = sn.w(sw * f);
      if (item.x1 === item.x2) {
        const t = sn.y((Math.min(item.y1, item.y2) - y0) * f);
        const b = sn.y((Math.max(item.y1, item.y2) - y0) * f);
        style = { left: sn.x((item.x1 - x0) * f) - sn.half(lw), top: t, width: lw, height: b - t };
      } else {
        const l = sn.x((Math.min(item.x1, item.x2) - x0) * f);
        const r = sn.x((Math.max(item.x1, item.x2) - x0) * f);
        style = { left: l, top: sn.y((item.y1 - y0) * f) - sn.half(lw), width: r - l, height: lw };
      }
    }
    return (
      <span className="i2-grid-shape" style={{ ...style, background: rgb(item.stroke.color) }} />
    );
  }
  // Pfade (gemeinsame Leitung, offenes Ende; I5) in einem SVG nur so gross wie ihr Umriss: Die gefüllte Fläche
  // (data-flaeche) misst dann die Form selbst und nicht die ganze Ebene.
  if (item.kind === 'path') {
    const nums = (item.d.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    // Ohne Kurven günstig als einfaches Element (viele SVG-Wurzeln machten das Ziehen träge, I2b-A A3):
    // gefülltes Vieleck (Dreiecke der gemeinsamen Leitung) mit clip-path, geschlossenes Rechteck als Rahmen.
    if (!/C/.test(item.d) && xs.length >= 3 && xs.length === ys.length) {
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      if (item.stroke === null && item.fill !== null && maxX > minX && maxY > minY) {
        // Umriss auf Gerätepixel wie Rechtecke (P3), Eckpunkte im gerundeten Umriss.
        const L = sn === null ? (minX - x0) * f : sn.x((minX - x0) * f);
        const T = sn === null ? (minY - y0) * f : sn.y((minY - y0) * f);
        const W = sn === null ? (maxX - minX) * f : sn.x((maxX - x0) * f) - L;
        const H = sn === null ? (maxY - minY) * f : sn.y((maxY - y0) * f) - T;
        const poly = xs
          .map(
            (x, i) =>
              `${String(((x - minX) / (maxX - minX)) * W)}px ${String((((ys[i] as number) - minY) / (maxY - minY)) * H)}px`,
          )
          .join(', ');
        return (
          <span
            className="i2-grid-shape"
            data-flaeche=""
            style={{
              left: L,
              top: T,
              width: W,
              height: H,
              background: rgb(item.fill),
              clipPath: `polygon(${poly})`,
            }}
          />
        );
      }
      const rectangle =
        item.fill === null &&
        item.stroke !== null &&
        item.stroke.dash === null &&
        /Z\s*$/.test(item.d) &&
        xs.length === 4 &&
        xs.every((x) => x === minX || x === maxX) &&
        ys.every((y) => y === minY || y === maxY);
      if (rectangle && item.stroke !== null) {
        const sw = item.stroke.widthPt;
        const bw = sn === null ? sw * f : sn.w(sw * f);
        const box =
          sn === null
            ? {
                left: (minX - x0 - sw / 2) * f,
                top: (minY - y0 - sw / 2) * f,
                width: (maxX - minX + sw) * f,
                height: (maxY - minY + sw) * f,
              }
            : {
                left: sn.x((minX - x0) * f) - sn.half(bw),
                top: sn.y((minY - y0) * f) - sn.half(bw),
                width: sn.x((maxX - x0) * f) - sn.x((minX - x0) * f) + bw,
                height: sn.y((maxY - y0) * f) - sn.y((minY - y0) * f) + bw,
              };
        return (
          <span
            className="i2-grid-shape"
            style={{
              ...box,
              borderWidth: bw,
              borderStyle: 'solid',
              borderColor: rgb(item.stroke.color),
            }}
          />
        );
      }
    }
    const pad = item.stroke === null ? 0 : item.stroke.widthPt;
    const bx = Math.min(...xs) - pad;
    const by = Math.min(...ys) - pad;
    const bw = Math.max(...xs) + pad - bx;
    const bh = Math.max(...ys) + pad - by;
    if (xs.length > 0 && ys.length > 0 && bw > 0 && bh > 0)
      return (
        <svg
          className="i2-grid-shapes"
          aria-hidden="true"
          viewBox={`${String(bx)} ${String(by)} ${String(bw)} ${String(bh)}`}
          width={bw * f}
          height={bh * f}
          style={{ left: (bx - x0) * f, top: (by - y0) * f }}
          preserveAspectRatio="none"
          {...(item.fill !== null ? { 'data-flaeche': '' } : {})}
        >
          <path
            d={item.d}
            fill={item.fill === null ? 'none' : rgb(item.fill)}
            fillRule="nonzero"
            {...strokeProps(item.stroke)}
          />
        </svg>
      );
  }
  return (
    <svg
      className="i2-grid-shapes"
      aria-hidden="true"
      viewBox={shapes.viewBox}
      width={shapes.width}
      height={shapes.height}
      preserveAspectRatio="none"
      {...(item.kind === 'path' && item.fill !== null ? { 'data-flaeche': '' } : {})}
    >
      {item.kind === 'line' ? (
        <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...strokeProps(item.stroke)} />
      ) : (
        <path
          d={item.d}
          fill={item.fill === null ? 'none' : rgb(item.fill)}
          fillRule="nonzero"
          {...strokeProps(item.stroke)}
        />
      )}
    </svg>
  );
}

export function Shapes({
  shapes,
  snap,
}: {
  readonly shapes: ScreenShapes;
  readonly snap?: PixelSnap | undefined;
}): JSX.Element {
  return (
    <span
      className={`i2-grid-shape-layer${shapes.clip ? ' is-clipped' : ''}`}
      aria-hidden="true"
      style={{ width: shapes.width, height: shapes.height }}
    >
      {shapes.items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Reihenfolge = Zeichenreihenfolge, unveränderlich je Ansicht
        <Shape key={i} item={item} shapes={shapes} snap={snap} />
      ))}
    </span>
  );
}

const ROTATION: { readonly [R in ScreenLine['rotation']]: string | null } = {
  0: null,
  90: 'rotate(-90deg)',
  270: 'rotate(90deg)',
};

/** Eine Zeile: Oberkante 1em über der Grundlinie, Drehung um den Grundlinienbeginn. */
export function Line({ line }: { readonly line: ScreenLine }): JSX.Element {
  // Drehung 90 (von unten nach oben) ohne CSS-Transformation: Schreibrichtung sideways-lr. Viele gedrehte Zeilen mit
  // eigener Transformation machten das Ziehen träge (I2b-A A3). Grundlinienbeginn wie bei der Drehung um (0, 1em).
  const sideways = line.rotation === 90;
  const length = line.runs.reduce((a, r) => a + r.widthPx, 0);
  const style: CSSProperties = sideways
    ? { left: line.left - line.fontPx, top: line.top + line.fontPx - length, fontSize: line.fontPx }
    : {
        left: line.left,
        top: line.top,
        fontSize: line.fontPx,
        ...(ROTATION[line.rotation] === null
          ? {}
          : { transform: ROTATION[line.rotation] as string }),
      };
  const lineClass = sideways ? 'i2-grid-line is-sideways' : 'i2-grid-line';
  const one = line.runs.length === 1 ? line.runs[0] : undefined;
  if (one !== undefined && !one.strike) {
    // Häufigster Fall: ein Lauf ohne Durchstreichung, ein einziges Element (weniger Elemente beim Ziehen).
    return (
      <span
        className={lineClass}
        style={{ ...style, fontWeight: one.bold ? 700 : 400, color: one.color }}
      >
        {one.text}
      </span>
    );
  }
  let offset = 0;
  const parts: JSX.Element[] = [];
  line.runs.forEach((r, k) => {
    parts.push(
      // biome-ignore lint/suspicious/noArrayIndexKey: Läufe einer Zeile in fester Reihenfolge
      <span key={`r${k}`} style={{ fontWeight: r.bold ? 700 : 400, color: r.color }}>
        {r.text}
      </span>,
    );
    if (r.strike && r.text !== '') {
      const thick = STRIKE_EM.thickness * line.fontPx;
      parts.push(
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: Läufe einer Zeile in fester Reihenfolge
          key={`s${k}`}
          className="i2-grid-strike"
          style={{
            left: offset,
            top: line.fontPx - STRIKE_EM.center * line.fontPx - thick / 2,
            width: r.widthPx,
            height: thick,
            backgroundColor: r.color,
          }}
        />,
      );
    }
    offset += r.widthPx;
  });
  return (
    <span className={lineClass} style={style}>
      {parts}
    </span>
  );
}

export const Lines = memo(function Lines({
  lines,
  left,
}: {
  readonly lines: readonly ScreenLine[];
  /** Versatz in px (z.B. Ausgleich der auf Gerätepixel gerundeten Tageslage; VQA-3-05). */
  readonly left?: number;
}): JSX.Element {
  return (
    <span className="i2-grid-lines" aria-hidden="true" style={left ? { left } : undefined}>
      {lines.map((l, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Zeilen in Zeichenreihenfolge
        <Line key={i} line={l} />
      ))}
    </span>
  );
});

export const RenderedEntry = memo(function RenderedEntry({
  render,
  snap,
}: {
  readonly render: LayoutRender;
  /** Rundung der Formen auf Gerätepixel; Zeilen bleiben an ihrer wahren Lage (F-UX2 P3). */
  readonly snap?: PixelSnap;
}): JSX.Element {
  const dx = snap === undefined ? 0 : snap.x - snap.ex;
  const dy = snap === undefined ? 0 : snap.y - snap.ey;
  return (
    <>
      {render.shapes.items.length > 0 && <Shapes shapes={render.shapes} snap={snap} />}
      {render.lines.length > 0 &&
        (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9 ? (
          <Lines lines={render.lines} />
        ) : (
          <span className="i2-grid-unsnap" style={{ left: dx, top: dy }}>
            <Lines lines={render.lines} />
          </span>
        ))}
    </>
  );
});
