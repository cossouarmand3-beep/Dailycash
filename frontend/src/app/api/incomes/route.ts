// POST /api/incomes — record a payment the freelancer actually received.
//
// This is the core write of the product. When the payment matches an open
// invoice for the same client EXACTLY, the invoice is settled in the SAME
// transaction: a payment recorded but an invoice left open would keep chasing
// a client who has already paid. See `dailycash/settle.ts` for why the match
// has to be exact rather than "anything this payment covers".
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';
import { pickInvoiceToSettle } from '@/lib/server/dailycash/settle';
import { startOfNextDay } from '@/lib/server/dailycash/period';

// XOF has no subunit, so this is whole francs. The ceiling is a sanity guard
// against a slipped keypad, not a business rule.
const AMOUNT_MAX = 1_000_000_000;

// A payment cannot have been received tomorrow. Without this bound a
// future-dated income inflates "aujourd'hui" and "cette semaine" while
// sitting outside the month window — the day total would exceed the month.
const MAX_BACKDATE_YEARS = 5;

const Body = z.object({
  amount: z.number().int().positive().max(AMOUNT_MAX),
  method: z.enum(['WAVE', 'ORANGE_MONEY', 'CASH']).default('WAVE'),
  clientId: z.string().min(1).nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

/** null when the date is unusable; the caller turns that into a 400. */
function resolveReceivedAt(raw: string | undefined, now: Date): Date | null {
  if (!raw) return now;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() >= startOfNextDay(now).getTime()) return null;
  const floor = new Date(now);
  floor.setUTCFullYear(floor.getUTCFullYear() - MAX_BACKDATE_YEARS);
  if (d.getTime() < floor.getTime()) return null;
  return d;
}

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

    const now = new Date();
    const receivedAt = resolveReceivedAt(parsed.data.receivedAt, now);
    if (!receivedAt) {
      return NextResponse.json(
        {
          error: 'RECEIVED_AT_OUT_OF_RANGE',
          message: 'La date de réception doit être passée (et pas trop ancienne).',
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Ownership check: a client id from another account must not attach.
      if (clientId) {
        const owned = await tx.client.findFirst({
          where: { id: clientId, userId },
          select: { id: true },
        });
        if (!owned) return { error: 'CLIENT_NOT_FOUND' as const };
      }

      const candidates = clientId
        ? await tx.invoice.findMany({
            where: { userId, clientId, status: 'OPEN' },
            select: { id: true, amount: true, dueDate: true, createdAt: true },
          })
        : [];
      const target = pickInvoiceToSettle(candidates, amount);

      // Compare-and-swap: only the request that flips OPEN → PAID owns the
      // settlement. A concurrent double-tap loses the race here, and its
      // income is still recorded — just not credited against the invoice.
      let settledInvoiceId: string | null = null;
      if (target) {
        const claimed = await tx.invoice.updateMany({
          where: { id: target.id, userId, status: 'OPEN' },
          data: { status: 'PAID', paidAt: receivedAt },
        });
        if (claimed.count === 1) settledInvoiceId = target.id;
      }

      const income = await tx.income.create({
        data: {
          userId,
          clientId,
          invoiceId: settledInvoiceId,
          amount,
          method,
          receivedAt,
          ...(note ? { note } : {}),
        },
        select: { id: true, amount: true, method: true, receivedAt: true },
      });

      return { income, settledInvoiceId };
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
