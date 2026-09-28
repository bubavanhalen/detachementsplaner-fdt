import { type ReactNode, useId, useLayoutEffect, useRef } from 'react';
import { Icon } from './Icon';

/** A nonmodal workspace region: the planning board remains usable while editing. */
export function PlanningPanel({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  useLayoutEffect(() => {
    const node = panel.current;
    const opener = document.activeElement;
    heading.current?.focus({ preventScroll: true });
    return () => {
      // Board actions can replace the panel; retain their focus instead of stealing it.
      if (
        node?.contains(document.activeElement) &&
        opener instanceof HTMLElement &&
        opener.isConnected
      )
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <section
      ref={panel}
      aria-labelledby={headingId}
      className={`side-panel ${wide ? 'is-wide' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="panel-header">
        <div className="grow">
          <h2 ref={heading} id={headingId} tabIndex={-1}>
            {title}
          </h2>
          {description && <p>{description}</p>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label="Bereich schliessen"
          title="Schliessen (Esc)"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="panel-body">{children}</div>
      {footer && <footer className="panel-footer">{footer}</footer>}
    </section>
  );
}
