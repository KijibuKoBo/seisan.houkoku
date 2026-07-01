import { YearStore, MonthData, SectionData, SalesData, emptyMonth, emptySales } from '../types';
import { apiSet, apiSetStrict, apiGetStrict } from './api';

type SalesMemo = Partial<Record<keyof SalesData, string>>;

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

// 元に戻す用バックアップのキー（部門ごと・サーバー保存＝どの端末からでも戻せる）
const UNDO_PREFIX = 'matsunaga_undo_';

interface UndoBackup {
  year: number;
  months: Record<number, SectionData>;  // 保存直前（=1つ前）の値
  ts: string;
}

// 部門（塗装・まとめ・木地）の指定年の各月データだけを安全に更新する。
// 他部門の同時編集を上書きしないよう、サーバーの最新をベースにマージしてから保存する。
// 保存直前の状態を「元に戻す」用にサーバーへ退避する。
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

  // 保存前の値を退避（変更する各月について）
  const prevSnap: Record<number, SectionData> = {};
  for (const m of Object.keys(months)) {
    const mn = Number(m);
    const sec = base[year]?.[mn]?.[dept];
    prevSnap[mn] = { count: sec?.count ?? 0, amount: sec?.amount ?? 0 };
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

  // 戻す用バックアップをサーバーへ（失敗しても保存自体は成功扱い）
  const backup: UndoBackup = { year, months: prevSnap, ts: new Date().toISOString() };
  try { await apiSetStrict(UNDO_PREFIX + dept, JSON.stringify(backup)); } catch { /* best effort */ }

  return next;
}

// 戻せるバックアップの有無を確認（どの端末からでもサーバーを見る）
export async function getUndoInfo(
  dept: 'tosou' | 'matome' | 'kiji' | 'eigyou'
): Promise<{ year: number; ts: string } | null> {
  try {
    const json = await apiGetStrict(UNDO_PREFIX + dept);
    if (!json) return null;
    const p = JSON.parse(json) as { year: number; ts: string };
    return { year: p.year, ts: p.ts };
  } catch {
    return null;
  }
}

// ── 営業（月ごと・6項目＋備考）の保存と元に戻す ──────────────────────────
interface SalesUndoBackup {
  year: number;
  month: number;
  sales: SalesData;
  salesMemo: SalesMemo;
  ts: string;
}

// 指定年月の営業データ（sales と salesMemo）だけを安全に更新する。
// サーバーの最新をベースにマージし、保存直前の状態を元に戻す用に退避する。
export async function saveSalesMonth(
  year: number, month: number, sales: SalesData, salesMemo: SalesMemo
): Promise<YearStore> {
  let base: YearStore;
  try {
    const serverJson = await apiGetStrict(KEY);
    base = serverJson ? JSON.parse(serverJson) : loadStore();
  } catch {
    base = loadStore();
  }

  const prev = base[year]?.[month];
  const backup: SalesUndoBackup = {
    year, month,
    sales: prev?.sales ?? emptySales(),
    salesMemo: prev?.salesMemo ?? {},
    ts: new Date().toISOString(),
  };

  const next: YearStore = { ...base };
  next[year] = { ...(next[year] ?? {}) };
  const existing = next[year][month] ?? emptyMonth(month);
  next[year][month] = { ...existing, sales: { ...sales }, salesMemo: { ...salesMemo } };

  const json = JSON.stringify(next);
  localStorage.setItem(KEY, json);
  await apiSetStrict(KEY, json);

  try { await apiSetStrict(UNDO_PREFIX + 'eigyou', JSON.stringify(backup)); } catch { /* best effort */ }
  return next;
}

// 直前の営業保存を1回だけ取り消す。
export async function undoSales(): Promise<YearStore | null> {
  const json = await apiGetStrict(UNDO_PREFIX + 'eigyou');
  if (!json) return null;
  const b = JSON.parse(json) as SalesUndoBackup;

  let base: YearStore;
  try {
    const serverJson = await apiGetStrict(KEY);
    base = serverJson ? JSON.parse(serverJson) : loadStore();
  } catch {
    base = loadStore();
  }

  const next: YearStore = { ...base };
  next[b.year] = { ...(next[b.year] ?? {}) };
  const existing = next[b.year][b.month] ?? emptyMonth(b.month);
  next[b.year][b.month] = { ...existing, sales: { ...b.sales }, salesMemo: { ...b.salesMemo } };

  const storeJson = JSON.stringify(next);
  localStorage.setItem(KEY, storeJson);
  await apiSetStrict(KEY, storeJson);

  try { await apiSetStrict(UNDO_PREFIX + 'eigyou', ''); } catch { /* best effort */ }
  return next;
}

// 直前の保存を1回だけ取り消す。戻したらバックアップは消費される（連続で戻せない）。
export async function undoDept(dept: 'tosou' | 'matome' | 'kiji'): Promise<YearStore | null> {
  const json = await apiGetStrict(UNDO_PREFIX + dept);
  if (!json) return null;
  const backup = JSON.parse(json) as UndoBackup;

  let base: YearStore;
  try {
    const serverJson = await apiGetStrict(KEY);
    base = serverJson ? JSON.parse(serverJson) : loadStore();
  } catch {
    base = loadStore();
  }

  const next: YearStore = { ...base };
  next[backup.year] = { ...(next[backup.year] ?? {}) };
  for (const [m, sec] of Object.entries(backup.months)) {
    const mn = Number(m);
    const existing = next[backup.year][mn] ?? emptyMonth(mn);
    next[backup.year][mn] = { ...existing, [dept]: { count: sec.count, amount: sec.amount } };
  }
  const storeJson = JSON.stringify(next);
  localStorage.setItem(KEY, storeJson);
  await apiSetStrict(KEY, storeJson);

  // バックアップを消費（空にする＝もう戻せない）
  try { await apiSetStrict(UNDO_PREFIX + dept, ''); } catch { /* best effort */ }

  return next;
}

export function setMonthData(store: YearStore, year: number, month: number, data: MonthData): YearStore {
  const next = { ...store };
  if (!next[year]) next[year] = {};
  next[year] = { ...next[year], [month]: data };
  return next;
}
