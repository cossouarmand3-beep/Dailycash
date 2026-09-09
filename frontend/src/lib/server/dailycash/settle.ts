import 'server-only';

// Which open invoice does an incoming payment settle?
//
// The rule is deliberately strict: **exact amount, or nothing.** An earlier
// version matched `amount <= payment` and took the oldest, which meant a
// client owing 10 000 (old) and 60 000 (recent) who paid 60 000 settled the
// 10 000 one and stayed "late" on the 60 000. Silently closing the wrong debt
// is worse than closing none: the freelancer stops chasing money they are
// still owed.
//
// A payment that matches nothing is still recorded as income — it just leaves
// every invoice open, which is the honest outcome for a partial payment or a
// job with no invoice behind it.

export interface SettleCandidate {
  id: string;
  amount: number;
  dueDate: Date | null;
  createdAt: Date;
}

/**
 * The invoice this payment settles, or null.
 *
 * Ties are broken by urgency: soonest due date first (an invoice with no due
 * date is the least urgent), then oldest created.
 */
export function pickInvoiceToSettle(
  candidates: readonly SettleCandidate[],
  amount: number,
): SettleCandidate | null {
  const exact = candidates.filter((c) => c.amount === amount);
  if (exact.length === 0) return null;

  return exact.reduce((best, c) => (isMoreUrgent(c, best) ? c : best), exact[0] as SettleCandidate);
}

function isMoreUrgent(a: SettleCandidate, b: SettleCandidate): boolean {
  if (a.dueDate && b.dueDate) {
    if (a.dueDate.getTime() !== b.dueDate.getTime()) {
      return a.dueDate.getTime() < b.dueDate.getTime();
    }
  } else if (a.dueDate || b.dueDate) {
    // A dated invoice always outranks an undated one.
    return a.dueDate !== null;
  }
  return a.createdAt.getTime() < b.createdAt.getTime();
}
