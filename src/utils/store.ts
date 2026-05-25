import { YearStore, MonthData } from '../types';
import { apiSet } from './api';

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

export function getMonthData(store: YearStore, year: number, month: number): MonthData | null {
  return store[year]?.[month] ?? null;
}

export function setMonthData(store: YearStore, year: number, month: number, data: MonthData): YearStore {
  const next = { ...store };
  if (!next[year]) next[year] = {};
  next[year] = { ...next[year], [month]: data };
  return next;
}

export function getAvailableYears(store: YearStore): number[] {
  return Object.keys(store).map(Number).sort((a, b) => b - a);
}
