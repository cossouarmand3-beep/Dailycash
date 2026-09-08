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
  user: { name: string | null; email: string | null; trade: string | null };
  totals: { month: number; week: number; day: number };
  goal: number | null;
  clients: { id: string; name: string }[];
  invoices: { id: string; amount: number; status: string }[];
  tasks: { id: string; label: string; done: boolean }[];
  prospects: { id: string; name: string; stage: string }[];
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
      body: { name: 'Fatou', trade: 'Community manager' },
    });

    // 2. A brand-new account must start at zero, not at seed data.
    const empty = await call<Dashboard>('dashboard (vide)', '/api/dashboard');
    if (empty.totals.month !== 0 || empty.clients.length !== 0) {
      throw new StepError('dashboard.empty', 200, empty);
    }

    // 3. Client owing 60 000
    const { client } = await call<{ client: { id: string } }>(
      'clients (avec dette)',
      '/api/clients',
      {
        method: 'POST',
        body: { name: 'Restaurant Teranga', owedAmount: 60000 },
      },
      201,
    );

    const withDebt = await call<Dashboard>('dashboard (dette)', '/api/dashboard');
    if (withDebt.invoices.length !== 1 || withDebt.invoices[0].amount !== 60000) {
      throw new StepError('dashboard.debt', 200, withDebt.invoices);
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

    // 5. Settle the invoice. This must ALSO create an income, so the month
    //    total climbs by the invoice amount — the invariant worth proving.
    const invoiceId = withDebt.invoices[0]?.id;
    await call('invoices (marquer reçu)', `/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      body: { action: 'pay', method: 'ORANGE_MONEY' },
    });

    // 6. Task + prospect + goal
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

    // 7. Final state
    const final = await call<Dashboard>('dashboard (final)', '/api/dashboard');
    const expectedMonth = 35000 + 60000;
    if (final.totals.month !== expectedMonth) {
      throw new StepError('totals.month', 200, {
        expected: expectedMonth,
        got: final.totals.month,
      });
    }
    if (final.totals.day !== expectedMonth || final.totals.week !== expectedMonth) {
      throw new StepError('totals.day/week', 200, final.totals);
    }
    if (final.goal !== 750000) throw new StepError('goal', 200, final.goal);
    if (final.invoices.some((i) => i.status !== 'PAID')) {
      throw new StepError('invoice.settled', 200, final.invoices);
    }
    if (final.prospects[0]?.stage !== 'QUOTE_SENT') {
      throw new StepError('prospect.stage', 200, final.prospects);
    }
    if (final.tasks[0]?.done !== true) throw new StepError('task.done', 200, final.tasks);
    if (final.clients[0]?.id !== client.id) throw new StepError('client', 200, final.clients);
    if (final.user?.name !== 'Fatou' || final.user?.trade !== 'Community manager') {
      throw new StepError('user.profile', 200, final.user);
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
