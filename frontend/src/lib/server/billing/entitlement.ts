import 'server-only';
import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { isPremium, type SubscriptionState } from './plan';

// Server-side entitlement. The ONLY authority on who has Premium.
//
// The previous version of this app kept `premium` in React state, defaulted
// it to true, and let the browser flip it. That is not a paywall — it is a
// picture of one. Every gated route now asks the database.

export interface Entitlement {
  premium: boolean;
  currentPeriodEnd: Date | null;
  status: string | null;
}

export async function getEntitlement(
  prisma: Pick<PrismaClient, 'subscription'>,
  userId: string,
  now: Date = new Date(),
): Promise<Entitlement> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  });
  return {
    premium: isPremium(sub as SubscriptionState | null, now),
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    status: sub?.status ?? null,
  };
}

/**
 * Guard for a Premium-only route. Mirrors the kit's middleware convention:
 * returns a `NextResponse` to bail on, or `null` to continue.
 *
 *   const denied = await requirePremium(prisma, userId, ctx.requestId);
 *   if (denied) return denied;
 *
 * 402 Payment Required is the honest status here: the request is well-formed
 * and the caller is authenticated — they just have not paid. The frontend
 * switches on `error`, never on the message.
 */
export async function requirePremium(
  prisma: Pick<PrismaClient, 'subscription'>,
  userId: string,
  requestId: string,
  now: Date = new Date(),
): Promise<NextResponse | null> {
  const { premium } = await getEntitlement(prisma, userId, now);
  if (premium) return null;

  return NextResponse.json(
    {
      error: 'PREMIUM_REQUIRED',
      message:
        'Cette fonctionnalité fait partie de Daily Cash Premium (2 000 FCFA / mois, sans engagement).',
    },
    { status: 402, headers: { 'x-request-id': requestId } },
  );
}
