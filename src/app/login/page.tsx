import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Вхід | iApteca' };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
