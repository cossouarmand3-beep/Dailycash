// PATCH /api/prospects/[id] — move a lead along the pipeline.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export const STAGES = ['FIRST_CONTACT', 'TO_FOLLOW_UP', 'QUOTE_SENT', 'WON'] as const;

const Body = z.object({ stage: z.enum(STAGES) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Statut de prospect inconnu' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const res = await prisma.prospect.updateMany({
      where: { id, userId: auth.user.sub },
      data: { stage: parsed.data.stage },
    });

    if (res.count === 0) {
      return NextResponse.json(
        { error: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
