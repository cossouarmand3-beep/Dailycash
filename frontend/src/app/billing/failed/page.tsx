// Where the provider sends the user back when a payment did not go through.
//
// No drama and no dead end: the free tier keeps working, and retrying is one
// tap. Nothing was charged, and saying so plainly is the point of the page.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Mono } from '@/components/dc/primitives';

export const metadata: Metadata = {
  title: 'Paiement non abouti — Daily Cash',
};

export default function BillingFailedPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#ede4d4] px-6 py-10">
      <div className="w-full max-w-[460px] rounded-md border border-edge-light bg-cream-card p-7">
        <Mono className="text-brand">Paiement non abouti</Mono>
        <h1 className="mt-3 text-[23px] leading-[1.25] font-extrabold tracking-[-0.02em] text-ink">
          Le paiement n&rsquo;est pas allé au bout.
        </h1>
        <p className="mt-2 text-[15px] leading-normal text-[#6b5941]">
          Rien ne vous a été débité. Vos revenus, vos totaux et vos tâches continuent de fonctionner
          normalement — ils sont gratuits, pour toujours.
        </p>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
          Si le problème vient du solde Wave ou Orange Money, rechargez puis réessayez depuis votre
          profil.
        </p>

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
