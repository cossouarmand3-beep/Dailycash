// PUT /api/goal — set (or change) this month's revenue target.
//
// Upsert on (userId, period): a freelancer revises the same month's goal, they
// do not accumulate goals. Past months keep their own row, so history stays
// honest about what was actually aimed for.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { periodKey } from '@/lib/server/dailycash/period';

const Body = z.object({
  amount: z.number().int().positive().max(1_000_000_000),
  // "2026-09"; defaults to the current month.
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Objectif invalide' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const period = parsed.data.period ?? periodKey(new Date());
    const goal = await prisma.monthlyGoal.upsert({
      where: { userId_period: { userId: auth.user.sub, period } },
      create: { userId: auth.user.sub, period, amount: parsed.data.amount },
      update: { amount: parsed.data.amount },
      select: { period: true, amount: true },
    });

    return NextResponse.json({ goal }, { status: 200, headers: { 'x-request-id': ctx.requestId } });
  });
}
