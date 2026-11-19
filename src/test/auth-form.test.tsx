import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/components/AuthForm';
import { useAuthStore } from '@/lib/store/authStore';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('auth forms', () => {
  it.each(['login', 'register'] as const)('toggles password visibility without submitting the %s form or losing input', (mode) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthForm mode={mode} />);
    const password = screen.getByLabelText('Пароль');
    fireEvent.change(password, { target: { value: 'TestPassword123' } });
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Показати пароль' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('TestPassword123');
    expect(screen.getByRole('button', { name: 'Приховати пароль' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Приховати пароль' }));
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveValue('TestPassword123');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('offers email-only login without a phone switch', () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByLabelText('Електронна пошта')).toHaveAttribute('type', 'email');
    expect(screen.queryByRole('button', { name: /телефон/ })).not.toBeInTheDocument();
  });
  it('requires consent and focuses the first invalid field on registration', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthForm mode="register" />);
    const submit = screen.getByRole('button', { name: 'Зареєструватися' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submit);
    expect(screen.getByLabelText('Електронна пошта')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Електронна пошта')).toHaveFocus();
    expect(screen.getByText('Введіть коректну електронну адресу.')).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps entered data and shows the server login error without redirecting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Неправильна електронна пошта або пароль.' }) }));
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Електронна пошта'), { target: { value: 'person@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'incorrect' } });
    fireEvent.click(screen.getByRole('button', { name: /^Увійти$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Неправильна електронна пошта або пароль.');
    expect(screen.getByLabelText('Електронна пошта')).toHaveValue('person@example.test');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('creates an email account with consent, saves the session user and opens home', async () => {
    const user = { _id: 'user1', email: 'person@example.test', role: 'CUSTOMER', isBanned: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText('Електронна пошта'), { target: { value: ' PERSON@example.test ' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'StrongPassword123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Зареєструватися' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/'));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'person@example.test', password: 'StrongPassword123', consent: true });
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('shows a recoverable connection error and unlocks the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Електронна пошта'), { target: { value: 'person@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Увійти$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Немає зв’язку із сервером');
    expect(screen.getByRole('button', { name: /^Увійти$/ })).toBeEnabled();
  });
});
