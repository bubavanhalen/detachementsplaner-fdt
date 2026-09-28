import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

const CloseMenu = createContext<() => void>(() => {});

/**
 * A small accessible action menu: arrow keys move, Escape closes and restores focus.
 * The list renders in a portal so zoomed or clipped containers (the planning canvas)
 * never shrink or cut it off.
 */
export function Menu({
  label,
  trigger,
  triggerClassName = 'btn btn-ghost btn-icon btn-sm',
  align = 'right',
  children,
  disabled,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  align?: 'left' | 'right' | 'up-left' | 'up-right';
  children: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback((restore = true) => {
    setOpen(false);
    if (restore) button.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !list.current?.contains(target)) close(false);
    };
    const dismiss = () => close(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', dismiss);
    window.addEventListener('wheel', dismiss, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('wheel', dismiss);
    };
  }, [open, close]);
  const move = (step: number) => {
    const items = [
      ...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + step + items.length) % items.length]?.focus();
  };
  return (
    <div className="menu-anchor nodrag nopan" ref={anchor}>
      <button
        ref={button}
        type="button"
        className={triggerClassName}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => {
          const rect = button.current?.getBoundingClientRect();
          if (rect) {
            const up = align.startsWith('up') || rect.bottom > window.innerHeight - 260;
            setPosition({
              ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
              ...(align.includes('left')
                ? { left: rect.left }
                : { right: Math.max(8, window.innerWidth - rect.right) }),
            });
          }
          setOpen((value) => !value);
        }}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            id={id}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            className="menu is-floating"
            style={position}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                move(1);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                move(-1);
              } else if (event.key === 'Tab') close(false);
            }}
          >
            <CloseMenu.Provider value={() => close()}>{children}</CloseMenu.Provider>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onSelect,
  disabled,
  danger,
  shortcut,
}: {
  icon?: IconName;
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  shortcut?: string;
}) {
  const close = useContext(CloseMenu);
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item ${danger ? 'is-danger' : ''}`}
      disabled={disabled}
      onClick={() => {
        close();
        onSelect();
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
      {shortcut && (
        <span className="kbd" aria-hidden="true">
          {shortcut}
        </span>
      )}
    </button>
  );
}

export function MenuSeparator() {
  return <hr className="menu-sep" />;
}
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-label">{children}</div>;
}
