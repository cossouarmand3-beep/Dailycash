// Shared building blocks for the Daily Cash screens.
//
// The Claude Design prototypes repeat a handful of patterns (mono eyebrow
// labels, pill chips, the chunky CTA with its 3px solid drop). They live here
// so a visual tweak lands in one place instead of four.

import type { ReactNode } from 'react';

/** 487500 → "487 500". Mirrors the prototypes' `fmt()`. */
export function fcfa(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Uppercase DM Mono label that sits above nearly every block. */
export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[11px] tracking-[0.14em] uppercase ${className}`}>
      {children}
    </div>
  );
}

/** Rounded selectable chip — trades, clients, goal amounts. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] rounded-full border px-[15px] py-2.5 text-[13px] font-semibold transition-colors ${
        active
          ? 'border-ink bg-ink text-cream'
          : 'border-edge-light bg-cream-card text-[#6b5941] hover:border-[#c7b69b]'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Primary action. Disabled state drops the shadow and goes flat — the
 * prototypes used this to signal "the form isn't complete yet".
 */
export function Cta({
  children,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[52px] rounded-[4px] p-4 text-base font-extrabold transition-transform ${
        disabled
          ? 'cursor-default bg-[#ede2ce] text-body'
          : 'cursor-pointer bg-brand text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-brand-deep)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Square 44px icon button (back arrows, sheet close). */
export function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-edge-light bg-cream-card text-[17px] text-ink hover:bg-[#f3ecde]"
    >
      {children}
    </button>
  );
}

/**
 * Phone-width shell.
 *
 * The prototypes drew a 390×844 phone bezel with a fake "07:42 · 4G · 84%"
 * status bar — canvas scaffolding, not product. Here the content goes
 * full-bleed on a real phone and sits in a centred column on wider screens.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-[#ede4d4] sm:py-7">
      <div className="flex w-full max-w-[420px] flex-col bg-cream sm:min-h-[844px] sm:overflow-hidden sm:rounded-[18px] sm:shadow-[0_24px_50px_rgba(42,29,18,0.22)]">
        {children}
      </div>
    </div>
  );
}
