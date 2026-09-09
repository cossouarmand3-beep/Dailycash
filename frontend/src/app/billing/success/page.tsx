'use client';

// Where Wave / Orange Money send the user back after a successful payment.
//
// IMPORTANT: landing here does NOT mean the account is Premium. The provider
// redirects the browser as soon as the customer finishes; the money is only
// confirmed by the webhook, which may arrive a second later. So this page
// polls /api/billing and tells the truth at each stage instead of announcing
// an activation it cannot verify.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Mono } from '@/components/dc/primitives';

/** ~20s of polling: comfortably longer than a webhook round-trip. */
const MAX_ATTEMPTS = 10;
const INTERVAL_MS = 2000;

export default function BillingSuccessPage() {
  const [state, setState] = useState<'checking' | 'active' | 'pending'>('checking');
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const check = useCallback(async () => {
    try {
      const res = await api<{ premium: boolean; currentPeriodEnd: string | null }>('/api/billing');
      if (res.premium) {
        setPeriodEnd(res.currentPeriodEnd);
        setState('active');
        return true;
      }
    } catch {
      /* keep polling; a transient failure is not an answer */
    }
    return false;
  }, []);

  useEffect(() => {
    if (state === 'active') return;
    if (attempts >= MAX_ATTEMPTS) {
      setState('pending');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(
      () => {
        void check().then((ok) => {
          if (!cancelled && !ok) setAttempts((n) => n + 1);
        });
      },
      attempts === 0 ? 0 : INTERVAL_MS,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempts, state, check]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#ede4d4] px-6 py-10">
      <div className="w-full max-w-[460px] rounded-md border border-edge-light bg-cream-card p-7">
        {state === 'active' ? (
          <>
            <div
              aria-hidden
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-amber text-[22px] font-black text-ink"
            >
              ✓
            </div>
            <h1 className="mt-5 text-[23px] leading-[1.25] font-extrabold tracking-[-0.02em] text-ink">
              Premium est actif. Merci.
            </h1>
            <p className="mt-2 text-[15px] leading-normal text-[#6b5941]">
              Vos fiches clients, vos factures ouvertes et votre objectif du mois sont débloqués
              {periodEnd
                ? ` jusqu'au ${new Date(periodEnd).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                  })}`
                : ''}
              .
            </p>
          </>
        ) : state === 'checking' ? (
          <>
            <Mono className="text-muted">Confirmation du paiement</Mono>
            <h1 className="mt-3 text-[21px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">
              Nous confirmons votre paiement…
            </h1>
            <p className="mt-2 text-[15px] leading-normal text-[#6b5941]">
              Cela prend quelques secondes. Ne fermez pas cette page.
            </p>
          </>
        ) : (
          <>
            <Mono className="text-muted">Paiement en cours de traitement</Mono>
            <h1 className="mt-3 text-[21px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">
              Votre paiement est bien parti, la confirmation tarde un peu.
            </h1>
            <p className="mt-2 text-[15px] leading-normal text-[#6b5941]">
              C&rsquo;est normal quand le réseau est lent. Votre accès s&rsquo;activera tout seul
              dès que l&rsquo;opérateur nous confirme le paiement — aucune action de votre part.
            </p>
            <button
              type="button"
              onClick={() => setAttempts(0)}
              className="mt-4 min-h-[44px] w-full cursor-pointer rounded-[4px] border border-edge-light bg-cream p-3 text-sm font-bold text-brand-deep"
            >
              Vérifier à nouveau
            </button>
          </>
        )}

        <Link
          href="/app"
          className="mt-5 block rounded-[4px] bg-brand p-4 text-center text-[15px] font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)]"
        >
          Retour à l&rsquo;application
        </Link>
      </div>
    </div>
  );
}
