import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileAccount } from '@/components/ProfileAccount';
const navigation = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
const user = { _id: 'owner', name: 'Олена', email: 'test@example.test', role: 'CUSTOMER' as const, isBanned: false };
const view = () => render(<ProfileAccount user={user}><p>Existing orders</p></ProfileAccount>);
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('account design feedback', () => {
  it('keeps account navigation in the URL when switching between profile and orders', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Мої замовлення' }));
    expect(navigation.push).toHaveBeenCalledWith('/profile?tab=orders');
    expect(screen.getByText('Existing orders')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Мій профіль' }));
    expect(navigation.push).toHaveBeenCalledWith('/profile');
  });
  it('shows a dismissible floating save notification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { ...user, name: 'Олена Коваль' } }) }));
    view(); fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }));
    fireEvent.change(screen.getByLabelText('Ім’я'), { target: { value: 'Олена' } });
    fireEvent.change(screen.getByLabelText('Прізвище'), { target: { value: 'Коваль' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Зміни збережено');
    fireEvent.click(screen.getByRole('button', { name: 'Закрити сповіщення' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('submits separate names, keeps email read-only and restores saved values after cancel', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { ...user, name: 'Марія Анна Коваль', firstName: 'Марія Анна', lastName: 'Коваль' } }) });
    vi.stubGlobal('fetch', fetchMock);
    view(); fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }));
    expect(screen.getByLabelText('Електронна пошта')).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText('Ім’я'), { target: { value: 'Марія Анна' } });
    fireEvent.change(screen.getByLabelText('Прізвище'), { target: { value: 'Коваль' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));
    await screen.findByRole('status');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ firstName: 'Марія Анна', lastName: 'Коваль', phone: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }));
    expect(screen.getByLabelText('Ім’я')).toHaveValue('Марія Анна');
    fireEvent.change(screen.getByLabelText('Ім’я'), { target: { value: 'Інше' } });
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }));
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }));
    expect(screen.getByLabelText('Ім’я')).toHaveValue('Марія Анна');
  });
  it('shows the server password error below its field and clears it when cancelling', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ fields: { currentPassword: 'Поточний пароль неправильний. Спробуйте ще раз.' } }) }));
    view(); fireEvent.click(screen.getByRole('button', { name: 'Змінити пароль' }));
    const current = screen.getByLabelText(/^Поточний пароль/, { selector: 'input' });
    fireEvent.change(current, { target: { value: 'Incorrect123' } });
    fireEvent.change(screen.getByLabelText(/^Новий пароль/, { selector: 'input' }), { target: { value: 'NewPassword123' } });
    fireEvent.change(screen.getByLabelText(/^Підтвердіть новий пароль/, { selector: 'input' }), { target: { value: 'NewPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти пароль' }));
    await waitFor(() => expect(current).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByRole('alert').id).toBe(current.getAttribute('aria-describedby'));
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('validates short and mismatched new passwords without sending a request', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    view(); fireEvent.click(screen.getByRole('button', { name: 'Змінити пароль' }));
    fireEvent.change(screen.getByLabelText(/^Поточний пароль/, { selector: 'input' }), { target: { value: 'Current123' } });
    fireEvent.change(screen.getByLabelText(/^Новий пароль/, { selector: 'input' }), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти пароль' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
