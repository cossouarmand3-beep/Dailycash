import type { Metadata } from 'next';
import { AuthFlow } from '@/components/dc/auth-flow';

export const metadata: Metadata = {
  title: 'Se connecter — Daily Cash',
};

export default function LoginPage() {
  return <AuthFlow initialMode="login" />;
}
