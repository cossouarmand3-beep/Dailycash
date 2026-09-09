// POST /api/prospects — add a lead at the first pipeline stage.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { requirePremium } from '@/lib/server/billing/entitlement';

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  estimatedAmount: z.number().int().positive().max(1_000_000_000).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // Premium surface (voir la landing) — le refus vient du serveur, pas de l'UI.
    const denied = await requirePremium(prisma, auth.user.sub, ctx.requestId);
    if (denied) return denied;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Nom de prospect invalide' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const prospect = await prisma.prospect.create({
      data: {
        userId: auth.user.sub,
        name: parsed.data.name,
        ...(parsed.data.estimatedAmount ? { estimatedAmount: parsed.data.estimatedAmount } : {}),
      },
      select: { id: true, name: true, estimatedAmount: true, stage: true },
    });

    return NextResponse.json(
      { prospect },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
