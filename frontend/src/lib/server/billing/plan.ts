import 'server-only';

// Daily Cash Premium — the plan, and the arithmetic of a paid period.
//
// Everything here is a pure function over values. The routes and the webhook
// both need these rules, and a rule about money that lives inside a request
// handler is a rule nobody can test.

/** 2 000 FCFA. XOF has no subunit, so this is whole francs. */
export const PREMIUM_PRICE_XOF = 2000;
export const PREMIUM_CURRENCY = 'XOF';

/** One paid period. Calendar-agnostic on purpose: 30 days is 30 days. */
export const PERIOD_DAYS = 30;
const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;

/** What the landing page sells, and what `requirePremium` actually gates. */
export const PREMIUM_FEATURES = [
  'Fiches clients et factures ouvertes',
  'Relances prêtes à envoyer',
  'Objectif mensuel et suivi des prospects',
] as const;

export interface SubscriptionState {
  status: string;
  currentPeriodEnd: Date | null;
}

/**
 * Does this account have Premium right now?
 *
 * A date comparison, deliberately — see the note on the Subscription model.
 * `status` alone is never enough: an ACTIVE row whose period ran out last
 * week is not entitled, and a CANCELLED row still inside its paid period is.
 */
export function isPremium(sub: SubscriptionState | null | undefined, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === 'PENDING') return false; // never paid
  if (!sub.currentPeriodEnd) return false;
  return sub.currentPeriodEnd.getTime() > now.getTime();
}

/**
 * The new period end after a payment lands.
 *
 * Paying while still inside a period STACKS the time rather than restarting
 * it — otherwise renewing early would silently burn the days already paid
 * for, and a duplicate webhook delivery would be indistinguishable from a
 * legitimate early renewal.
 */
export function extendPeriod(currentEnd: Date | null | undefined, now: Date): Date {
  const base =
    currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd.getTime() : now.getTime();
  return new Date(base + PERIOD_MS);
}

/** Whole days of access left; 0 once the period has run out. */
export function daysRemaining(sub: SubscriptionState | null | undefined, now: Date): number {
  if (!isPremium(sub, now) || !sub?.currentPeriodEnd) return 0;
  return Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
