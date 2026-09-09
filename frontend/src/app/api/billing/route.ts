// GET /api/billing — what the account's Premium status actually is.
//
// The single source of truth for the paywall. The screens used to keep the
// plan in React state (defaulted to Premium, flippable from the browser);
// they now read it from here and cannot lie about it.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { getEntitlement } from '@/lib/server/billing/entitlement';
import {
  PREMIUM_CURRENCY,
  PREMIUM_FEATURES,
  PREMIUM_PRICE_XOF,
  daysRemaining,
} from '@/lib/server/billing/plan';
import { isBillingConfigured } from '@/lib/server/billing/provider-status';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const now = new Date();
    const ent = await getEntitlement(prisma, auth.user.sub, now);
    const sub = { status: ent.status ?? 'NONE', currentPeriodEnd: ent.currentPeriodEnd };

    return NextResponse.json(
      {
        premium: ent.premium,
        status: ent.status,
        currentPeriodEnd: ent.currentPeriodEnd?.toISOString() ?? null,
        daysRemaining: daysRemaining(sub, now),
        price: PREMIUM_PRICE_XOF,
        currency: PREMIUM_CURRENCY,
        features: PREMIUM_FEATURES,
        // Lets the UI say "les paiements ne sont pas encore branchés" instead
        // of showing a Pay button that can only ever return 503.
        checkoutAvailable: isBillingConfigured(),
      },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
