'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogTitle, DialogDescription, DialogClose } from './ui/dialog';
import type { AccountOrder } from './AccountOrders';
import { orderNumber } from '@/lib/checkout';
import { canCancelOrder, orderDisplay } from '@/lib/order-display';
import styles from './AccountOrders.module.css';

export function CancelOrderDialog({ order, onCancelled, className = styles.cancel }: { order: AccountOrder; onCancelled: (order: AccountOrder) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const router = useRouter();
  if (!canCancelOrder(order.status)) return null;

  async function cancel() {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError('');
    try {
      const response = await fetch('/api/orders/' + encodeURIComponent(order._id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) });
      const data = await response.json();
      if (!response.ok || data.status !== 'CANCELLED') { setError(data.error || 'Не вдалося скасувати замовлення. Спробуйте ще раз.'); return; }
      setOpen(false);
      onCancelled({ ...order, status: 'CANCELLED', checkout: data.checkout || order.checkout });
      router.refresh();
    } catch { setError('Немає зв’язку із сервером. Спробуйте ще раз.'); }
    finally { submitting.current = false; setPending(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!submitting.current) { setOpen(value); setError(''); } }}>
    <DialogTrigger asChild><button type="button" className={className}>Скасувати замовлення</button></DialogTrigger>
    <DialogPortal><DialogOverlay className={styles.overlay} /><DialogPrimitive.Content className={styles.dialog} aria-busy={pending}>
      <DialogTitle className={styles.dialogTitle}>Скасувати замовлення?</DialogTitle>
      <DialogDescription className={styles.dialogDescription}>{orderDisplay(order).paid ? 'Скасуємо замовлення та передамо повернення оплачених коштів у обробку. Статус повернення буде видно в деталях замовлення.' : `Замовлення № ${orderNumber(order._id, order.createdAt)} буде скасовано. Ви не зможете отримати товари за цим замовленням.`}</DialogDescription>
      {error && <p className={styles.actionError} role="alert">{error}</p>}
      <div className={styles.dialogActions}><DialogClose asChild><button type="button" className={styles.secondary} disabled={pending}>Залишити замовлення</button></DialogClose><button type="button" className={styles.confirm} disabled={pending} onClick={cancel}>{pending ? 'Скасовуємо…' : 'Скасувати замовлення'}</button></div>
    </DialogPrimitive.Content></DialogPortal>
  </Dialog>;
}
