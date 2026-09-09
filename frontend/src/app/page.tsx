// Daily Cash — landing page.
//
// Faithful implementation of the Claude Design canvas `Daily Cash Landing.dc.html`.
// The canvas' inline styles are mapped onto the design tokens declared in
// globals.css; the `<sc-for>` loops became the plain arrays below, which is
// what the canvas' DCLogic `renderVals()` provided.
//
// Server component: nothing here is interactive, so no 'use client'.

import Link from 'next/link';

export const runtime = 'nodejs';

const FEATURES = [
  {
    num: '01',
    title: 'Chaque paiement, en dix secondes',
    body: 'Le montant, le client, le moyen de paiement. Le total du mois, de la semaine et du jour se recalculent immédiatement.',
  },
  {
    num: '02',
    title: "Qui vous doit encore de l'argent",
    body: 'Les factures ouvertes restent visibles avec leur retard, et un message de relance prêt à envoyer par WhatsApp ou SMS.',
  },
  {
    num: '03',
    title: 'Votre objectif du mois',
    body: "Un chiffre à atteindre, et la distance qui reste. Les prospects avancent d'un statut à l'autre jusqu'au devis signé.",
  },
] as const;

const FREE_ITEMS = [
  'Revenus enregistrés sans limite',
  'Total du jour, de la semaine et du mois',
  'Tâches quotidiennes',
] as const;

const PREMIUM_ITEMS = [
  'Fiches clients et factures ouvertes',
  'Relances prêtes à envoyer',
  'Objectif mensuel et suivi des prospects',
] as const;

/** Small uppercase mono label used above every section. */
function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[11px] uppercase tracking-[0.16em] ${className}`}>
      {children}
    </div>
  );
}

/** Filled action with the design's signature 3px solid drop. */
function PrimaryLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-center rounded-[4px] bg-brand px-6 font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-brand-deep)] ${className}`}
    >
      {children}
    </Link>
  );
}

/** Outlined action on dark surfaces. */
function GhostLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-center rounded-[4px] border border-edge-dark px-[22px] font-semibold text-sand transition-colors hover:border-tan ${className}`}
    >
      {children}
    </Link>
  );
}

export default function Home() {
  return (
    <div className="bg-cream text-ink">
      {/* ─── Dark block: nav + hero ─────────────────────────────────── */}
      <header className="bg-ink text-cream">
        <nav className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-5 px-6 py-[18px]">
          <div>
            <div className="text-xl font-black tracking-[-0.02em]">Daily Cash</div>
            <Eyebrow className="mt-0.5 text-[10px] tracking-[0.18em] text-tan">
              Pilotage freelance · FCFA
            </Eyebrow>
          </div>
          <div className="flex items-center gap-2.5">
            <GhostLink href="/login" className="min-h-[44px] px-4 text-sm">
              Se connecter
            </GhostLink>
            <PrimaryLink href="/signup" className="min-h-[44px] px-[18px] text-sm">
              Créer un compte
            </PrimaryLink>
          </div>
        </nav>

        <div className="mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-11 px-6 pt-[42px] pb-14">
          <div>
            <Eyebrow className="text-amber">Pour les indépendants au Sénégal</Eyebrow>
            <h1 className="mt-3.5 text-[34px] leading-[1.08] font-black tracking-[-0.035em] text-pretty sm:text-[46px]">
              Combien vous avez gagné ce mois-ci, et qui vous doit encore de l&rsquo;argent.
            </h1>
            <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-sand text-pretty">
              Un paiement s&rsquo;enregistre en dix secondes, par Wave, Orange Money ou en espèces.
              Le total du mois se met à jour tout seul — plus de cahier, plus de calcul de tête.
            </p>
            <div className="mt-[26px] flex flex-wrap gap-3">
              <PrimaryLink href="/signup" className="min-h-[52px] text-base">
                Commencer gratuitement
              </PrimaryLink>
              <GhostLink href="/onboarding" className="min-h-[52px] text-base">
                Découvrir en 3 étapes
              </GhostLink>
            </div>
            <p className="mt-[18px] font-mono text-xs leading-relaxed text-tan">
              Sans carte bancaire. Gratuit pour les revenus et les tâches.
            </p>
          </div>

          {/* Revenue card — the product's core promise, shown rather than told. */}
          <div className="rounded-md border border-edge-dark bg-ink-card p-6">
            <Eyebrow className="tracking-[0.14em] text-tan">Encaissé en septembre</Eyebrow>
            <div className="mt-2 flex items-baseline gap-[9px]">
              <span className="text-[52px] leading-none font-black tracking-[-0.035em] tabular-nums">
                487 500
              </span>
              <span className="text-base font-bold text-tan">FCFA</span>
            </div>

            <div
              className="mt-[18px] h-2.5 overflow-hidden rounded-[2px] bg-edge-dark"
              role="img"
              aria-label="65 % de l'objectif mensuel de 750 000 FCFA atteint"
            >
              <div className="h-full w-[65%] bg-amber" />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-tan">
              <span>Objectif 750 000</span>
              <span>65%</span>
            </div>

            <div className="mt-[22px] grid grid-cols-2 gap-2.5">
              <div className="rounded-[4px] border border-edge-dark bg-ink-deep p-3.5">
                <Eyebrow className="text-[10px] tracking-[0.12em] text-tan">Cette semaine</Eyebrow>
                <div className="mt-[5px] text-[22px] font-extrabold tabular-nums">112 500</div>
              </div>
              <div className="rounded-[4px] border border-edge-amber border-l-4 border-l-amber bg-ink-deep p-3.5">
                <Eyebrow className="text-[10px] tracking-[0.12em] text-amber-light">
                  À recevoir
                </Eyebrow>
                <div className="mt-[5px] text-[22px] font-extrabold tabular-nums">185 000</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Features ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1160px] px-6 pt-14">
        <Eyebrow className="text-muted">Ce que vous faites avec</Eyebrow>
        <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.num}
              className="rounded-[5px] border border-edge-light bg-cream-card p-[22px]"
            >
              <div className="font-mono text-[11px] text-brand">{f.num}</div>
              <h2 className="mt-2.5 text-[19px] leading-tight font-extrabold tracking-[-0.02em]">
                {f.title}
              </h2>
              <p className="mt-2 text-[15px] leading-[1.55] text-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1160px] px-6 pt-14">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          <div className="rounded-[5px] border border-edge-light bg-cream-card p-[26px]">
            <Eyebrow className="tracking-[0.14em] text-muted">Formule gratuite</Eyebrow>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-[34px] font-black tracking-[-0.03em]">0</span>
              <span className="text-[15px] font-bold text-muted">FCFA</span>
            </div>
            <ul className="mt-[18px] flex flex-col gap-2.5">
              {FREE_ITEMS.map((text) => (
                <li
                  key={text}
                  className="flex items-start gap-2.5 text-[15px] leading-normal text-body"
                >
                  <span aria-hidden className="font-black text-check">
                    ✓
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[5px] border border-edge-light border-t-4 border-t-brand bg-cream-card p-[26px]">
            <Eyebrow className="tracking-[0.14em] text-brand">Premium</Eyebrow>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-[34px] font-black tracking-[-0.03em]">2 000</span>
              <span className="text-[15px] font-bold text-muted">FCFA / mois</span>
            </div>
            <ul className="mt-[18px] flex flex-col gap-2.5">
              {PREMIUM_ITEMS.map((text) => (
                <li
                  key={text}
                  className="flex items-start gap-2.5 text-[15px] leading-normal text-body"
                >
                  <span aria-hidden className="font-black text-brand">
                    ✓
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-[18px] font-mono text-xs leading-relaxed text-muted">
              Payable par Wave ou Orange Money. Sans engagement, annulable à tout moment.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Closing CTA ────────────────────────────────────────────── */}
      <section className="mx-auto mt-14 max-w-[1160px] px-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-center gap-7 rounded-md bg-ink px-8 py-10 text-cream">
          <div>
            <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em] text-pretty sm:text-[30px]">
              Votre mois commence par un chiffre. Enregistrez le premier maintenant.
            </h2>
            <p className="mt-3 text-base leading-[1.55] text-sand">
              Créer un compte prend une adresse email et un code de confirmation. Rien
              d&rsquo;autre.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <PrimaryLink href="/signup" className="min-h-[52px] text-base">
              Créer mon compte
            </PrimaryLink>
            <GhostLink href="/login" className="min-h-[52px] text-base">
              J&rsquo;ai déjà un compte
            </GhostLink>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="mx-auto flex max-w-[1160px] flex-wrap items-baseline justify-between gap-4 px-6 pt-8 pb-12">
        <div className="font-mono text-[11px] text-muted">Daily Cash · Dakar · FCFA</div>
        <div className="flex flex-wrap gap-[18px] text-sm">
          <Link href="/onboarding" className="text-link hover:text-link-hover">
            Découvrir
          </Link>
          <Link href="/app" className="text-link hover:text-link-hover">
            Application mobile
          </Link>
          <Link href="/app/desktop" className="text-link hover:text-link-hover">
            Version desktop
          </Link>
        </div>
      </footer>
    </div>
  );
}
