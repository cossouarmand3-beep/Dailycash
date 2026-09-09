'use client';

// Daily Cash — mobile app.
// Faithful to `Daily Cash.dc.html`: three screens behind a bottom nav, four
// bottom sheets, and a full-screen confirmation after a recorded income.
//
// The prototype's phone bezel and fake status bar were canvas scaffolding and
// are gone. So is its "premier lancement" toggle — the empty state now happens
// on its own when an account has no data, and the plan toggle went with it:
// Premium is a real subscription now, so `d.premium` is server truth and no
// control on this page can change it.

import Link from 'next/link';
import { Chip, Cta, IconButton, Mono, fcfa } from '@/components/dc/primitives';
import { PremiumPanel } from '@/components/dc/premium-panel';
import {
  GOAL_OPTIONS,
  METHODS,
  relanceMessage,
  useDailyCash,
  type Method,
} from '@/components/dc/store';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'];

export default function AppPage() {
  const { s, d, a, loading, authRequired, error } = useDailyCash();

  if (loading || authRequired) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#ede4d4] px-6">
        <div className="w-full max-w-[420px] rounded-md border border-edge-light bg-cream-card p-6 text-center">
          {loading ? (
            <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-muted">
              Chargement…
            </p>
          ) : (
            <>
              <h1 className="text-[19px] font-extrabold tracking-[-0.02em]">
                Connectez-vous pour voir vos chiffres
              </h1>
              <p className="mt-2 text-sm leading-normal text-[#6b5941]">
                Vos revenus, factures et tâches sont rattachés à votre compte.
              </p>
              <Link
                href="/login"
                className="mt-5 block rounded-[4px] bg-brand p-4 text-[15px] font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)]"
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh justify-center bg-[#ede4d4] sm:py-7">
      <div className="relative flex w-full max-w-[420px] flex-col bg-cream sm:min-h-[844px] sm:overflow-hidden sm:rounded-[18px] sm:shadow-[0_24px_50px_rgba(42,29,18,0.24)]">
        {error && (
          <button
            type="button"
            onClick={() => a.dismissError()}
            className="w-full cursor-pointer bg-[#fff3e2] px-5 py-2.5 text-left text-[13px] text-brand-deep"
          >
            {error} — toucher pour masquer
          </button>
        )}
        <div className="flex-1 overflow-y-auto">
          {s.screen === 'today' && (
            <>
              <header className="bg-ink px-5 pt-[18px] pb-[26px] text-cream">
                <div className="flex items-baseline justify-between">
                  <div>
                    <Mono className="text-tan">Lundi 7 septembre</Mono>
                    <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">
                      {d.greeting}
                    </h1>
                  </div>
                  <button
                    type="button"
                    onClick={() => a.openSheet('profile')}
                    aria-label="Ouvrir le profil"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-brand text-[15px] font-extrabold text-cream"
                  >
                    {d.initial}
                  </button>
                </div>

                <div className="mt-5 border-t border-edge-dark pt-4">
                  <Mono className="text-tan">Encaissé en septembre</Mono>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-[46px] leading-none font-black tracking-[-0.035em] tabular-nums">
                      {d.monthLabel}
                    </span>
                    <span className="text-[15px] font-bold text-tan">FCFA</span>
                  </div>

                  {d.premium ? (
                    <button
                      type="button"
                      onClick={() => a.openSheet('goal')}
                      className="mt-4 block w-full cursor-pointer text-left"
                    >
                      <div className="mb-1.5 flex justify-between font-mono text-[11px] text-tan">
                        <span>Objectif {fcfa(d.objective)}</span>
                        <span>{d.goalPct}% · modifier</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-[2px] bg-edge-dark">
                        <div
                          className="h-full origin-left animate-[dcSweep_0.7s_cubic-bezier(0.2,0.8,0.2,1)_both] bg-amber"
                          style={{ width: `${d.goalPct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[13px] text-sand">{d.goalNote}</p>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => a.go('clients')}
                      className="mt-4 flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-3 rounded-[4px] border border-dashed border-[#7a5c3c] px-3.5 py-3 text-left"
                    >
                      <span className="text-[13px] leading-[1.35] text-sand">
                        Fixez un objectif mensuel et suivez-le jour après jour.
                      </span>
                      <span className="font-mono text-[11px] whitespace-nowrap text-amber">
                        Voir →
                      </span>
                    </button>
                  )}
                </div>
              </header>

              <div className="grid grid-cols-2 border-b border-edge-light">
                <div className="border-r border-edge-light px-5 py-3.5">
                  <Mono className="text-[10px] tracking-[0.12em] text-muted">Cette semaine</Mono>
                  <div className="mt-[3px] text-xl font-extrabold tabular-nums">{d.weekLabel}</div>
                </div>
                <div className="px-5 py-3.5">
                  <Mono className="text-[10px] tracking-[0.12em] text-muted">
                    Aujourd&rsquo;hui
                  </Mono>
                  <div className="mt-[3px] text-xl font-extrabold tabular-nums">{d.dayLabel}</div>
                </div>
              </div>

              {d.isEmpty && (
                <div className="px-5 pt-[22px] pb-1">
                  <div className="animate-[dcRise_0.5s_ease_both] rounded-md border border-edge-light bg-cream-card p-5">
                    <h2 className="text-[19px] leading-[1.25] font-extrabold tracking-[-0.02em]">
                      Trois minutes pour tout savoir sur votre mois
                    </h2>
                    <p className="mt-2 text-sm leading-normal text-[#6b5941]">
                      Commencez par le dernier paiement que vous avez reçu. Le reste se remplit tout
                      seul.
                    </p>
                    <Cta
                      onClick={() => a.go('income')}
                      className="mt-[18px] min-h-0 p-[15px] text-[15px]"
                    >
                      Enregistrer un revenu reçu
                    </Cta>
                    <div className="mt-[18px] flex flex-col gap-3 border-t border-[#ede2ce] pt-4">
                      {[
                        {
                          num: '02',
                          text: "Ajoutez un client ou un prospect pour savoir qui vous doit de l'argent.",
                          onClick: () => a.openSheet('add'),
                        },
                        {
                          num: '03',
                          text: 'Fixez votre objectif du mois pour suivre votre progression.',
                          onClick: () => a.openSheet('goal'),
                        },
                      ].map((row) => (
                        <button
                          key={row.num}
                          type="button"
                          onClick={row.onClick}
                          className="flex min-h-[44px] cursor-pointer items-start gap-2.5 text-left"
                        >
                          <span className="pt-0.5 font-mono text-[11px] text-brand">{row.num}</span>
                          <span className="text-[13px] leading-[1.4] text-[#6b5941]">
                            {row.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {d.due > 0 && (
                <section className="px-5 pt-[18px]">
                  <div className="flex items-center justify-between">
                    <Mono className="text-muted">En attente de paiement</Mono>
                    <button
                      type="button"
                      onClick={() => a.go('clients')}
                      className="min-h-[44px] cursor-pointer px-0.5 font-mono text-[11px] text-brand"
                    >
                      Tout voir
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => a.go('clients')}
                    className="mt-1 w-full cursor-pointer rounded-[4px] border border-[#efd3ae] border-l-4 border-l-amber bg-[#fff3e2] p-3.5 text-left"
                  >
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="text-2xl font-black tabular-nums">{d.dueLabel}</span>
                      <span className="font-mono text-[11px] text-[#8a6435]">{d.dueCount}</span>
                    </div>
                    <p className="mt-[5px] text-[13px] text-[#6b5941]">{d.dueNote}</p>
                  </button>
                </section>
              )}

              <section className="px-5 pt-[22px] pb-[26px]">
                <div className="flex items-center justify-between">
                  <Mono className="text-muted">Tâches du jour</Mono>
                  <div className="font-mono text-[11px] text-muted">{d.taskCount}</div>
                </div>
                {d.tasks.length > 0 ? (
                  <ul className="mt-2.5 overflow-hidden rounded-[4px] border border-edge-light bg-cream-card">
                    {d.tasks.map((t, i) => (
                      // Keyed by id: two tasks can legitimately share a label,
                      // and a label key made React reuse the wrong row.
                      <li
                        key={t.id}
                        className={`flex items-center ${i ? 'border-t border-[#ede2ce]' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => a.toggleTask(t.id, !t.done)}
                          className="flex min-h-[56px] flex-1 cursor-pointer items-center gap-[11px] p-3.5 text-left"
                        >
                          <span
                            aria-hidden
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] text-[13px] font-black text-cream ${
                              t.done ? 'border-check bg-check' : 'border-[#c7b69b]'
                            }`}
                          >
                            {t.done ? '✓' : ''}
                          </span>
                          <span
                            className={`flex-1 text-sm leading-[1.35] ${
                              t.done ? 'text-muted line-through' : 'text-ink'
                            }`}
                          >
                            {t.label}
                          </span>
                          <span className="shrink-0 rounded-[3px] bg-[#f3ecde] px-[7px] py-1 font-mono text-[10px] tracking-[0.06em] uppercase text-muted">
                            {t.tag}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => a.deleteTask(t.id)}
                          aria-label={`Supprimer la tâche ${t.label}`}
                          className="min-h-[56px] shrink-0 cursor-pointer px-3.5 text-[15px] text-muted hover:text-brand-deep"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 rounded-[4px] border border-dashed border-[#d8c9ae] bg-cream-card p-4 text-[13px] leading-[1.45] text-muted">
                    Rien de prévu aujourd&rsquo;hui. Écrivez ce que vous devez livrer ou relancer.
                  </p>
                )}
                <div className="mt-3 flex gap-2.5">
                  <input
                    value={s.draft}
                    onChange={(e) => a.setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') a.addTask();
                    }}
                    placeholder="Ajouter une tâche rapide"
                    aria-label="Ajouter une tâche rapide"
                    className="min-h-[44px] flex-1 rounded-[4px] border border-edge-light bg-cream-card px-3.5 py-[13px] text-sm text-ink outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => a.addTask()}
                    aria-label="Ajouter la tâche"
                    className="min-h-[44px] w-[52px] cursor-pointer rounded-[4px] bg-ink text-xl font-bold text-cream"
                  >
                    +
                  </button>
                </div>
              </section>
            </>
          )}

          {s.screen === 'income' && (
            <>
              <div className="flex items-center gap-3 border-b border-edge-light px-4 pt-3 pb-2.5">
                <IconButton onClick={() => a.go('today')} label="Retour">
                  ←
                </IconButton>
                <h1 className="text-[17px] font-extrabold">Revenu reçu</h1>
              </div>

              <div className="px-5 pt-[22px] text-center">
                <Mono className="text-muted">Montant encaissé</Mono>
                <div className="mt-2 flex items-baseline justify-center gap-2">
                  <span
                    className={`text-[46px] leading-none font-black tracking-[-0.035em] tabular-nums ${
                      s.digits ? 'text-ink' : 'text-[#c7b69b]'
                    }`}
                  >
                    {s.digits ? fcfa(d.entry) : '0'}
                  </span>
                  <span className="text-base font-bold text-muted">FCFA</span>
                </div>
                <div className="mt-2.5 inline-flex gap-2">
                  {[5000, 10000, 25000].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => a.bump(n)}
                      className="min-h-[44px] cursor-pointer rounded-full border border-edge-light bg-cream-card px-[15px] py-2 font-mono text-xs text-[#6b5941]"
                    >
                      +{fcfa(n)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-5 mt-[18px] flex items-center justify-between rounded-[4px] bg-[#f3ecde] px-3.5 py-3">
                <Mono className="tracking-[0.1em] text-muted">Total septembre</Mono>
                <span className="text-[17px] font-extrabold tabular-nums">{d.projectedMonth}</span>
              </div>

              <section className="px-5 pt-[18px]">
                <div className="flex items-center justify-between">
                  <Mono className="text-muted">Client — optionnel</Mono>
                  <button
                    type="button"
                    onClick={() => a.openSheet('add')}
                    className="min-h-[44px] cursor-pointer px-0.5 font-mono text-[11px] text-brand"
                  >
                    + Nouveau
                  </button>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-2">
                  <Chip active={!s.clientId} onClick={() => a.setClient(null)}>
                    Sans client
                  </Chip>
                  {d.clients.map((c) => (
                    <Chip key={c.id} active={s.clientId === c.id} onClick={() => a.setClient(c.id)}>
                      {c.name}
                    </Chip>
                  ))}
                </div>
                {d.settleTarget && (
                  <button
                    type="button"
                    onClick={() => a.settleInvoice()}
                    className="mt-3 min-h-[44px] w-full cursor-pointer rounded-[4px] border border-[#cfdcc0] bg-[#f1f5ea] p-3 text-left text-[13px] leading-[1.4] font-semibold text-[#3f5a2c]"
                  >
                    Solder la facture de {d.settleTarget.name} — {fcfa(d.settleTarget.amount)} FCFA
                  </button>
                )}
                <div className="mt-3.5 flex gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => a.setMethod(m as Method)}
                      className={`min-h-[44px] flex-1 cursor-pointer rounded-[4px] border px-1.5 py-3 font-mono text-xs ${
                        s.method === m
                          ? 'border-brand bg-[#fff3e2] text-brand-deep'
                          : 'border-edge-light bg-cream-card text-muted'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-3 gap-2 px-4 pt-4">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => a.pressKey(k)}
                    className="cursor-pointer rounded-[4px] border border-edge-light bg-cream-card py-4 text-[21px] font-bold text-ink active:bg-[#f3ecde]"
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="px-5 pt-3.5 pb-6">
                <Cta disabled={d.entry <= 0} onClick={() => a.confirmIncome()}>
                  {d.entry > 0 ? `Confirmer ${fcfa(d.entry)} FCFA` : 'Saisissez un montant'}
                </Cta>
              </div>
            </>
          )}

          {s.screen === 'clients' && (
            <>
              <div className="flex items-center justify-between gap-2.5 border-b border-edge-light px-5 py-3.5">
                <div>
                  <h1 className="text-[19px] font-extrabold tracking-[-0.02em]">
                    Clients &amp; encaissements
                  </h1>
                  <div className="mt-[3px] font-mono text-[11px] text-muted">
                    {d.premium
                      ? d.isEmpty
                        ? '0 client · 0 prospect'
                        : `${d.clients.length} clients actifs · ${d.prospects.length} prospects`
                      : 'Aperçu — version gratuite'}
                  </div>
                </div>
                {d.premium && (
                  <button
                    type="button"
                    onClick={() => a.openSheet('add')}
                    aria-label="Ajouter un client ou un prospect"
                    className="h-11 w-11 shrink-0 cursor-pointer rounded-[4px] bg-ink text-xl font-bold text-cream"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="px-5 pt-4">
                <div className="rounded-[5px] bg-ink p-4 text-cream">
                  <Mono className="text-tan">Total à recevoir</Mono>
                  <div className="mt-[5px] flex items-baseline gap-2">
                    <span className="text-[32px] font-black tracking-[-0.03em] tabular-nums">
                      {d.dueLabel}
                    </span>
                    <span className="text-[13px] font-bold text-tan">FCFA</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-sand">{d.dueSummary}</p>
                </div>
              </div>

              <section className="px-5 pt-5">
                <Mono className="text-muted">Factures ouvertes</Mono>
                {d.invoices.length > 0 ? (
                  <div className="mt-2.5 flex flex-col gap-2.5">
                    {d.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className={`rounded-[4px] p-3.5 ${
                          inv.paid
                            ? 'border border-[#cfdcc0] bg-[#f1f5ea]'
                            : inv.late
                              ? 'border border-[#efc9ae] border-l-4 border-l-brand bg-cream-card'
                              : 'border border-edge-light bg-cream-card'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2.5">
                          <span className="text-[15px] font-bold">{inv.name}</span>
                          <span className="text-[17px] font-extrabold tabular-nums">
                            {fcfa(inv.amount)}
                          </span>
                        </div>
                        <div
                          className={`mt-2 font-mono text-[11px] ${
                            inv.paid
                              ? 'text-[#3f5a2c]'
                              : inv.late
                                ? 'text-brand-deep'
                                : 'text-muted'
                          }`}
                        >
                          {inv.tag}
                        </div>
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            disabled={inv.paid}
                            onClick={() => a.openRelance(inv.id)}
                            className={`min-h-[44px] flex-1 rounded-[4px] border bg-cream px-3 py-2.5 text-[13px] font-semibold ${
                              inv.paid
                                ? 'cursor-default border-[#dce6d0] text-[#7c9169]'
                                : 'cursor-pointer border-edge-light text-[#6b5941]'
                            }`}
                          >
                            {inv.paid
                              ? 'Encaissé'
                              : inv.relanced
                                ? "Relancé aujourd'hui"
                                : 'Relancer'}
                          </button>
                          <button
                            type="button"
                            disabled={inv.paid}
                            onClick={() => a.payInvoice(inv.id)}
                            className={`min-h-[44px] flex-1 rounded-[4px] px-3 py-2.5 text-[13px] font-bold ${
                              inv.paid
                                ? 'cursor-default bg-[#dce6d0] text-[#3f5a2c]'
                                : 'cursor-pointer bg-ink text-cream'
                            }`}
                          >
                            {inv.paid ? 'Reçu ✓' : 'Marquer reçu'}
                          </button>
                          <button
                            type="button"
                            onClick={() => a.deleteInvoice(inv.id)}
                            aria-label={`Supprimer la facture de ${inv.name}`}
                            title="Supprimer cette facture"
                            className="min-h-[44px] shrink-0 cursor-pointer rounded-[4px] border border-edge-light bg-cream px-3 text-[13px] text-muted hover:text-brand-deep"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2.5 rounded-[4px] border border-dashed border-[#d8c9ae] bg-cream-card p-4 text-[13px] leading-[1.45] text-muted">
                    Personne ne vous doit d&rsquo;argent. Tout est encaissé.
                  </p>
                )}
              </section>

              <section className="px-5 pt-[22px]">
                <Mono className="text-muted">Clients à jour</Mono>
                {d.settledClients.length > 0 ? (
                  <ul className="mt-2.5 overflow-hidden rounded-[4px] border border-edge-light bg-cream-card">
                    {d.settledClients.map((c, i) => (
                      <li
                        key={c.id}
                        className={`flex min-h-[56px] items-center justify-between gap-3 px-3.5 py-3 ${
                          i ? 'border-t border-[#ede2ce]' : ''
                        }`}
                      >
                        <div>
                          <div className="text-sm font-bold">{c.name}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted">
                            Aucun impayé
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            a.setClient(c.id);
                            a.go('income');
                          }}
                          className="min-h-[44px] cursor-pointer rounded-[4px] border border-edge-light bg-cream px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap text-[#6b5941]"
                        >
                          Noter un paiement
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 rounded-[4px] border border-dashed border-[#d8c9ae] bg-cream-card p-4 text-[13px] leading-[1.45] text-muted">
                    Aucun client enregistré. Touchez « + » pour ajouter le premier.
                  </p>
                )}
              </section>

              <section className="px-5 pt-[22px] pb-[26px]">
                <Mono className="text-muted">Prospects</Mono>
                {d.prospects.length > 0 ? (
                  <>
                    <ul className="mt-2.5 overflow-hidden rounded-[4px] border border-edge-light bg-cream-card">
                      {d.prospects.map((p, i) => (
                        <li
                          key={p.id}
                          className={`flex items-center ${i ? 'border-t border-[#ede2ce]' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => a.advanceProspect(p.id, p.stage)}
                            className="flex min-h-[56px] flex-1 cursor-pointer items-center justify-between gap-3 p-3.5 text-left"
                          >
                            <div>
                              <div className="text-sm font-bold">{p.name}</div>
                              <div className="mt-0.5 font-mono text-[11px] text-muted">
                                {p.value}
                              </div>
                            </div>
                            <span
                              className={`rounded-[3px] px-2 py-[5px] font-mono text-[10px] tracking-[0.06em] whitespace-nowrap uppercase ${
                                p.stage === 'Gagné'
                                  ? 'bg-[#e4edd8] text-[#3f5a2c]'
                                  : p.stage === 'Devis envoyé'
                                    ? 'bg-[#fff3e2] text-[#8a6435]'
                                    : 'bg-[#f3ecde] text-[#6b5941]'
                              }`}
                            >
                              {p.stage}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => a.deleteProspect(p.id)}
                            aria-label={`Supprimer le prospect ${p.name}`}
                            className="min-h-[56px] shrink-0 cursor-pointer px-3.5 text-[15px] text-muted hover:text-brand-deep"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 font-mono text-[11px] text-muted">
                      Touchez un prospect pour faire avancer son statut. La croix le supprime.
                    </p>
                  </>
                ) : (
                  <p className="mt-2.5 rounded-[4px] border border-dashed border-[#d8c9ae] bg-cream-card p-4 text-[13px] leading-[1.45] text-muted">
                    Aucun prospect en cours. Ajoutez ceux à qui vous avez envoyé un devis.
                  </p>
                )}
              </section>

              {!d.premium && (
                <div className="absolute inset-x-0 top-[300px] bottom-[66px] flex items-end bg-gradient-to-b from-transparent via-cream via-[34%] to-cream px-5 pb-5">
                  <div className="w-full animate-[dcRise_0.4s_ease_both] rounded-[5px] border border-edge-light border-t-4 border-t-brand bg-cream-card p-[18px] shadow-[0_-8px_24px_rgba(42,29,18,0.08)]">
                    <Mono className="text-brand">Daily Cash Premium</Mono>
                    <h2 className="mt-1.5 text-[18px] leading-[1.3] font-extrabold">
                      {d.upgradeTitle}
                    </h2>
                    <p className="mt-2 text-[13px] leading-normal text-[#6b5941]">
                      Fiches clients, relances, statuts de prospects et objectif mensuel. 2 000 FCFA
                      par mois, payable par Wave ou Orange Money.
                    </p>
                    <Cta
                      onClick={() => a.openPremium()}
                      className="mt-4 min-h-0 p-[15px] text-[15px]"
                    >
                      Activer Premium
                    </Cta>
                    <p className="mt-2.5 text-center font-mono text-[11px] text-muted">
                      Sans engagement. Annulable à tout moment.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom nav */}
        <nav className="grid shrink-0 grid-cols-3 border-t border-edge-light bg-cream-card">
          {(
            [
              { key: 'today', icon: '▣', label: "Aujourd'hui" },
              { key: 'income', icon: '＋', label: 'Revenu' },
              { key: 'clients', icon: '◫', label: 'Clients' },
            ] as const
          ).map((tab) => {
            const active = s.screen === tab.key && !s.success;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => a.go(tab.key)}
                aria-current={active}
                className={`flex min-h-[56px] cursor-pointer flex-col items-center gap-[3px] px-0 pt-3 pb-3.5 ${
                  active ? 'bg-[#f3ecde] text-brand' : 'text-muted'
                }`}
              >
                <span aria-hidden className="text-[15px]">
                  {tab.icon}
                </span>
                <span className="text-[11px] font-bold">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Full-screen confirmation after a recorded income */}
        {s.success && s.sheet === 'success' && (
          <div className="absolute inset-0 flex animate-[dcPop_0.35s_cubic-bezier(0.2,0.8,0.2,1)_both] flex-col justify-center bg-ink p-7 text-cream">
            <div
              aria-hidden
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-amber text-[22px] font-black text-ink"
            >
              ✓
            </div>
            <Mono className="mt-[26px] text-tan">
              {s.success.client ?? 'Sans client'} · {s.success.method}
            </Mono>
            <div className="mt-1.5 text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em]">
              {fcfa(s.success.amount)} FCFA enregistrés
            </div>
            <div className="mt-7 border-t border-edge-dark pt-5">
              <Mono className="text-tan">Total septembre</Mono>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[44px] leading-none font-black tracking-[-0.035em] tabular-nums">
                  {d.monthLabel}
                </span>
                <span className="text-sm font-bold text-tan">FCFA</span>
              </div>
              <p className="mt-2.5 text-sm leading-[1.45] text-sand">{d.successNote}</p>
            </div>
            <button
              type="button"
              onClick={() => a.closeSuccess()}
              className="mt-[30px] w-full cursor-pointer rounded-[4px] bg-cream p-[15px] text-[15px] font-extrabold text-ink"
            >
              Retour au jour
            </button>
            <button
              type="button"
              onClick={() => a.againIncome()}
              className="mt-2.5 w-full cursor-pointer rounded-[4px] border border-edge-dark p-[13px] text-sm font-semibold text-tan"
            >
              Enregistrer un autre revenu
            </button>
          </div>
        )}

        {/* Bottom sheets */}
        {s.sheet && s.sheet !== 'success' && (
          <div
            role="presentation"
            onClick={() => a.closeSheet()}
            className="absolute inset-0 flex items-end bg-[rgba(26,18,10,0.52)]"
          >
            <div
              role="dialog"
              aria-modal
              onClick={(e) => e.stopPropagation()}
              className="max-h-[84%] w-full animate-[dcSheet_0.26s_cubic-bezier(0.2,0.8,0.2,1)_both] overflow-y-auto rounded-t-[10px] border-t-4 border-brand bg-cream px-5 pt-[18px] pb-6"
            >
              <div className="flex items-center justify-between gap-2.5">
                <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">
                  {s.sheet === 'profile'
                    ? (d.displayName ?? 'Mon profil')
                    : s.sheet === 'goal'
                      ? 'Objectif du mois'
                      : s.sheet === 'premium'
                        ? 'Formule'
                        : s.sheet === 'corrections'
                          ? 'Corriger un encaissement'
                          : s.sheet === 'add'
                            ? s.form.kind === 'prospect'
                              ? 'Nouveau prospect'
                              : 'Nouveau client'
                            : `Relancer ${d.relanceInvoice?.name ?? ''}`}
                </h2>
                <IconButton onClick={() => a.closeSheet()} label="Fermer">
                  ✕
                </IconButton>
              </div>

              {s.sheet === 'profile' && (
                <>
                  <p className="mt-1 text-[13px] text-[#6b5941]">
                    {d.profileLine || 'Activité à préciser'}
                  </p>
                  <div className="mt-4 overflow-hidden rounded-[4px] border border-edge-light bg-cream-card">
                    <button
                      type="button"
                      onClick={() => a.openSheet('goal')}
                      className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 p-3.5 text-left"
                    >
                      <span className="text-sm font-bold">Objectif mensuel</span>
                      <span className="font-mono text-xs text-brand">
                        {fcfa(d.objective)} FCFA →
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => a.openSheet('corrections')}
                      className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 border-t border-[#ede2ce] p-3.5 text-left"
                    >
                      <span className="text-sm font-bold">Corriger un encaissement</span>
                      <span className="font-mono text-xs text-brand">→</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => a.openPremium()}
                      className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 border-t border-[#ede2ce] p-3.5 text-left"
                    >
                      <span>
                        <span className="block text-sm font-bold">{d.planShort}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted">
                          {d.planDetail}
                        </span>
                      </span>
                      <span className="font-mono text-xs whitespace-nowrap text-brand">
                        {d.premium ? 'Gérer →' : 'Activer →'}
                      </span>
                    </button>
                  </div>

                  {/* The number quoted in every reminder. Blank = the reminder
                      asks the client how they want to pay instead. */}
                  <Mono className="mt-[18px] text-muted">Mon numéro de paiement</Mono>
                  <input
                    value={s.phoneDraft}
                    onChange={(e) => a.setPhoneDraft(e.target.value)}
                    onBlur={() => a.savePhone()}
                    placeholder="77 000 00 00"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-label="Mon numéro Wave ou Orange Money"
                    className="mt-2 min-h-[52px] w-full rounded-[4px] border border-edge-light bg-cream-card p-3.5 font-mono text-[15px] text-ink outline-none focus:border-brand"
                  />
                  <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted">
                    Ce numéro apparaît dans vos messages de relance. Laissez vide et le message
                    demandera simplement au client comment il souhaite régler.
                  </p>
                  <button
                    type="button"
                    onClick={() => void a.signOut()}
                    className="mt-4 min-h-[44px] w-full cursor-pointer rounded-[4px] border border-edge-light bg-cream-card p-3.5 text-left text-sm font-bold text-brand-deep"
                  >
                    Se déconnecter
                  </button>

                  <Mono className="mt-[18px] text-muted">Encaissement par défaut</Mono>
                  <div className="mt-2.5 flex gap-2">
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => a.setMethod(m as Method)}
                        className={`min-h-[44px] flex-1 cursor-pointer rounded-[4px] border px-1.5 py-3 font-mono text-xs ${
                          s.method === m
                            ? 'border-brand bg-[#fff3e2] text-brand-deep'
                            : 'border-edge-light bg-cream-card text-muted'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {s.sheet === 'premium' && (
                <PremiumPanel
                  premium={d.premium}
                  cancelled={d.cancelled}
                  priceLabel={d.priceLabel}
                  renewalLabel={d.renewalLabel}
                  daysRemaining={d.daysRemaining}
                  features={d.features}
                  checkoutAvailable={d.checkoutAvailable}
                  lockedSummary={d.lockedSummary}
                  lockedOwed={d.lockedOwed}
                  checkingOut={s.checkingOut}
                  onCheckout={() => void a.startCheckout()}
                  onCancel={() => a.cancelPremium()}
                  onDevActivate={() => a.devActivatePremium()}
                />
              )}

              {s.sheet === 'corrections' && (
                <>
                  <p className="mt-1 text-[13px] leading-normal text-[#6b5941]">
                    Un montant tapé de travers ? Supprimez-le : le total du mois se recalcule, et la
                    facture qu&rsquo;il avait réglée redevient ouverte.
                  </p>
                  {d.recentIncomes.length > 0 ? (
                    <ul className="mt-3.5 overflow-hidden rounded-[4px] border border-edge-light bg-cream-card">
                      {d.recentIncomes.map((inc, i) => (
                        <li
                          key={inc.id}
                          className={`flex items-center gap-3 p-3.5 ${
                            i ? 'border-t border-[#ede2ce]' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold">{inc.label}</div>
                            <div className="mt-0.5 font-mono text-[11px] text-muted">
                              {inc.when}
                            </div>
                          </div>
                          <span className="text-[15px] font-extrabold tabular-nums">
                            {fcfa(inc.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => a.deleteIncome(inc.id)}
                            aria-label={`Supprimer l'encaissement de ${fcfa(inc.amount)} FCFA`}
                            className="min-h-[44px] shrink-0 cursor-pointer rounded-[4px] border border-edge-light px-3 text-[13px] font-bold text-brand-deep"
                          >
                            Annuler
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3.5 rounded-[4px] border border-dashed border-[#d8c9ae] bg-cream-card p-4 text-[13px] leading-[1.45] text-muted">
                      Aucun encaissement enregistré pour le moment.
                    </p>
                  )}
                </>
              )}

              {s.sheet === 'goal' && (
                <>
                  <p className="mt-1 text-[13px] leading-[1.45] text-[#6b5941]">
                    Un chiffre qui vous ressemble. Vous pourrez le changer chaque mois.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((v) => (
                      <Chip key={v} active={d.objective === v} onClick={() => a.setObjective(v)}>
                        {fcfa(v)}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-4 rounded-[4px] bg-[#f3ecde] px-3.5 py-3 text-[13px] leading-[1.45] text-[#6b5941]">
                    {d.goalSheetNote}
                  </p>
                  <Cta onClick={() => a.closeSheet()} className="mt-4 min-h-0 p-[15px] text-[15px]">
                    Garder cet objectif
                  </Cta>
                </>
              )}

              {s.sheet === 'add' && (
                <>
                  <div className="mt-3.5 flex gap-2">
                    <Chip
                      active={s.form.kind === 'client'}
                      onClick={() => a.setForm({ kind: 'client' })}
                    >
                      Client
                    </Chip>
                    <Chip
                      active={s.form.kind === 'prospect'}
                      onClick={() => a.setForm({ kind: 'prospect' })}
                    >
                      Prospect
                    </Chip>
                  </div>
                  <input
                    value={s.form.name}
                    onChange={(e) => a.setForm({ name: e.target.value })}
                    placeholder="Nom du client ou de la structure"
                    aria-label="Nom"
                    className="mt-3 min-h-[44px] w-full rounded-[4px] border border-edge-light bg-cream-card px-3.5 py-[13px] text-sm text-ink outline-none focus:border-brand"
                  />
                  <input
                    value={s.form.amount}
                    onChange={(e) => a.setForm({ amount: e.target.value.replace(/[^0-9]/g, '') })}
                    inputMode="numeric"
                    placeholder={
                      s.form.kind === 'prospect'
                        ? 'Montant estimé du devis (FCFA)'
                        : 'Montant déjà dû (FCFA, optionnel)'
                    }
                    aria-label="Montant"
                    className="mt-2.5 min-h-[44px] w-full rounded-[4px] border border-edge-light bg-cream-card px-3.5 py-[13px] font-mono text-sm text-ink outline-none focus:border-brand"
                  />
                  <p className="mt-2 font-mono text-[11px] leading-normal text-muted">
                    {s.form.kind === 'prospect'
                      ? 'Le prospect démarre au statut « Premier contact ». Touchez-le ensuite pour le faire avancer.'
                      : 'Si le client vous doit déjà quelque chose, notez le montant : il apparaîtra dans les factures ouvertes.'}
                  </p>
                  <Cta
                    disabled={!d.canAdd}
                    onClick={() => a.submitAdd()}
                    className="mt-4 min-h-0 p-[15px] text-[15px]"
                  >
                    {s.form.kind === 'prospect' ? 'Ajouter le prospect' : 'Ajouter le client'}
                  </Cta>
                </>
              )}

              {s.sheet === 'relance' && d.relanceInvoice && (
                <>
                  <div className="mt-1 font-mono text-[11px] text-muted">
                    {fcfa(d.relanceInvoice.amount)} FCFA · {d.relanceInvoice.tag}
                  </div>
                  <p className="mt-3.5 rounded-[4px] border border-edge-light bg-cream-card p-3.5 text-sm leading-normal text-ink">
                    {relanceMessage(d.relanceInvoice, d.phone)}
                  </p>
                  {!d.phone && (
                    <button
                      type="button"
                      onClick={() => a.openSheet('profile')}
                      className="mt-2 w-full cursor-pointer text-left font-mono text-[11px] leading-relaxed text-brand"
                    >
                      Ajoutez votre numéro Wave / Orange Money dans le profil pour qu&rsquo;il
                      apparaisse ici →
                    </button>
                  )}
                  <Cta
                    onClick={() => a.markRelanced()}
                    className="mt-3.5 min-h-0 p-[15px] text-[15px]"
                  >
                    Envoyer et marquer relancé
                  </Cta>
                  <button
                    type="button"
                    onClick={() => s.relanceId !== null && a.payInvoice(s.relanceId)}
                    className="mt-2.5 min-h-[44px] w-full cursor-pointer rounded-[4px] border border-[#cfdcc0] p-[13px] text-sm font-bold text-[#3f5a2c]"
                  >
                    Il a déjà payé — marquer reçu
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
