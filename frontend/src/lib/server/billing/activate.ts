import 'server-only';
import type { Prisma } from '@prisma/client';
import { extendPeriod } from './plan';

// Turning a paid Order into a month of access.
//
// Runs INSIDE the webhook's Serializable transaction, so the subscription and
// the Order status commit together: an order marked PAID with no access
// granted is a support ticket, and access granted against an unpaid order is
// theft.

export interface ActivationResult {
  /** null when nothing changed (already applied, or not a subscription). */
  currentPeriodEnd: Date | null;
  alreadyApplied: boolean;
}

/**
 * Grant or extend Premium for `userId`, crediting `orderId`.
 *
 * Idempotent per order: `lastOrderId` records which payment last extended the
 * period, so replaying the same order is a no-op. The webhook factory already
 * dedupes deliveries via WebhookLog, but a webhook that credits twice on a
 * retry is the kind of bug that only shows up in production, on someone
 * else's money — so it is closed here too.
 */
export async function activateSubscription(
  tx: Prisma.TransactionClient,
  input: { userId: string; orderId: string; now?: Date },
): Promise<ActivationResult> {
  const now = input.now ?? new Date();

  const existing = await tx.subscription.findUnique({
    where: { userId: input.userId },
    select: { currentPeriodEnd: true, lastOrderId: true },
  });

  if (existing?.lastOrderId === input.orderId) {
    return { currentPeriodEnd: existing.currentPeriodEnd, alreadyApplied: true };
  }

  const currentPeriodEnd = extendPeriod(existing?.currentPeriodEnd ?? null, now);

  await tx.subscription.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      plan: 'PREMIUM',
      status: 'ACTIVE',
      currentPeriodEnd,
      lastOrderId: input.orderId,
    },
    update: {
      status: 'ACTIVE',
      currentPeriodEnd,
      lastOrderId: input.orderId,
      // Re-subscribing clears a previous cancellation.
      cancelledAt: null,
    },
  });

  return { currentPeriodEnd, alreadyApplied: false };
}
