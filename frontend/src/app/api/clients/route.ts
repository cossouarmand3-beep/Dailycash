// POST /api/clients — add a client, optionally with what they already owe.
//
// A client whose name already exists is reused rather than duplicated: the
// prototype's "+ Nouveau" is a quick-add on a phone, and typing the same name
// twice must not fork the client's history.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional(),
  // When set, an OPEN invoice for that amount is created alongside the client.
  owedAmount: z.number().int().positive().max(1_000_000_000).optional(),
  dueDate: z.string().datetime().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const userId = auth.user.sub;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Nom de client invalide' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const { name, phone, owedAmount, dueDate } = parsed.data;

    const client = await prisma.$transaction(async (tx) => {
      const row = await tx.client.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name, ...(phone ? { phone } : {}) },
        update: phone ? { phone } : {},
        select: { id: true, name: true, phone: true },
      });

      if (owedAmount) {
        await tx.invoice.create({
          data: {
            userId,
            clientId: row.id,
            amount: owedAmount,
            status: 'OPEN',
            ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
          },
        });
      }
      return row;
    });

    return NextResponse.json(
      { client },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
