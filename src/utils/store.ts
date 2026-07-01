import { YearStore, MonthData, SectionData, emptyMonth } from '../types';
import { apiSet, apiSetStrict, apiGetStrict } from './api';

const KEY = 'matsunaga_seisan';

export function loadStore(): YearStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStore(store: YearStore): void {
  const json = JSON.stringify(store);
  localStorage.setItem(KEY, json);
  apiSet(KEY, json);
}

// 保存後にサーバー反映を確実にする（失敗時は例外）
export async function pushStoreToServer(): Promise<void> {
  const json = localStorage.getItem(KEY);
  if (json) await apiSetStrict(KEY, json);
}

// 部門（塗装・まとめ・木地）の指定年の各月データだけを安全に更新する。
// 他部門の同時編集を上書きしないよう、サーバーの最新をベースにマージしてから保存する。
export async function saveDeptMonths(
  year: number,
  dept: 'tosou' | 'matome' | 'kiji',
  months: Record<number, SectionData>
): Promise<YearStore> {
  let base: YearStore;
  try {
    const serverJson = await apiGetStrict(KEY);
    base = serverJson ? JSON.parse(serverJson) : loadStore();
  } catch {
    // サーバー取得に失敗したらローカルをベースにする
    base = loadStore();
  }
  const next: YearStore = { ...base };
  next[year] = { ...(next[year] ?? {}) };
  for (const [m, sec] of Object.entries(months)) {
    const mn = Number(m);
    const existing = next[year][mn] ?? emptyMonth(mn);
    next[year][mn] = { ...existing, [dept]: { count: sec.count, amount: sec.amount } };
  }
  const json = JSON.stringify(next);
  localStorage.setItem(KEY, json);
  await apiSetStrict(KEY, json);
  return next;
}

export function setMonthData(store: YearStore, year: number, month: number, data: MonthData): YearStore {
  const next = { ...store };
  if (!next[year]) next[year] = {};
  next[year] = { ...next[year], [month]: data };
  return next;
}
