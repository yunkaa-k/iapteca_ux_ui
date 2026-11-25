'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CheckoutDetails } from '@/lib/checkout';
import { DemoCardFields } from './DemoCardFields';
import { demoPaymentOutcome, emptyDemoCard, validateDemoCard } from '@/lib/demo-payment';
import styles from './DemoPaymentNotice.module.css';

export function DemoPaymentNotice({ orderId, checkout, guestToken, onPaid }: {
  orderId: string; checkout: CheckoutDetails; guestToken?: string; onPaid: (checkout: CheckoutDetails) => void;
}) {
  const [resolved, setResolved] = useState<CheckoutDetails>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [card, setCard] = useState(emptyDemoCard);
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const current = resolved || checkout;
  const errors = validateDemoCard(card);
  useEffect(() => {
    if (editing) formRef.current?.querySelector('input')?.focus();
    else if (wasEditing.current) retryButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  if (current.paymentMode !== 'demo') return null;
  async function retry(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setSubmitted(true);
    if (Object.keys(errors).length) { formRef.current?.querySelector<HTMLInputElement>('[data-card-field="' + Object.keys(errors)[0] + '"]')?.focus(); return; }
    submitting.current = true; setPending(true); setError('');
    try {
      const response = await fetch('/api/orders/' + encodeURIComponent(orderId) + '/demo-payment', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(guestToken ? { Authorization: 'Bearer ' + guestToken } : {}) }, body: JSON.stringify({ outcome: demoPaymentOutcome(card.number) }) });
      const data = await response.json();
      if (!response.ok || data.checkout?.paymentMode !== 'demo' || !['paid', 'failed'].includes(data.checkout?.demoPaymentStatus)) throw new Error('Payment unavailable');
      setResolved(data.checkout);
      setCard(emptyDemoCard); setEditing(false); setSubmitted(false);
      if (data.checkout.demoPaymentStatus === 'paid') onPaid(data.checkout);
      else setError('Оплату не підтверджено. Перевірте дані та спробуйте ще раз.');
    } catch { setError('Не вдалося підтвердити оплату. Спробуйте ще раз.'); }
    finally { submitting.current = false; setPending(false); }
  }
  return <div>
    {current.demoPaymentStatus === 'failed' && <section className={styles.notice} aria-label="Помилка оплати" aria-busy={pending}><div><strong>Не вдалося підтвердити оплату</strong><p>Замовлення збережено. Повторіть оплату або поверніться до нього пізніше.</p>{error && <p role="alert">{error}</p>}</div>{!editing && <button ref={retryButton} type="button" onClick={() => { setCard(emptyDemoCard); setSubmitted(false); setError(''); setEditing(true); }}>Повторити оплату</button>}</section>}
    {editing && <form ref={formRef} className={styles.retryForm} onSubmit={retry} noValidate aria-label="Повторна оплата" aria-busy={pending}>
      <DemoCardFields value={card} onChange={setCard} errors={submitted ? errors : {}} disabled={pending} />
      <div className={styles.actions}><button type="submit" disabled={pending}>{pending ? 'Підтверджуємо оплату…' : 'Підтвердити оплату'}</button><button type="button" className={styles.cancel} disabled={pending} onClick={() => { setEditing(false); setCard(emptyDemoCard); setSubmitted(false); setError(''); }}>Скасувати</button></div>
    </form>}
    <p className={styles.caption}>Демонстраційна оплата — кошти не списуються.</p>
  </div>;
}
