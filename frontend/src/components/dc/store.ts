'use client';

// Daily Cash — client model, backed by the API.
//
// Shape note: the screens speak the DESIGN's vocabulary (French stage labels,
// "Wave", a display `tag` per invoice); the API speaks the DATABASE's
// (FIRST_CONTACT, WAVE, a dueDate). The mapping lives here so neither side
// leaks into the other, and so both screens keep the exact same view model.
//
// Every mutation refetches /api/dashboard rather than patching local state:
// totals are server-computed SUMs, and a payment can settle an invoice as a
// side effect. Guessing the new state client-side would drift from the truth.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { relanceMessage as buildRelance } from '@/lib/dailycash/relance';
import { fcfa } from './primitives';

export const STAGES = ['Premier contact', 'À relancer', 'Devis envoyé', 'Gagné'] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_TO_API: Record<Stage, string> = {
  'Premier contact': 'FIRST_CONTACT',
  'À relancer': 'TO_FOLLOW_UP',
  'Devis envoyé': 'QUOTE_SENT',
  Gagné: 'WON',
};
const STAGE_FROM_API: Record<string, Stage> = {
  FIRST_CONTACT: 'Premier contact',
  TO_FOLLOW_UP: 'À relancer',
  QUOTE_SENT: 'Devis envoyé',
  WON: 'Gagné',
};

export const METHODS = ['Wave', 'Orange Money', 'Espèces'] as const;
export type Method = (typeof METHODS)[number];

const METHOD_TO_API: Record<Method, string> = {
  Wave: 'WAVE',
  'Orange Money': 'ORANGE_MONEY',
  Espèces: 'CASH',
};

export const GOAL_OPTIONS = [300000, 500000, 750000, 1000000] as const;

const DEFAULT_GOAL = 750000;

export interface Client {
  id: string;
  name: string;
}
export interface Task {
  id: string;
  label: string;
  tag: string;
  done: boolean;
}
export interface Invoice {
  id: string;
  clientId: string | null;
  name: string;
  amount: number;
  tag: string;
  late: boolean;
  /** Whole days past the due date — read from the API, never re-parsed. */
  daysLate: number;
  paid: boolean;
  relanced: boolean;
}
export interface RecentIncome {
  id: string;
  amount: number;
  label: string;
  when: string;
}
export interface Prospect {
  id: string;
  name: string;
  value: string;
  stage: Stage;
}
export interface Income {
  amount: number;
  client: string | null;
  method: Method;
}

export type Screen = 'today' | 'income' | 'clients';
export type Sheet =
  | 'profile'
  | 'goal'
  | 'add'
  | 'relance'
  | 'income'
  | 'success'
  // Undo a payment entered wrong. Without it the ledger was append-only and
  // a slipped keypad stayed in the month total forever.
  | 'corrections'
  // The paywall. Opened by the plan row, and automatically whenever a gated
  // route answers 402.
  | 'premium';

// ── Wire format ──────────────────────────────────────────────────────
interface DashboardResponse {
  user: { name: string | null; email: string | null; trade: string | null; phone: string | null };
  totals: { month: number; week: number; day: number };
  goal: number | null;
  period: string;
  clients: { id: string; name: string; phone: string | null }[];
  invoices: {
    id: string;
    amount: number;
    status: string;
    clientId: string | null;
    clientName: string | null;
    dueDate: string | null;
    paidAt: string | null;
    paidToday: boolean;
    late: boolean;
    daysLate: number;
    relancedToday: boolean;
  }[];
  tasks: { id: string; label: string; tag: string; done: boolean }[];
  prospects: { id: string; name: string; estimatedAmount: number | null; stage: string }[];
  recentIncomes: {
    id: string;
    amount: number;
    method: string;
    receivedAt: string;
    clientName: string | null;
  }[];
  /** Server truth. The screens never decide this for themselves. */
  premium: boolean;
  /** Counts of what a free account is missing; null when Premium is active. */
  locked: {
    clients: number;
    openInvoices: number;
    openInvoicesAmount: number;
    prospects: number;
    hasGoal: boolean;
  } | null;
}

interface BillingResponse {
  premium: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number;
  price: number;
  currency: string;
  features: readonly string[];
  /** False when no payment provider is wired on this deployment. */
  checkoutAvailable: boolean;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** The one-line status the invoice cards show under the client name. */
function invoiceTag(inv: DashboardResponse['invoices'][number]): string {
  if (inv.status === 'PAID') {
    // Only claim "aujourd'hui" when it really was today: an invoice settled
    // three months ago used to read "encaissé aujourd'hui" forever.
    if (inv.paidToday) return "Payé — encaissé aujourd'hui";
    return inv.paidAt ? `Payé le ${shortDate(inv.paidAt)}` : 'Payé';
  }
  const base = inv.late
    ? `Retard ${inv.daysLate} jour${inv.daysLate > 1 ? 's' : ''}`
    : inv.dueDate
      ? `Échéance ${shortDate(inv.dueDate)}`
      : 'Échéance à définir';
  return inv.relancedToday ? `Relancé aujourd'hui · ${base}` : base;
}

interface UiState {
  screen: Screen;
  digits: string;
  clientId: string | null;
  method: Method;
  sheet: Sheet | null;
  relanceId: string | null;
  form: { kind: 'client' | 'prospect'; name: string; amount: string };
  draft: string;
  /** Edited in the profile sheet; the number quoted in reminder messages. */
  phoneDraft: string;
  success: Income | null;
  /** True while the checkout redirect is being prepared. */
  checkingOut: boolean;
}

const UI_SEED: UiState = {
  screen: 'today',
  digits: '',
  clientId: null,
  method: 'Wave',
  sheet: null,
  relanceId: null,
  form: { kind: 'client', name: '', amount: '' },
  draft: '',
  phoneDraft: '',
  success: null,
  checkingOut: false,
};

export function useDailyCash() {
  const [ui, setUi] = useState<UiState>(UI_SEED);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((p: Partial<UiState> | ((prev: UiState) => Partial<UiState>)) => {
    setUi((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      // Both in one round-trip pair: the dashboard already carries `premium`
      // (so the screens never flicker), and /api/billing adds the price,
      // renewal date and whether a payment can even be taken.
      const [dash, bill] = await Promise.all([
        api<DashboardResponse>('/api/dashboard'),
        api<BillingResponse>('/api/billing').catch(() => null),
      ]);
      setData(dash);
      setBilling(bill);
      setAuthRequired(false);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setAuthRequired(true);
      } else {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Run a mutation, then resync from the server. */
  const mutate = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        await refresh();
      } catch (e) {
        // A gated route answered 402: show the offer, not a red banner. This
        // is the only place the paywall can legitimately appear on its own —
        // it means the SERVER refused, so it is never a guess.
        if (e instanceof ApiError && e.code === 'PREMIUM_REQUIRED') {
          patch({ sheet: 'premium' });
          return;
        }
        setError(e instanceof Error ? e.message : 'Action impossible');
      }
    },
    [refresh, patch],
  );

  // ── View model ──────────────────────────────────────────────────────
  const view = useMemo(() => {
    const clients: Client[] = (data?.clients ?? []).map((c) => ({ id: c.id, name: c.name }));
    const invoices: Invoice[] = (data?.invoices ?? []).map((inv) => ({
      id: inv.id,
      clientId: inv.clientId,
      name: inv.clientName ?? 'Sans client',
      amount: inv.amount,
      tag: invoiceTag(inv),
      late: inv.late,
      daysLate: inv.daysLate,
      paid: inv.status === 'PAID',
      relanced: inv.relancedToday,
    }));
    const recentIncomes: RecentIncome[] = (data?.recentIncomes ?? []).map((inc) => ({
      id: inc.id,
      amount: inc.amount,
      label: inc.clientName ?? 'Sans client',
      when: shortDate(inc.receivedAt),
    }));
    const tasks: Task[] = data?.tasks ?? [];
    const prospects: Prospect[] = (data?.prospects ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      value: p.estimatedAmount ? `Estimé ${fcfa(p.estimatedAmount)} FCFA` : 'Montant à définir',
      stage: STAGE_FROM_API[p.stage] ?? 'Premier contact',
    }));

    // Entitlement is server truth. The screens read it; they never set it.
    const premium = data?.premium ?? false;
    const lockedInvoices = data?.locked?.openInvoices ?? 0;
    const lockedOwed = data?.locked?.openInvoicesAmount ?? 0;
    const price = billing?.price ?? 2000;
    const cancelled = billing?.status === 'CANCELLED';
    const renewalLabel = billing?.currentPeriodEnd ? shortDate(billing.currentPeriodEnd) : '—';

    const month = data?.totals.month ?? 0;
    const objective = data?.goal ?? DEFAULT_GOAL;
    const entry = ui.digits ? parseInt(ui.digits, 10) : 0;
    const openInvoices = invoices.filter((i) => !i.paid);
    const due = openInvoices.reduce((a, i) => a + i.amount, 0);
    const lateInvoices = openInvoices.filter((i) => i.late);
    const owed = new Set(openInvoices.map((i) => i.clientId));
    const settledClients = clients.filter((c) => !owed.has(c.id));
    const selectedClient = clients.find((c) => c.id === ui.clientId) ?? null;
    // The invoice this payment would settle, if any.
    const settleTarget =
      openInvoices.find((i) => i.clientId === ui.clientId && i.amount > 0) ?? null;
    const goalPct = Math.min(100, Math.round(month / (objective / 100)));
    const openCount = openInvoices.length;

    const displayName = data?.user.name?.trim() || null;

    return {
      user: data?.user ?? null,
      displayName,
      // Avatar letter: the initial, or a neutral dot when we have no name yet.
      initial: displayName ? displayName.charAt(0).toUpperCase() : '·',
      greeting: displayName ? `Bonjour ${displayName}` : 'Bonjour',
      profileLine: [data?.user.trade, 'Dakar'].filter(Boolean).join(' · '),
      phone: data?.user.phone ?? null,
      clients,
      invoices,
      recentIncomes,
      tasks,
      prospects,
      openInvoices,
      settledClients,
      selectedClient,
      settleTarget,
      objective,
      month,
      entry,
      due,
      goalPct,
      // True only once loaded AND the account genuinely has nothing yet.
      // Prospects count: an account holding only leads is not empty, and the
      // empty state used to hide them behind a "commencez ici" screen.
      isEmpty:
        !loading &&
        clients.length === 0 &&
        invoices.length === 0 &&
        tasks.length === 0 &&
        prospects.length === 0 &&
        month === 0,
      monthLabel: fcfa(month),
      weekLabel: fcfa(data?.totals.week ?? 0),
      dayLabel: fcfa(data?.totals.day ?? 0),
      dueLabel: fcfa(due),
      dueCount: `${openCount} ${openCount > 1 ? 'factures' : 'facture'}`,
      dueSummary:
        due <= 0
          ? "Rien à recevoir pour l'instant. Ajoutez un client pour suivre ce qu'on vous doit."
          : `Réparti sur ${openCount} ${openCount > 1 ? 'clients. ' : 'client. '}` +
            // daysLate comes straight off the wire. The previous version dug
            // the number back out of the display string with a regex, so any
            // wording change silently produced "attend depuis  jours".
            (lateInvoices[0]
              ? `${lateInvoices[0].name} attend depuis ${lateInvoices[0].daysLate} ${
                  lateInvoices[0].daysLate > 1 ? 'jours' : 'jour'
                }.`
              : 'Tout est dans les délais.'),
      dueNote: lateInvoices[0]
        ? `${lateInvoices[0].name} est en retard.`
        : 'Aucun retard sur les factures ouvertes.',
      goalNote: !premium
        ? 'Passez en Premium pour fixer un objectif mensuel et suivre la distance qui reste.'
        : month >= objective
          ? 'Objectif atteint. Le mois est gagné.'
          : `Il reste ${fcfa(objective - month)} FCFA à encaisser avant votre objectif de ${fcfa(objective)}.`,
      goalSheetNote: `À ${fcfa(objective)} FCFA, il vous faut environ ${Math.max(
        1,
        Math.round(objective / 45000),
      )} prestations par mois au tarif moyen de 45 000 FCFA.`,
      taskCount: `${tasks.filter((t) => !t.done).length} restantes`,
      projectedMonth: `${fcfa(month + entry)} FCFA`,
      // For a free account the amount owed is not readable, so the pitch
      // leans on the count the server DOES disclose.
      upgradeTitle: premium
        ? `Vous avez ${fcfa(due)} FCFA à récupérer. Suivez-les jusqu'au bout.`
        : lockedOwed > 0
          ? `Vous avez ${fcfa(lockedOwed)} FCFA à récupérer sur ${lockedInvoices} ${
              lockedInvoices > 1 ? 'factures' : 'facture'
            }. Suivez-les jusqu'au bout.`
          : 'Suivez qui vous doit de l’argent, et relancez-les sans y penser.',
      planLabel: premium
        ? `Premium · ${fcfa(price)} FCFA / mois`
        : `Gratuite · activer Premium (${fcfa(price)} FCFA / mois) →`,
      planShort: premium ? 'Premium' : 'Formule gratuite',
      // What the profile row shows under the plan name.
      planDetail: premium
        ? cancelled
          ? `Annulé — accès jusqu'au ${renewalLabel}`
          : `Renouvellement le ${renewalLabel}`
        : 'Revenus et tâches inclus, pour toujours',
      successNote: premium
        ? month >= objective
          ? 'Objectif du mois atteint. Bravo.'
          : `Il reste ${fcfa(Math.max(0, objective - month))} FCFA avant votre objectif du mois.`
        : 'Fixez un objectif mensuel pour voir la distance qui reste.',
      relanceInvoice: invoices.find((i) => i.id === ui.relanceId) ?? null,
      canAdd: ui.form.name.trim().length > 1,

      // ── Billing ───────────────────────────────────────────────────────
      premium,
      cancelled,
      price,
      priceLabel: `${fcfa(price)} FCFA / mois`,
      renewalLabel,
      daysRemaining: billing?.daysRemaining ?? 0,
      features: billing?.features ?? [],
      /** False on a deployment with no payment credentials wired. */
      checkoutAvailable: billing?.checkoutAvailable ?? false,
      locked: data?.locked ?? null,
      lockedInvoices,
      lockedOwed,
      lockedSummary: data?.locked
        ? [
            data.locked.clients > 0 &&
              `${data.locked.clients} ${data.locked.clients > 1 ? 'clients' : 'client'}`,
            data.locked.openInvoices > 0 &&
              `${data.locked.openInvoices} ${
                data.locked.openInvoices > 1 ? 'factures ouvertes' : 'facture ouverte'
              }`,
            data.locked.prospects > 0 &&
              `${data.locked.prospects} ${data.locked.prospects > 1 ? 'prospects' : 'prospect'}`,
          ]
            .filter((x): x is string => typeof x === 'string')
            .join(' · ')
        : '',
    };
  }, [data, billing, ui, loading]);

  // ── Actions ─────────────────────────────────────────────────────────
  const actions = useMemo(
    () => ({
      refresh,
      go: (screen: Screen) => patch({ screen, success: null, sheet: null }),
      // The profile sheet edits the payment number, so it opens with the
      // stored value rather than a blank field.
      openSheet: (sheet: Sheet) =>
        patch(sheet === 'profile' ? { sheet, phoneDraft: data?.user.phone ?? '' } : { sheet }),
      closeSheet: () => patch({ sheet: null, relanceId: null }),
      setMethod: (method: Method) => patch({ method }),
      setClient: (clientId: string | null) => patch({ clientId }),
      setDraft: (draft: string) => patch({ draft }),
      setPhoneDraft: (phoneDraft: string) => patch({ phoneDraft: phoneDraft.slice(0, 32) }),

      /** Saves (or clears) the number the reminder message quotes. */
      savePhone: () =>
        void mutate(async () => {
          await api('/api/profile', {
            method: 'PATCH',
            body: { phone: ui.phoneDraft.trim() },
          });
          patch({ sheet: null });
        }),
      setDigits: (digits: string) => patch({ digits: digits.replace(/[^0-9]/g, '').slice(0, 9) }),
      setForm: (p: Partial<UiState['form']>) => patch((prev) => ({ form: { ...prev.form, ...p } })),
      dismissError: () => setError(null),

      // ── Premium ───────────────────────────────────────────────────────
      openPremium: () => patch({ sheet: 'premium' }),

      /**
       * Opens the hosted Wave / Orange Money checkout.
       *
       * Nothing is granted here — the browser cannot grant anything. Access
       * appears only when the provider's webhook confirms the payment, which
       * is why this just redirects and the dashboard is re-read on return.
       */
      startCheckout: async () => {
        if (ui.checkingOut) return;
        patch({ checkingOut: true });
        try {
          const res = await api<{ paymentUrl: string | null }>('/api/billing/checkout', {
            method: 'POST',
          });
          if (res.paymentUrl) {
            window.location.href = res.paymentUrl;
            return; // leaving the page; keep the spinner until it unloads
          }
          setError("Le paiement n'a pas pu être ouvert. Réessayez.");
        } catch (e) {
          setError(
            e instanceof ApiError && e.code === 'PAYMENT_PROVIDER_UNCONFIGURED'
              ? 'Les paiements ne sont pas encore branchés sur ce déploiement.'
              : e instanceof Error
                ? e.message
                : 'Paiement impossible',
          );
        } finally {
          patch({ checkingOut: false });
        }
      },

      /** Stops renewal; the days already paid for are kept. */
      cancelPremium: () =>
        void mutate(async () => {
          await api('/api/billing/cancel', { method: 'POST' });
          patch({ sheet: null });
        }),

      /**
       * Development only, and only while no payment provider exists — the
       * route 404s otherwise. Lets the Premium half of the app be exercised
       * before a payment contract is signed.
       */
      devActivatePremium: () =>
        void mutate(async () => {
          await api('/api/billing/dev-activate', { method: 'POST' });
          patch({ sheet: null });
        }),

      /** Ends the session server-side, then hands back to the login screen. */
      signOut: async () => {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        setAuthRequired(true);
        setData(null);
      },

      pressKey: (label: string) =>
        patch((prev) => {
          if (label === '⌫') return { digits: prev.digits.slice(0, -1) };
          if (prev.digits.length > 8) return {};
          if (!prev.digits && (label === '0' || label === '000')) return {};
          return { digits: prev.digits + label };
        }),
      bump: (n: number) =>
        patch((prev) => ({ digits: String((prev.digits ? parseInt(prev.digits, 10) : 0) + n) })),
      settleInvoice: () => {
        if (view.settleTarget) patch({ digits: String(view.settleTarget.amount) });
      },

      setObjective: (amount: number) =>
        void mutate(() => api('/api/goal', { method: 'PUT', body: { amount } })),

      addTask: () => {
        const label = ui.draft.trim();
        if (!label) return;
        patch({ draft: '' });
        void mutate(() => api('/api/tasks', { method: 'POST', body: { label } }));
      },
      toggleTask: (id: string, done: boolean) =>
        void mutate(() => api(`/api/tasks/${id}`, { method: 'PATCH', body: { done } })),

      // ── Corrections ───────────────────────────────────────────────────
      // Nothing here existed before: every screen could only add. A freelancer
      // who typed 350 000 instead of 35 000 had a wrong month total for good.
      deleteTask: (id: string) => void mutate(() => api(`/api/tasks/${id}`, { method: 'DELETE' })),
      deleteProspect: (id: string) =>
        void mutate(() => api(`/api/prospects/${id}`, { method: 'DELETE' })),
      deleteClient: (id: string) =>
        void mutate(() => api(`/api/clients/${id}`, { method: 'DELETE' })),
      deleteInvoice: (id: string) =>
        void mutate(() => api(`/api/invoices/${id}`, { method: 'DELETE' })),
      /** Also reopens the invoice this payment had settled, server-side. */
      deleteIncome: (id: string) =>
        void mutate(() => api(`/api/incomes/${id}`, { method: 'DELETE' })),

      payInvoice: (id: string) =>
        void mutate(async () => {
          await api(`/api/invoices/${id}`, {
            method: 'PATCH',
            body: { action: 'pay', method: METHOD_TO_API[ui.method] },
          });
          patch({ sheet: null, relanceId: null });
        }),
      openRelance: (id: string) => patch({ sheet: 'relance', relanceId: id }),
      markRelanced: () => {
        const id = ui.relanceId;
        if (!id) return;
        void mutate(async () => {
          await api(`/api/invoices/${id}`, { method: 'PATCH', body: { action: 'relance' } });
          patch({ sheet: null, relanceId: null });
        });
      },

      confirmIncome: () => {
        const amount = ui.digits ? parseInt(ui.digits, 10) : 0;
        if (amount <= 0) return;
        void mutate(async () => {
          await api('/api/incomes', {
            method: 'POST',
            body: { amount, method: METHOD_TO_API[ui.method], clientId: ui.clientId },
          });
          patch({
            success: {
              amount,
              client: view.selectedClient?.name ?? null,
              method: ui.method,
            },
            sheet: 'success',
            digits: '',
          });
        });
      },
      closeSuccess: () => patch({ success: null, sheet: null, screen: 'today', clientId: null }),
      againIncome: () =>
        patch({ success: null, sheet: null, screen: 'income', clientId: null, digits: '' }),

      advanceProspect: (id: string, current: Stage) => {
        const next = STAGES[(STAGES.indexOf(current) + 1) % STAGES.length] ?? STAGES[0];
        void mutate(() =>
          api(`/api/prospects/${id}`, { method: 'PATCH', body: { stage: STAGE_TO_API[next] } }),
        );
      },

      submitAdd: () => {
        const name = ui.form.name.trim();
        if (name.length <= 1) return;
        const amount = parseInt(ui.form.amount || '0', 10) || 0;
        const kind = ui.form.kind;
        void mutate(async () => {
          if (kind === 'prospect') {
            await api('/api/prospects', {
              method: 'POST',
              body: { name, ...(amount ? { estimatedAmount: amount } : {}) },
            });
          } else {
            await api('/api/clients', {
              method: 'POST',
              body: { name, ...(amount ? { owedAmount: amount } : {}) },
            });
          }
          patch({
            sheet: null,
            screen: 'clients',
            form: { kind: 'client', name: '', amount: '' },
          });
        });
      },
    }),
    [patch, mutate, refresh, ui, data, view.settleTarget, view.selectedClient],
  );

  return { s: ui, d: view, a: actions, loading, authRequired, error };
}

/**
 * The ready-to-send reminder text.
 *
 * `phone` is the FREELANCER's own Wave / Orange Money number. It must come
 * from the account (`d.phone`) — the prototype's placeholder used to be
 * hard-coded here, which sent every client to a number owned by nobody.
 */
export function relanceMessage(inv: Invoice | null, phone: string | null): string {
  if (!inv) return '';
  return buildRelance({ clientName: inv.name, amount: inv.amount, phone });
}
