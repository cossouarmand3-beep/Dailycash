import 'server-only';
import { getProvider, PaymentProviderUnconfiguredError } from '../payments/provider-singleton';

/**
 * Can we actually take a payment right now?
 *
 * Bictorys is env-gated like every optional provider in this starter, so a
 * fresh clone has no payment credentials. Asking here lets the UI say so
 * plainly instead of offering a "Passer en Premium" button whose only
 * possible outcome is a 503.
 */
export function isBillingConfigured(): boolean {
  try {
    getProvider();
    return true;
  } catch (err) {
    if (err instanceof PaymentProviderUnconfiguredError) return false;
    throw err;
  }
}

/**
 * May `/api/billing/dev-activate` grant Premium without a payment?
 *
 * BOTH conditions must hold, and this is the only place they are expressed:
 *   1. not production — `next build` sets NODE_ENV=production for you;
 *   2. no payment provider configured — so the hatch closes by itself the
 *      moment real credentials land, rather than waiting to be remembered.
 *
 * Lives here, tested here. A security gate written inline in a route handler
 * is a gate nobody can test.
 */
export function isDevBillingFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && !isBillingConfigured();
}
