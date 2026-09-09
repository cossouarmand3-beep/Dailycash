// POST /api/billing/dev-activate — grant yourself Premium, in development,
// while no payment provider exists.
//
// WHY THIS EXISTS: Bictorys is env-gated like every optional provider in this
// starter, so a fresh clone cannot take a payment at all. Without this route
// the entire Premium half of the app would be untestable until someone signs
// a payment contract — and untestable code is where bugs live.
//
// IT IS DOUBLE-GATED, and both gates must hold:
//   1. NODE_ENV !== 'production'  — `next build` sets production for you.
//   2. The payment provider is NOT configured. The moment real BICTORYS_*
//      credentials exist, this route stops responding even locally. It
//      removes itself rather than waiting to be remembered.
//
// Either gate failing returns 404, not 403: a route that does not exist is a
// smaller target than one that admits it exists and refuses.
//
// It still requires auth + CSRF, and only ever affects the caller's own
// account.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';
import { activateSubscription } from '@/lib/server/billing/activate';
import { isDevBillingFallbackEnabled } from '@/lib/server/billing/provider-status';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    if (!isDevBillingFallbackEnabled()) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // A real Order row is written, tagged as a simulation, so the audit trail
    // never shows access appearing out of nowhere.
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: auth.user.sub,
          amount: 0,
          currency: 'XOF',
          provider: 'dev',
          status: 'PAID',
          paidAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          customerEmail: auth.user.email,
          metadata: { kind: 'subscription', simulated: true },
        },
        select: { id: true },
      });
      return activateSubscription(tx, { userId: auth.user.sub, orderId: order.id });
    });

    log.warn('[dev] Premium activé sans paiement (aucun fournisseur configuré)', {
      userId: auth.user.sub,
      currentPeriodEnd: result.currentPeriodEnd?.toISOString() ?? null,
    });

    return NextResponse.json(
      { ok: true, simulated: true, currentPeriodEnd: result.currentPeriodEnd?.toISOString() },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
