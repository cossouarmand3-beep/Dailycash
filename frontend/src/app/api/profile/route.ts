// PATCH /api/profile — the freelancer's display name and trade.
//
// Collected at signup (the design asks for both before sending the code) but
// saved only AFTER verification, because signup issues no session: there is
// no authenticated user to attach them to until the code is entered.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  trade: z.string().trim().min(1).max(80).optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Prénom ou activité invalide' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const user = await prisma.user.update({
      where: { id: auth.user.sub },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.trade ? { trade: parsed.data.trade } : {}),
      },
      select: { name: true, trade: true, email: true },
    });

    return NextResponse.json({ user }, { status: 200, headers: { 'x-request-id': ctx.requestId } });
  });
}
