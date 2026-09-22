import { type ReactNode, useId, useLayoutEffect, useRef } from 'react';
import './planning-panel.css';

/** A nonmodal workspace region: the planning board remains usable while editing. */
export function PlanningPanel({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
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
      className="planning-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="planning-panel-header">
        <div>
          <span className="eyebrow">PLANUNG</span>
          <h2 ref={heading} id={headingId} tabIndex={-1}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Bereich schliessen"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="planning-panel-body">{children}</div>
      {footer && <footer className="planning-panel-footer">{footer}</footer>}
    </section>
  );
}
