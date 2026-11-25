import type { Medication } from './types';
import { dosageForms } from './catalog';
export const money = (value: number) => `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value)} грн`;
export const unitPrice = (med: Medication) => med.packSize && med.packSize > 0 ? `${money(med.price / med.packSize)} / ${med.dosageForm === 'tablets' ? 'табл.' : med.dosageForm === 'capsules' ? 'капс.' : 'од.'}` : 'Не вказано';
export const prescriptionLabel = (med: Medication) => med.requiresPrescription === true ? 'Потрібен рецепт' : med.requiresPrescription === false ? 'Без рецепта' : 'Не вказано';
export function productFacts(med: Medication): [string, string][] {
  return [['Діючі речовини', med.activeIngredient || 'Не вказано'], ['Дозування', med.dosage || 'Не вказано'], ['Лікарська форма', dosageForms.find(form => form.value === med.dosageForm)?.label || 'Не вказано'], ['Кількість в упаковці', med.packSize ? String(med.packSize) : 'Не вказано'], ['Виробник', med.manufacturer || 'Не вказано'], ['Країна виробництва', med.country || 'Не вказано'], ['Категорія відпуску', prescriptionLabel(med)], ['Вікові обмеження', med.ageGroup || 'Не вказано'], ['Код АТХ', med.atcCode || 'Не вказано']];
}
