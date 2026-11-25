import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDetails } from '@/components/ProductDetails';
import { productFacts, prescriptionLabel, unitPrice } from '@/lib/product';
import { useCartStore } from '@/lib/store/cartStore';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import type { Medication } from '@/lib/types';
import { productInstruction } from '@/lib/product-instructions';
import catalogFacts from '@/lib/data/catalog-facts.json';
vi.mock('@/lib/useHydrated', () => ({ useHydrated: () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
const med: Medication = { _id: 'test-product', name: 'Демонстраційний товар', description: 'Тестові дані', price: 100, stock: 2, category: 'Test', manufacturer: 'Test' };
beforeEach(() => { useCartStore.setState({ items: [] }); useFavoritesStore.setState({ items: [] }); });
afterEach(cleanup);
describe('product details', () => {
  it('shows precise form and package details without treating ointment grams as unit count', () => {
    const ointment: Medication = { ...med, ...catalogFacts['Метилурацил з мірамістином 30 г'].facts, name: 'Метилурацил з мірамістином 30 г', dosageForm: 'ointments' };
    expect(productFacts(ointment)).toContainEqual(['Лікарська форма', 'Мазь']);
    expect(productFacts(ointment)).toContainEqual(['Кількість в упаковці', '1 туба, 30 г']);
    expect(unitPrice(ointment)).toBe('Не вказано');
    expect(productInstruction(ointment)?.url).toBe('https://darnytsia.ua/catalog/metiluratsil-z-miramistinom');
  });
  it('keeps Nurofen and Forte characteristics and instruction links separate', () => {
    const standard = { ...med, name: 'Нурофен 200 мг №24', ...catalogFacts['Нурофен 200 мг №24'].facts };
    const forte = { ...med, name: 'Нурофен Форте №12', ...catalogFacts['Нурофен Форте №12'].facts };
    expect(productFacts(standard)).toContainEqual(['Дозування', '200 мг']);
    expect(productFacts(forte)).toContainEqual(['Дозування', '400 мг']);
    expect(standard.ageGroup).not.toBe(forte.ageGroup);
    expect(productInstruction(standard)?.url).not.toBe(productInstruction(forte)?.url);
  });
  it('provides the identified amoxicillin manufacturer and its own capsule instruction', () => {
    const amoxicillin = { ...med, name: 'Амоксицилін 500 мг №10', ...catalogFacts['Амоксицилін 500 мг №10'].facts };
    expect(productFacts(amoxicillin)).toContainEqual(['Виробник', 'Antibiotice S.A.']);
    expect(productFacts(amoxicillin)).toContainEqual(['Країна виробництва', 'Румунія']);
    expect(productInstruction(amoxicillin)?.url).toBe('https://tabletki.ua/uk/Амоксициллин/1044556/');
  });
  it('opens the matching full instruction with source attribution and safe external-link behavior', () => {
    render(<ProductDetails medication={{ ...med, name: 'Нурофен 200 мг №24', dosage: '200 мг' }} alternatives={[]} />);
    fireEvent.click(screen.getByText('Інструкція', { selector: 'summary' }));
    const link = screen.getByRole('link', { name: /Відкрити повну інструкцію/ });
    expect(link).toHaveAttribute('href', 'https://tabletki.ua/uk/Nurofen/15973/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('heading', { name: 'Коротко про препарат' })).toBeInTheDocument();
    expect(screen.getByText('В одній таблетці — 200 мг ібупрофену.')).toBeInTheDocument();
    expect(screen.getByText('Джерело: опублікована інструкція для обраного лікарського засобу.')).toBeInTheDocument();
  });
  it('uses a separate manufacturer instruction for another medicine', () => {
    render(<ProductDetails medication={{ ...med, name: 'Валідол-Дарниця 60 мг №10', dosage: '60 мг' }} alternatives={[]} />);
    fireEvent.click(screen.getByText('Інструкція', { selector: 'summary' }));
    expect(screen.getByRole('link', { name: /Відкрити повну інструкцію/ })).toHaveAttribute('href', 'https://darnytsia.ua/catalog/validol-darnitsya');
    expect(screen.queryByText('В одній таблетці — 200 мг ібупрофену.')).not.toBeInTheDocument();
  });
  it('does not substitute an instruction for an unknown product, changed dose or a bundle', () => {
    expect(productInstruction(med)).toBeUndefined();
    expect(productInstruction({ ...med, name: 'Нурофен 200 мг №24', dosage: '400 мг' })).toBeUndefined();
    expect(productInstruction({ ...med, name: 'Нурофен 200 мг №24', dosage: '200 мг', kind: 'bundle' })).toBeUndefined();
    render(<ProductDetails medication={med} alternatives={[]} />);
    fireEvent.click(screen.getByText('Інструкція', { selector: 'summary' }));
    expect(screen.queryByRole('link', { name: /Відкрити повну інструкцію/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Посилання на інструкцію для цього препарату ще не додано/)).toBeInTheDocument();
  });
  it('includes pickup, courier and payment explanations in the delivery accordion', () => {
    render(<ProductDetails medication={med} alternatives={[]} />);
    const toggle = screen.getByText('Доставка та оплата', { selector: 'summary' });
    fireEvent.click(toggle);
    const accordion = toggle.closest('details')!;
    expect(accordion).toHaveTextContent('Самовивіз з аптеки');
    expect(accordion).toHaveTextContent('Під час оформлення оберіть на мапі аптеку з підтвердженою наявністю всіх товарів із кошика.');
    expect(accordion).toHaveTextContent('Вкажіть адресу під час оформлення, щоб перевірити доступність доставки й дізнатися її вартість.');
    expect(accordion).toHaveTextContent('Доступний спосіб оплати та підсумкову суму буде показано перед підтвердженням замовлення.');
  });
  it('keeps dose notes and per-unit prices inside their respective alternative cards', () => {
    render(<ProductDetails medication={{ ...med, dosage: '200 мг' }} alternatives={[
      { ...med, _id: 'same', name: 'Та сама тестова доза', dosage: '200 мг', dosageForm: 'tablets', packSize: 20, price: 79 },
      { ...med, _id: 'different', name: 'Інша тестова доза', dosage: '400 мг', dosageForm: 'tablets', packSize: 12, price: 168 },
    ]} />);
    const [same, different] = screen.getAllByRole('article');
    expect(within(same).getByText('Та сама доза · 200 мг')).toBeInTheDocument();
    expect(within(same).getByText('3,95 грн / табл.')).toBeInTheDocument();
    expect(within(different).getByText('Інше дозування · 400 мг')).toBeInTheDocument();
    expect(within(different).getByText('14,00 грн / табл.')).toBeInTheDocument();
    fireEvent.click(within(different).getByRole('button', { name: 'Порівняти' }));
    expect(within(different).getByRole('button', { name: 'Прибрати' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('table')).toHaveTextContent('Інша тестова доза');
    expect(within(same).getByRole('button', { name: 'Порівняти' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('does not guess dose equivalence or unit price when data is missing', () => {
    render(<ProductDetails medication={med} alternatives={[{ ...med, _id: 'unknown', dosage: '400 мг', packSize: 0 }]} />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('Дозування потребує уточнення')).toBeInTheDocument();
    expect(within(card).getByText('Ціну за одиницю не вказано')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Infinity');
  });
  it('does not infer prescription, ingredient or dosage from a name', () => {
    expect(prescriptionLabel(med)).toBe('Не вказано');
    expect(productFacts(med)).toContainEqual(['Діючі речовини', 'Не вказано']);
    expect(unitPrice(med)).toBe('Не вказано');
    expect(unitPrice({ ...med, packSize: 20 })).toBe('5 грн / од.');
    expect(unitPrice({ ...med, packSize: 20, dosageForm: 'tablets' })).toBe('5 грн / табл.');
  });
  it('caps selected quantity and cart additions at available stock', () => {
    render(<ProductDetails medication={med} alternatives={[]} />);
    const plus = screen.getByRole('button', { name: 'Збільшити кількість' });
    fireEvent.click(plus); expect(plus).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Додати в кошик' }));
    expect(useCartStore.getState().items[0].quantity).toBe(2);
    expect(screen.getByRole('button', { name: 'Увесь доступний залишок уже в кошику' })).toBeDisabled();
  });
  it('shows stock-zero and empty alternatives without offering purchase', () => {
    render(<ProductDetails medication={{ ...med, stock: 0, manufacturer: 'Тестовий виробник', country: 'Україна' }} alternatives={[]} />);
    const purchase = screen.getByRole('region', { name: 'Придбати препарат' });
    expect(within(purchase).getByText('Виробник')).toBeInTheDocument();
    expect(within(purchase).getByText('Тестовий виробник · Україна')).toBeInTheDocument();
    expect(within(purchase).queryByText('Самовивіз')).not.toBeInTheDocument();
    expect(within(purchase).getByRole('button', { name: 'Додати до обраного' })).toHaveTextContent('');
    fireEvent.click(within(purchase).getByRole('button', { name: 'Додати до обраного' }));
    expect(within(purchase).getByRole('button', { name: 'Вилучити з обраного' })).toHaveAttribute('aria-pressed', 'true');
    expect(useFavoritesStore.getState().items[0].medication._id).toBe(med._id);
    expect(screen.getByText('Тестовий виробник')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Додати в кошик' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Переглянути аналоги' })).toHaveAttribute('href', '#product-alternatives');
    expect(screen.getByRole('heading', { name: 'Доступних аналогів поки немає' })).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Доступні аналоги та інші варіанти' });
    expect(section).toHaveTextContent('Спробуйте інший запит або поверніться до каталогу.');
    expect(within(section).getByRole('link', { name: 'Повернутися до каталогу' })).toHaveAttribute('href', '/catalog');
    expect(within(section).queryByRole('button', { name: 'Порівняти всі' })).not.toBeInTheDocument();
    expect(section).not.toHaveTextContent('Варіанти з іншим дозуванням');
  });
  it('compares an alternative with the current product and removes it again', () => {
    render(<ProductDetails medication={med} alternatives={[{ ...med, _id: 'other-product', name: 'Інший тестовий товар', price: 80 }]} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Порівняти' }));
    expect(screen.getByRole('table')).toHaveTextContent('Переглядаєте зараз');
    expect(screen.getByRole('table')).toHaveTextContent('80 грн');
    fireEvent.click(screen.getByRole('button', { name: 'Прибрати' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('keeps favorites working on the details screen', () => {
    render(<ProductDetails medication={med} alternatives={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Додати до обраного' }));
    expect(useFavoritesStore.getState().items[0].medication._id).toBe(med._id);
    fireEvent.click(screen.getByRole('button', { name: 'Вилучити з обраного' }));
    expect(useFavoritesStore.getState().items).toHaveLength(0);
  });
  it('closes a comparison, resets selection and returns focus to its entry point', () => {
    render(<ProductDetails medication={med} alternatives={[{ ...med, _id: 'alternative' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Порівняти всі' }));
    expect(screen.getByRole('table', { name: 'Порівняння препаратів' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Закрити порівняння' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Порівняти всі' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Порівняти' })).toHaveAttribute('aria-pressed', 'false');
  });
});
