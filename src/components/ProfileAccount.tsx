'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, X, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import type { User } from '@/lib/types';
import styles from './ProfileAccount.module.css';
import { LogoutDialog } from './LogoutDialog';
import { profileNames } from '@/lib/profile';

export function ProfileAccount({ user, children, initialOrders = false, requestDetails = false }: { user: User; children: ReactNode; initialOrders?: boolean; requestDetails?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState(user);
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState(() => profileNames(user));
  const [phone, setPhone] = useState(user.phone || '');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwords, setPasswords] = useState(['', '', '']);
  const [visible, setVisible] = useState([false, false, false]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [orders, setOrders] = useState(initialOrders);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(timer); }, [message]);
  function resetNotice() { setError(''); setMessage(''); setPasswordErrors([]); }
  async function save(event: FormEvent, password: boolean) {
    event.preventDefault(); resetNotice();
    if (password) {
      const validation = [!passwords[0] ? 'Введіть поточний пароль.' : '', passwords[1].length < 8 ? 'Пароль має містити щонайменше 8 символів.' : new TextEncoder().encode(passwords[1]).length > 72 ? 'Пароль має містити не більше 72 байтів.' : passwords[1] === passwords[0] ? 'Новий пароль має відрізнятися від поточного.' : '', passwords[2] !== passwords[1] ? 'Паролі не збігаються. Повторіть новий пароль.' : ''];
      if (validation.some(Boolean)) { setPasswordErrors(validation); return; }
    }
    setPending(true);
    try {
      const response = await fetch(password ? '/api/profile/password' : '/api/profile', { method: password ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(password ? { currentPassword: passwords[0], newPassword: passwords[1], confirmation: passwords[2] } : { ...names, phone }) });
      const data = await response.json();
      if (!response.ok) { if (password && data.fields) setPasswordErrors([data.fields.currentPassword || '', data.fields.newPassword || '', data.fields.confirmation || '']); else setError(data.error || 'Не вдалося зберегти зміни.'); return; }
      if (password) { setPasswords(['', '', '']); setVisible([false, false, false]); setChangingPassword(false); setMessage('Пароль змінено'); }
      else { setProfile(data.user); useAuthStore.getState().setUser(data.user); setEditing(false); setMessage('Зміни збережено'); }
      router.refresh();
    } catch { setError('Немає зв’язку із сервером. Спробуйте ще раз.'); }
    finally { setPending(false); }
  }
  return <div className={styles.page}>
    <nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link> / Особистий кабінет{orders && ' / Мої замовлення'}{orders && requestDetails && ' / Заявка'}</nav>
    <h1>{orders ? requestDetails ? 'Деталі заявки' : 'Мої замовлення' : 'Особистий кабінет'}</h1>
    <p className={styles.subtitle}>{orders ? requestDetails ? 'Товари, прикріплений рецепт і результат його перевірки.' : 'Заявки на перевірку рецепта, оформлені замовлення та статуси їх отримання.' : editing ? 'Оновіть контактні дані для наступних замовлень.' : 'Керуйте особистими даними та переглядайте свої замовлення.'}</p>
    {message && <div className={styles.toast} role="status"><span className={styles.toastIcon}><Check size={16} aria-hidden="true" /></span><span>{message}</span><button type="button" aria-label="Закрити сповіщення" onClick={() => setMessage('')}><X size={16} aria-hidden="true" /></button></div>}
    <div className={styles.columns}>
      <aside className={styles.sidebar} aria-label="Особистий кабінет">
        <div className={styles.identity}><strong>{profile.name || 'Мій акаунт'}</strong><span>{profile.email}</span></div>
        <button aria-current={!orders ? 'page' : undefined} onClick={() => { setOrders(false); router.push('/profile'); resetNotice(); }}><span className={styles.navIcon}><Image src="/images/account/profile.svg" alt="" width={22} height={22} /></span>Мій профіль</button>
        <button aria-current={orders ? 'page' : undefined} onClick={() => { setOrders(true); router.push('/profile?tab=orders'); resetNotice(); }}><Image src="/images/account/orders.svg" alt="" width={24} height={24} />Мої замовлення</button>
        {user.role === 'ADMIN' && <Link href="/admin">Адміністрування</Link>}
        <LogoutDialog><button type="button" className={styles.logout} disabled={pending}><Image src="/images/account/logout.svg" alt="" width={24} height={24} />Вийти з акаунта</button></LogoutDialog>
      </aside>
      <div className={styles.main}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {orders ? children : <>
          <section className={styles.card} aria-labelledby="personal-title">
            <div className={styles.row}><h2 id="personal-title">{editing ? 'Редагування профілю' : 'Особисті дані'}</h2>{!editing && <button className={styles.secondary} onClick={() => { setNames(profileNames(profile)); setPhone(profile.phone || ''); setEditing(true); resetNotice(); }}>Редагувати</button>}</div>
            <form onSubmit={event => save(event, false)} className={styles.form}>
              <div className={`${styles.fields} ${editing ? styles.editingFields : ''}`}>
                {([{ key: 'firstName', label: 'Ім’я', complete: 'given-name' }, { key: 'lastName', label: 'Прізвище', complete: 'family-name' }] as const).map(field => <label key={field.key}>{field.label}{editing ? <input value={names[field.key]} onChange={e => setNames(value => ({ ...value, [field.key]: e.target.value }))} required maxLength={100} autoComplete={field.complete} disabled={pending} /> : <strong>{profileNames(profile)[field.key] || 'Не вказано'}</strong>}</label>)}
                <label>Електронна пошта{editing ? <span className={styles.lockedEmail}><input type="email" value={profile.email || ''} readOnly aria-readonly="true" autoComplete="email" /><Image src="/images/account/email-lock.svg" alt="" width={24} height={24} aria-hidden="true" /></span> : <strong>{profile.email || 'Не вказано'}</strong>}</label>
                <label>Номер телефону{editing ? <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380 XX XXX XX XX" autoComplete="tel" disabled={pending} /> : <strong>{profile.phone || 'Не вказано'}</strong>}</label>
              </div>
              {editing && <div className={styles.passwordActions}><button className={styles.primary} disabled={pending}>Зберегти зміни</button><button type="button" className={styles.secondary} disabled={pending} onClick={() => { setEditing(false); resetNotice(); }}>Скасувати</button></div>}
            </form>
          </section>
          <section className={`${styles.card} ${changingPassword ? styles.securityEditing : ''}`} aria-labelledby="security-title"><h2 id="security-title">Пароль та безпека</h2>
            {changingPassword ? <form className={styles.form} noValidate onSubmit={e => save(e, true)}><p>Введіть поточний пароль та створіть новий.</p><div className={styles.passwordGrid}>{['Поточний пароль', 'Новий пароль', 'Підтвердіть новий пароль'].map((label, index) => <label key={label} className={styles.passwordLabel}>{label}<span className={styles.passwordField}><input aria-invalid={!!passwordErrors[index]} aria-describedby={passwordErrors[index] ? `password-field-error-${index}` : index === 1 ? 'new-password-help' : undefined} type={visible[index] ? 'text' : 'password'} value={passwords[index]} autoComplete={index === 0 ? 'current-password' : 'new-password'} required minLength={index ? 8 : undefined} disabled={pending} onChange={e => setPasswords(values => values.map((v, i) => i === index ? e.target.value : v))} /><button type="button" disabled={pending} aria-label={`${visible[index] ? 'Приховати' : 'Показати'}: ${label}`} aria-pressed={visible[index]} onClick={() => setVisible(values => values.map((v, i) => i === index ? !v : v))}>{visible[index] ? <EyeOff size={20} /> : <Eye size={20} />}</button></span>{passwordErrors[index] && <span className={styles.fieldError} id={`password-field-error-${index}`} role="alert">{passwordErrors[index]}</span>}{index === 1 && <span className={styles.passwordHint} id="new-password-help">Мінімум 8 символів</span>}</label>)}</div><div className={styles.passwordActions}><button className={styles.primary} disabled={pending}>Зберегти пароль</button><button className={styles.secondary} type="button" disabled={pending} onClick={() => { setChangingPassword(false); setPasswords(['', '', '']); setVisible([false, false, false]); resetNotice(); }}>Скасувати</button></div></form> : <div className={styles.row}><div><strong>Пароль до акаунта</strong><p>Оновіть пароль для захисту вашого акаунта.</p></div><button className={styles.secondary} onClick={() => { setChangingPassword(true); resetNotice(); }}>Змінити пароль</button></div>}
          </section>
        </>}
      </div>
    </div>
  </div>;
}
