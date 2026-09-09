import 'server-only';
import { getEmailQueue } from '../queues/email-queue-singleton';
import { log } from '../observability/log';

// Development affordance for a starter with no email provider wired yet.
//
// The problem it solves: with RESEND_API_KEY (or the Upstash pair) unset, the
// email queue is null and the outbox silently drops the verification email.
// Signup still returns 201, the user lands on the code screen, and NOTHING
// ever arrives — with no signal anywhere that email is simply not configured.
// Whoever is building the app concludes the auth flow is broken.
//
// So: outside production, and ONLY while no mailer exists, the code is written
// to the server log where `pnpm dev` shows it. In production this is a no-op —
// a verification code in a log file is a credential leak, and the correct fix
// there is to configure Resend.

export function announceVerificationCodeInDev(email: string, code: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (getEmailQueue() !== null) return; // A real email is on its way.

  log.warn(
    `[dev] Aucun fournisseur d'email configuré — le code de vérification n'a PAS été envoyé. ` +
      `Code pour ${email} : ${code}. ` +
      `Renseignez RESEND_API_KEY + EMAIL_FROM (et les clés Upstash) pour de vrais envois.`,
  );
}
