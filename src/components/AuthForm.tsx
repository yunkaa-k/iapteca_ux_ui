'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/store/authStore';
import { normalizeEmail, validateEmailAuth, type AuthFieldErrors } from '@/lib/authValidation';
import styles from './AuthForm.module.css';

export function AuthForm({ mode, returnTo }: { mode: 'login' | 'register'; returnTo?: string }) {
  const registration = mode === 'register';
  const prescriptionReturn = returnTo === '/cart/prescription';
  const returnQuery = prescriptionReturn ? '?returnTo=%2Fcart%2Fprescription' : '';
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [consent, setConsent] = useState(false);
  const [fields, setFields] = useState<AuthFieldErrors>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const validation = validateEmailAuth(identifier, password, registration, consent);
    setFields(validation);
    setError('');
    if (Object.keys(validation).length) {
      if (validation.email) identifierRef.current?.focus();
      else if (validation.password) passwordRef.current?.focus();
      else consentRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(identifier), password, ...(registration ? { consent } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Не вдалося виконати запит. Спробуйте ще раз.');
        if (data.fields) setFields(data.fields);
        return;
      }
      setUser(data.user);
      setPassword('');
      router.replace(prescriptionReturn ? '/cart/prescription' : '/');
      router.refresh();
    } catch {
      setError('Немає зв’язку із сервером. Перевірте підключення та спробуйте ще раз.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`${styles.page} ${registration ? styles.registrationPage : ''}`}>
      <section className={`${styles.card} ${registration ? styles.registrationCard : ''}`} aria-labelledby="auth-title">
        <nav className={styles.tabs} aria-label="Вхід і реєстрація">
          <Link href={`/login${returnQuery}`} aria-current={!registration ? 'page' : undefined}>Вхід</Link>
          <Link href={`/register${returnQuery}`} aria-current={registration ? 'page' : undefined}>Реєстрація</Link>
        </nav>
        <div className={styles.heading}>
          <h1 id="auth-title">{registration ? 'Приєднуйтеся до iApteca' : prescriptionReturn ? 'Увійдіть, щоб продовжити' : 'З поверненням!'}</h1>
          <p>{prescriptionReturn ? 'Збережемо заявку у «Мої замовлення». Після входу повернемо вас до прикріпленого рецепта.' : registration ? 'Зберігайте обране, переглядайте замовлення та оформлюйте покупки швидше.' : 'Увійдіть, щоб переглядати свої замовлення та збережені товари.'}</p>
        </div>
        <form className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
          {error && <p className={styles.banner} role="alert">{error}</p>}
          <div className={styles.field}>
            <label htmlFor="auth-identifier">Електронна пошта</label>
            <Input ref={identifierRef} id="auth-identifier" name="email" type="email" autoComplete="username" className={styles.input} placeholder="name@example.com" value={identifier} disabled={pending} required aria-invalid={!!fields.email} aria-describedby={fields.email ? 'identifier-error' : undefined} onChange={(event) => { setIdentifier(event.target.value); setFields((current) => ({ ...current, email: undefined })); setError(''); }} />
            {fields.email && <p className={styles.error} id="identifier-error">{fields.email}</p>}
          </div>
          <div className={styles.field}>
            <label htmlFor="auth-password">Пароль</label>
            <div className={styles.passwordField}>
              <Input ref={passwordRef} id="auth-password" name="password" type={passwordVisible ? 'text' : 'password'} autoComplete={registration ? 'new-password' : 'current-password'} className={`${styles.input} ${styles.passwordInput}`} placeholder={registration ? 'Придумайте пароль' : 'Введіть пароль'} value={password} disabled={pending} required aria-invalid={!!fields.password} aria-describedby={fields.password ? 'password-error' : registration ? 'password-help' : undefined} onChange={(event) => { setPassword(event.target.value); setFields((current) => ({ ...current, password: undefined })); setError(''); }} />
              <button className={styles.passwordToggle} type="button" aria-label={passwordVisible ? 'Приховати пароль' : 'Показати пароль'} aria-controls="auth-password" aria-pressed={passwordVisible} disabled={pending} onClick={() => setPasswordVisible((visible) => !visible)}>
                {passwordVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
            {fields.password ? <p className={styles.error} id="password-error">{fields.password}</p> : registration && <p className={styles.help} id="password-help">Мінімум 8 символів</p>}
          </div>
          {registration ? (
            <div>
              <label className={styles.consent}>
                <input ref={consentRef} type="checkbox" checked={consent} disabled={pending} onChange={(event) => { setConsent(event.target.checked); setFields((current) => ({ ...current, consent: undefined })); }} aria-invalid={!!fields.consent} aria-describedby={fields.consent ? 'consent-error' : undefined} />
                <span>Погоджуюся з політикою конфіденційності</span>
              </label>
              {fields.consent && <p className={styles.error} id="consent-error">{fields.consent}</p>}
            </div>
          ) : <Link className={styles.forgot} href="/reset-password">Забули пароль?</Link>}
          <button className={styles.submit} type="submit" disabled={pending || (registration && !consent)}>{pending ? (registration ? 'Створюємо акаунт…' : 'Входимо…') : registration ? 'Зареєструватися' : 'Увійти'}</button>
        </form>
      </section>
    </div>
  );
}
