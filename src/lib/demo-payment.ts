export type DemoPaymentOutcome = 'success' | 'failure';
export interface DemoCard { number: string; expiry: string; cvv: string; }
export const emptyDemoCard: DemoCard = { number: '', expiry: '', cvv: '' };
export function demoPaymentOutcome(number: string): DemoPaymentOutcome | undefined {
  const digits = number.replace(/\s/g, '');
  return digits === '4242424242424242' ? 'success' : digits === '4000000000000002' ? 'failure' : undefined;
}
export function validateDemoCard(card: DemoCard, now = new Date()): Partial<Record<keyof DemoCard, string>> {
  const errors: Partial<Record<keyof DemoCard, string>> = {};
  if (!demoPaymentOutcome(card.number)) errors.number = 'Використайте тестову картку з підказки нижче.';
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry);
  const month = match ? Number(match[1]) : 0;
  const year = match ? 2000 + Number(match[2]) : 0;
  if (month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = 'Укажіть майбутній термін у форматі ММ / РР.';
  if (!/^\d{3}$/.test(card.cvv)) errors.cvv = 'Укажіть 3 тестові цифри.';
  return errors;
}
