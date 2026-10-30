// Leiste mit Überlauf (H-UI2, UX-H-03; UI-Richtlinie 2.2; I2b-A A5): Die Leiste bleibt einzeilig und ragt nie aus
// dem Fenster. Fehlt der Platz, weichen die Bedienelemente mit der tiefsten Priorität ins Menü «Mehr …» aus (bzw. in
// ein festes Menü der Leiste, z.B. das Planmenü); dort sind sie mit Maus und Tastatur erreichbar. Feste Elemente
// (ohne Priorität) bleiben immer sichtbar. Gemessen wird nach jedem Zeichnen und bei jeder Grössenänderung; ohne
// Layout (jsdom) bleibt alles sichtbar.

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { GridMenu, type MenuItem } from './GridMenu';

export interface BarItem {
  readonly id: string;
  /** Höher bleibt länger sichtbar; ohne Priorität fest (weicht nie aus). */
  readonly priority?: number;
  readonly node: ReactNode;
  /** Einträge im Menü «Mehr …», solange das Element ausgewichen ist; fehlt: Element erscheint nur im festen Menü. */
  readonly menu?: readonly MenuItem[];
}

/** Breite des Knopfs «Mehr …», bevor er einmal gemessen ist. */
const MORE_FALLBACK = 76;

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * Welche Elemente ausweichen: Passt alles, keines; sonst bleiben die festen und so viele Elemente in absteigender
 * Priorität, wie neben dem Knopf «Mehr …» Platz haben (die erste, die nicht passt, beendet die Reihe).
 */
export function overflowing(
  items: readonly { readonly id: string; readonly priority?: number }[],
  widths: ReadonlyMap<string, number>,
  available: number,
  gap: number,
  more: number,
): ReadonlySet<string> {
  const width = (id: string) => widths.get(id) ?? 0;
  const total = items.reduce((s, it) => s + width(it.id), 0) + gap * Math.max(0, items.length - 1);
  if (available <= 0 || total <= available) return new Set();
  let budget = available - more;
  for (const it of items) if (it.priority === undefined) budget -= width(it.id) + gap;
  const flexible = items
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => it.priority !== undefined)
    .sort((a, b) => (b.it.priority ?? 0) - (a.it.priority ?? 0) || a.index - b.index);
  const hidden = new Set<string>();
  let full = false;
  for (const { it } of flexible) {
    const w = width(it.id) + gap;
    if (!full && w <= budget) budget -= w;
    else {
      full = true;
      hidden.add(it.id);
    }
  }
  return hidden;
}

/**
 * Misst die Elemente der Leiste und liefert die ausgewichenen IDs. `bar` ist die Leiste (Flex, eine Zeile), ihre
 * Kinder tragen `data-bar-id`.
 */
export function useOverflow(
  bar: RefObject<HTMLElement | null>,
  items: readonly { readonly id: string; readonly priority?: number }[],
  /** Knopf «Mehr …»; null: keiner (ausgewichene Elemente stehen in einem festen Menü). */
  more: RefObject<HTMLElement | null> | null,
): ReadonlySet<string> {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const widths = useRef(new Map<string, number>());
  const moreWidth = useRef(MORE_FALLBACK);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const measure = useCallback(() => {
    const node = bar.current;
    if (node === null) return;
    for (const child of node.querySelectorAll<HTMLElement>(':scope > [data-bar-id]')) {
      const id = child.dataset.barId ?? '';
      if (!child.hidden) widths.current.set(id, child.getBoundingClientRect().width);
    }
    const style = getComputedStyle(node);
    const gap = Number.parseFloat(style.columnGap) || 0;
    const padding =
      (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
    const seen = more?.current?.getBoundingClientRect().width ?? 0;
    if (seen > 0) moreWidth.current = seen;
    const next = overflowing(
      itemsRef.current,
      widths.current,
      node.clientWidth - padding - 1,
      gap,
      more === null ? 0 : moreWidth.current + gap,
    );
    setHidden((current) => (sameSet(current, next) ? current : next));
  }, [bar, more]);
  // Neu messen, wenn Elemente hinzukommen oder wegfallen (Signatur), sonst nur bei Grössenänderungen (ResizeObserver,
  // ohne erzwungenes Layout beim Ziehen; PERF R-5.1-14).
  const signature = items.map((it) => `${it.id}:${String(it.priority ?? '')}`).join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: die Signatur steht für die Elemente der Leiste
  useLayoutEffect(() => {
    measure();
  }, [signature, measure]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: die Signatur steht für die beobachteten Elemente
  useEffect(() => {
    const node = bar.current;
    if (node === null || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(node);
    for (const child of node.querySelectorAll<HTMLElement>(':scope > [data-bar-id]'))
      observer.observe(child);
    if (more?.current) observer.observe(more.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [bar, more, signature, measure]);
  return hidden;
}

/** Knopf «Mehr …» mit den ausgewichenen Befehlen (Pfeile, Enter, Esc wie das Kontextmenü). */
export function MoreMenu({
  label,
  text = 'Mehr …',
  title,
  items,
  buttonRef,
  hidden,
}: {
  readonly label: string;
  /** Sichtbare Beschriftung des Knopfs (zugleich sein Name). */
  readonly text?: string;
  readonly title?: string;
  readonly items: readonly MenuItem[];
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  /** Kein Eintrag: der Knopf bleibt unsichtbar, behält aber seinen Platz in der Messung. */
  readonly hidden: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Lage nur bei offenem Menü lesen: sonst erzwänge jedes Neuzeichnen (auch beim Ziehen) eine Layout-Berechnung
  // mitten im Rendern (F-PERF, FL2-04).
  const rect = open ? buttonRef.current?.getBoundingClientRect() : undefined;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn wap-bar-more"
        aria-haspopup="menu"
        aria-expanded={open}
        title={title ?? `${label}: Befehle, für die in der Leiste der Platz fehlt`}
        hidden={hidden}
        onClick={() => setOpen((v) => !v)}
      >
        {text}
      </button>
      {open && !hidden && (
        <GridMenu
          label={label}
          x={Math.max(4, (rect?.right ?? 260) - 260)}
          y={rect?.bottom ?? 0}
          items={items}
          onClose={(refocus) => {
            setOpen(false);
            if (refocus) buttonRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

/** Einzeilige Leiste: Elemente in der gegebenen Reihenfolge, ausgewichene im Menü «Mehr …» am Ende. */
export function OverflowBar({
  items,
  className,
  role,
  label,
  moreLabel,
}: {
  readonly items: readonly BarItem[];
  readonly className: string;
  readonly role?: 'toolbar';
  readonly label?: string;
  /** Name des Menüs «Mehr …»; null: kein solches Menü (die Befehle stehen in einem festen Menü der Leiste). */
  readonly moreLabel: string | null;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const hidden = useOverflow(bar, items, moreLabel === null ? null : more);
  const menu = items.filter((it) => hidden.has(it.id)).flatMap((it) => it.menu ?? []);
  return (
    <div
      ref={bar}
      className={className}
      {...(role === undefined ? {} : { role })}
      {...(label === undefined ? {} : { 'aria-label': label })}
    >
      {items.map((it) => (
        <div key={it.id} className="wap-bar-item" data-bar-id={it.id} hidden={hidden.has(it.id)}>
          {it.node}
        </div>
      ))}
      {moreLabel !== null && (
        <MoreMenu label={moreLabel} items={menu} buttonRef={more} hidden={menu.length === 0} />
      )}
    </div>
  );
}
