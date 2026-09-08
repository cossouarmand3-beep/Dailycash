// PATCH /api/invoices/[id] — mark an invoice paid, or record that it was chased.
//
// action: "pay"     → settle it AND create the matching Income row
// action: "relance" → stamp relancedAt (the reminder was sent)
//
// Why "pay" writes an Income: day/week/month totals are SUMs over Income, so
// flipping only the invoice status would settle the debt while leaving the
// month total unchanged — the exact contradiction the product exists to avoid.
// Both writes share one transaction: an invoice marked paid with no income
// behind it is worse than a failure the caller can retry.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  action: z.enum(['pay', 'relance']),
  method: z.enum(['WAVE', 'ORANGE_MONEY', 'CASH']).optional(),
});

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
    const userId = auth.user.sub;

    const { id } = await params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Action inconnue' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, userId },
        select: { id: true, amount: true, clientId: true, status: true },
      });
      if (!invoice) return { error: 'INVOICE_NOT_FOUND' as const };

      if (parsed.data.action === 'relance') {
        await tx.invoice.update({ where: { id }, data: { relancedAt: new Date() } });
        return { ok: true as const, incomeId: null };
      }

      // Idempotent: paying an already-paid invoice must not double-count.
      if (invoice.status === 'PAID') return { ok: true as const, incomeId: null };

      const now = new Date();
      const income = await tx.income.create({
        data: {
          userId,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          amount: invoice.amount,
          method: parsed.data.method ?? 'WAVE',
          receivedAt: now,
        },
        select: { id: true },
      });
      await tx.invoice.update({
        where: { id },
        data: { status: 'PAID', paidAt: now },
      });
      return { ok: true as const, incomeId: income.id };
    });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error, message: 'Facture introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-request-id': ctx.requestId },
    });
  });
}
