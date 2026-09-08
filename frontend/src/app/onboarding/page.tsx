'use client';

// Onboarding — 3-step carousel.
// Faithful to `Daily Cash Onboarding.dc.html`: each step previews the feature
// it describes (month total → open invoices → monthly goal), progress bars
// double as back-navigation, and "Passer" exits to the auth flow at any point.

import { useState } from 'react';
import Link from 'next/link';
import { Mono, fcfa } from '@/components/dc/primitives';

const STEPS = [
  {
    label: 'Étape 1 sur 3',
    title: 'Sachez toujours combien vous avez gagné ce mois-ci.',
    body: "Chaque paiement reçu s'enregistre en dix secondes, par Wave, Orange Money ou en espèces. Le total du mois se met à jour tout seul — plus besoin du cahier ni de la mémoire.",
  },
  {
    label: 'Étape 2 sur 3',
    title: "Ne laissez plus un client oublier qu'il vous doit de l'argent.",
    body: "Chaque facture ouverte reste visible avec son retard. Un message de relance est déjà prêt : vous l'envoyez, vous marquez le paiement reçu, et le montant part directement dans votre total du mois.",
  },
  {
    label: 'Étape 3 sur 3',
    title: 'Fixez votre objectif, et voyez la distance qui reste.',
    body: "Les revenus, les tâches et le total du mois sont gratuits, pour toujours. L'objectif mensuel, le suivi des clients et les relances font partie de Premium : 2 000 FCFA par mois, par Wave ou Orange Money, sans carte bancaire ni engagement.",
  },
] as const;

const OPEN_INVOICES = [
  { name: 'Restaurant Teranga', amount: 60000, note: 'Retard 12 jours', late: true },
  { name: 'Ndiaye Digital', amount: 125000, note: 'Échéance 12 sept.', late: false },
] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const current = STEPS[step - 1] ?? STEPS[0];
  const isLast = step >= STEPS.length;

  return (
    <div className="flex min-h-dvh justify-center bg-[repeating-linear-gradient(135deg,#EDE4D4_0_14px,#E9DFCD_14px_28px)] sm:py-7">
      <div className="flex w-full max-w-[420px] flex-col bg-ink px-6 pt-5 pb-6 text-cream sm:min-h-[844px] sm:rounded-[18px] sm:shadow-[0_24px_50px_rgba(42,29,18,0.28)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-black tracking-[-0.02em]">Daily Cash</div>
            <Mono className="mt-[3px] text-[10px] tracking-[0.18em] text-tan">
              Pilotage freelance · FCFA
            </Mono>
          </div>
          <Link
            href="/login"
            className="flex min-h-[44px] items-center px-3 font-mono text-[11px] tracking-[0.1em] uppercase text-tan hover:text-cream"
          >
            Passer
          </Link>
        </div>

        {/* Each step previews the thing it is talking about. */}
        <div key={step} className="mt-[26px] animate-[dcRise_0.3s_ease_both]">
          {step === 1 && (
            <div className="rounded-[5px] border border-edge-dark bg-ink-card p-5">
              <Mono className="text-tan">Encaissé en septembre</Mono>
              <div className="mt-[7px] flex items-baseline gap-2">
                <span className="text-[44px] leading-none font-black tracking-[-0.035em] tabular-nums">
                  {fcfa(487500)}
                </span>
                <span className="text-[15px] font-bold text-tan">FCFA</span>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-[2px] bg-edge-dark">
                <div className="h-full w-[65%] bg-amber" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-tan">
                <span>Objectif {fcfa(750000)}</span>
                <span>65%</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="rounded-[5px] border border-edge-dark bg-ink-card p-5">
                <Mono className="text-tan">Total à recevoir</Mono>
                <div className="mt-[7px] flex items-baseline gap-2">
                  <span className="text-[40px] leading-none font-black tracking-[-0.035em] tabular-nums">
                    {fcfa(185000)}
                  </span>
                  <span className="text-[15px] font-bold text-tan">FCFA</span>
                </div>
              </div>
              <div className="mt-2.5 flex flex-col gap-2">
                {OPEN_INVOICES.map((inv) => (
                  <div
                    key={inv.name}
                    className={`rounded-[4px] bg-ink-deep px-3.5 py-[13px] ${
                      inv.late
                        ? 'border border-edge-amber border-l-4 border-l-amber'
                        : 'border border-edge-dark'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="text-[15px] font-bold">{inv.name}</span>
                      <span className="text-base font-extrabold tabular-nums">
                        {fcfa(inv.amount)}
                      </span>
                    </div>
                    <div
                      className={`mt-[5px] font-mono text-[11px] ${
                        inv.late ? 'text-amber-light' : 'text-tan'
                      }`}
                    >
                      {inv.note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="rounded-[5px] border border-edge-dark bg-ink-card p-5">
                <div className="flex items-baseline justify-between gap-2.5">
                  <Mono className="text-tan">Objectif de septembre</Mono>
                  <div className="font-mono text-[11px] text-amber">65%</div>
                </div>
                <div className="mt-[7px] flex items-baseline gap-2">
                  <span className="text-[40px] leading-none font-black tracking-[-0.035em] tabular-nums">
                    {fcfa(750000)}
                  </span>
                  <span className="text-[15px] font-bold text-tan">FCFA</span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-[2px] bg-edge-dark">
                  <div className="h-full w-[65%] bg-amber" />
                </div>
                <p className="mt-3 text-sm leading-[1.45] text-sand">
                  Il reste {fcfa(262500)} FCFA à encaisser, dont {fcfa(185000)} déjà facturés.
                </p>
              </div>
              <div className="mt-2.5 flex gap-2">
                <div className="flex-1 rounded-[4px] border border-edge-dark bg-ink-deep px-3.5 py-[13px]">
                  <Mono className="text-[10px] tracking-[0.12em] text-tan">Formule gratuite</Mono>
                  <div className="mt-1.5 text-sm leading-[1.35] font-bold">
                    Revenus, tâches et total du mois
                  </div>
                </div>
                <div className="flex-1 rounded-[4px] border border-edge-amber border-l-4 border-l-amber bg-ink-deep px-3.5 py-[13px]">
                  <Mono className="text-[10px] tracking-[0.12em] text-amber-light">
                    Premium · 2 000 / mois
                  </Mono>
                  <div className="mt-1.5 text-sm leading-[1.35] font-bold">
                    Objectif, clients et relances
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-[26px]">
          <Mono className="text-amber">{current.label}</Mono>
          <h1 className="mt-2.5 text-[28px] leading-[1.18] font-extrabold tracking-[-0.03em] text-pretty">
            {current.title}
          </h1>
          <p className="mt-3 text-base leading-[1.55] text-sand text-pretty">{current.body}</p>
        </div>

        {/* Progress bars double as back-navigation, exactly as in the prototype. */}
        <div className="mx-[-5px] mt-2 flex gap-0.5">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setStep(i + 1)}
              aria-label={`Aller à l'étape ${i + 1}`}
              aria-current={step === i + 1}
              className={`h-11 w-11 cursor-pointer rounded-[2px] bg-clip-content px-[5px] py-[17px] ${
                step === i + 1 ? 'bg-amber' : 'bg-edge-dark'
              }`}
            />
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          {!isLast ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              className="cursor-pointer rounded-[4px] bg-brand p-[17px] text-base font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-brand-deep)]"
            >
              Continuer
            </button>
          ) : (
            <Link
              href="/signup"
              className="rounded-[4px] bg-brand p-[17px] text-center text-base font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)]"
            >
              Créer mon compte
            </Link>
          )}
          <Link
            href="/login"
            className="rounded-[4px] border border-edge-dark p-[15px] text-center text-[15px] font-semibold text-sand hover:border-tan"
          >
            J&rsquo;ai déjà un compte
          </Link>
        </div>
      </div>
    </div>
  );
}
