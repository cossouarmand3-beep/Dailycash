// GET /api/dashboard — everything the Daily Cash screens need, in one call.
//
// Deliberately a single aggregate endpoint rather than six resource GETs: the
// app targets freelancers on mobile data in Senegal, where round-trips cost
// more than payload. The prototypes even ship a "réseau lent" state.
//
// Totals are SUMs over Income.receivedAt — never counters on User. A counter
// would drift the moment an income is edited, deleted, or back-dated.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import {
  daysLate,
  isLate,
  periodKey,
  startOfDay,
  startOfMonth,
  startOfNextDay,
  startOfNextMonth,
  startOfNextWeek,
  startOfWeek,
} from '@/lib/server/dailycash/period';

// How many recent payments the "corriger une erreur" list shows. Small on
// purpose: it exists to undo a slip made minutes ago, not to browse history.
const RECENT_INCOMES = 8;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const userId = auth.user.sub;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = startOfNextMonth(now);
    const weekStart = startOfWeek(now);
    const weekEnd = startOfNextWeek(now);
    const dayStart = startOfDay(now);
    const dayEnd = startOfNextDay(now);

    const [
      user,
      monthAgg,
      weekAgg,
      dayAgg,
      goal,
      clients,
      invoices,
      tasks,
      recentIncomes,
      prospects,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, trade: true, phone: true },
      }),
      prisma.income.aggregate({
        where: { userId, receivedAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      // Every window is half-open [start, end): without the upper bound a
      // payment dated in the future counted in "aujourd'hui" and "cette
      // semaine" while sitting outside the month — the day total could
      // exceed the month total.
      prisma.income.aggregate({
        where: { userId, receivedAt: { gte: weekStart, lt: weekEnd } },
        _sum: { amount: true },
      }),
      prisma.income.aggregate({
        where: { userId, receivedAt: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
      prisma.monthlyGoal.findUnique({
        where: { userId_period: { userId, period: periodKey(now) } },
        select: { amount: true },
      }),
      prisma.client.findMany({
        where: { userId },
        select: { id: true, name: true, phone: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.invoice.findMany({
        where: { userId, status: { not: 'CANCELLED' } },
        select: {
          id: true,
          label: true,
          amount: true,
          status: true,
          dueDate: true,
          relancedAt: true,
          paidAt: true,
          clientId: true,
          client: { select: { name: true } },
        },
        // "OPEN" sorts before "PAID" alphabetically, which is the order we
        // want — spelled out here so a renamed status does not silently
        // reshuffle the list.
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      }),
      prisma.task.findMany({
        where: { userId },
        select: { id: true, label: true, tag: true, done: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.income.findMany({
        where: { userId },
        select: {
          id: true,
          amount: true,
          method: true,
          receivedAt: true,
          client: { select: { name: true } },
        },
        orderBy: { receivedAt: 'desc' },
        take: RECENT_INCOMES,
      }),
      prisma.prospect.findMany({
        where: { userId },
        select: { id: true, name: true, estimatedAmount: true, stage: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const todayStart = startOfDay(now).getTime();

    return NextResponse.json(
      {
        user: {
          name: user?.name ?? null,
          email: user?.email ?? null,
          trade: user?.trade ?? null,
          // The freelancer's OWN payment number — the reminder message quotes
          // it, and omits the payment line entirely when it is null.
          phone: user?.phone ?? null,
        },
        totals: {
          month: monthAgg._sum.amount ?? 0,
          week: weekAgg._sum.amount ?? 0,
          day: dayAgg._sum.amount ?? 0,
        },
        goal: goal ? goal.amount : null,
        period: periodKey(now),
        clients,
        invoices: invoices.map((inv) => ({
          id: inv.id,
          label: inv.label,
          amount: inv.amount,
          status: inv.status,
          clientId: inv.clientId,
          clientName: inv.client?.name ?? null,
          dueDate: inv.dueDate?.toISOString() ?? null,
          paidAt: inv.paidAt?.toISOString() ?? null,
          // Same rule as relancedToday: "encaissé aujourd'hui" must mean today.
          paidToday: inv.paidAt !== null && inv.paidAt.getTime() >= todayStart,
          late: inv.status === 'OPEN' && isLate(inv.dueDate, now),
          daysLate: inv.status === 'OPEN' ? daysLate(inv.dueDate, now) : 0,
          // "Relancé aujourd'hui" in the UI means exactly that — chased today,
          // not chased at some point in the past.
          relancedToday: inv.relancedAt !== null && inv.relancedAt.getTime() >= todayStart,
        })),
        tasks,
        prospects,
        // Newest first — the undo list for a payment just entered wrong.
        recentIncomes: recentIncomes.map((inc) => ({
          id: inc.id,
          amount: inc.amount,
          method: inc.method,
          receivedAt: inc.receivedAt.toISOString(),
          clientName: inc.client?.name ?? null,
        })),
      },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
