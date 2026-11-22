'use client';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import type { DemoCard } from '@/lib/demo-payment';
import styles from './Checkout.module.css';

export function DemoCardFields({ value, onChange, errors, disabled }: {
  value: DemoCard; onChange: (value: DemoCard) => void;
  errors: Partial<Record<keyof DemoCard, string>>; disabled: boolean;
}) {
  const id = useId();
  function field(key: keyof DemoCard, label: string, placeholder: string, length: number) {
    return <div className={styles.field}><label htmlFor={id + key}>{label}</label><Input
      id={id + key} data-card-field={key} type={key === 'cvv' ? 'password' : 'text'} inputMode="numeric" autoComplete="off" spellCheck={false}
      className={styles.input} value={value[key]} placeholder={placeholder} maxLength={length} disabled={disabled} aria-required="true"
      aria-invalid={!!errors[key]} aria-describedby={id + key + '-error ' + id + '-hint'}
      onChange={event => {
        const digits = event.target.value.replace(/\D/g, '');
        const formatted = key === 'number' ? digits.slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ') : key === 'expiry' ? digits.slice(0, 4).replace(/^(\d{2})(\d)/, '$1 / $2') : digits.slice(0, 3);
        onChange({ ...value, [key]: formatted });
      }} /><span id={id + key + '-error'} className={styles.fieldError}>{errors[key] || ''}</span></div>;
  }
  return <section className={styles.card} aria-labelledby={id + '-title'}>
    <h2 id={id + '-title'}>Оплата карткою</h2>
    {field('number', 'Номер картки *', '0000 0000 0000 0000', 19)}
    <div className={styles.twoColumns}>{field('expiry', 'Термін дії *', 'ММ / РР', 7)}{field('cvv', 'CVV / CVC *', 'CVV', 3)}</div>
    <p id={id + '-hint'} className={styles.demoHint}>Демонстраційна оплата — кошти не списуються. Тестова картка 4242 4242 4242 4242 — успіх; 4000 0000 0000 0002 — помилка. Майбутній термін дії та CVV 123. Справжні дані картки не вводьте.</p>
  </section>;
}
