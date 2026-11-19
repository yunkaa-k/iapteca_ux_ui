import Link from 'next/link';
import styles from '@/components/AuthForm.module.css';

export const metadata = { title: 'Відновлення пароля | iApteca' };

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="reset-title">
        <div className={styles.heading}>
          <h1 id="reset-title">Відновлення пароля</h1>
          <p>Відновлення через електронну пошту поки недоступне. Сервіс надсилання листів ще не підключено.</p>
        </div>
        <Link className={styles.submit} style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href="/login">Повернутися до входу</Link>
      </section>
    </div>
  );
}
