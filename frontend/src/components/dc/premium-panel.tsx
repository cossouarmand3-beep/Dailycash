'use client';

// The paywall, and the plan management screen — the same panel serves both,
// because what a user needs to see is the same question either way: what does
// Premium give me, and where do I stand with it?
//
// Shared by the mobile sheet and the desktop modal so the offer, the price and
// the cancellation wording can never drift apart between the two.

import { Cta, Mono, fcfa } from './primitives';

export interface PremiumPanelProps {
  premium: boolean;
  cancelled: boolean;
  priceLabel: string;
  renewalLabel: string;
  daysRemaining: number;
  features: readonly string[];
  /** False when the deployment has no payment credentials wired. */
  checkoutAvailable: boolean;
  /** "3 clients · 2 factures ouvertes" — counts the server discloses. */
  lockedSummary: string;
  lockedOwed: number;
  checkingOut: boolean;
  onCheckout: () => void;
  onCancel: () => void;
  onDevActivate: () => void;
}

export function PremiumPanel({
  premium,
  cancelled,
  priceLabel,
  renewalLabel,
  daysRemaining,
  features,
  checkoutAvailable,
  lockedSummary,
  lockedOwed,
  checkingOut,
  onCheckout,
  onCancel,
  onDevActivate,
}: PremiumPanelProps) {
  // The dev escape hatch mirrors the server route's own gate: development
  // only, and only while no payment provider exists. The route 404s
  // otherwise, so a stray button could never grant anything anyway.
  const devFallback = process.env.NODE_ENV !== 'production' && !checkoutAvailable && !premium;

  if (premium) {
    return (
      <>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[21px] font-extrabold tracking-[-0.02em]">Premium actif</span>
          <span className="font-mono text-[11px] text-muted">{priceLabel}</span>
        </div>
        <p className="mt-2 text-sm leading-normal text-[#6b5941]">
          {cancelled
            ? `Abonnement annulé. Vous gardez l'accès jusqu'au ${renewalLabel} — ${daysRemaining} ${
                daysRemaining > 1 ? 'jours' : 'jour'
              } restants. Aucun prélèvement ne sera fait.`
            : `Renouvellement le ${renewalLabel}, dans ${daysRemaining} ${
                daysRemaining > 1 ? 'jours' : 'jour'
              }.`}
        </p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[15px] leading-normal text-body">
              <span aria-hidden className="font-black text-check">
                ✓
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {!cancelled && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-5 min-h-[44px] w-full cursor-pointer rounded-[4px] border border-edge-light bg-cream-card p-3.5 text-left text-sm font-bold text-brand-deep"
          >
            Annuler l&rsquo;abonnement
          </button>
        )}
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
          Sans engagement. En annulant, vous gardez l&rsquo;accès jusqu&rsquo;à la fin du mois déjà
          payé.
        </p>
      </>
    );
  }

  return (
    <>
      <Mono className="mt-1 text-brand">Daily Cash Premium</Mono>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[30px] font-black tracking-[-0.03em]">
          {priceLabel.split(' ')[0]}
        </span>
        <span className="text-sm font-bold text-muted">FCFA / mois</span>
      </div>

      {lockedOwed > 0 ? (
        <p className="mt-2 text-sm leading-normal text-[#6b5941]">
          Vous avez <strong>{fcfa(lockedOwed)} FCFA</strong> à récupérer. Premium vous montre qui
          vous doit quoi, et prépare les relances.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-normal text-[#6b5941]">
          Vos revenus et vos tâches restent gratuits, pour toujours. Premium ajoute le suivi de ce
          qu&rsquo;on vous doit.
        </p>
      )}
      {lockedSummary && (
        <p className="mt-1.5 font-mono text-[11px] text-muted">
          Déjà dans votre compte : {lockedSummary}.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[15px] leading-normal text-body">
            <span aria-hidden className="font-black text-brand">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {checkoutAvailable ? (
        <>
          <Cta onClick={onCheckout} disabled={checkingOut} className="mt-5 min-h-0 p-[15px]">
            {checkingOut ? 'Ouverture du paiement…' : 'Passer en Premium'}
          </Cta>
          <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-muted">
            Payable par Wave ou Orange Money. Sans carte bancaire, sans engagement, annulable à tout
            moment.
          </p>
        </>
      ) : (
        <div className="mt-5 rounded-[4px] border border-dashed border-[#d8c9ae] bg-cream-card p-4">
          <p className="text-[13px] leading-[1.45] text-muted">
            Les paiements ne sont pas encore branchés sur ce déploiement. Ajoutez les clés Bictorys
            (<span className="font-mono">BICTORYS_API_KEY</span>,{' '}
            <span className="font-mono">BICTORYS_WEBHOOK_SECRET</span>) pour activer le règlement
            par Wave et Orange Money.
          </p>
          {devFallback && (
            <button
              type="button"
              onClick={onDevActivate}
              className="mt-3 min-h-[44px] w-full cursor-pointer rounded-[4px] border border-edge-light bg-cream p-3 text-[13px] font-bold text-brand-deep"
            >
              Activer Premium pour tester (développement uniquement)
            </button>
          )}
        </div>
      )}
    </>
  );
}
