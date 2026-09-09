// POST /api/billing/cancel — stop renewing.
//
// The landing page promises "sans engagement, annulable à tout moment", so
// this must be one tap and must not be a trap. It does NOT revoke the days
// already paid for: `currentPeriodEnd` is left alone and `isPremium` keeps
// returning true until it passes. Cancelling asks us not to charge again; it
// is not a request for a refund of the current month.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const res = await prisma.subscription.updateMany({
      where: { userId: auth.user.sub, status: { in: ['ACTIVE', 'PENDING'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    if (res.count === 0) {
      return NextResponse.json(
        { error: 'NO_ACTIVE_SUBSCRIPTION', message: 'Aucun abonnement à annuler.' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    log.info('subscription cancelled', { userId: auth.user.sub });

    const sub = await prisma.subscription.findUnique({
      where: { userId: auth.user.sub },
      select: { currentPeriodEnd: true },
    });

    return NextResponse.json(
      {
        ok: true,
        // The UI tells the user exactly how long they keep access.
        accessUntil: sub?.currentPeriodEnd?.toISOString() ?? null,
      },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
