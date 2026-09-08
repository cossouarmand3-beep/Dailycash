// POST /api/incomes — record a payment the freelancer actually received.
//
// This is the core write of the product. When the payment covers an open
// invoice for the same client, the invoice is settled in the SAME transaction:
// a payment recorded but an invoice left open would keep chasing a client who
// has already paid.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';

// XOF has no subunit, so this is whole francs. The ceiling is a sanity guard
// against a slipped keypad, not a business rule.
const AMOUNT_MAX = 1_000_000_000;

const Body = z.object({
  amount: z.number().int().positive().max(AMOUNT_MAX),
  method: z.enum(['WAVE', 'ORANGE_MONEY', 'CASH']).default('WAVE'),
  clientId: z.string().min(1).nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
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
        { error: 'VALIDATION_FAILED', message: 'Montant ou moyen de paiement invalide' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const { amount, method, note } = parsed.data;
    const clientId = parsed.data.clientId ?? null;
    const receivedAt = parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Ownership check: a client id from another account must not attach.
      if (clientId) {
        const owned = await tx.client.findFirst({
          where: { id: clientId, userId },
          select: { id: true },
        });
        if (!owned) return { error: 'CLIENT_NOT_FOUND' as const };
      }

      // Settle the oldest open invoice this payment fully covers.
      const invoice = clientId
        ? await tx.invoice.findFirst({
            where: { userId, clientId, status: 'OPEN', amount: { lte: amount } },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
          })
        : null;

      const income = await tx.income.create({
        data: {
          userId,
          clientId,
          invoiceId: invoice?.id ?? null,
          amount,
          method,
          receivedAt,
          ...(note ? { note } : {}),
        },
        select: { id: true, amount: true, method: true, receivedAt: true },
      });

      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: receivedAt },
        });
      }

      return { income, settledInvoiceId: invoice?.id ?? null };
    });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error, message: 'Client introuvable' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    log.info('income recorded', {
      incomeId: result.income.id,
      amount,
      settledInvoiceId: result.settledInvoiceId,
    });

    return NextResponse.json(
      { income: result.income, settledInvoiceId: result.settledInvoiceId },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
