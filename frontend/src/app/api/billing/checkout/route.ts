// POST /api/billing/checkout — start (or resume) a Premium payment.
//
// Built on the kit's existing payment seam: an `Order` row plus the
// `PaymentProvider` interface, guarded by the shared CircuitBreaker. What is
// specific to a subscription:
//
//   1. THE PRICE IS FIXED SERVER-SIDE. /api/orders takes an amount from the
//      request body, which is right for a marketplace and catastrophic here —
//      a client could buy a month of Premium for 1 FCFA.
//   2. `metadata.kind = 'subscription'` is what the webhook keys on to
//      extend the period. Without it a paid order is just a paid order.
//   3. A live PENDING attempt is RESUMED rather than duplicated. Double-tap
//      on a slow connection is the normal case on mobile, and two hosted
//      checkout pages for the same month is how people get billed twice.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';
import { CircuitOpenError } from '@/lib/server/payments/circuit-breaker';
import {
  breaker,
  getProvider,
  PaymentProviderUnconfiguredError,
} from '@/lib/server/payments/provider-singleton';
import { PREMIUM_CURRENCY, PREMIUM_PRICE_XOF } from '@/lib/server/billing/plan';

/** Hosted checkout links do not stay valid forever; 2h is generous. */
const CHECKOUT_EXPIRY_MS = 2 * 60 * 60 * 1000;

/** Marks an Order as "this buys a month of Premium". Read by the webhook. */
export const SUBSCRIPTION_ORDER_KIND = 'subscription';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const userId = auth.user.sub;
    const now = new Date();

    // 1. Resume a checkout already in flight for this user.
    const pending = await prisma.order.findFirst({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gt: now },
        paymentUrl: { not: null },
        metadata: { path: ['kind'], equals: SUBSCRIPTION_ORDER_KIND },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, paymentUrl: true },
    });
    if (pending) {
      return NextResponse.json(
        { orderId: pending.id, paymentUrl: pending.paymentUrl, resumed: true },
        { status: 200, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // 2. Provider must be wired. A missing key is a misconfiguration, not a
    //    server fault — 503, never 500 (kit convention).
    let provider;
    try {
      provider = getProvider();
    } catch (err) {
      if (err instanceof PaymentProviderUnconfiguredError) {
        return NextResponse.json(
          {
            error: 'PAYMENT_PROVIDER_UNCONFIGURED',
            message: 'Les paiements ne sont pas encore configurés sur ce déploiement.',
          },
          { status: 503, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }

    // Same fail-closed rule as /api/orders: without PUBLIC_URL in production
    // the provider would redirect real payers to localhost.
    const envPublicUrl = process.env.PUBLIC_URL;
    if (!envPublicUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'PAYMENT_PROVIDER_UNCONFIGURED',
          message: 'PUBLIC_URL absent : impossible de construire les URLs de retour.',
        },
        { status: 503, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const publicUrl = envPublicUrl ?? 'http://localhost:3000';

    // 3. Create the PENDING order. The idempotency key buckets by minute:
    //    two taps racing past the resume check above collide on the unique
    //    index instead of opening two checkouts. The loser re-reads and
    //    returns the winner's URL.
    const bucket = Math.floor(now.getTime() / 60_000);
    const idempotencyKey = `sub:${userId}:${bucket}`;
    let order;
    try {
      order = await prisma.order.create({
        data: {
          userId,
          amount: PREMIUM_PRICE_XOF,
          currency: PREMIUM_CURRENCY,
          provider: 'bictorys',
          status: 'PENDING',
          expiresAt: new Date(now.getTime() + CHECKOUT_EXPIRY_MS),
          idempotencyKey,
          customerEmail: auth.user.email,
          metadata: { kind: SUBSCRIPTION_ORDER_KIND } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await prisma.order.findUnique({
          where: { idempotencyKey },
          select: { id: true, paymentUrl: true },
        });
        if (winner?.paymentUrl) {
          return NextResponse.json(
            { orderId: winner.id, paymentUrl: winner.paymentUrl, resumed: true },
            { status: 200, headers: { 'x-request-id': ctx.requestId } },
          );
        }
        // The winner has not got its URL back from the provider yet.
        return NextResponse.json(
          { error: 'PAYMENT_IN_FLIGHT', message: 'Paiement en cours, réessayez dans un instant.' },
          { status: 503, headers: { 'x-request-id': ctx.requestId, 'Retry-After': '3' } },
        );
      }
      throw err;
    }

    // 4. Charge behind the breaker.
    try {
      const result = await breaker.execute(() =>
        provider.charge({
          amount: PREMIUM_PRICE_XOF,
          currency: PREMIUM_CURRENCY,
          customer: { email: auth.user.email },
          successUrl: `${publicUrl}/billing/success?order=${order.id}`,
          failureUrl: `${publicUrl}/billing/failed?order=${order.id}`,
          externalRef: order.id,
        }),
      );

      await prisma.order.update({
        where: { id: order.id },
        data: { providerChargeId: result.providerChargeId, paymentUrl: result.paymentUrl },
      });

      log.info('billing checkout opened', { orderId: order.id, amount: PREMIUM_PRICE_XOF });

      return NextResponse.json(
        { orderId: order.id, paymentUrl: result.paymentUrl, resumed: false },
        { status: 201, headers: { 'x-request-id': ctx.requestId } },
      );
    } catch (err) {
      // Mark FAILED either way, so the resume branch above never hands a
      // caller a PENDING order that will never get a payment URL.
      await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });

      if (err instanceof CircuitOpenError) {
        const retryAfterSec = Math.max(1, Math.ceil((err.retryAt.getTime() - Date.now()) / 1000));
        return NextResponse.json(
          {
            error: 'PAYMENT_PROVIDER_UNAVAILABLE',
            message: 'Le service de paiement est momentanément indisponible.',
          },
          {
            status: 503,
            headers: { 'x-request-id': ctx.requestId, 'Retry-After': String(retryAfterSec) },
          },
        );
      }
      return NextResponse.json(
        {
          error: 'PAYMENT_FAILED',
          message: err instanceof Error ? err.message : 'Erreur de paiement inconnue',
        },
        { status: 502, headers: { 'x-request-id': ctx.requestId } },
      );
    }
  });
}
