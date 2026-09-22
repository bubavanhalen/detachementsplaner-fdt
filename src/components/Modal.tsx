import { type ReactNode, useEffect, useId, useRef } from 'react';

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
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
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={heading}
      onCancel={onClose}
    >
      <header className="modal-header">
        <h2 id={heading}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Dialog schliessen"
          onClick={onClose}
        >
          ×
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
    <div className="notice notice-error" role="alert" tabIndex={-1} ref={ref}>
      {message}
    </div>
  ) : null;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Die Änderung konnte nicht gespeichert werden.';
}
