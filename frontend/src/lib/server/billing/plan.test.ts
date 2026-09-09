import { describe, expect, it } from 'vitest';
import {
  PERIOD_DAYS,
  PREMIUM_PRICE_XOF,
  daysRemaining,
  extendPeriod,
  isPremium,
  type SubscriptionState,
} from './plan';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-09-09T12:00:00Z');
const sub = (status: string, end: string | null): SubscriptionState => ({
  status,
  currentPeriodEnd: end ? at(end) : null,
});

describe('isPremium', () => {
  it('is false with no subscription at all', () => {
    expect(isPremium(null, NOW)).toBe(false);
    expect(isPremium(undefined, NOW)).toBe(false);
  });

  it('is false while the subscription has never been paid', () => {
    expect(isPremium(sub('PENDING', null), NOW)).toBe(false);
    // Even a PENDING row carrying a future date is not entitled: the date is
    // only ever written by the webhook, but defence in depth is free here.
    expect(isPremium(sub('PENDING', '2026-12-01T00:00:00Z'), NOW)).toBe(false);
  });

  it('is true inside a paid period', () => {
    expect(isPremium(sub('ACTIVE', '2026-10-09T12:00:00Z'), NOW)).toBe(true);
  });

  it('is false once the period has run out, even if status still says ACTIVE', () => {
    // The regression this guards: treating `status` as the entitlement means
    // access never lapses unless a cron happens to flip the row.
    expect(isPremium(sub('ACTIVE', '2026-09-01T00:00:00Z'), NOW)).toBe(false);
  });

  it('KEEPS access for a cancelled subscription until its period ends', () => {
    // The user paid for the month; cancelling asks us not to renew, it does
    // not ask for the remaining days back.
    expect(isPremium(sub('CANCELLED', '2026-09-30T00:00:00Z'), NOW)).toBe(true);
    expect(isPremium(sub('CANCELLED', '2026-09-01T00:00:00Z'), NOW)).toBe(false);
  });

  it('is false exactly at the boundary instant', () => {
    expect(isPremium(sub('ACTIVE', NOW.toISOString()), NOW)).toBe(false);
  });
});

describe('extendPeriod', () => {
  it('starts a period from now for a first payment', () => {
    expect(extendPeriod(null, NOW).toISOString()).toBe('2026-10-09T12:00:00.000Z');
  });

  it('STACKS onto a period still running instead of restarting it', () => {
    // The regression this guards: restarting from `now` would burn the days
    // already paid for whenever someone renews early.
    const end = at('2026-09-20T12:00:00Z');
    expect(extendPeriod(end, NOW).toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('restarts from now when the previous period already lapsed', () => {
    expect(extendPeriod(at('2026-08-01T00:00:00Z'), NOW).toISOString()).toBe(
      '2026-10-09T12:00:00.000Z',
    );
  });

  it(`adds exactly ${PERIOD_DAYS} days`, () => {
    const ms = extendPeriod(null, NOW).getTime() - NOW.getTime();
    expect(ms).toBe(PERIOD_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe('daysRemaining', () => {
  it('is 0 without entitlement', () => {
    expect(daysRemaining(null, NOW)).toBe(0);
    expect(daysRemaining(sub('ACTIVE', '2026-09-01T00:00:00Z'), NOW)).toBe(0);
  });

  it('counts the days left', () => {
    expect(daysRemaining(sub('ACTIVE', '2026-09-19T12:00:00Z'), NOW)).toBe(10);
  });

  it('rounds a part-day up — a few hours left is still a day of access', () => {
    expect(daysRemaining(sub('ACTIVE', '2026-09-09T18:00:00Z'), NOW)).toBe(1);
  });
});

describe('price', () => {
  it('is 2 000 FCFA in whole francs', () => {
    // XOF has no subunit: storing 200000 "centimes" here would bill 100x.
    expect(PREMIUM_PRICE_XOF).toBe(2000);
    expect(Number.isInteger(PREMIUM_PRICE_XOF)).toBe(true);
  });
});
