// DELETE /api/clients/[id] — remove a client added by mistake.
//
// Money is never destroyed by this: Invoice.clientId and Income.clientId are
// both `onDelete: SetNull`, so recorded payments keep their amount and date
// and simply show as "Sans client". Deleting a client must not silently
// rewrite the month total.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { requirePremium } from '@/lib/server/billing/entitlement';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // Premium surface (voir la landing) — le refus vient du serveur, pas de l'UI.
    const denied = await requirePremium(prisma, auth.user.sub, ctx.requestId);
    if (denied) return denied;

    const { id } = await params;
    const res = await prisma.client.deleteMany({ where: { id, userId: auth.user.sub } });

    if (res.count === 0) {
      return NextResponse.json(
        { error: 'CLIENT_NOT_FOUND', message: 'Client introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
