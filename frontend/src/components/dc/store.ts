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
  paid: boolean;
  relanced: boolean;
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
export type Sheet = 'profile' | 'goal' | 'add' | 'relance' | 'income' | 'success';

// ── Wire format ──────────────────────────────────────────────────────
interface DashboardResponse {
  user: { name: string | null; email: string | null; trade: string | null };
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
    late: boolean;
    daysLate: number;
    relancedToday: boolean;
  }[];
  tasks: { id: string; label: string; tag: string; done: boolean }[];
  prospects: { id: string; name: string; estimatedAmount: number | null; stage: string }[];
}

/** The one-line status the invoice cards show under the client name. */
function invoiceTag(inv: DashboardResponse['invoices'][number]): string {
  if (inv.status === 'PAID') return "Payé — encaissé aujourd'hui";
  const base = inv.late
    ? `Retard ${inv.daysLate} jour${inv.daysLate > 1 ? 's' : ''}`
    : inv.dueDate
      ? `Échéance ${new Date(inv.dueDate).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        })}`
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
  success: Income | null;
  // Billing is not built yet, so the plan is a local toggle: it drives the
  // paywall UI only, and grants nothing server-side.
  premium: boolean;
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
  success: null,
  premium: true,
};

export function useDailyCash() {
  const [ui, setUi] = useState<UiState>(UI_SEED);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((p: Partial<UiState> | ((prev: UiState) => Partial<UiState>)) => {
    setUi((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api<DashboardResponse>('/api/dashboard');
      setData(res);
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
        setError(e instanceof Error ? e.message : 'Action impossible');
      }
    },
    [refresh],
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
      paid: inv.status === 'PAID',
      relanced: inv.relancedToday,
    }));
    const tasks: Task[] = data?.tasks ?? [];
    const prospects: Prospect[] = (data?.prospects ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      value: p.estimatedAmount ? `Estimé ${fcfa(p.estimatedAmount)} FCFA` : 'Montant à définir',
      stage: STAGE_FROM_API[p.stage] ?? 'Premier contact',
    }));

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
      clients,
      invoices,
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
      isEmpty:
        !loading &&
        clients.length === 0 &&
        invoices.length === 0 &&
        tasks.length === 0 &&
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
            (lateInvoices[0]
              ? `${lateInvoices[0].name} attend depuis ${lateInvoices[0].tag.replace(/\D+/g, '')} jours.`
              : 'Tout est dans les délais.'),
      dueNote: lateInvoices[0]
        ? `${lateInvoices[0].name} est en retard.`
        : 'Aucun retard sur les factures ouvertes.',
      goalNote: !ui.premium
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
      upgradeTitle: `Vous avez ${fcfa(due)} FCFA à récupérer. Suivez-les jusqu'au bout.`,
      planLabel: ui.premium ? 'Premium · 2 000 FCFA / mois' : 'Gratuite · activer Premium →',
      planShort: ui.premium ? 'Premium' : 'Formule gratuite',
      successNote: ui.premium
        ? month >= objective
          ? 'Objectif du mois atteint. Bravo.'
          : `Il reste ${fcfa(Math.max(0, objective - month))} FCFA avant votre objectif du mois.`
        : 'Fixez un objectif mensuel pour voir la distance qui reste.',
      relanceInvoice: invoices.find((i) => i.id === ui.relanceId) ?? null,
      canAdd: ui.form.name.trim().length > 1,
    };
  }, [data, ui, loading]);

  // ── Actions ─────────────────────────────────────────────────────────
  const actions = useMemo(
    () => ({
      refresh,
      go: (screen: Screen) => patch({ screen, success: null, sheet: null }),
      openSheet: (sheet: Sheet) => patch({ sheet }),
      closeSheet: () => patch({ sheet: null, relanceId: null }),
      setMethod: (method: Method) => patch({ method }),
      setClient: (clientId: string | null) => patch({ clientId }),
      setDraft: (draft: string) => patch({ draft }),
      setDigits: (digits: string) => patch({ digits: digits.replace(/[^0-9]/g, '').slice(0, 9) }),
      setForm: (p: Partial<UiState['form']>) => patch((prev) => ({ form: { ...prev.form, ...p } })),
      togglePremium: () => patch((prev) => ({ premium: !prev.premium, sheet: null })),
      dismissError: () => setError(null),

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
    [patch, mutate, refresh, ui, view.settleTarget, view.selectedClient],
  );

  return { s: ui, d: view, a: actions, loading, authRequired, error };
}

/** The ready-to-send reminder text, exactly as the prototypes composed it. */
export function relanceMessage(inv: Invoice | null): string {
  if (!inv) return '';
  return `Bonjour ${inv.name}, petit rappel pour la facture de ${fcfa(inv.amount)} FCFA. Vous pouvez régler par Wave ou Orange Money au 77 000 00 00. Merci !`;
}
