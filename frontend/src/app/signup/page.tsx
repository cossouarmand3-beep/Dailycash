import type { Metadata } from 'next';
import { AuthFlow } from '@/components/dc/auth-flow';

export const metadata: Metadata = {
  title: 'Créer un compte — Daily Cash',
};

export default function SignupPage() {
  return <AuthFlow initialMode="signup" />;
}
