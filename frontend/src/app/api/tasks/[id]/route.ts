// PATCH  /api/tasks/[id] — tick a task off (or back on).
// DELETE /api/tasks/[id] — remove it entirely.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({ done: z.boolean() });

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
        { error: 'VALIDATION_FAILED', message: 'Champ « done » requis' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // updateMany scoped by userId: a task belonging to someone else matches
    // zero rows, so ownership is enforced by the query, not a second read.
    const res = await prisma.task.updateMany({
      where: { id, userId: auth.user.sub },
      data: { done: parsed.data.done, doneAt: parsed.data.done ? new Date() : null },
    });

    if (res.count === 0) {
      return NextResponse.json(
        { error: 'TASK_NOT_FOUND', message: 'Tâche introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

// DELETE /api/tasks/[id] — remove a task typed by mistake. Ticking a task off
// hides it from the count but keeps it on screen; deleting is the only way to
// undo a typo, which is why it exists rather than being left to a rewrite.
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

    const { id } = await params;
    const res = await prisma.task.deleteMany({ where: { id, userId: auth.user.sub } });

    if (res.count === 0) {
      return NextResponse.json(
        { error: 'TASK_NOT_FOUND', message: 'Tâche introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
