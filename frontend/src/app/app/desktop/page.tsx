'use client';

// Daily Cash — desktop app.
// Faithful to `Daily Cash Desktop.dc.html`. Same model as the mobile screen
// (see components/dc/store.ts); what changes is the shell: a fixed sidebar
// instead of a bottom nav, centred modals instead of bottom sheets, and the
// client list as a table with a prospect board by stage.

import Link from 'next/link';
import { Chip, Cta, Mono, fcfa } from '@/components/dc/primitives';
import { PremiumPanel } from '@/components/dc/premium-panel';
import {
  GOAL_OPTIONS,
  METHODS,
  STAGES,
  relanceMessage,
  useDailyCash,
  type Method,
} from '@/components/dc/store';

export default function DesktopAppPage() {
  const { s, d, a, loading, authRequired, error } = useDailyCash();

  if (loading || authRequired) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#ede4d4] px-6">
        <div className="w-full max-w-[440px] rounded-md border border-edge-light bg-cream-card p-8 text-center">
          {loading ? (
            <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-muted">
              Chargement…
            </p>
          ) : (
            <>
              <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">
                Connectez-vous pour voir vos chiffres
              </h1>
              <p className="mt-2 text-[15px] leading-normal text-[#6b5941]">
                Vos revenus, factures et tâches sont rattachés à votre compte.
              </p>
              <Link
                href="/login"
                className="mt-6 block rounded-[4px] bg-brand p-4 text-[15px] font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)]"
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const stat = (label: string, value: string) => (
    <div className="rounded-[5px] border border-edge-light bg-cream-card p-5">
      <Mono className="tracking-[0.12em] text-muted">{label}</Mono>
      <div className="mt-2 text-[30px] font-extrabold tracking-[-0.02em] tabular-nums">{value}</div>
    </div>
  );

  const closeBtn = (
    <button
      type="button"
      onClick={() => a.closeSheet()}
      aria-label="Fermer"
      className="h-10 w-10 shrink-0 cursor-pointer rounded-[4px] border border-edge-light bg-cream text-base text-[#6b5941]"
    >
      ✕
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col items-center gap-[18px] bg-[repeating-linear-gradient(135deg,#EDE4D4_0_14px,#E9DFCD_14px_28px)] px-6 pt-6 pb-12">
      {error && (
        <button
          type="button"
          onClick={() => a.dismissError()}
          className="w-full max-w-[1320px] cursor-pointer rounded-[4px] bg-[#fff3e2] px-5 py-2.5 text-left text-[13px] text-brand-deep"
        >
          {error} — cliquer pour masquer
        </button>
      )}
      <div className="relative grid min-h-[820px] w-full max-w-[1320px] grid-cols-1 overflow-hidden rounded-md border border-[#ddd0b8] bg-cream shadow-[0_18px_44px_rgba(42,29,18,0.16)] lg:grid-cols-[236px_minmax(0,1fr)]">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-7 bg-ink px-[18px] py-[22px] text-cream">
          <div>
            <div className="text-[19px] font-black tracking-[-0.02em]">Daily Cash</div>
            <Mono className="mt-[3px] text-[10px] tracking-[0.18em] text-tan">
              Pilotage freelance · FCFA
            </Mono>
          </div>

          <nav className="flex flex-col gap-1">
            {(
              [
                {
                  icon: '▣',
                  label: 'Vue du jour',
                  active: s.screen === 'today',
                  go: () => a.go('today'),
                },
                {
                  icon: '＋',
                  label: 'Revenu reçu',
                  active: s.sheet === 'income',
                  go: () => a.openSheet('income'),
                },
                {
                  icon: '◫',
                  label: 'Clients & paiements',
                  active: s.screen === 'clients',
                  go: () => a.go('clients'),
                },
              ] as const
            ).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.go}
                aria-current={item.active}
                className={`flex cursor-pointer items-center gap-2.5 rounded-[4px] px-[13px] py-3 text-left text-sm font-semibold ${
                  item.active ? 'bg-cream text-ink' : 'text-[#d6c4a8] hover:bg-ink-card'
                }`}
              >
                <span aria-hidden className="text-[13px]">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          {d.premium && (
            <button
              type="button"
              onClick={() => a.openSheet('goal')}
              className="mt-auto cursor-pointer rounded-[4px] border border-edge-dark p-3.5 text-left text-cream"
            >
              <Mono className="text-[10px] text-tan">Objectif du mois</Mono>
              <div className="mt-[5px] text-base font-extrabold tabular-nums">
                {fcfa(d.objective)} FCFA
              </div>
              <div className="mt-[9px] h-2 overflow-hidden rounded-[2px] bg-edge-dark">
                <div
                  className="h-full origin-left animate-[dcSweep_0.7s_cubic-bezier(0.2,0.8,0.2,1)_both] bg-amber"
                  style={{ width: `${d.goalPct}%` }}
                />
              </div>
              <div className="mt-[7px] font-mono text-[10px] text-tan">
                {d.goalPct}% atteint · modifier
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => a.openSheet('profile')}
            className={`flex cursor-pointer items-center gap-[11px] border-t border-edge-dark px-0.5 pt-4 text-left ${
              d.premium ? '' : 'mt-auto'
            }`}
          >
            <span
              aria-hidden
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand text-sm font-extrabold text-cream"
            >
              {d.initial}
            </span>
            <span>
              <span className="block text-sm font-bold">{d.displayName ?? 'Mon profil'}</span>
              <span className="mt-0.5 block font-mono text-[10px] text-tan">{d.planShort}</span>
            </span>
          </button>
        </aside>

        {/* ── Main ────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col">
          <header className="flex items-end justify-between gap-5 border-b border-edge-light px-7 pt-6 pb-5">
            <div>
              <Mono className="text-muted">Lundi 7 septembre 2026</Mono>
              <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.025em]">
                {s.screen === 'clients' ? 'Clients & paiements attendus' : 'Vue du jour'}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => a.openSheet('income')}
              className="cursor-pointer rounded-[4px] bg-brand px-5 py-3.5 text-[15px] font-extrabold whitespace-nowrap text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-brand-deep)]"
            >
              Enregistrer un revenu
            </button>
          </header>

          <div className="flex min-w-0 flex-1 flex-col gap-[22px] px-7 pt-6 pb-8">
            {s.screen === 'today' && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-[5px] bg-ink p-[22px] text-cream">
                    <Mono className="text-tan">Encaissé en septembre</Mono>
                    <div className="mt-2 flex items-baseline gap-[9px]">
                      <span className="text-[52px] leading-none font-black tracking-[-0.035em] tabular-nums">
                        {d.monthLabel}
                      </span>
                      <span className="text-base font-bold text-tan">FCFA</span>
                    </div>
                    <p className="mt-3 text-sm leading-[1.45] text-sand">{d.goalNote}</p>
                  </div>
                  {stat('Cette semaine', d.weekLabel)}
                  {stat("Aujourd'hui", d.dayLabel)}
                </div>

                {d.isEmpty && (
                  <div className="grid animate-[dcRise_0.4s_ease_both] grid-cols-1 gap-[26px] rounded-[5px] border border-edge-light bg-cream-card p-[26px] md:grid-cols-2">
                    <div>
                      <h2 className="text-[22px] leading-[1.25] font-extrabold tracking-[-0.02em]">
                        Trois minutes pour tout savoir sur votre mois
                      </h2>
                      <p className="mt-2.5 text-[15px] leading-[1.55] text-[#6b5941]">
                        Commencez par le dernier paiement que vous avez reçu. Le reste se remplit
                        tout seul.
                      </p>
                      <button
                        type="button"
                        onClick={() => a.openSheet('income')}
                        className="mt-5 cursor-pointer rounded-[4px] bg-brand px-[22px] py-[15px] text-[15px] font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)]"
                      >
                        Enregistrer un revenu reçu
                      </button>
                    </div>
                    <div className="flex flex-col gap-2.5 md:border-l md:border-[#ede2ce] md:pl-[26px]">
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
                          className="flex cursor-pointer items-start gap-3 py-2 text-left"
                        >
                          <span className="pt-[3px] font-mono text-[11px] text-brand">
                            {row.num}
                          </span>
                          <span className="text-sm leading-[1.45] text-[#6b5941]">{row.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  <section>
                    <div className="flex items-baseline justify-between gap-3">
                      <Mono className="text-muted">Tâches du jour</Mono>
                      <div className="font-mono text-[11px] text-muted">{d.taskCount}</div>
                    </div>
                    {d.tasks.length > 0 ? (
                      <ul className="mt-2.5 overflow-hidden rounded-[4px] border border-edge-light bg-cream-card">
                        {d.tasks.map((t, i) => (
                          // Keyed by id: two tasks can share a label.
                          <li
                            key={t.id}
                            className={`flex items-center ${i ? 'border-t border-[#ede2ce]' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={() => a.toggleTask(t.id, !t.done)}
                              className="flex flex-1 cursor-pointer items-center gap-3 px-4 py-[15px] text-left"
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
                                className={`flex-1 text-[15px] leading-[1.35] ${
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
                              className="shrink-0 cursor-pointer px-4 py-[15px] text-[15px] text-muted hover:text-brand-deep"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2.5 rounded-[4px] border border-dashed border-[#d8c9ae] bg-cream-card p-[18px] text-sm leading-normal text-muted">
                        Rien de prévu aujourd&rsquo;hui. Écrivez ce que vous devez livrer ou
                        relancer.
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
                        className="min-w-0 flex-1 rounded-[4px] border border-edge-light bg-cream-card px-3.5 py-[13px] text-sm text-ink outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => a.addTask()}
                        className="cursor-pointer rounded-[4px] bg-ink px-5 text-sm font-bold text-cream"
                      >
                        Ajouter
                      </button>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-baseline justify-between gap-3">
                      <Mono className="text-muted">En attente de paiement</Mono>
                      <button
                        type="button"
                        onClick={() => a.go('clients')}
                        className="cursor-pointer font-mono text-[11px] text-brand"
                      >
                        Tout voir →
                      </button>
                    </div>
                    <div className="mt-2.5 rounded-[4px] border border-[#efd3ae] border-l-4 border-l-amber bg-[#fff3e2] p-[18px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[30px] font-black tracking-[-0.02em] tabular-nums">
                          {d.dueLabel}
                        </span>
                        <span className="font-mono text-[11px] text-[#8a6435]">{d.dueCount}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-[1.45] text-[#6b5941]">{d.dueSummary}</p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2.5">
                      {d.invoices.map((inv) =>
                        inv.paid ? null : (
                          <div
                            key={inv.id}
                            className={`rounded-[4px] bg-cream-card p-3.5 ${
                              inv.late
                                ? 'border border-[#efc9ae] border-l-4 border-l-brand'
                                : 'border border-edge-light'
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-2.5">
                              <span className="text-[15px] font-bold">{inv.name}</span>
                              <span className="text-base font-extrabold tabular-nums">
                                {fcfa(inv.amount)}
                              </span>
                            </div>
                            <div
                              className={`mt-1.5 font-mono text-[11px] ${
                                inv.late ? 'text-brand-deep' : 'text-muted'
                              }`}
                            >
                              {inv.tag}
                            </div>
                            <div className="mt-2.5 flex gap-2">
                              <button
                                type="button"
                                onClick={() => a.openRelance(inv.id)}
                                className="flex-1 cursor-pointer rounded-[4px] border border-edge-light bg-cream px-3 py-2.5 text-[13px] font-semibold text-[#6b5941]"
                              >
                                {inv.relanced ? 'Relancé' : 'Relancer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => a.payInvoice(inv.id)}
                                className="flex-1 cursor-pointer rounded-[4px] bg-ink px-3 py-2.5 text-[13px] font-bold text-cream"
                              >
                                Marquer reçu
                              </button>
                              <button
                                type="button"
                                onClick={() => a.deleteInvoice(inv.id)}
                                aria-label={`Supprimer la facture de ${inv.name}`}
                                title="Supprimer cette facture"
                                className="shrink-0 cursor-pointer rounded-[4px] border border-edge-light bg-cream px-3 py-2.5 text-[13px] text-muted hover:text-brand-deep"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}

            {s.screen === 'clients' && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-[5px] bg-ink p-5 text-cream">
                    <Mono className="text-tan">Total à recevoir</Mono>
                    <div className="mt-[7px] flex items-baseline gap-2">
                      <span className="text-4xl font-black tracking-[-0.03em] tabular-nums">
                        {d.dueLabel}
                      </span>
                      <span className="text-[13px] font-bold text-tan">FCFA</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-[1.45] text-sand">{d.dueSummary}</p>
                  </div>
                  {stat('Clients actifs', String(d.clients.length))}
                  <div className="flex flex-col justify-between gap-3 rounded-[5px] border border-edge-light bg-cream-card p-5">
                    <div>
                      <Mono className="tracking-[0.12em] text-muted">Prospects en cours</Mono>
                      <div className="mt-2 text-[30px] font-extrabold tabular-nums">
                        {d.prospects.length}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => a.openSheet('add')}
                      className="cursor-pointer rounded-[4px] bg-ink px-3.5 py-3 text-sm font-bold text-cream"
                    >
                      Ajouter un client ou un prospect
                    </button>
                  </div>
                </div>

                <section>
                  <Mono className="text-muted">Factures et clients</Mono>
                  <div className="mt-2.5 overflow-x-auto rounded-[4px] border border-edge-light bg-cream-card">
                    <div className="min-w-[720px]">
                      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] gap-3.5 bg-[#f3ecde] px-[18px] py-3 font-mono text-[10px] tracking-[0.12em] uppercase text-muted">
                        <span>Client</span>
                        <span className="text-right">Montant dû</span>
                        <span>Statut</span>
                        <span className="text-right">Action</span>
                      </div>
                      {d.clients.map((c) => {
                        const inv = d.invoices.find((i) => i.clientId === c.id && !i.paid);
                        const settled = !inv;
                        return (
                          <div
                            key={c.id}
                            className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] items-center gap-3.5 border-t border-[#ede2ce] px-[18px] py-3.5 ${
                              inv?.late ? 'bg-[#fffbf4]' : ''
                            }`}
                          >
                            <span className="min-w-0 truncate text-[15px] font-bold">{c.name}</span>
                            <span className="text-right text-base font-extrabold tabular-nums">
                              {inv ? fcfa(inv.amount) : '—'}
                            </span>
                            <span
                              className={`font-mono text-[11px] ${
                                settled
                                  ? 'text-[#3f5a2c]'
                                  : inv.late
                                    ? 'text-brand-deep'
                                    : 'text-muted'
                              }`}
                            >
                              {inv
                                ? inv.relanced
                                  ? `Relancé aujourd'hui · ${inv.tag}`
                                  : inv.tag
                                : 'À jour'}
                            </span>
                            <span className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={settled}
                                onClick={() => inv && a.openRelance(inv.id)}
                                className={`rounded-[4px] border border-edge-light bg-cream px-[13px] py-2.5 text-[13px] font-semibold whitespace-nowrap ${
                                  settled
                                    ? 'cursor-default text-muted'
                                    : 'cursor-pointer text-[#6b5941]'
                                }`}
                              >
                                {settled ? 'Historique' : inv.relanced ? 'Relancé' : 'Relancer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (settled) {
                                    a.setClient(c.id);
                                    a.openSheet('income');
                                  } else if (inv) {
                                    a.payInvoice(inv.id);
                                  }
                                }}
                                className={`cursor-pointer rounded-[4px] px-[13px] py-2.5 text-[13px] font-bold whitespace-nowrap ${
                                  settled
                                    ? 'border border-edge-light bg-cream text-[#6b5941]'
                                    : 'bg-ink text-cream'
                                }`}
                              >
                                {settled ? 'Noter un paiement' : 'Marquer reçu'}
                              </button>
                            </span>
                          </div>
                        );
                      })}
                      {d.clients.length === 0 && (
                        <p className="px-[18px] py-[22px] text-sm leading-normal text-muted">
                          Aucun client enregistré. Ajoutez le premier pour suivre ce qu&rsquo;on
                          vous doit.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex items-baseline justify-between gap-3">
                    <Mono className="text-muted">Prospects</Mono>
                    <div className="font-mono text-[11px] text-muted">
                      Cliquez une fiche pour la faire avancer
                    </div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {STAGES.map((stage) => {
                      const cards = d.prospects
                        .map((p, i) => ({ p, i }))
                        .filter((o) => o.p.stage === stage);
                      return (
                        <div
                          key={stage}
                          className="min-h-[130px] rounded-[4px] border border-edge-light bg-cream-card p-3"
                        >
                          <div
                            className={`inline-block rounded-[3px] px-2 py-[5px] font-mono text-[10px] tracking-[0.1em] uppercase ${
                              stage === 'Gagné'
                                ? 'bg-[#e4edd8] text-[#3f5a2c]'
                                : stage === 'Devis envoyé'
                                  ? 'bg-[#fff3e2] text-[#8a6435]'
                                  : 'bg-[#f3ecde] text-[#6b5941]'
                            }`}
                          >
                            {stage}
                          </div>
                          <div className="mt-2.5 flex flex-col gap-2">
                            {cards.map((o) => (
                              // A div, not a button: the delete control sits
                              // inside the card, and a button cannot nest.
                              <div
                                key={o.p.id}
                                className="flex items-start gap-1 rounded-[3px] border border-edge-light bg-cream"
                              >
                                <button
                                  type="button"
                                  onClick={() => a.advanceProspect(o.p.id, o.p.stage)}
                                  className="flex-1 cursor-pointer p-[11px] text-left"
                                >
                                  <span className="block text-sm font-bold">{o.p.name}</span>
                                  <span className="mt-[3px] block font-mono text-[11px] text-muted">
                                    {o.p.value}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => a.deleteProspect(o.p.id)}
                                  aria-label={`Supprimer le prospect ${o.p.name}`}
                                  className="cursor-pointer px-2 py-[11px] text-[13px] text-muted hover:text-brand-deep"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                          {cards.length === 0 && (
                            <div className="mt-2.5 font-mono text-[11px] text-[#beab8c]">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {!d.premium && (
                  <div className="absolute inset-x-0 top-[320px] bottom-0 flex items-end justify-center bg-gradient-to-b from-transparent via-cream via-[30%] to-cream px-7 pb-8 lg:left-[236px]">
                    <div className="grid w-full max-w-[720px] grid-cols-1 items-center gap-6 rounded-[5px] border border-edge-light border-t-4 border-t-brand bg-cream-card p-6 shadow-[0_-10px_30px_rgba(42,29,18,0.1)] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                      <div>
                        <Mono className="text-brand">Daily Cash Premium</Mono>
                        <h2 className="mt-[7px] text-[21px] leading-[1.3] font-extrabold">
                          {d.upgradeTitle}
                        </h2>
                        <p className="mt-[9px] text-sm leading-[1.55] text-[#6b5941]">
                          Fiches clients, relances, tableau des prospects et objectif mensuel. 2 000
                          FCFA par mois, payable par Wave ou Orange Money.
                        </p>
                      </div>
                      <div>
                        <Cta
                          onClick={() => a.openPremium()}
                          className="min-h-0 p-[15px] text-[15px]"
                        >
                          Activer Premium
                        </Cta>
                        <p className="mt-2.5 text-center font-mono text-[11px] text-muted">
                          Sans engagement. Annulable à tout moment.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Modals ──────────────────────────────────────────────── */}
        {s.sheet && (
          <div
            role="presentation"
            onClick={() => a.closeSheet()}
            className="absolute inset-0 flex items-center justify-center bg-[rgba(26,18,10,0.55)] p-8"
          >
            <div
              role="dialog"
              aria-modal
              onClick={(e) => e.stopPropagation()}
              className={`max-h-full w-full animate-[dcRise_0.22s_ease_both] overflow-y-auto rounded-md border-t-4 border-brand bg-cream p-[26px] shadow-[0_24px_60px_rgba(26,18,10,0.4)] ${
                s.sheet === 'income' || s.sheet === 'success' ? 'max-w-[760px]' : 'max-w-[520px]'
              }`}
            >
              {s.sheet === 'income' && (
                <>
                  <div className="flex items-center justify-between gap-3.5">
                    <div>
                      <Mono className="text-muted">Nouveau revenu</Mono>
                      <h2 className="mt-[3px] text-[22px] font-extrabold tracking-[-0.02em]">
                        Vous venez d&rsquo;être payé
                      </h2>
                    </div>
                    {closeBtn}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-[22px] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div>
                      <Mono className="tracking-[0.12em] text-muted">Montant encaissé</Mono>
                      <div className="mt-2 flex items-baseline gap-2.5 border-b-2 border-ink pb-2">
                        <input
                          value={s.digits ? fcfa(d.entry) : ''}
                          onChange={(e) => a.setDigits(e.target.value)}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label="Montant encaissé"
                          className="min-w-0 flex-1 border-none bg-transparent p-0 text-[42px] font-black tracking-[-0.035em] tabular-nums text-ink outline-none"
                        />
                        <span className="text-[15px] font-bold text-muted">FCFA</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {[5000, 10000, 25000].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => a.bump(n)}
                            className="flex-1 cursor-pointer rounded-full border border-edge-light bg-cream-card px-2 py-[11px] font-mono text-xs text-[#6b5941]"
                          >
                            +{fcfa(n)}
                          </button>
                        ))}
                      </div>

                      <Mono className="mt-[22px] tracking-[0.12em] text-muted">
                        Moyen d&rsquo;encaissement
                      </Mono>
                      <div className="mt-2.5 flex gap-2">
                        {METHODS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => a.setMethod(m as Method)}
                            className={`flex-1 cursor-pointer rounded-[4px] border px-1.5 py-3 font-mono text-xs ${
                              s.method === m
                                ? 'border-brand bg-[#fff3e2] text-brand-deep'
                                : 'border-edge-light bg-cream-card text-muted'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between gap-2.5">
                        <Mono className="tracking-[0.12em] text-muted">Client — optionnel</Mono>
                        <button
                          type="button"
                          onClick={() => a.openSheet('add')}
                          className="cursor-pointer font-mono text-[11px] text-brand"
                        >
                          + Nouveau
                        </button>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Chip active={!s.clientId} onClick={() => a.setClient(null)}>
                          Sans client
                        </Chip>
                        {d.clients.map((c) => (
                          <Chip
                            key={c.id}
                            active={s.clientId === c.id}
                            onClick={() => a.setClient(c.id)}
                          >
                            {c.name}
                          </Chip>
                        ))}
                      </div>
                      {d.settleTarget && (
                        <button
                          type="button"
                          onClick={() => a.settleInvoice()}
                          className="mt-3 w-full cursor-pointer rounded-[4px] border border-[#cfdcc0] bg-[#f1f5ea] p-3 text-left text-[13px] leading-[1.4] font-semibold text-[#3f5a2c]"
                        >
                          Solder la facture de {d.settleTarget.name} — {fcfa(d.settleTarget.amount)}{' '}
                          FCFA
                        </button>
                      )}
                      <div className="mt-[18px] rounded-[4px] bg-[#f3ecde] p-3.5">
                        <Mono className="tracking-[0.1em] text-muted">
                          Total septembre après ajout
                        </Mono>
                        <div className="mt-[5px] text-2xl font-extrabold tabular-nums">
                          {d.projectedMonth}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Cta disabled={d.entry <= 0} onClick={() => a.confirmIncome()} className="mt-6">
                    {d.entry > 0 ? `Confirmer ${fcfa(d.entry)} FCFA` : 'Saisissez un montant'}
                  </Cta>
                </>
              )}

              {s.sheet === 'success' && s.success && (
                <>
                  <div className="grid grid-cols-1 items-center gap-[26px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div>
                      <div
                        aria-hidden
                        className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-amber text-[22px] font-black text-ink"
                      >
                        ✓
                      </div>
                      <Mono className="mt-5 text-muted">
                        {s.success.client ?? 'Sans client'} · {s.success.method}
                      </Mono>
                      <div className="mt-1.5 text-2xl leading-[1.25] font-extrabold tracking-[-0.02em]">
                        {fcfa(s.success.amount)} FCFA enregistrés
                      </div>
                    </div>
                    <div className="rounded-[5px] bg-ink p-[22px] text-cream">
                      <Mono className="text-tan">Total septembre</Mono>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="text-[40px] leading-none font-black tracking-[-0.035em] tabular-nums">
                          {d.monthLabel}
                        </span>
                        <span className="text-sm font-bold text-tan">FCFA</span>
                      </div>
                      <p className="mt-2.5 text-sm leading-[1.45] text-sand">{d.successNote}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => a.closeSuccess()}
                      className="flex-1 cursor-pointer rounded-[4px] bg-ink p-[15px] text-[15px] font-extrabold text-cream"
                    >
                      Retour à la vue du jour
                    </button>
                    <button
                      type="button"
                      onClick={() => a.openSheet('income')}
                      className="flex-1 cursor-pointer rounded-[4px] border border-edge-light p-[15px] text-[15px] font-bold text-[#6b5941]"
                    >
                      Enregistrer un autre revenu
                    </button>
                  </div>
                </>
              )}

              {s.sheet === 'profile' && (
                <>
                  <div className="flex items-center justify-between gap-3.5">
                    <div>
                      <h2 className="text-[21px] font-extrabold tracking-[-0.02em]">
                        {d.displayName ?? 'Mon profil'}
                      </h2>
                      <p className="mt-[3px] text-sm text-[#6b5941]">
                        {d.profileLine || 'Activité à préciser'}
                      </p>
                    </div>
                    {closeBtn}
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[4px] border border-edge-light bg-cream-card">
                    <button
                      type="button"
                      onClick={() => a.openSheet('goal')}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 p-3.5 text-left"
                    >
                      <span className="text-sm font-bold">Objectif mensuel</span>
                      <span className="font-mono text-xs text-brand">
                        {fcfa(d.objective)} FCFA →
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => a.openSheet('corrections')}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 border-t border-[#ede2ce] p-3.5 text-left"
                    >
                      <span className="text-sm font-bold">Corriger un encaissement</span>
                      <span className="font-mono text-xs text-brand">→</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => a.openPremium()}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 border-t border-[#ede2ce] p-3.5 text-left"
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
                    className="mt-2 w-full rounded-[4px] border border-edge-light bg-cream-card p-3.5 font-mono text-[15px] text-ink outline-none focus:border-brand"
                  />
                  <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted">
                    Ce numéro apparaît dans vos messages de relance. Laissez vide et le message
                    demandera simplement au client comment il souhaite régler.
                  </p>

                  <button
                    type="button"
                    onClick={() => void a.signOut()}
                    className="mt-4 w-full cursor-pointer rounded-[4px] border border-edge-light bg-cream-card p-3.5 text-left text-sm font-bold text-brand-deep"
                  >
                    Se déconnecter
                  </button>
                </>
              )}

              {s.sheet === 'premium' && (
                <>
                  <div className="flex items-center justify-between gap-3.5">
                    <h2 className="text-[21px] font-extrabold tracking-[-0.02em]">Formule</h2>
                    {closeBtn}
                  </div>
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
                </>
              )}

              {s.sheet === 'corrections' && (
                <>
                  <div className="flex items-center justify-between gap-3.5">
                    <h2 className="text-[21px] font-extrabold tracking-[-0.02em]">
                      Corriger un encaissement
                    </h2>
                    {closeBtn}
                  </div>
                  <p className="mt-2 text-sm leading-normal text-[#6b5941]">
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
                            className="shrink-0 cursor-pointer rounded-[4px] border border-edge-light px-3 py-2 text-[13px] font-bold text-brand-deep"
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
                  <div className="flex items-center justify-between gap-3.5">
                    <h2 className="text-[21px] font-extrabold tracking-[-0.02em]">
                      Objectif du mois
                    </h2>
                    {closeBtn}
                  </div>
                  <p className="mt-1 text-sm leading-[1.45] text-[#6b5941]">
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
                  <div className="flex items-center justify-between gap-3.5">
                    <h2 className="text-[21px] font-extrabold tracking-[-0.02em]">
                      {s.form.kind === 'prospect' ? 'Nouveau prospect' : 'Nouveau client'}
                    </h2>
                    {closeBtn}
                  </div>
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
                    className="mt-3 w-full rounded-[4px] border border-edge-light bg-cream-card px-3.5 py-[13px] text-sm text-ink outline-none focus:border-brand"
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
                    className="mt-2.5 w-full rounded-[4px] border border-edge-light bg-cream-card px-3.5 py-[13px] font-mono text-sm text-ink outline-none focus:border-brand"
                  />
                  <p className="mt-2 font-mono text-[11px] leading-normal text-muted">
                    {s.form.kind === 'prospect'
                      ? 'Le prospect démarre au statut « Premier contact ». Cliquez sa fiche pour la faire avancer.'
                      : 'Si le client vous doit déjà quelque chose, notez le montant : il apparaîtra dans le tableau des factures.'}
                  </p>
                  <Cta
                    disabled={!d.canAdd}
                    onClick={() => a.submitAdd()}
                    className="mt-[18px] min-h-0 p-[15px] text-[15px]"
                  >
                    {s.form.kind === 'prospect' ? 'Ajouter le prospect' : 'Ajouter le client'}
                  </Cta>
                </>
              )}

              {s.sheet === 'relance' && d.relanceInvoice && (
                <>
                  <div className="flex items-center justify-between gap-3.5">
                    <div>
                      <h2 className="text-[21px] font-extrabold tracking-[-0.02em]">
                        Relancer {d.relanceInvoice.name}
                      </h2>
                      <div className="mt-1 font-mono text-xs text-muted">
                        {fcfa(d.relanceInvoice.amount)} FCFA · {d.relanceInvoice.tag}
                      </div>
                    </div>
                    {closeBtn}
                  </div>
                  <p className="mt-4 rounded-[4px] border border-edge-light bg-cream-card p-4 text-[15px] leading-[1.55] text-ink">
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
                  <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => a.markRelanced()}
                      className="flex-1 cursor-pointer rounded-[4px] bg-brand p-[15px] text-[15px] font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)]"
                    >
                      Envoyer et marquer relancé
                    </button>
                    <button
                      type="button"
                      onClick={() => s.relanceId !== null && a.payInvoice(s.relanceId)}
                      className="flex-1 cursor-pointer rounded-[4px] border border-[#cfdcc0] p-[15px] text-[15px] font-bold text-[#3f5a2c]"
                    >
                      Il a déjà payé — marquer reçu
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
