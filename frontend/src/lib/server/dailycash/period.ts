import 'server-only';

// Day / week / month boundaries for the Daily Cash totals.
//
// TIMEZONE: the app targets Senegal (Africa/Dakar), which is UTC+00:00
// year-round with no DST. UTC boundaries are therefore the real local
// boundaries — no offset maths, no tz database. If this app ever ships
// outside that offset, every function here needs revisiting; that is why
// the assumption is stated rather than buried.

/** Weeks start Monday, per French/Senegalese convention. */
export function startOfWeek(now: Date): Date {
  const d = startOfDay(now);
  // getUTCDay(): 0 = Sunday … 6 = Saturday. Monday must map to 0 offset,
  // Sunday to 6 — otherwise Sunday would open a brand-new week.
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

export function startOfDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** First instant of the next month — the exclusive upper bound. */
export function startOfNextMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** "2026-09" — the MonthlyGoal.period key. */
export function periodKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** An invoice is late once its due date has passed and it is still open. */
export function isLate(dueDate: Date | null, now: Date): boolean {
  return dueDate !== null && dueDate.getTime() < startOfDay(now).getTime();
}

/** Whole days between the due date and today; 0 when not yet due. */
export function daysLate(dueDate: Date | null, now: Date): number {
  if (!isLate(dueDate, now)) return 0;
  const ms = startOfDay(now).getTime() - startOfDay(dueDate as Date).getTime();
  return Math.floor(ms / 86_400_000);
}
