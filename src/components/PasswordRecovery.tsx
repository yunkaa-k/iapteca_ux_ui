'use client';

import { useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Input } from './ui/input';
import { normalizeEmail, validEmail } from '@/lib/authValidation';
import auth from './AuthForm.module.css';
import styles from './PasswordRecovery.module.css';

// A Figma walkthrough only. No account lookup, email service or credential mutation.
export function PasswordRecovery() {
  const [step, setStep] = useState<'email' | 'code' | 'complete'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState([false, false]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 'email') {
      if (!validEmail(normalizeEmail(email))) { setErrors({ email: 'Введіть коректну електронну адресу.' }); emailInput.current?.focus(); return; }
      setEmail(''); setErrors({}); setStep('code');
      requestAnimationFrame(() => heading.current?.focus());
      return;
    }
    const next: Record<string, string> = {};
    if (code !== '482913') next.code = 'Неправильний код. Для тестування введіть 482913.';
    if (password.length < 8) next.password = 'Пароль має містити щонайменше 8 символів.';
    else if (new TextEncoder().encode(password).length > 72) next.password = 'Пароль має бути не довшим за 72 байти.';
    if (password !== confirmation) next.confirmation = 'Паролі не збігаються.';
    setErrors(next);
    if (Object.keys(next).length) { (next.code ? codeInput : next.password ? passwordInput : confirmationInput).current?.focus(); return; }
    setCode(''); setPassword(''); setConfirmation(''); setVisible([false, false]); setNotice(''); setStep('complete');
    requestAnimationFrame(() => heading.current?.focus());
  }
  const ready = code.length === 6 && password.length >= 8 && confirmation.length > 0;
  return <div className={styles.page}>
    <section className={`${auth.card} ${styles.card}`} aria-labelledby="recovery-title">
      <div className={auth.heading + ' ' + styles.heading}>
        <h1 id="recovery-title" ref={heading} tabIndex={-1}>{step === 'complete' ? 'Пароль змінено' : 'Відновлення пароля'}</h1>
        <p>{step === 'email' ? 'Вкажіть пошту, з якою ви реєструвалися.' : step === 'code' ? 'Введіть шестизначний код із листа та створіть новий пароль.' : 'Демонстрацію завершено. Пароль вашого акаунта не змінено.'}</p>
      </div>
      {step !== 'complete' ? <>
        <form className={styles.form} onSubmit={submit} noValidate>
          {step === 'email' ? <div className={auth.field}>
            <label htmlFor="recovery-email">Електронна пошта</label>
            <Input ref={emailInput} id="recovery-email" type="email" autoComplete="email" className={auth.input} placeholder="name@example.com" value={email} onChange={e => { setEmail(e.target.value); setErrors({}); }} required aria-invalid={!!errors.email} aria-describedby={errors.email ? 'recovery-email-error' : undefined} />
            {errors.email && <p id="recovery-email-error" className={auth.error} role="alert">{errors.email}</p>}
          </div> : <div className={styles.fields}>
            <div className={auth.field}><label htmlFor="recovery-code">Шестизначний код</label><Input ref={codeInput} id="recovery-code" className={auth.input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 цифр із листа" value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErrors(current => ({ ...current, code: '' })); }} required aria-invalid={!!errors.code} aria-describedby="recovery-code-help recovery-code-error" />
              <p className={auth.help} id="recovery-code-help">Для тестування використовуйте код 482913.</p>
              <p className={auth.error} id="recovery-code-error" role={errors.code ? 'alert' : undefined}>{errors.code}</p>
            </div>
            {[{ label: 'Новий пароль', placeholder: 'Мінімум 8 символів', value: password, update: setPassword, key: 'password', ref: passwordInput }, { label: 'Підтвердіть новий пароль', placeholder: 'Повторіть новий пароль', value: confirmation, update: setConfirmation, key: 'confirmation', ref: confirmationInput }].map((field, index) => <div className={auth.field} key={field.key}>
              <label htmlFor={'recovery-' + field.key}>{field.label}</label><div className={auth.passwordField}>
                <Input ref={field.ref} id={'recovery-' + field.key} type={visible[index] ? 'text' : 'password'} autoComplete="new-password" className={auth.input + ' ' + auth.passwordInput} placeholder={field.placeholder} value={field.value} onChange={e => { field.update(e.target.value); setErrors(current => ({ ...current, [field.key]: '' })); }} required aria-invalid={!!errors[field.key]} aria-describedby={errors[field.key] ? 'recovery-' + field.key + '-error' : undefined} />
                <button type="button" className={auth.passwordToggle} aria-label={(visible[index] ? 'Приховати: ' : 'Показати: ') + field.label.toLowerCase()} aria-pressed={visible[index]} aria-controls={'recovery-' + field.key} onClick={() => setVisible(current => current.map((value, at) => at === index ? !value : value))}><Image src={visible[index] ? '/images/auth/eye-off.svg' : '/images/auth/eye.svg'} width={24} height={24} alt="" /></button>
              </div>{errors[field.key] && <p className={auth.error} id={'recovery-' + field.key + '-error'} role="alert">{errors[field.key]}</p>}
            </div>)}
          </div>}
          <button type="submit" className={auth.submit} disabled={step === 'code' && !ready}>{step === 'email' ? 'Надіслати код' : 'Зберегти пароль'}</button>
        </form>
        {step === 'code' && <div className={styles.resend}><button type="button" onClick={() => { setCode(''); setErrors(current => ({ ...current, code: '' })); setNotice('Демонстраційний код: 482913. Лист не надсилається.'); codeInput.current?.focus(); }}>Надіслати код повторно</button><p>Не бачите листа? Перевірте папку «Спам».</p>{notice && <p role="status">{notice}</p>}</div>}
        <p className={styles.demo}>Демонстраційний режим: листи не надсилаються, пароль акаунта не змінюється. Використовуйте тестові дані.</p>
      </> : <Link className={auth.submit + ' ' + styles.back} href="/login">Повернутися до входу</Link>}
    </section>
  </div>;
}
