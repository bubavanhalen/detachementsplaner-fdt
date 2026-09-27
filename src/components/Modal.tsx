import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Icon } from './Icon';

export function Modal({
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
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        // A click on the backdrop (the dialog element itself) closes, like Escape.
        if (event.target === dialog.current) onClose();
      }}
    >
      <header className="modal-header">
        <div>
          <h2 id={heading}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label="Dialog schliessen"
          title="Schliessen (Esc)"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-footer">{footer}</footer>}
    </dialog>
  );
}

export function ErrorBox({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  return message ? (
    <div className="error-box" role="alert" tabIndex={-1} ref={ref}>
      <Icon name="alert" />
      <span>{message}</span>
    </div>
  ) : null;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Die Änderung konnte nicht gespeichert werden.';
}
