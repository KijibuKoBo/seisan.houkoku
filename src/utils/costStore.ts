import { ProductDef, PRODUCT_LIST, lookupLaborMaterial } from './productList';
import { apiSet, apiSetStrict } from './api';

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

// 保存後にサーバー反映を確実にする（失敗時は例外）
export async function pushCostDbToServer(): Promise<void> {
  const json = localStorage.getItem(KEY);
  if (json) await apiSetStrict(KEY, json);
}

export function seedCostDatabaseIfEmpty(): void {
  if (!localStorage.getItem(KEY)) {
    saveCostDatabase(PRODUCT_LIST);
  }
}

// 既存の原価データに手間代・材料代が無ければ、マスターから初期値を補完する（マイグレーション）
// 既存の unitPrice（単価）は変更しない。
export function enrichCostDatabase(): void {
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  let list: ProductDef[];
  try { list = JSON.parse(raw); } catch { return; }
  let changed = false;
  const next = list.map(p => {
    if (p.labor != null && p.material != null) return p;
    const lm = lookupLaborMaterial(p.category, p.name);
    if (!lm) return p;
    const merged = { ...p };
    if (merged.labor == null && lm.labor != null) { merged.labor = lm.labor; changed = true; }
    if (merged.material == null && lm.material != null) { merged.material = lm.material; changed = true; }
    return merged;
  });
  if (changed) saveCostDatabase(next);
}

// マスター(PRODUCT_LIST)にあって原価DBに無い製品を追加する（マイグレーション）
// 既存の製品・ユーザー追加の製品はそのまま残す。
export function addMissingProducts(): void {
  const raw = localStorage.getItem(KEY);
  if (!raw) return; // 空なら seed が処理
  let list: ProductDef[];
  try { list = JSON.parse(raw); } catch { return; }
  const have = new Set(list.map(p => `${p.category}|${p.name}`));
  let changed = false;
  for (const p of PRODUCT_LIST) {
    const k = `${p.category}|${p.name}`;
    if (!have.has(k)) { list.push({ ...p }); have.add(k); changed = true; }
  }
  if (changed) saveCostDatabase(list);
}
