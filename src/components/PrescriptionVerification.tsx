'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { usePrescriptionRequestStore } from '@/lib/store/prescriptionRequestStore';
import { useCartStore } from '@/lib/store/cartStore';
import { prescriptionFor, prescriptionsApproved, usePrescriptionStore } from '@/lib/store/prescriptionStore';
import { useHydrated } from '@/lib/useHydrated';
import { money } from '@/lib/product';
import styles from './Prescription.module.css';

const statusLabels = { attached: 'Рецепт прикріплено', reviewing: 'На перевірці', approved: 'Рецепт підтверджено', 'needs-new-photo': 'Потрібне нове фото' };

export function PrescriptionVerification({ requestId, returnToDetails = false }: { requestId?: string; returnToDetails?: boolean }) {
  const cartItems = useCartStore(state => state.items);
  const draft = usePrescriptionStore();
  const requests = usePrescriptionRequestStore();
  const user = useAuthStore(state => state.user);
  const authLoading = useAuthStore(state => state.isLoading);
  const router = useRouter();
  const [createdId, setCreatedId] = useState<string>();
  const selectedId = requestId || createdId;
  const request = requests.requests.find(r => r.id === selectedId && r.ownerId === user?._id && r.state === 'active');
  const items = request ? request.items : selectedId ? [] : cartItems;
  const entries = request ? request.entries : draft.entries;
  const settle = selectedId ? requests.settle : draft.settle;
  const attach = (item: typeof items[number], name: string) => request && user ? requests.replaceFile(request.id, user._id, item._id, name) : draft.attach(item, name);
  const remove = (id: string) => request && user ? requests.removeFile(request.id, user._id, id) : draft.remove(id);
  const hydrated = useHydrated();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const required = items.filter(item => item.requiresPrescription);
  const reviewing = required.some(item => prescriptionFor(item, entries)?.status === 'reviewing');
  useEffect(() => {
    settle();
    if (!reviewing) return;
    const timer = setInterval(settle, 250);
    return () => clearInterval(timer);
  }, [reviewing, settle]);
  if (!hydrated) return <div className={styles.page} role="status">Завантажуємо рецепти…</div>;
  if (selectedId && authLoading && !user) return <div className={styles.page} role="status">Перевіряємо акаунт…</div>;
  if (selectedId && !request) return <div className={styles.page}><h1>Заявка недоступна</h1><p className={styles.caption}>Увійдіть до свого акаунта або відкрийте чинну заявку з «Мої замовлення».</p><Link href="/profile?tab=orders" className={styles.primary}>Мої замовлення</Link></div>;
  if (!required.length) return <div className={styles.page}><h1>Перевірка рецепта</h1><p className={styles.caption}>У кошику немає препаратів, що потребують рецепта.</p><Link href="/cart" className={styles.primary}>До кошика</Link></div>;

  const approved = prescriptionsApproved(items, entries);
  const needsPhoto = required.some(item => prescriptionFor(item, entries)?.status === 'needs-new-photo');
  const attached = required.filter(item => prescriptionFor(item, entries)).length;
  const canSubmit = !reviewing && !approved && required.every(item => ['attached', 'approved'].includes(prescriptionFor(item, entries)?.status || ''));
  const multi = required.length > 1;
  const title = reviewing ? (multi ? 'Рецепти перевіряє фармацевт' : 'Рецепт перевіряє фармацевт') : approved ? (multi ? 'Рецепти підтверджено' : 'Рецепт підтверджено') : needsPhoto ? 'Потрібне нове фото рецепта' : multi ? 'Рецепти для товарів' : attached ? 'Рецепт прикріплено' : 'Додайте рецепт';
  const description = reviewing ? 'Статус збережено в «Мої замовлення». Ви можете повернутися до каталогу та робити інші покупки.' : approved ? 'Можна продовжити оформлення замовлення.' : needsPhoto ? 'На фото не видно всіх даних рецепта. Завантажте чіткіше фото або скан.' : multi ? 'Додайте фото або скан рецепта для кожного препарату зі списку.' : attached ? 'Перевірте, що прикріпили потрібний файл, і надішліть його фармацевту.' : 'Додайте фото або скан рецепта. Переконайтеся, що текст добре видно.';
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const files = [...new Set(required.map(item => prescriptionFor(item, entries)?.fileName).filter((name): name is string => !!name))];
  function submitVerification() {
    if (!user) { router.push('/login?returnTo=%2Fcart%2Fprescription'); return; }
    if (request) { requests.submit(request.id, user._id); return; }
    draft.submit(items);
    const id = requests.create(user._id, items, usePrescriptionStore.getState().entries);
    if (id) { setCreatedId(id); draft.clear(); router.replace(`/cart/prescription?request=${id}`); }
  }

  return <div className={styles.page}>
    <div className={styles.introduction}><nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link> / <Link href="/cart">Кошик</Link> / Перевірка рецепта</nav><h1>Перевірка рецепта</h1></div>
    <ol className={styles.progress} aria-label="Етапи замовлення">
      <li className={styles.completed}><span><Image src="/images/prescription/check.svg" width={16} height={16} alt="" /></span>Кошик</li>
      <li className={styles.active} aria-current="step"><span>2</span>Перевірка рецепта</li><li><span>3</span>Оформлення</li><li><span>4</span>Підтвердження</li>
    </ol>
    <div className={styles.verificationLayout}>
      <section className={styles.verification} aria-label="Рецепти для товарів">
        <h2 aria-live="polite">{title}</h2><p className={styles.caption}>{description}</p>
        {required.map(item => {
          const entry = prescriptionFor(item, entries);
          const status = entry?.status;
          const editable = !reviewing && (!status || status === 'attached' || status === 'needs-new-photo');
          return <article className={styles.card} key={item._id}>
            <div className={styles.photo}>{item.image && <Image src={item.image} alt="" fill sizes="120px" />}</div>
            <div className={styles.product}><h2>{item.name}</h2><p>{item.description} · {item.quantity} уп.</p><span>Потрібен рецепт</span></div>
            <div className={styles.attachment}>
              <p className={`${styles.status} ${status === 'needs-new-photo' ? styles.needsNewPhoto : status ? styles[status] : ''}`} role="status">{status ? statusLabels[status] : 'Рецепт ще не додано'}</p>
              {entry && <div className={styles.fileRow}><span>{entry.fileName}</span>{status === 'attached' && <>
                <button className={styles.iconButton} aria-label={`Замінити рецепт для ${item.name}`} onClick={() => inputs.current[item._id]?.click()}><Image src="/images/prescription/replace.svg" width={20} height={20} alt="" /></button>
                <button className={styles.iconButton} aria-label={`Видалити рецепт для ${item.name}`} onClick={() => remove(item._id)}><Image src="/images/prescription/trash.svg" width={20} height={20} alt="" /></button>
              </>}</div>}
              {editable && <input ref={node => { inputs.current[item._id] = node; }} className={styles.fileInput} tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label={`Файл рецепта для ${item.name}`} onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) {
                  setErrors(prev => ({ ...prev, [item._id]: 'Оберіть JPG, PNG, WEBP або PDF до 10 МБ.' })); return;
                }
                attach(item, file.name); setErrors(prev => ({ ...prev, [item._id]: '' }));
              }} />}
              {editable && status !== 'attached' && <button className={styles.upload} onClick={() => inputs.current[item._id]?.click()}><Image src="/images/prescription/upload.svg" width={20} height={20} alt="" />{status === 'needs-new-photo' ? 'Завантажити інше фото' : 'Додати рецепт'}</button>}
              {editable && !entry && files.length > 0 && <details><summary className={styles.upload}>Вибрати доданий файл</summary>{files.map(name => <button className={styles.upload} key={name} onClick={() => attach(item, name)}>{name}</button>)}</details>}
              {errors[item._id] && <p className={styles.error} role="alert">{errors[item._id]}</p>}
            </div>
          </article>;
        })}
        {multi && !reviewing && !approved && <p className={styles.caption}>Додано рецепти для {attached} з {required.length} препаратів</p>}
        <div className={styles.navigation}>
          <Link href={request && returnToDetails ? `/profile?tab=orders&request=${request.id}` : request || reviewing || approved || needsPhoto ? '/profile?tab=orders' : '/cart'}>{request || reviewing || approved || needsPhoto ? '← До моїх замовлень' : multi ? '← До кошика' : '← Повернутися'}</Link>
          {approved ? <Link className={styles.primary} href={request ? `/checkout?request=${request.id}` : '/checkout'}>Перейти до оформлення</Link> : !reviewing && (attached > 0 || multi) && <button className={styles.primary} disabled={!canSubmit} onClick={submitVerification}>Надіслати на перевірку</button>}
        </div>
      </section>
      <aside className={styles.summary} aria-label="Ваше замовлення"><h2>Ваше замовлення</h2><dl>
        {items.map(item => <div key={item._id}><dt>{item.name} × {item.quantity}</dt><dd>{money(item.price * item.quantity)}</dd></div>)}
        <div className={styles.divider}><dt className={styles.muted}>Товари</dt><dd>{money(total)}</dd></div><div><dt className={styles.muted}>Отримання</dt><dd>Безкоштовно</dd></div>
      </dl><div className={styles.total}><span>До сплати</span><strong>{money(total)}</strong></div></aside>
    </div>
  </div>;
}
