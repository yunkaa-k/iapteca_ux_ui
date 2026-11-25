'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogTitle, DialogDescription, DialogClose } from './ui/dialog';
import { OrderProducts } from './OrderProducts';
import { DemoPaymentNotice } from './DemoPaymentNotice';
import type { AccountOrder } from './AccountOrders';
import { money } from '@/lib/product';
import { orderNumber } from '@/lib/checkout';
import { canCancelOrder, orderDisplay } from '@/lib/order-display';
import styles from './AccountOrders.module.css';

export function OrderDetails({ order: initialOrder }: { order: AccountOrder }) {
  const [override, setOverride] = useState<AccountOrder>();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const router = useRouter();
  const order = override || initialOrder;
  const display = orderDisplay(order);
  const checkout = order.checkout;
  const number = orderNumber(order._id, order.createdAt);
  async function cancel() {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError('');
    try {
      const response = await fetch('/api/orders/' + encodeURIComponent(order._id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) });
      const data = await response.json();
      if (!response.ok || data.status !== 'CANCELLED') { setError(data.error || 'Не вдалося скасувати замовлення. Спробуйте ще раз.'); return; }
      setOverride({ ...order, status: 'CANCELLED', checkout: data.checkout || checkout });
      setOpen(false); router.refresh();
    } catch { setError('Немає зв’язку із сервером. Спробуйте ще раз.'); }
    finally { submitting.current = false; setPending(false); }
  }
  return <>
    <Link className={styles.back} href="/profile?tab=orders">← До моїх замовлень</Link>
    <section className={styles.panel + ' ' + styles.orderDetails} aria-label="Деталі замовлення">
      <div className={styles.heading}><div><div className={styles.orderIdentity}><h2>№ {number}</h2><span className={`${styles.badge} ${styles[display.badgeState]}`}>{display.badge}</span></div><p>{new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(new Date(order.createdAt))}</p></div>
        {canCancelOrder(order.status) && <Dialog open={open} onOpenChange={value => { if (!submitting.current) { setOpen(value); setError(''); } }}>
          <DialogTrigger asChild><button type="button" className={styles.cancel}>Скасувати замовлення</button></DialogTrigger>
          <DialogPortal><DialogOverlay className={styles.overlay} /><DialogPrimitive.Content className={styles.dialog} aria-busy={pending}>
            <DialogTitle className={styles.dialogTitle}>Скасувати замовлення?</DialogTitle>
            <DialogDescription className={styles.dialogDescription}>{display.paid ? 'Скасуємо замовлення та передамо повернення оплачених коштів у обробку. Статус повернення буде видно в деталях замовлення.' : `Замовлення № ${number} буде скасовано. Ви не зможете отримати товари за цим замовленням.`}</DialogDescription>
            {error && <p className={styles.actionError} role="alert">{error}</p>}
            <div className={styles.dialogActions}><DialogClose asChild><button type="button" className={styles.secondary} disabled={pending}>Залишити замовлення</button></DialogClose><button type="button" className={styles.confirm} disabled={pending} onClick={cancel}>{pending ? 'Скасовуємо…' : 'Скасувати замовлення'}</button></div>
          </DialogPrimitive.Content></DialogPortal>
        </Dialog>}
      </div>
      {display.failed && checkout ? <DemoPaymentNotice orderId={order._id} checkout={checkout} onPaid={value => { setOverride({ ...order, checkout: value }); router.refresh(); }} /> : <div className={`${styles.explanation} ${styles[display.state]}`} role="status"><strong>{display.title}</strong><p>{display.description}</p></div>}
      <h2>Товари в замовленні</h2><OrderProducts items={order.items} />
      <div className={styles.orderTotals}><div><span>Доставка</span><span>{checkout ? checkout.delivery.fee ? money(checkout.delivery.fee) : 'Безкоштовно' : 'Не вказано'}</span></div><div><strong>{display.totalLabel}</strong><strong>{money(order.total)}</strong></div></div>
      {(display.refund || display.paid) && <p className={styles.demoCaption}>Демонстраційна оплата та повернення — реальні кошти не переказуються.</p>}
    </section>
    <section className={styles.panel} aria-label="Отримання та оплата"><h2>Отримання та оплата</h2>
      <dl className={styles.receivingDetails}>
        <div><dt>Спосіб отримання</dt><dd>{checkout?.delivery.method === 'courier' ? 'Кур’єрська доставка' : checkout?.delivery.method === 'pickup' ? 'Самовивіз з аптеки' : 'Не вказано'}</dd></div>
        <div><dt>Оплата</dt><dd>{display.payment}</dd></div>
        <div className={styles.fullWidth}><dt>{checkout?.delivery.method === 'courier' ? 'Адреса доставки' : 'Аптека'}</dt><dd>{checkout?.delivery.method === 'courier' ? [checkout.delivery.city, checkout.delivery.address].filter(Boolean).join(', ') || 'Не вказано' : [checkout?.delivery.pharmacyName, checkout?.delivery.address].filter(Boolean).join(', ') || 'Не вказано'}</dd></div>
        <div className={styles.contactRow}><div><dt>Отримувач</dt><dd>{checkout?.contact.name || 'Не вказано'}</dd></div><div><dt>Номер телефону</dt><dd>{checkout?.contact.phone || 'Не вказано'}</dd></div></div>
      </dl>
    </section>
  </>;
}
