// POST /api/tasks — add a quick daily task.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  label: z.string().trim().min(1).max(200),
  tag: z.string().trim().max(40).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Libellé de tâche invalide' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const task = await prisma.task.create({
      data: {
        userId: auth.user.sub,
        label: parsed.data.label,
        ...(parsed.data.tag ? { tag: parsed.data.tag } : {}),
      },
      select: { id: true, label: true, tag: true, done: true },
    });

    return NextResponse.json({ task }, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  });
}
