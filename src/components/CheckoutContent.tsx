'use client';
import { useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/lib/store/cartStore';
import { useAuthStore } from '@/lib/store/authStore';
import { useHydrated } from '@/lib/useHydrated';
import { prescriptionsApproved, usePrescriptionStore } from '@/lib/store/prescriptionStore';
import { requestStatus, usePrescriptionRequestStore } from '@/lib/store/prescriptionRequestStore';
import { useCheckoutStore } from '@/lib/store/checkoutStore';
import { checkoutDetails, DEMO_PHARMACIES, emptyCheckout, validateCheckout, type CheckoutForm } from '@/lib/checkout';
import { money } from '@/lib/product';
import styles from './Checkout.module.css';
import { DemoCardFields } from './DemoCardFields';
import { demoPaymentOutcome, emptyDemoCard, validateDemoCard } from '@/lib/demo-payment';

export function CheckoutContent({ requestId }: { requestId?: string }) {
  const cartItems = useCartStore(state => state.items);
  const { user, isLoading: authLoading } = useAuthStore();
  const requests = usePrescriptionRequestStore();
  const request = requests.requests.find(r => r.id === requestId && r.ownerId === user?._id && r.state === 'active');
  const items = request ? request.items : requestId ? [] : cartItems;
  const prescriptions = usePrescriptionStore(state => state.entries);
  const approved = request ? requestStatus(request) === 'approved' : prescriptionsApproved(items, prescriptions);
  const key = requestId ? 'request:' + requestId : 'cart:' + JSON.stringify(items.map(i => [i._id, i.quantity, i.price]));
  const { drafts, update, saveReceipt } = useCheckoutStore();
  const draft = drafts[key] || emptyCheckout;
  const form: CheckoutForm = draft.payment === 'online-after-confirmation' ? { ...draft, payment: 'online' } : draft;
  const [touched, setTouched] = useState<Partial<Record<keyof CheckoutForm, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [card, setCard] = useState(emptyDemoCard);
  const submitting = useRef(false);
  const centerPin = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const hydrated = useHydrated();
  const errors = validateCheckout(form);
  const cardErrors = form.payment === 'online' ? validateDemoCard(card) : {};
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = form.receiving === 'courier' ? 59 : 0;
  const pharmacy = DEMO_PHARMACIES.find(p => p.id === form.pharmacyId);
  const started = Object.values(form).some(Boolean);
  function patch(change: Partial<CheckoutForm>) { update(key, change); setError(''); }
  async function handleOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setSubmitted(true);
    if (Object.keys(errors).length) { document.getElementById('checkout-' + Object.keys(errors)[0])?.focus(); return; }
    if (Object.keys(cardErrors).length) { document.querySelector<HTMLInputElement>('[data-card-field="' + Object.keys(cardErrors)[0] + '"]')?.focus(); return; }
    if (!approved || (requestId && !request)) return;
    submitting.current = true; setPending(true); setError('');
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        items: items.map(i => ({ medication: i._id, ...(i.kind === 'bundle' ? { kind: 'bundle' } : {}), quantity: i.quantity, price: i.price })), total: subtotal + deliveryFee, checkout: { ...form, ...(form.payment === 'online' ? { demoPaymentOutcome: demoPaymentOutcome(card.number) } : {}) },
      }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Не вдалося оформити замовлення. Спробуйте ще раз.'); return; }
      if (typeof data._id !== 'string') throw new Error('Missing order number');
      if (form.payment === 'online' && (data.checkout?.paymentMode !== 'demo' || !['paid', 'failed'].includes(data.checkout?.demoPaymentStatus))) throw new Error('Missing payment result');
      const receiptItems = items.map(item => {
        const saved = data.items?.find((line: { medication: string }) => line.medication === item._id);
        return { ...item, price: typeof saved?.price === 'number' ? saved.price : item.price, quantity: saved?.quantity || item.quantity };
      });
      saveReceipt(key, { id: data._id, createdAt: data.createdAt || new Date().toISOString(), ownerId: user?._id, ...(typeof data.guestPaymentToken === 'string' ? { guestPaymentToken: data.guestPaymentToken } : {}), items: receiptItems, total: typeof data.total === 'number' ? data.total : subtotal + deliveryFee, checkout: data.checkout || checkoutDetails(form, form.payment === 'online' ? demoPaymentOutcome(card.number) : undefined) });
      setCard(emptyDemoCard);
      if (request && user) requests.complete(request.id, user._id, data._id);
      for (const item of items) {
        const current = useCartStore.getState().items.find(line => line._id === item._id);
        if (current) useCartStore.getState().updateQuantity(item._id, Math.max(0, current.quantity - item.quantity));
      }
      if (!request) usePrescriptionStore.getState().clear();
      setCompleted(true);
      router.push('/order/result?order=' + encodeURIComponent(data._id));
    } catch { setError('Немає зв’язку із сервером. Перевірте з’єднання та спробуйте ще раз.'); }
    finally { submitting.current = false; setPending(false); }
  }
  function field(name: 'name' | 'phone' | 'email' | 'city' | 'address', label: string, placeholder: string, autoComplete: string, type = 'text') {
    const message = (submitted || touched[name]) && errors[name];
    return <div className={styles.field}><label htmlFor={'checkout-' + name}>{label}</label>
      <Input id={'checkout-' + name} name={name} value={form[name]} type={type} autoComplete={autoComplete} placeholder={placeholder} className={styles.input} disabled={pending} maxLength={name === 'address' ? 200 : name === 'email' ? 254 : 100} aria-required={name !== 'email'} aria-invalid={!!message} aria-describedby={'checkout-' + name + '-error'} onBlur={() => setTouched(prev => ({ ...prev, [name]: true }))} onChange={e => patch({ [name]: e.target.value })} />
      <span id={'checkout-' + name + '-error'} className={styles.fieldError}>{message || ''}</span></div>;
  }
  if (!hydrated || (requestId && authLoading && !user)) return <div className={styles.page} role="status">Завантажуємо замовлення…</div>;
  if (completed) return <div className={styles.page} role="status">Відкриваємо підтвердження замовлення…</div>;
  if (requestId && !request) return <div className={styles.page}><h1>Заявка недоступна або вже оформлена</h1><Link href="/profile?tab=orders" className={styles.secondary}>Мої замовлення</Link></div>;
  if (!items.length) return <div className={styles.page}><h1>Кошик порожній</h1><Link className={styles.primary} href="/catalog">Перейти до каталогу</Link></div>;
  if (!approved) return <div className={styles.page}><h1>Потрібна перевірка рецепта</h1><p>Перед оформленням додайте рецепт для кожного рецептурного препарату.</p><Link className={styles.primary} href={request ? '/cart/prescription?request=' + request.id : '/cart/prescription'}>Перейти до перевірки рецепта</Link></div>;
  return <div className={styles.page}>
    <div className={styles.heading}><h1>Оформлення замовлення</h1><Link href={request ? '/profile?tab=orders&request=' + request.id : '/cart'}><Image src="/images/checkout/back.svg" alt="" width={16} height={16} />До кошика</Link></div>
    <ol className={styles.progress} aria-label="Етапи замовлення"><li className={styles.done}><span><Image src="/images/prescription/check.svg" alt="" width={16} height={16} /></span>Кошик</li><li className={styles.current} aria-current="step"><span>2</span>Оформлення</li><li><span>3</span>Підтвердження</li></ol>
    {(error || (submitted && (Object.keys(errors).length > 0 || Object.keys(cardErrors).length > 0))) && <p role="alert" className={styles.errorBanner}>{error || 'Перевірте обов’язкові поля та спосіб отримання.'}</p>}
    <form className={styles.layout} onSubmit={handleOrder} noValidate aria-busy={pending}>
      <div className={styles.sections}>
        <section className={styles.card} aria-labelledby="checkout-contact-title"><h2 id="checkout-contact-title">Контактні дані</h2><div className={styles.twoColumns}>{field('name', 'Ім’я та прізвище *', 'Як до вас звертатися', 'name')}{field('phone', 'Номер телефону *', '+380 (__) ___ __ __', 'tel', 'tel')}</div>{field('email', 'Електронна пошта (необов’язково)', 'example@email.com', 'email', 'email')}</section>
        <fieldset className={styles.card}><legend>Спосіб отримання</legend>
          <div className={styles.twoColumns} id="checkout-receiving">{([{ id: 'pickup', title: 'Самовивіз з аптеки', caption: 'Безкоштовно' }, { id: 'courier', title: 'Кур’єрська доставка', caption: '59 грн за адресою' }] as const).map(option => <label className={styles.choice + (submitted && errors.receiving ? ' ' + styles.invalid : '')} key={option.id}><span><input type="radio" name="receiving" value={option.id} checked={form.receiving === option.id} disabled={pending} onChange={() => patch({ receiving: option.id })} />{option.title}</span><small>{option.caption}</small></label>)}</div>
          {form.receiving === 'courier' ? <div className={styles.addressColumns}>{field('city', 'Місто *', 'Оберіть місто', 'address-level2')}{field('address', 'Вулиця, будинок, квартира *', 'Вулиця, будинок, квартира', 'street-address')}</div> : <div className={styles.pickup}>
            <p className={styles.label}>Аптека для самовивозу *</p><p className={styles.legend}><span />Аптеки з наявністю всіх товарів із кошика</p>
            <div className={styles.map} aria-label="Демонстраційна мапа аптек"><div className={styles.mapCanvas} style={{ transform: 'scale(' + zoom + ')' }}><Image src="/images/checkout/map.png" alt="" fill sizes="768px" />{DEMO_PHARMACIES.map(p => <button ref={p.id === 'center' ? centerPin : undefined} className={styles.pin} style={{ left: p.x / 766 * 100 + '%', top: p.y }} key={p.id} type="button" disabled={pending} aria-label={'Обрати ' + p.name} aria-pressed={form.pharmacyId === p.id} onClick={() => patch({ receiving: 'pickup', pharmacyId: p.id })}><Image src="/images/checkout/map-pin.svg" alt="" width={40} height={48} /></button>)}<Image className={styles.location} src="/images/checkout/location.svg" alt="Ваше розташування у демонстрації" width={28} height={28} /></div><div className={styles.zoom}><button type="button" aria-label="Збільшити мапу" disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, value + .1))}>+</button><button type="button" aria-label="Зменшити мапу" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .1))}>−</button></div><span className={styles.attribution}>Map data ©2026 Google</span></div>
            <p className={styles.pharmacy}>{pharmacy ? pharmacy.name + (pharmacy.address ? ', ' + pharmacy.address : '') : 'Аптеку ще не обрано'}</p><button id="checkout-pharmacyId" type="button" className={styles.secondary + (submitted && errors.pharmacyId ? ' ' + styles.invalid : '')} onClick={() => { patch({ receiving: 'pickup' }); centerPin.current?.focus(); }}>Обрати аптеку на мапі</button>{submitted && errors.pharmacyId && <p className={styles.fieldError}>{errors.pharmacyId}</p>}
          </div>}
          {submitted && errors.receiving && <p className={styles.fieldError}>{errors.receiving}</p>}
        </fieldset>
        <fieldset className={styles.card}><legend>Спосіб оплати</legend><div className={styles.twoColumns} id="checkout-payment">{([{ id: 'on-receipt', title: 'При отриманні', caption: 'Оплата під час отримання замовлення' }, { id: 'online', title: 'Онлайн', caption: 'Оплата банківською карткою' }] as const).map(option => <label className={styles.choice} key={option.id}><span><input type="radio" name="payment" value={option.id} checked={form.payment === option.id} disabled={pending} onChange={() => { patch({ payment: option.id }); setCard(emptyDemoCard); }} />{option.title}</span><small>{option.caption}</small></label>)}</div>{submitted && errors.payment && <p className={styles.fieldError}>{errors.payment}</p>}</fieldset>
        {form.payment === 'online' && <DemoCardFields value={card} onChange={setCard} errors={submitted ? cardErrors : {}} disabled={pending} />}
      </div>
      <aside className={styles.summary} aria-label="Ваше замовлення"><h2>Ваше замовлення</h2><dl>{items.map(item => <div key={item._id}><dt>{item.name} × {item.quantity}</dt><dd>{money(item.price * item.quantity)}</dd></div>)}<div className={styles.divider}><dt>Товари</dt><dd>{money(subtotal)}</dd></div><div><dt>Отримання</dt><dd>{deliveryFee ? money(deliveryFee) : 'Безкоштовно'}</dd></div></dl><div className={styles.total}><span>До сплати</span><strong>{money(subtotal + deliveryFee)}</strong></div><button className={styles.primary} type="submit" disabled={pending || !started}>{pending ? 'Оформлюємо замовлення…' : 'Підтвердити замовлення'}</button><p>Перевірте контактні дані та місце отримання перед підтвердженням.</p></aside>
    </form>
  </div>;
}
