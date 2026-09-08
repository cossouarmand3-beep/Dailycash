'use client';

// Auth flow — the design of `Daily Cash Auth.dc.html`, wired to the kit's
// real email authentication.
//
// WHAT CHANGED FROM THE CANVAS, AND WHY
// The mockup signed up with a phone number and a 4-digit SMS code. That needs
// an SMS provider (a contract, a per-message cost, a rewritten signup) which
// this project deliberately deferred. The kit already ships a hardened email
// flow — enumeration-resistant signup, rate limits, an 8-character code — so
// the shape of the screen is kept and the credential swapped:
//
//   phone + 4 numeric digits  →  email + password + 8-character code
//
// The numeric keypad is gone with it: the code alphabet is
// ABCDEFGHJKMNPQRSTUVWXYZ23456789, which a digit pad cannot type.
//
// Signup issues NO session (by design — see CLAUDE.md), so the name and trade
// collected here are saved to /api/profile only after the code is verified.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import { Chip, Cta, IconButton, Mono } from '@/components/dc/primitives';

const TRADES = ['Community manager', 'Graphiste', 'Développeur', 'Photographe', 'Autre'] as const;

const PROOFS = [
  {
    num: '01',
    text: "Un revenu s'enregistre en dix secondes, sans quitter la conversation avec le client.",
  },
  { num: '02', text: 'Wave, Orange Money ou espèces : le total du mois se met à jour tout seul.' },
  {
    num: '03',
    text: 'Aucune carte bancaire. 2 000 FCFA par mois pour la version Premium, quand vous voulez.',
  },
] as const;

const CODE_LENGTH = 8;
const CODE_ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]*$/;
const RESEND_SECONDS = 42;

type Step = 'form' | 'code' | 'done';

export function AuthFlow({ initialMode }: { initialMode: 'signup' | 'login' }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trade, setTrade] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resend, setResend] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = mode === 'signup';
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  // The API enforces the real password policy; this only gates the button.
  const passwordOk = password.length >= 8;
  const formOk = emailOk && passwordOk && (!signup || name.trim().length > 1);
  const codeOk = code.length === CODE_LENGTH;

  useEffect(() => {
    if (step !== 'code' || resend <= 0) return;
    const t = setTimeout(() => setResend((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resend]);

  /** Turns an ApiError into something a freelancer can act on. */
  function explain(e: unknown): string {
    if (e instanceof ApiError) {
      switch (e.code) {
        case 'INVALID_CREDENTIALS':
          return 'Email ou mot de passe incorrect.';
        case 'EMAIL_NOT_VERIFIED':
          return "Ce compte n'est pas encore vérifié. Entrez le code reçu par email.";
        case 'INVALID_CODE':
        case 'CODE_EXPIRED':
          return 'Code invalide ou expiré. Demandez-en un nouveau.';
        case 'TOO_MANY_SIGNUP_ATTEMPTS':
        case 'TOO_MANY_REQUESTS':
          return 'Trop de tentatives. Réessayez dans quelques minutes.';
        case 'VALIDATION_FAILED':
          return 'Mot de passe trop faible : 8 caractères minimum, pas un mot courant.';
        default:
          return e.message || 'Une erreur est survenue.';
      }
    }
    return 'Connexion impossible. Vérifiez votre réseau.';
  }

  async function submitForm() {
    if (!formOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (signup) {
        // Enumeration-resistant: always 201, whether or not the email exists.
        await api('/api/auth/signup', {
          method: 'POST',
          body: { email: email.trim(), password },
        });
        setCode('');
        setResend(RESEND_SECONDS);
        setStep('code');
      } else {
        await api('/api/auth/login', {
          method: 'POST',
          body: { email: email.trim(), password },
        });
        router.push('/app');
        return;
      }
    } catch (e) {
      // An unverified account landing on login still needs the code screen.
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
        setCode('');
        setResend(RESEND_SECONDS);
        setStep('code');
      } else {
        setError(explain(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!codeOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      // This is the call that issues the session cookies.
      await api('/api/auth/verify-email', {
        method: 'POST',
        body: { email: email.trim(), code },
      });
      if (signup && (name.trim() || trade)) {
        // Best-effort: a failed profile save must not strand a verified user
        // on the code screen — they can set both later from the app.
        await api('/api/profile', {
          method: 'PATCH',
          body: {
            ...(name.trim() ? { name: name.trim() } : {}),
            ...(trade ? { trade } : {}),
          },
        }).catch(() => undefined);
      }
      setStep('done');
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (resend > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setResend(RESEND_SECONDS);
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  const pitch = signup
    ? "Combien vous avez gagné ce mois-ci, et qui vous doit encore de l'argent. En un écran."
    : 'Reprenez là où vous en étiez. Vos chiffres du mois sont à jour.';

  const errorBanner = error && (
    <p className="mt-4 rounded-[4px] border border-[#efc9ae] bg-[#fff3e2] p-3 text-[13px] leading-normal text-brand-deep">
      {error}
    </p>
  );

  const fieldClass =
    'mt-2 min-h-[52px] w-full rounded-[4px] border border-edge-light bg-cream-card p-3.5 text-base text-ink outline-none focus:border-brand';

  // ── Form ──────────────────────────────────────────────────────────────
  const formPanel = (
    <>
      <div className="grid grid-cols-2 border-b border-edge-light lg:hidden">
        {(['signup', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`min-h-[52px] cursor-pointer border-b-[3px] px-2.5 py-[15px] text-sm font-bold ${
              mode === m
                ? 'border-brand bg-cream text-ink'
                : 'border-transparent bg-[#f3ecde] text-muted'
            }`}
          >
            {m === 'signup' ? 'Créer un compte' : 'Se connecter'}
          </button>
        ))}
      </div>

      <form
        className="p-[22px] lg:p-0"
        onSubmit={(e) => {
          e.preventDefault();
          void submitForm();
        }}
      >
        <div className="hidden self-start rounded-[4px] bg-[#f3ecde] p-1 lg:inline-flex lg:gap-1.5">
          {(['signup', 'login'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`min-h-[44px] cursor-pointer rounded-[3px] px-4 py-[11px] text-sm font-bold ${
                mode === m ? 'bg-ink text-cream' : 'text-muted'
              }`}
            >
              {m === 'signup' ? 'Créer un compte' : 'Se connecter'}
            </button>
          ))}
        </div>

        <h1 className="mt-0 hidden text-[26px] leading-[1.25] font-extrabold tracking-[-0.025em] text-ink lg:mt-[22px] lg:block">
          {signup ? 'Créez votre compte' : 'Content de vous revoir'}
        </h1>
        <p className="hidden text-[15px] leading-[1.55] text-[#6b5941] lg:mt-2 lg:block">
          {signup
            ? 'Une adresse email suffit. Pas de carte bancaire.'
            : 'Entrez votre email et votre mot de passe.'}
        </p>

        {signup && (
          <>
            <Mono className="text-muted lg:mt-[26px]">Votre prénom</Mono>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fatou"
              autoComplete="given-name"
              className={fieldClass}
            />
          </>
        )}

        <Mono className="mt-[18px] text-muted">Votre email</Mono>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="fatou@exemple.sn"
          autoComplete="email"
          inputMode="email"
          aria-label="Adresse email"
          className={`${fieldClass} ${emailOk ? 'border-brand' : ''}`}
        />

        <Mono className="mt-[18px] text-muted">Mot de passe</Mono>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          autoComplete={signup ? 'new-password' : 'current-password'}
          aria-label="Mot de passe"
          className={fieldClass}
        />
        <p className="mt-2 font-mono text-[11px] leading-normal text-muted">
          {signup
            ? 'Un code à 8 caractères arrive par email pour confirmer votre adresse.'
            : 'Vous recevrez un code si votre compte n’est pas encore confirmé.'}
        </p>

        {signup && (
          <>
            <Mono className="mt-5 text-muted">Votre activité</Mono>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {TRADES.map((t) => (
                <Chip key={t} active={trade === t} onClick={() => setTrade(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </>
        )}

        {errorBanner}

        <Cta type="submit" disabled={!formOk || busy} className="mt-[22px]">
          {busy ? 'Un instant…' : signup ? 'Recevoir mon code' : 'Se connecter'}
        </Cta>
        <p className="mt-3.5 text-center font-mono text-[11px] leading-relaxed text-muted lg:text-left">
          {signup
            ? "En créant un compte, vous acceptez les conditions d'utilisation. Vos chiffres restent les vôtres et ne sont jamais partagés."
            : 'Pas encore de compte ? Choisissez « Créer un compte » ci-dessus.'}
        </p>
      </form>
    </>
  );

  // ── Code ──────────────────────────────────────────────────────────────
  const codePanel = (
    <form
      className="p-[22px] lg:p-0"
      onSubmit={(e) => {
        e.preventDefault();
        void submitCode();
      }}
    >
      <IconButton
        onClick={() => {
          setStep('form');
          setCode('');
          setError(null);
        }}
        label="Revenir au formulaire"
      >
        ←
      </IconButton>
      <h1 className="mt-4 text-[21px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink lg:mt-5 lg:text-[26px]">
        Entrez le code reçu par email
      </h1>
      <p className="mt-2 text-sm leading-normal text-[#6b5941] lg:text-[15px]">
        Envoyé à {email.trim()}. Pensez à regarder dans les indésirables.
      </p>

      {/* Eight boxes mirroring the mockup's four, sized for the real code. */}
      <div className="mt-[22px] flex gap-1.5">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className={`flex min-h-[52px] flex-1 items-center justify-center rounded-[4px] border bg-cream-card text-xl font-extrabold text-ink ${
              code.length === i ? 'border-brand shadow-[0_0_0_3px_#FFF3E2]' : 'border-edge-light'
            }`}
          >
            {code[i] ?? ''}
          </div>
        ))}
      </div>

      <input
        value={code}
        onChange={(e) => {
          // The alphabet excludes I, L, O, 0 and 1 to avoid misreadings, so
          // uppercase and filter rather than rejecting the whole entry.
          const next = e.target.value.toUpperCase().replace(/\s/g, '').slice(0, CODE_LENGTH);
          if (CODE_ALPHABET.test(next)) setCode(next);
        }}
        placeholder="Tapez les 8 caractères"
        autoComplete="one-time-code"
        aria-label="Code de vérification"
        className="mt-3 min-h-[52px] w-full rounded-[4px] border border-edge-light bg-cream-card p-3.5 text-center font-mono text-lg tracking-[0.3em] text-ink uppercase outline-none focus:border-brand"
      />

      <button
        type="button"
        onClick={() => void resendCode()}
        disabled={resend > 0 || busy}
        className={`mt-3 font-mono text-[11px] ${
          resend > 0 ? 'cursor-default text-muted' : 'cursor-pointer text-brand'
        }`}
      >
        {resend > 0
          ? `Renvoyer le code dans ${Math.floor(resend / 60)}:${String(resend % 60).padStart(2, '0')}`
          : 'Renvoyer le code'}
      </button>

      {errorBanner}

      <Cta type="submit" disabled={!codeOk || busy} className="mt-[22px]">
        {busy ? 'Vérification…' : codeOk ? 'Valider le code' : 'Entrez les 8 caractères'}
      </Cta>
    </form>
  );

  // ── Done ──────────────────────────────────────────────────────────────
  const donePanel = (
    <div className="animate-[dcRise_0.35s_ease_both] p-[22px] lg:p-0">
      <div
        aria-hidden
        className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-amber text-[22px] font-black text-ink"
      >
        ✓
      </div>
      <h1 className="mt-5 text-[23px] leading-[1.25] font-extrabold tracking-[-0.02em] text-ink lg:text-[26px]">
        {`${name.trim() ? `Bienvenue ${name.trim()}.` : 'Bienvenue.'} Votre compte est prêt.`}
      </h1>
      <p className="mt-2.5 text-[15px] leading-[1.55] text-[#6b5941]">
        Premier réflexe : enregistrez le dernier paiement que vous avez reçu. Votre total du mois
        démarre là.
      </p>
      <div className="mt-5 rounded-[4px] border border-edge-light bg-cream-card p-4">
        <Mono className="tracking-[0.12em] text-muted">Compte</Mono>
        <div className="mt-1.5 text-[15px] font-bold text-ink">
          {email.trim()}
          {name.trim() ? ` · ${name.trim()}` : ''}
        </div>
        <div className="mt-1 font-mono text-xs text-muted">
          {trade ?? 'Activité à préciser'} · Formule gratuite
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push('/app')}
        className="mt-5 block w-full cursor-pointer rounded-[4px] bg-brand p-4 text-center text-[15px] font-extrabold text-[#fff7ec] shadow-[0_3px_0_var(--color-brand-deep)]"
      >
        Ouvrir mon tableau de bord
      </button>
    </div>
  );

  const panel = step === 'form' ? formPanel : step === 'code' ? codePanel : donePanel;

  return (
    <div className="flex min-h-dvh justify-center bg-[repeating-linear-gradient(135deg,#EDE4D4_0_14px,#E9DFCD_14px_28px)] p-0 sm:p-6 lg:items-center">
      <div className="flex w-full max-w-[420px] flex-col overflow-hidden bg-cream sm:rounded-[18px] sm:shadow-[0_24px_50px_rgba(42,29,18,0.24)] lg:grid lg:max-w-[1100px] lg:grid-cols-2 lg:rounded-md lg:border lg:border-[#ddd0b8]">
        <div className="flex flex-col justify-between gap-8 bg-ink px-[22px] py-[26px] text-cream lg:p-10">
          <div>
            <div className="text-2xl font-black tracking-[-0.025em] lg:text-[26px]">Daily Cash</div>
            <Mono className="mt-1 text-[10px] tracking-[0.18em] text-tan">
              Pilotage freelance · FCFA
            </Mono>
            <p className="mt-5 text-[17px] leading-[1.4] font-bold lg:mt-[34px] lg:text-[22px]">
              {pitch}
            </p>
          </div>
          <div className="hidden flex-col gap-3.5 lg:flex">
            {PROOFS.map((p) => (
              <div key={p.num} className="flex gap-3 border-t border-edge-dark pt-3.5">
                <span className="pt-[3px] font-mono text-[11px] text-amber">{p.num}</span>
                <span className="text-sm leading-normal text-sand">{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center lg:p-10">{panel}</div>
      </div>
    </div>
  );
}
