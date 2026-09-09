import { describe, expect, it } from 'vitest';
import { pickInvoiceToSettle, type SettleCandidate } from './settle';

const inv = (
  id: string,
  amount: number,
  opts: { due?: string; created?: string } = {},
): SettleCandidate => ({
  id,
  amount,
  dueDate: opts.due ? new Date(opts.due) : null,
  createdAt: new Date(opts.created ?? '2026-09-01T00:00:00Z'),
});

describe('pickInvoiceToSettle', () => {
  it('settles nothing when no invoice matches the amount exactly', () => {
    expect(pickInvoiceToSettle([inv('a', 60000)], 35000)).toBeNull();
    expect(pickInvoiceToSettle([], 60000)).toBeNull();
  });

  it('settles the invoice whose amount matches exactly', () => {
    const chosen = pickInvoiceToSettle([inv('a', 10000), inv('b', 60000)], 60000);
    expect(chosen?.id).toBe('b');
  });

  it('does NOT settle a smaller invoice with a larger payment', () => {
    // The regression this guards: the first version matched `amount <= paid`
    // and took the oldest, so paying the 60 000 closed the 10 000 and left
    // the real debt open and un-chased.
    const chosen = pickInvoiceToSettle(
      [inv('vieille', 10000, { created: '2026-08-01T00:00:00Z' }), inv('recente', 60000)],
      60000,
    );
    expect(chosen?.id).toBe('recente');
  });

  it('does not settle on a partial payment', () => {
    expect(pickInvoiceToSettle([inv('a', 60000)], 30000)).toBeNull();
  });

  it('prefers the soonest due date among equal amounts', () => {
    const chosen = pickInvoiceToSettle(
      [
        inv('tard', 50000, { due: '2026-10-30T00:00:00Z' }),
        inv('tot', 50000, { due: '2026-09-10T00:00:00Z' }),
      ],
      50000,
    );
    expect(chosen?.id).toBe('tot');
  });

  it('ranks a dated invoice above an undated one', () => {
    const chosen = pickInvoiceToSettle(
      [inv('sans-date', 50000), inv('avec-date', 50000, { due: '2026-12-31T00:00:00Z' })],
      50000,
    );
    expect(chosen?.id).toBe('avec-date');
  });

  it('falls back to the oldest when neither has a due date', () => {
    const chosen = pickInvoiceToSettle(
      [
        inv('neuve', 50000, { created: '2026-09-05T00:00:00Z' }),
        inv('vieille', 50000, { created: '2026-07-05T00:00:00Z' }),
      ],
      50000,
    );
    expect(chosen?.id).toBe('vieille');
  });
});
