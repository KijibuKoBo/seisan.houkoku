import { YearStore, MonthData } from '../types';
import { apiSet, apiSetStrict } from './api';

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

export function setMonthData(store: YearStore, year: number, month: number, data: MonthData): YearStore {
  const next = { ...store };
  if (!next[year]) next[year] = {};
  next[year] = { ...next[year], [month]: data };
  return next;
}
