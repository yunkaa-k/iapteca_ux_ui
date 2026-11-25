export type AuthFieldErrors = { email?: string; password?: string; consent?: string };

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function validateEmailAuth(email: string, password: string, registration: boolean, consent = false): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (!validEmail(normalizeEmail(email))) errors.email = 'Введіть коректну електронну адресу.';
  if (!password) errors.password = 'Введіть пароль.';
  else if (registration && password.length < 8) errors.password = 'Пароль має містити щонайменше 8 символів.';
  else if (new TextEncoder().encode(password).length > 72) errors.password = 'Пароль має бути не довшим за 72 байти.';
  if (registration && !consent) errors.consent = 'Підтвердьте згоду з політикою конфіденційності.';
  return errors;
}
