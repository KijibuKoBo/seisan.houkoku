import { KijiItem } from '../types';
import { apiSet, apiSetStrict } from './api';

const KEY = 'matsunaga_kiji_items';

function load(): { [ym: string]: KijiItem[] } {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(data: { [ym: string]: KijiItem[] }): void {
  const json = JSON.stringify(data);
  localStorage.setItem(KEY, json);
  apiSet(KEY, json);
}

function key(year: number, month: number): string {
  return `${year}_${month}`;
}

export function saveKijiItems(year: number, month: number, items: KijiItem[]): void {
  const data = load();
  data[key(year, month)] = items;
  save(data);
}

// ZIPインポート完了後など、全データを確実にサーバーへ送信する（失敗時は例外）
export async function pushKijiToServer(): Promise<void> {
  const json = localStorage.getItem(KEY);
  if (json) await apiSetStrict(KEY, json);
}

function normalizeCategory(item: KijiItem): KijiItem {
  if (item.category) return item;
  return { ...item, category: 'その他' };
}

export function loadKijiItems(year: number, month: number): KijiItem[] {
  return (load()[key(year, month)] ?? []).map(normalizeCategory);
}

export function loadAllKijiItems(): KijiItem[] {
  const data = load();
  return Object.values(data).flat().map(normalizeCategory);
}

export function getAvailableKijiYears(): number[] {
  const data = load();
  const years = new Set(Object.keys(data).map(k => parseInt(k.split('_')[0])));
  return [...years].sort((a, b) => b - a);
}

// カテゴリーを略称に正規化するマップ（起動時に実行）
const CATEGORY_MIGRATION: Record<string, string> = {
  'Ca':            'Co',
  'Continue':      'Co',
  'Master Piece':  'MP',
  'MasterPiece':   'MP',
  'Petit.Continue':'PC',
  'Petit Continue':'PC',
  'Petit':         'PC',
  '仏':            '仏壇',
  '特':            '特注',
};

export function migrateCategories(): void {
  const data = load();
  let changed = false;
  for (const ym of Object.keys(data)) {
    data[ym] = data[ym].map(item => {
      const mapped = CATEGORY_MIGRATION[item.category];
      if (mapped) { changed = true; return { ...item, category: mapped }; }
      return item;
    });
  }
  if (changed) save(data);
}

// Rename by exact code+category+name (used from ManageTab)
export function renameKijiItems(
  oldCode: string, oldCategory: string, oldName: string,
  newCategory: string, newName: string
): void {
  const data = load();
  for (const ym of Object.keys(data)) {
    data[ym] = data[ym].map(item =>
      item.code === oldCode && item.category === oldCategory && item.name === oldName
        ? { ...item, category: newCategory, name: newName }
        : item
    );
  }
  save(data);
}

// Rename by category+name across ALL months (ignores lot number — merges all)
export function renameKijiItemsByName(
  oldCategory: string, oldName: string,
  newCategory: string, newName: string
): void {
  const data = load();
  for (const ym of Object.keys(data)) {
    data[ym] = data[ym].map(item =>
      item.category === oldCategory && item.name === oldName
        ? { ...item, category: newCategory, name: newName }
        : item
    );
  }
  save(data);
}
