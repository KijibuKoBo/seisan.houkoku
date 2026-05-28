import { ProductDef, PRODUCT_LIST } from './productList';
import { apiSet } from './api';

const KEY = 'matsunaga_cost_db';

export function loadCostDatabase(): ProductDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : PRODUCT_LIST;
  } catch { return PRODUCT_LIST; }
}

export function saveCostDatabase(list: ProductDef[]): void {
  const json = JSON.stringify(list);
  localStorage.setItem(KEY, json);
  apiSet(KEY, json);
}

export function seedCostDatabaseIfEmpty(): void {
  if (!localStorage.getItem(KEY)) {
    saveCostDatabase(PRODUCT_LIST);
  }
}
