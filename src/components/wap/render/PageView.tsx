// Bildschirm-Zeichner einer Seite (Vertrag E1-02c Abschnitt 3.2, 3.3; ADR-004 Punkt 4, Leitplanke 2).
// Zeichnet nur das vorberechnete Seitenmodell: jede Zeile ein Element mit `white-space: pre` an ihrer
// Grundlinie, Formen als SVG in Zeichenreihenfolge, feste Auflösung 4 px pro pt mit Skalierung per CSS.
// Der Browser bricht nie selbst um; Text erscheint nie in einer Ersatzschrift.

import {
  type CSSProperties,
  type JSX,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PageModel, TextItem } from '../../../model/wap/layout/pageModel';
import { STRIKE_EM } from '../../../model/wap/layout/pageModel';
import { measureRuns } from '../../../model/wap/layout/text/measure';
import type { Rgb } from '../../../model/wap/types';
import { type Ebene, ebenenVon, type Form } from './ebenen';
import { ensureScreenFont, SCREEN_FONT_MESSAGE } from './screenFont';
import './pageView.css';

export interface PageViewProps {
  readonly page: PageModel;
  /** px pro pt (Zoom), endlich und > 0; Umbrüche bleiben unverändert (R-5-02). */
  readonly scale: number;
  /** Zugänglicher Name des Containers, z.B. «Wochenseite KVK». */
  readonly label: string;
  /** Bedien- und Prüfmarken, nur Bildschirm (R-5-03); liegen über dem Papier, Koordinaten in px der Zoomstufe. */
  readonly overlay?: ReactNode;
  /** true: Die zugängliche Struktur liefert das Overlay (E1-12); das Papier ist dann `aria-hidden`. Standard false. */
  readonly semanticsProvidedByOverlay?: boolean;
}

/** Feste Auflösung des Papiers: 4 px pro pt (ADR-004 Punkt 4, AR0-13 b). */
const PX_PRO_PT = 4;

type Schriftstand = 'laden' | 'bereit' | 'fehler';

/** Stand der Bildschirmschrift in diesem Dokument; bekannt, sobald der eine Ladevorgang abgeschlossen ist. */
let bekannterStand: Schriftstand = 'laden';

/** Folgt dem einen Ladevorgang der Bildschirmschrift (V-02c-3, V-02c-4). */
function useSchriftstand(): Schriftstand {
  const [stand, setStand] = useState<Schriftstand>(bekannterStand);
  useEffect(() => {
    if (stand !== 'laden') return;
    let aktiv = true;
    ensureScreenFont().then(
      () => {
        bekannterStand = 'bereit';
        if (aktiv) setStand('bereit');
      },
      () => {
        bekannterStand = 'fehler';
        if (aktiv) setStand('fehler');
      },
    );
    return () => {
      aktiv = false;
    };
  }, [stand]);
  return stand;
}

function farbe(c: Rgb): string {
  return `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`;
}

function px(wert: number): string {
  return `${String(wert)}px`;
}

/** Eine Form im SVG: Strich und Füllung wie im PDF (§2.3 Nr 3, V04), Bild ohne Erhalt des Verhältnisses (V05). */
function FormElement({ form }: { readonly form: Form }): JSX.Element {
  if (form.art === 'bild') {
    const { x, y, w, h } = form.rect;
    return <image href={form.href} x={x} y={y} width={w} height={h} preserveAspectRatio="none" />;
  }
  const s = form.stroke;
  return (
    <path
      d={form.d}
      fill={form.fill === null ? 'none' : farbe(form.fill)}
      fillRule="nonzero"
      stroke={s === null ? 'none' : farbe(s.color)}
      {...(s === null
        ? {}
        : {
            strokeWidth: s.widthPt,
            strokeLinecap: 'butt' as const,
            strokeLinejoin: 'miter' as const,
            strokeMiterlimit: 10,
            strokeDashoffset: 0,
            ...(s.dash === null ? {} : { strokeDasharray: s.dash.join(' ') }),
          })}
    />
  );
}

/** Drehung per CSS um den Grundlinienbeginn: 90 liest von unten nach oben, 270 von oben nach unten. */
const DREHUNG: { readonly [R in TextItem['rotation']]: string | null } = {
  0: null,
  90: 'rotate(-90deg)',
  270: 'rotate(90deg)',
};

/**
 * Eine vorberechnete Zeile als genau ein Element (§3.2 «Zeile»): Oberkante eine Schriftgrösse über der
 * Grundlinie; ein unsichtbarer Block der Höhe 1em (::before, vertical-align baseline) legt die Grundlinie auf
 * diese Höhe, unabhängig von den Metriken des Browsers. Je Lauf ein `span`; Durchstreichung als eigenes
 * leeres Element nach STRIKE_EM (V-02c-2), nicht `text-decoration`.
 */
function Zeile({ index, item }: { readonly index: number; readonly item: TextItem }): JSX.Element {
  const em = item.sizePt * PX_PRO_PT;
  const drehung = DREHUNG[item.rotation];
  const stil: CSSProperties = {
    left: px(item.x * PX_PRO_PT),
    top: px((item.baselineY - item.sizePt) * PX_PRO_PT),
    fontSize: px(em),
    ...(drehung === null ? {} : { transform: drehung }),
  };
  const teile: JSX.Element[] = [];
  let versatz = 0;
  for (const [k, r] of item.runs.entries()) {
    const breite = measureRuns([r], item.sizePt);
    teile.push(
      <span
        key={`l${String(k)}`}
        style={{ fontWeight: r.weight === 'bold' ? 700 : 400, color: farbe(r.color) }}
      >
        {r.text}
      </span>,
    );
    if (r.strike && r.text !== '') {
      const dicke = STRIKE_EM.thickness * em;
      teile.push(
        <span
          key={`s${String(k)}`}
          aria-hidden="true"
          className="wap-seite__strich"
          style={{
            left: px(versatz * PX_PRO_PT),
            top: px(em - STRIKE_EM.center * em - dicke / 2),
            width: px(breite * PX_PRO_PT),
            height: px(dicke),
            backgroundColor: farbe(r.color),
          }}
        />,
      );
    }
    versatz += breite;
  }
  return (
    <span data-wap-item={String(index)} className="wap-seite__zeile" style={stil}>
      {teile}
    </span>
  );
}

/**
 * Alle Ebenen der Seite. Mit `memo`: Ändern sich nur Zoom, Overlay oder Name, bleiben die Ebenen unverändert
 * (CR-E102c-04; `ebenen` und `page` sind über `useMemo` stabil).
 */
const Ebenen = memo(function Ebenen({
  ebenen,
  page,
}: {
  readonly ebenen: readonly Ebene[];
  readonly page: PageModel;
}): JSX.Element {
  return (
    <>
      {ebenen.map((e) =>
        e.art === 'zeile' ? (
          <Zeile key={`z${String(e.index)}`} index={e.index} item={e.item} />
        ) : (
          <svg
            key={`f${String(e.formen[0]?.index ?? 0)}`}
            className="wap-seite__ebene"
            aria-hidden="true"
            viewBox={`0 0 ${String(page.widthPt)} ${String(page.heightPt)}`}
            width={page.widthPt * PX_PRO_PT}
            height={page.heightPt * PX_PRO_PT}
          >
            {e.formen.map((f) => (
              <FormElement key={String(f.index)} form={f} />
            ))}
          </svg>
        ),
      )}
    </>
  );
});

/**
 * Zeichnet eine Seite des Seitenmodells (Vertrag E1-02c §3.2). Bis die Bildschirmschrift geladen ist, bleibt
 * der Container leer und `aria-busy` (V-02c-4); lädt sie nicht, erscheint statt der Seite die Meldung mit
 * Ursache und nächstem Schritt (§3.3, R-L-05).
 */
export function PageView(props: PageViewProps): JSX.Element {
  const { page, scale, label, overlay, semanticsProvidedByOverlay = false } = props;
  const stand = useSchriftstand();
  const ebenen = useMemo(() => ebenenVon(page), [page]);

  if (stand === 'fehler') {
    return (
      <div role="alert" className="banner-danger wap-seite-fehler">
        <p>{SCREEN_FONT_MESSAGE.cause}</p>
        <p>{SCREEN_FONT_MESSAGE.nextStep}</p>
      </div>
    );
  }
  const groesse: CSSProperties = {
    width: px(page.widthPt * scale),
    height: px(page.heightPt * scale),
  };
  if (stand === 'laden') {
    return (
      <div
        role="document"
        aria-label={label}
        aria-busy="true"
        className="wap-seite"
        style={groesse}
      />
    );
  }
  return (
    <div role="document" aria-label={label} className="wap-seite" style={groesse}>
      <div
        className="wap-seite__papier"
        aria-hidden={semanticsProvidedByOverlay ? 'true' : undefined}
        style={{
          width: px(page.widthPt * PX_PRO_PT),
          height: px(page.heightPt * PX_PRO_PT),
          transform: `scale(${String(scale / PX_PRO_PT)})`,
        }}
      >
        <Ebenen ebenen={ebenen} page={page} />
      </div>
      {overlay}
    </div>
  );
}
