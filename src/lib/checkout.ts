export const DEMO_PHARMACIES = [
  { id: 'center', name: 'iApteca · Центр', address: 'вул. Центральна, 12', x: 381, y: 62 },
  { id: 'myronosytska', name: 'iApteca · Мироносицька', address: '', x: 459, y: 117 },
  { id: 'kultury', name: 'iApteca · Культури', address: '', x: 94, y: 117 },
] as const;
export interface CheckoutForm {
  name: string; phone: string; email: string;
  receiving: '' | 'pickup' | 'courier'; pharmacyId: string; city: string; address: string;
  payment: '' | 'on-receipt' | 'online-after-confirmation' | 'online';
}
export interface CheckoutDetails {
  contact: { name: string; phone: string; email?: string };
  delivery: { method: 'pickup' | 'courier'; pharmacyId?: string; pharmacyName?: string; city?: string; address?: string; fee: number };
  payment: 'on-receipt' | 'online-after-confirmation' | 'online';
  paymentMode?: 'demo';
  demoPaymentStatus?: 'paid' | 'failed';
}
export const emptyCheckout: CheckoutForm = { name: '', phone: '', email: '', receiving: '', pharmacyId: '', city: '', address: '', payment: '' };
export type CheckoutErrors = Partial<Record<keyof CheckoutForm, string>>;
export const normalizePhone = (value: string) => value.replace(/[\s()\-]/g, '').replace(/^0(?=\d{9}$)/, '+380');
export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (form.name.trim().length < 2 || form.name.trim().length > 100) errors.name = 'Укажіть ім’я та прізвище';
  if (!/^\+380\d{9}$/.test(normalizePhone(form.phone))) errors.phone = 'Укажіть коректний номер телефону';
  if (form.email && (form.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))) errors.email = 'Укажіть коректну електронну адресу';
  if (!['pickup', 'courier'].includes(form.receiving)) errors.receiving = 'Оберіть спосіб отримання.';
  if (form.receiving !== 'courier' && !DEMO_PHARMACIES.some(p => p.id === form.pharmacyId)) errors.pharmacyId = 'Оберіть аптеку для самовивозу.';
  if (form.receiving === 'courier') {
    if (form.city.trim().length < 2 || form.city.length > 100) errors.city = 'Укажіть місто';
    if (form.address.trim().length < 5 || form.address.length > 200) errors.address = 'Укажіть вулицю, будинок і квартиру';
  }
  if (!['on-receipt', 'online-after-confirmation', 'online'].includes(form.payment)) errors.payment = 'Оберіть спосіб оплати.';
  return errors;
}
export function checkoutDetails(form: CheckoutForm, outcome?: import('./demo-payment').DemoPaymentOutcome): CheckoutDetails {
  const pharmacy = DEMO_PHARMACIES.find(p => p.id === form.pharmacyId);
  return {
    contact: { name: form.name.trim(), phone: normalizePhone(form.phone), ...(form.email.trim() ? { email: form.email.trim().toLowerCase() } : {}) },
    delivery: form.receiving === 'courier' ? { method: 'courier', city: form.city.trim(), address: form.address.trim(), fee: 59 } : { method: 'pickup', pharmacyId: pharmacy!.id, pharmacyName: pharmacy!.name, address: pharmacy!.address, fee: 0 },
    payment: form.payment as CheckoutDetails['payment'],
    ...(form.payment === 'online' && outcome ? { paymentMode: 'demo' as const, demoPaymentStatus: outcome === 'success' ? 'paid' as const : 'failed' as const } : {}),
  };
}
export function parseCheckout(value: unknown): { details?: CheckoutDetails; errors?: CheckoutErrors } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { errors: { name: 'Заповніть контактні дані.' } };
  const source = value as Record<string, unknown>;
  const form = Object.fromEntries(Object.keys(emptyCheckout).map(key => [key, typeof source[key] === 'string' ? source[key] : ''])) as unknown as CheckoutForm;
  const errors = validateCheckout(form);
  const outcome = source.demoPaymentOutcome;
  if (form.payment === 'online' && outcome !== 'success' && outcome !== 'failure') errors.payment = 'Підтвердьте демонстраційну оплату.';
  return Object.keys(errors).length ? { errors } : { details: checkoutDetails(form, outcome === 'success' || outcome === 'failure' ? outcome : undefined) };
}
export const orderNumber = (id: string, createdAt: string) => `IA-${new Date(createdAt).getFullYear()}-${id.slice(-8).toUpperCase()}`;
