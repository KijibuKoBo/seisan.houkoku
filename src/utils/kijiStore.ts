import { KijiItem } from '../types';

const KEY = 'matsunaga_kiji_items';

function load(): { [ym: string]: KijiItem[] } {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(data: { [ym: string]: KijiItem[] }): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function key(year: number, month: number): string {
  return `${year}_${month}`;
}

export function saveKijiItems(year: number, month: number, items: KijiItem[]): void {
  const data = load();
  data[key(year, month)] = items;
  save(data);
}

export function loadKijiItems(year: number, month: number): KijiItem[] {
  return load()[key(year, month)] ?? [];
}

export function loadAllKijiItems(): KijiItem[] {
  const data = load();
  return Object.values(data).flat();
}

export function loadKijiItemsByYears(years: number[]): KijiItem[] {
  const data = load();
  return Object.entries(data)
    .filter(([k]) => years.includes(parseInt(k.split('_')[0])))
    .flatMap(([, items]) => items);
}

export function getAvailableKijiYears(): number[] {
  const data = load();
  const years = new Set(Object.keys(data).map(k => parseInt(k.split('_')[0])));
  return [...years].sort((a, b) => b - a);
}

// Rename category/name across ALL months in kijiStore
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
