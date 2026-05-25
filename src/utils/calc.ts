import { MonthData, SalesData, YearStore } from '../types';

export function salesTotal(s: SalesData): number {
  return s.otsuka + s.takumi + s.butsudan + s.ippanten + s.showroom + s.bukken;
}

export function yearTotal(store: YearStore, year: number, getter: (m: MonthData) => number): number {
  const months = store[year] ?? {};
  return Object.values(months).reduce((sum, m) => sum + getter(m), 0);
}

export function monthsWithData(store: YearStore, year: number, getter: (m: MonthData) => number): number {
  const months = store[year] ?? {};
  return Object.values(months).filter(m => getter(m) > 0).length;
}

export function yearAvg(store: YearStore, year: number, getter: (m: MonthData) => number): number {
  const total = yearTotal(store, year, getter);
  const count = monthsWithData(store, year, getter);
  return count > 0 ? Math.round(total / count) : 0;
}

export function yoyRatio(store: YearStore, year: number, getter: (m: MonthData) => number): number | null {
  const cur = yearTotal(store, year, getter);
  const prev = yearTotal(store, year - 1, getter);
  if (prev === 0) return null;
  return Math.round((cur / prev) * 100);
}

export function momRatio(store: YearStore, year: number, month: number, getter: (m: MonthData) => number): number | null {
  const cur = store[year]?.[month] ? getter(store[year][month]) : 0;
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
  const prev = store[prevYear]?.[prevMonth] ? getter(store[prevYear][prevMonth]) : 0;
  if (prev === 0) return null;
  return Math.round((cur / prev) * 100);
}

export function formatAmount(n: number): string {
  if (n === 0) return '0';
  return n.toLocaleString('ja-JP');
}

export function formatRatio(r: number | null): string {
  if (r === null) return '—';
  return `${r}%`;
}

export const GETTERS = {
  salesTotal: (m: MonthData) => salesTotal(m.sales),
  otsuka: (m: MonthData) => m.sales.otsuka,
  takumi: (m: MonthData) => m.sales.takumi,
  butsudan: (m: MonthData) => m.sales.butsudan,
  ippanten: (m: MonthData) => m.sales.ippanten,
  showroom: (m: MonthData) => m.sales.showroom,
  bukken: (m: MonthData) => m.sales.bukken,
  kijiAmount: (m: MonthData) => m.kiji.amount,
  kijiCount: (m: MonthData) => m.kiji.count,
  tosouAmount: (m: MonthData) => m.tosou.amount,
  tosouCount: (m: MonthData) => m.tosou.count,
  matomeAmount: (m: MonthData) => m.matome.amount,
  matomeCount: (m: MonthData) => m.matome.count,
} as const;
