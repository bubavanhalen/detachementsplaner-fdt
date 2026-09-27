import { useEffect, useState } from 'react';
import { notify } from '../store';
import { Icon } from './Icon';

/** Copies to the local clipboard only; the value never leaves the device through the app. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    notify('Kopieren ist hier nicht verfügbar. Bitte den Wert direkt markieren und kopieren.', {
      tone: 'warning',
    });
    return false;
  }
}

export function CopyButton({
  value,
  label,
  className = 'copy-btn',
  children,
}: {
  value: string;
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className={`${className} ${copied ? 'is-copied' : ''}`}
      aria-label={label}
      title={copied ? 'Kopiert' : label}
      disabled={!value}
      onClick={async () => {
        if (await copyText(value)) setCopied(true);
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      {children}
    </button>
  );
}
