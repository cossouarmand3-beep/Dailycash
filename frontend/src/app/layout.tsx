import type { Metadata } from 'next';
import { Archivo, DM_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';

// Archivo is variable (400–900) — the design leans on 800/900 for headings.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

// DM Mono has no variable axis; the design only uses 400 and 500.
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Daily Cash — Pilotage freelance · FCFA',
  description:
    "Combien vous avez gagné ce mois-ci, et qui vous doit encore de l'argent. Suivi des revenus, des impayés et des objectifs pour les indépendants au Sénégal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${archivo.variable} ${dmMono.variable}`}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
