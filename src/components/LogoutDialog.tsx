'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/store/authStore';
import styles from './LogoutDialog.module.css';

export function LogoutDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function confirmLogout() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await useAuthStore.getState().logout();
      setOpen(false);
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Не вдалося вийти. Спробуйте ще раз.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <Dialog open={open} onOpenChange={value => {
    if (submitting.current) return;
    setError('');
    setOpen(value);
  }}>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogPortal>
      <DialogOverlay className={styles.overlay} />
      <DialogPrimitive.Content className={styles.dialog} aria-busy={pending}>
        <DialogTitle className={styles.title}>Вийти з акаунта?</DialogTitle>
        <DialogDescription className={styles.description}>Щоб знову переглядати профіль і свої замовлення, потрібно буде увійти.</DialogDescription>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <DialogClose asChild><button type="button" className={styles.stay} disabled={pending}>Залишитися</button></DialogClose>
          <button type="button" className={styles.confirm} disabled={pending} onClick={confirmLogout}>Вийти</button>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  </Dialog>;
}
