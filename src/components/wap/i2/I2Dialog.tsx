import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useDialogGuard } from './dialogGuard';

export function I2Dialog({
  title,
  description,
  onClose,
  children,
  dismissible = true,
  className,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
  /** Zusätzliche Klasse, z.B. für den Importbericht am rechten Rand (H-UI2, UX-H-10). */
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  // Nicht schliessbare Dialoge («Sicherung vor dem Update», Import) schliessen nie, auch nicht durch den Browser
  // (H-UI2, SA-H-06, SA-H-19); schliesst der Browser einen gewöhnlichen Dialog, gilt das wie «Schliessen».
  const close = useRef(onClose);
  close.current = onClose;
  const { closing } = useDialogGuard(dialog, {
    locked: !dismissible,
    onNativeClose: () => close.current(),
  });
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    closing.current = false;
    node?.showModal();
    return () => {
      closing.current = true;
      node?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [closing]);
  return (
    <dialog
      ref={dialog}
      className={`wap-i2-dialog${className === undefined ? '' : ` ${className}`}`}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
    >
      <header className="wap-i2-dialog-heading">
        <div>
          <h2 id={heading}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {dismissible && (
          <button type="button" className="btn" aria-label="Dialog schliessen" onClick={onClose}>
            Schliessen
          </button>
        )}
      </header>
      <div className="wap-i2-dialog-body">{children}</div>
    </dialog>
  );
}
