import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { activateSubscription } from './activate';

// A hand-rolled stand-in for the transaction client. The real one is a Prisma
// proxy; all this code touches is subscription.findUnique + upsert, so faking
// exactly that keeps the test about the RULE rather than about Prisma.
function makeTx(existing: { currentPeriodEnd: Date | null; lastOrderId: string | null } | null) {
  const upsert = vi.fn().mockResolvedValue({});
  const tx = {
    subscription: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert,
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, upsert };
}

const NOW = new Date('2026-09-09T12:00:00Z');

describe('activateSubscription', () => {
  it('starts a 30-day period for a first payment', async () => {
    const { tx, upsert } = makeTx(null);
    const res = await activateSubscription(tx, { userId: 'u1', orderId: 'o1', now: NOW });

    expect(res.alreadyApplied).toBe(false);
    expect(res.currentPeriodEnd?.toISOString()).toBe('2026-10-09T12:00:00.000Z');
    expect(upsert).toHaveBeenCalledOnce();
    const arg = upsert.mock.calls[0]?.[0] as { create: { status: string; lastOrderId: string } };
    expect(arg.create.status).toBe('ACTIVE');
    expect(arg.create.lastOrderId).toBe('o1');
  });

  it('stacks onto a period still running', async () => {
    const { tx } = makeTx({
      currentPeriodEnd: new Date('2026-09-20T12:00:00Z'),
      lastOrderId: 'o1',
    });
    const res = await activateSubscription(tx, { userId: 'u1', orderId: 'o2', now: NOW });
    expect(res.currentPeriodEnd?.toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('is a no-op when the SAME order is applied twice', async () => {
    // The regression this guards: a webhook redelivery (or a provider that
    // fires "paid" twice) would otherwise grant 60 days for one payment.
    const existing = {
      currentPeriodEnd: new Date('2026-10-09T12:00:00Z'),
      lastOrderId: 'o1',
    };
    const { tx, upsert } = makeTx(existing);
    const res = await activateSubscription(tx, { userId: 'u1', orderId: 'o1', now: NOW });

    expect(res.alreadyApplied).toBe(true);
    expect(res.currentPeriodEnd).toBe(existing.currentPeriodEnd);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('restarts from now when the previous period had lapsed', async () => {
    const { tx } = makeTx({
      currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
      lastOrderId: 'old',
    });
    const res = await activateSubscription(tx, { userId: 'u1', orderId: 'o9', now: NOW });
    expect(res.currentPeriodEnd?.toISOString()).toBe('2026-10-09T12:00:00.000Z');
  });

  it('clears a previous cancellation when re-subscribing', async () => {
    const { tx, upsert } = makeTx({ currentPeriodEnd: null, lastOrderId: null });
    await activateSubscription(tx, { userId: 'u1', orderId: 'o3', now: NOW });
    const arg = upsert.mock.calls[0]?.[0] as {
      update: { cancelledAt: Date | null; status: string };
    };
    expect(arg.update.cancelledAt).toBeNull();
    expect(arg.update.status).toBe('ACTIVE');
  });
});
