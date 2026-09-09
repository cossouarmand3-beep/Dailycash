// DELETE /api/incomes/[id] — undo a payment entered by mistake.
//
// The single most important correction in the app: the whole product is a
// number the freelancer trusts, and a slipped keypad (350 000 instead of
// 35 000) must not be permanent. Without this route the ledger was
// append-only and the month total was wrong forever.
//
// If the income had settled an invoice, that invoice goes back to OPEN in the
// same transaction — otherwise deleting the payment would leave a debt marked
// paid that nobody is chasing any more.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';

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
    const userId = auth.user.sub;

    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const income = await tx.income.findFirst({
        where: { id, userId },
        select: { id: true, amount: true, invoiceId: true },
      });
      if (!income) return { error: 'INCOME_NOT_FOUND' as const };

      if (income.invoiceId) {
        // Scoped by userId and by the PAID status it is supposed to be in, so
        // a re-issued delete cannot reopen an invoice someone settled since.
        await tx.invoice.updateMany({
          where: { id: income.invoiceId, userId, status: 'PAID' },
          data: { status: 'OPEN', paidAt: null },
        });
      }

      await tx.income.delete({ where: { id: income.id } });
      return { ok: true as const, reopenedInvoiceId: income.invoiceId, amount: income.amount };
    });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error, message: 'Encaissement introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    log.info('income deleted', {
      incomeId: id,
      amount: result.amount,
      reopenedInvoiceId: result.reopenedInvoiceId,
    });

    return NextResponse.json(
      { ok: true, reopenedInvoiceId: result.reopenedInvoiceId },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
