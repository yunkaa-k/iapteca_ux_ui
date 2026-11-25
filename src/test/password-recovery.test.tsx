import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordRecovery } from '@/components/PasswordRecovery';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function start() {
  fireEvent.change(screen.getByLabelText('Електронна пошта'), { target: { value: 'demo@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Надіслати код' }));
}
function fields(code = '482913', confirmation = 'OnlyDemo123!') {
  fireEvent.change(screen.getByLabelText('Шестизначний код'), { target: { value: code } });
  fireEvent.change(screen.getByLabelText('Новий пароль', { exact: true }), { target: { value: 'OnlyDemo123!' } });
  fireEvent.change(screen.getByLabelText('Підтвердіть новий пароль'), { target: { value: confirmation } });
}
describe('demonstration password recovery', () => {
  it('validates email without looking up accounts or sending mail', () => {
    render(<PasswordRecovery />);
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати код' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Введіть коректну електронну адресу.');
    expect(screen.getByLabelText('Електронна пошта')).toHaveFocus();
    start(); expect(screen.getByLabelText('Шестизначний код')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Зберегти пароль' })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects wrong codes and mismatched passwords, then clears fields at completion', () => {
    render(<PasswordRecovery />); start(); fields('111111', 'DifferentDemo123!');
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти пароль' }));
    expect(screen.getByText(/Неправильний код/)).toBeInTheDocument();
    expect(screen.getByText('Паролі не збігаються.')).toBeInTheDocument();
    fields(); fireEvent.click(screen.getByRole('button', { name: 'Зберегти пароль' }));
    expect(screen.getByRole('heading', { name: 'Пароль змінено' })).toBeInTheDocument();
    expect(screen.getByText(/Пароль вашого акаунта не змінено/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Повернутися до входу' })).toHaveAttribute('href', '/login');
    expect(screen.queryByLabelText('Новий пароль')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('toggles each password independently and resends the demo code without a request', () => {
    render(<PasswordRecovery />); start(); fields();
    fireEvent.click(screen.getByRole('button', { name: 'Показати: новий пароль' }));
    expect(screen.getByLabelText('Новий пароль', { exact: true })).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Підтвердіть новий пароль')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати код повторно' }));
    expect(screen.getByLabelText('Шестизначний код')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Лист не надсилається');
    expect(screen.getByRole('button', { name: 'Зберегти пароль' })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
