import { describe, expect, it } from 'vitest';
import {
  daysLate,
  isLate,
  periodKey,
  startOfDay,
  startOfMonth,
  startOfNextMonth,
  startOfWeek,
} from './period';

// All dates are UTC, which for Africa/Dakar (UTC+0, no DST) is also local time.
const at = (iso: string) => new Date(iso);

describe('startOfWeek (Monday-based)', () => {
  it('returns the same Monday for a Monday', () => {
    // 2026-09-07 is a Monday.
    expect(startOfWeek(at('2026-09-07T15:30:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('walks back to Monday from mid-week', () => {
    expect(startOfWeek(at('2026-09-10T08:00:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('treats Sunday as the END of its week, not the start', () => {
    // The regression this guards: with a naive getUTCDay() offset, Sunday
    // opens a new week and "cette semaine" resets a day early.
    expect(startOfWeek(at('2026-09-13T23:59:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('crosses a month boundary', () => {
    // 2026-10-01 is a Thursday; its week starts Monday 2026-09-28.
    expect(startOfWeek(at('2026-10-01T12:00:00Z')).toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });
});

describe('day and month boundaries', () => {
  it('startOfDay strips the time', () => {
    expect(startOfDay(at('2026-09-08T23:59:59Z')).toISOString()).toBe('2026-09-08T00:00:00.000Z');
  });

  it('startOfMonth returns the 1st', () => {
    expect(startOfMonth(at('2026-09-30T10:00:00Z')).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('startOfNextMonth rolls the year over in December', () => {
    expect(startOfNextMonth(at('2026-12-15T10:00:00Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });
});

describe('periodKey', () => {
  it('zero-pads single-digit months', () => {
    expect(periodKey(at('2026-09-08T00:00:00Z'))).toBe('2026-09');
    expect(periodKey(at('2026-01-31T00:00:00Z'))).toBe('2026-01');
    expect(periodKey(at('2026-12-01T00:00:00Z'))).toBe('2026-12');
  });
});

describe('isLate / daysLate', () => {
  const now = at('2026-09-08T09:00:00Z');

  it('an invoice with no due date is never late', () => {
    expect(isLate(null, now)).toBe(false);
    expect(daysLate(null, now)).toBe(0);
  });

  it('is not late on the due date itself', () => {
    // Due today = still has the whole day to pay.
    expect(isLate(at('2026-09-08T00:00:00Z'), now)).toBe(false);
    expect(daysLate(at('2026-09-08T18:00:00Z'), now)).toBe(0);
  });

  it('is not late when due in the future', () => {
    expect(isLate(at('2026-09-12T00:00:00Z'), now)).toBe(false);
  });

  it('counts whole days once the due date has passed', () => {
    expect(isLate(at('2026-09-07T00:00:00Z'), now)).toBe(true);
    expect(daysLate(at('2026-09-07T00:00:00Z'), now)).toBe(1);
    expect(daysLate(at('2026-08-27T00:00:00Z'), now)).toBe(12);
  });

  it('ignores the time of day on both sides', () => {
    // Same calendar days, wildly different clock times → same answer.
    expect(daysLate(at('2026-08-27T23:59:00Z'), at('2026-09-08T00:01:00Z'))).toBe(12);
  });
});
