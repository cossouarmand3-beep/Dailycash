// Smoke test for the Daily Cash domain API, against a running dev server.
//
// Usage: pnpm smoke:dailycash   (after `pnpm dev` in another terminal)
//
// Covers: signup → verify → dashboard (empty) → client with debt → income →
// invoice settle → task → prospect → goal → dashboard (totals check).
// Exits 0 on a full pass, 1 + a log line on the first failure.
//
// NOT run in CI (needs a live server + a real database). Manual UAT only —
// which is why there is no companion .test.ts: Vitest would pick it up and
// run it with nothing listening.

import { pathToFileURL } from 'node:url';

import { PrismaClient } from '@prisma/client';

const RAW_BASE_URL = process.env.SMOKE_BASE_URL?.trim();
const BASE_URL = RAW_BASE_URL ? RAW_BASE_URL : 'http://localhost:3000';
const COOKIE_PREFIX = process.env.COOKIE_PREFIX ?? 'app';
const TEST_EMAIL = `dc-smoke-${Date.now()}@example.test`;
const TEST_PASSWORD = 'SmokeTestPwd123!';

const prisma = new PrismaClient();
const cookieJar: string[] = [];

function cookieHeader(): string {
  return cookieJar.map((c) => c.split(';')[0]).join('; ');
}

function absorbCookies(res: Response): void {
  for (const c of res.headers.getSetCookie()) {
    const name = c.split('=')[0];
    const idx = cookieJar.findIndex((existing) => existing.split('=')[0] === name);
    if (idx >= 0) cookieJar[idx] = c;
    else cookieJar.push(c);
  }
}

function csrf(): string {
  const re = new RegExp(`(?:^|;\\s*)${COOKIE_PREFIX}-csrf=([^;]+)`);
  for (const c of cookieJar) {
    const m = c.match(re);
    if (m) return decodeURIComponent(m[1] ?? '');
  }
  return '';
}

class StepError extends Error {
  constructor(
    public step: string,
    public status: number,
    public body: unknown,
  ) {
    super(`[${step}] status=${status}`);
  }
}

// Shapes of the responses this script asserts on. Kept minimal on purpose:
// the script checks behaviour, not the full API surface.
interface Dashboard {
  user: { name: string | null; email: string | null; trade: string | null; phone: string | null };
  totals: { month: number; week: number; day: number };
  goal: number | null;
  clients: { id: string; name: string }[];
  invoices: { id: string; amount: number; status: string; paidToday: boolean }[];
  tasks: { id: string; label: string; done: boolean }[];
  prospects: { id: string; name: string; stage: string }[];
  recentIncomes: { id: string; amount: number; clientName: string | null }[];
}

async function call<T = unknown>(
  step: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
  expected = 200,
): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { cookie: cookieHeader() };
  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    headers['x-csrf-token'] = csrf();
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  absorbCookies(res);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  if (res.status !== expected) throw new StepError(step, res.status, body);
  console.log(`  ✓ ${step}: ${res.status}`);
  return body as T;
}

export async function main(): Promise<number> {
  console.log(`Smoke Daily Cash contre ${BASE_URL} — ${TEST_EMAIL}\n`);
  try {
    // 1. Account
    await call(
      'signup',
      '/api/auth/signup',
      {
        method: 'POST',
        body: { email: TEST_EMAIL, password: TEST_PASSWORD },
      },
      201,
    );

    const user = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      select: { id: true },
    });
    if (!user) throw new StepError('db.user', 0, 'user row not created');

    const vc = await prisma.verificationCode.findFirst({
      where: { userId: user.id, type: 'EMAIL_VERIFY' },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    if (!vc) throw new StepError('db.code', 0, 'no verification code');
    console.log(`  ✓ db.peekCode: ${vc.code.slice(0, 2)}…`);

    await call('verify-email', '/api/auth/verify-email', {
      method: 'POST',
      body: { email: TEST_EMAIL, code: vc.code },
    });

    // 1b. Name + trade — saved after verification, exactly as the signup
    //     screen does it (signup itself issues no session to attach them to).
    await call('profile', '/api/profile', {
      method: 'PATCH',
      body: { name: 'Fatou', trade: 'Community manager', phone: '77 123 45 67' },
    });

    // 2. A brand-new account must start at zero, not at seed data.
    const empty = await call<Dashboard>('dashboard (vide)', '/api/dashboard');
    if (empty.totals.month !== 0 || empty.clients.length !== 0) {
      throw new StepError('dashboard.empty', 200, empty);
    }

    // 3. One client, two open invoices. The OLD, SMALL one is created first
    //    on purpose — see step 5.
    const { client } = await call<{ client: { id: string } }>(
      'clients (vieille dette 10 000)',
      '/api/clients',
      {
        method: 'POST',
        body: { name: 'Restaurant Teranga', owedAmount: 10000 },
      },
      201,
    );
    // Same name → the client is reused, and a second invoice is attached.
    await call(
      'clients (nouvelle facture 60 000)',
      '/api/clients',
      {
        method: 'POST',
        body: { name: 'Restaurant Teranga', owedAmount: 60000 },
      },
      201,
    );

    const withDebt = await call<Dashboard>('dashboard (dettes)', '/api/dashboard');
    if (withDebt.clients.length !== 1 || withDebt.invoices.length !== 2) {
      throw new StepError('dashboard.debt', 200, {
        clients: withDebt.clients,
        invoices: withDebt.invoices,
      });
    }

    // 4. A 35 000 income with no client — month total moves, debt does not.
    await call(
      'incomes (sans client)',
      '/api/incomes',
      {
        method: 'POST',
        body: { amount: 35000, method: 'WAVE' },
      },
      201,
    );

    // 5. Pay 60 000 for that client. It must settle the 60 000 invoice and
    //    leave the older 10 000 OPEN. The regression this pins down: matching
    //    "any invoice this payment covers, oldest first" closed the 10 000 and
    //    left the real debt open and un-chased.
    const paid60 = await call<{ income: { id: string }; settledInvoiceId: string | null }>(
      'incomes (60 000 — règlement exact)',
      '/api/incomes',
      {
        method: 'POST',
        body: { amount: 60000, method: 'ORANGE_MONEY', clientId: client.id },
      },
      201,
    );
    const invoice60 = withDebt.invoices.find((i) => i.amount === 60000);
    const invoice10 = withDebt.invoices.find((i) => i.amount === 10000);
    if (!invoice60 || !invoice10) throw new StepError('fixtures', 200, withDebt.invoices);
    if (paid60.settledInvoiceId !== invoice60.id) {
      throw new StepError('settle.exactMatch', 200, {
        expected: invoice60.id,
        got: paid60.settledInvoiceId,
      });
    }

    // 6. A payment dated in the future is refused: it would land in "today"
    //    and "this week" while sitting outside the month window.
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    await call(
      'incomes (date future refusée)',
      '/api/incomes',
      { method: 'POST', body: { amount: 1000, receivedAt: future } },
      400,
    );

    // 7. Task + prospect + goal
    const { task } = await call<{ task: { id: string } }>(
      'tasks',
      '/api/tasks',
      {
        method: 'POST',
        body: { label: 'Livrer 6 visuels Boutique Awa' },
      },
      201,
    );
    await call('tasks (cocher)', `/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: { done: true },
    });

    const { prospect } = await call<{ prospect: { id: string } }>(
      'prospects',
      '/api/prospects',
      {
        method: 'POST',
        body: { name: 'Sokhna Événements', estimatedAmount: 180000 },
      },
      201,
    );
    await call('prospects (avancer)', `/api/prospects/${prospect.id}`, {
      method: 'PATCH',
      body: { stage: 'QUOTE_SENT' },
    });

    await call('goal', '/api/goal', { method: 'PUT', body: { amount: 750000 } });

    // 8. State after the additions
    const full = await call<Dashboard>('dashboard (complet)', '/api/dashboard');
    const expectedMonth = 35000 + 60000;
    if (full.totals.month !== expectedMonth) {
      throw new StepError('totals.month', 200, { expected: expectedMonth, got: full.totals.month });
    }
    if (full.totals.day !== expectedMonth || full.totals.week !== expectedMonth) {
      throw new StepError('totals.day/week', 200, full.totals);
    }
    if (full.goal !== 750000) throw new StepError('goal', 200, full.goal);
    if (full.invoices.find((i) => i.id === invoice60.id)?.status !== 'PAID') {
      throw new StepError('invoice60.settled', 200, full.invoices);
    }
    // The whole point of the exact-match rule: the old debt is untouched.
    if (full.invoices.find((i) => i.id === invoice10.id)?.status !== 'OPEN') {
      throw new StepError('invoice10.untouched', 200, full.invoices);
    }
    if (full.prospects[0]?.stage !== 'QUOTE_SENT') {
      throw new StepError('prospect.stage', 200, full.prospects);
    }
    if (full.tasks[0]?.done !== true) throw new StepError('task.done', 200, full.tasks);
    if (full.clients[0]?.id !== client.id) throw new StepError('client', 200, full.clients);
    if (full.user?.name !== 'Fatou' || full.user?.trade !== 'Community manager') {
      throw new StepError('user.profile', 200, full.user);
    }
    if (full.user?.phone !== '77 123 45 67') throw new StepError('user.phone', 200, full.user);
    if (full.recentIncomes.length !== 2) {
      throw new StepError('recentIncomes', 200, full.recentIncomes);
    }

    // 9. Undo a payment. The month total must fall back AND the invoice it
    //    had settled must reopen — otherwise deleting the money would leave a
    //    debt marked paid that nobody chases.
    await call('incomes (annuler)', `/api/incomes/${paid60.income.id}`, { method: 'DELETE' });
    const undone = await call<Dashboard>('dashboard (après annulation)', '/api/dashboard');
    if (undone.totals.month !== 35000) {
      throw new StepError('undo.total', 200, { expected: 35000, got: undone.totals.month });
    }
    if (undone.invoices.find((i) => i.id === invoice60.id)?.status !== 'OPEN') {
      throw new StepError('undo.invoiceReopened', 200, undone.invoices);
    }

    // 10. Settling through the invoice route creates the income too, and a
    //     repeated call must NOT double-count it (the double-tap case).
    await call('invoices (marquer reçu)', `/api/invoices/${invoice10.id}`, {
      method: 'PATCH',
      body: { action: 'pay', method: 'WAVE' },
    });
    await call('invoices (re-marquer reçu — idempotent)', `/api/invoices/${invoice10.id}`, {
      method: 'PATCH',
      body: { action: 'pay', method: 'WAVE' },
    });
    const settled = await call<Dashboard>('dashboard (facture réglée)', '/api/dashboard');
    if (settled.totals.month !== 45000) {
      throw new StepError('pay.idempotent', 200, {
        expected: 45000,
        got: settled.totals.month,
        note: 'un second « marquer reçu » a recompté le paiement',
      });
    }

    // 11. Deletions clean up.
    await call('tasks (supprimer)', `/api/tasks/${task.id}`, { method: 'DELETE' });
    await call('prospects (supprimer)', `/api/prospects/${prospect.id}`, { method: 'DELETE' });
    const final = await call<Dashboard>('dashboard (final)', '/api/dashboard');
    if (final.tasks.length !== 0 || final.prospects.length !== 0) {
      throw new StepError('delete.cleanup', 200, {
        tasks: final.tasks,
        prospects: final.prospects,
      });
    }

    console.log(
      `\n  totaux: mois=${final.totals.month} semaine=${final.totals.week} jour=${final.totals.day}`,
    );
    console.log('\n✓ smoke-dailycash PASS');
    return 0;
  } catch (err) {
    const e = err as StepError;
    console.error(`\n✗ smoke-dailycash FAIL at [${e.step ?? 'unknown'}]`);
    console.error(`  status: ${e.status ?? 'n/a'}`);
    console.error(`  body:   ${JSON.stringify(e.body, null, 2)}`);
    return 1;
  } finally {
    // Cascade deletes every Daily Cash row this run created.
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
