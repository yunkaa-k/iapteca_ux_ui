import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Реєстрація | iApteca' };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
