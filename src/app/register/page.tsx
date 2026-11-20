import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Реєстрація | iApteca' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <AuthForm mode="register" returnTo={returnTo} />;
}
