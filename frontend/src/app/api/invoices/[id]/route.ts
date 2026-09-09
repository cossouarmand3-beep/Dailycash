// PATCH  /api/invoices/[id] — mark an invoice paid, or record that it was chased.
// DELETE /api/invoices/[id] — remove an invoice added by mistake.
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
        // Chasing a settled invoice would send a client a reminder for money
        // they already paid — refuse rather than stamp it.
        if (invoice.status !== 'OPEN') return { error: 'INVOICE_NOT_OPEN' as const };
        await tx.invoice.update({ where: { id }, data: { relancedAt: new Date() } });
        return { ok: true as const, incomeId: null };
      }

      // Compare-and-swap on the status. Two concurrent "marquer reçu" taps —
      // the normal outcome of a slow mobile connection — would otherwise BOTH
      // read OPEN and BOTH create an income, double-counting the payment.
      // Only the request that actually flips OPEN → PAID writes the income.
      const now = new Date();
      const claimed = await tx.invoice.updateMany({
        where: { id, userId, status: 'OPEN' },
        data: { status: 'PAID', paidAt: now },
      });
      if (claimed.count === 0) {
        // Already settled (by the other tap, or by an earlier request).
        return { ok: true as const, incomeId: null };
      }

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
      return { ok: true as const, incomeId: income.id };
    });

    if ('error' in result) {
      const notOpen = result.error === 'INVOICE_NOT_OPEN';
      return NextResponse.json(
        {
          error: result.error,
          message: notOpen ? 'Cette facture est déjà réglée.' : 'Facture introuvable',
        },
        { status: notOpen ? 409 : 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-request-id': ctx.requestId },
    });
  });
}

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
    // Any income already recorded against this invoice SURVIVES: the money
    // was really received. Income.invoiceId is `onDelete: SetNull`, so the
    // payment simply stops pointing at a deleted invoice.
    const res = await prisma.invoice.deleteMany({ where: { id, userId: auth.user.sub } });

    if (res.count === 0) {
      return NextResponse.json(
        { error: 'INVOICE_NOT_FOUND', message: 'Facture introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
