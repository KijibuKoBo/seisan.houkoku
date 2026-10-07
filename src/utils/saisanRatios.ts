import { apiSet, apiSetStrict, apiGetStrict } from './api';

// 手間/材料が未登録の品目について、手間代の割合（%）を品名ごとに記憶する。
// キー = "カテゴリー|品名"、値 = 手間代の割合（0-100）
const KEY = 'matsunaga_saisan_ratios';

export type RatioMap = Record<string, number>;

export function loadSaisanRatios(): RatioMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveSaisanRatios(map: RatioMap): void {
  const json = JSON.stringify(map);
  localStorage.setItem(KEY, json);
  apiSet(KEY, json);
}

export async function pushSaisanRatios(): Promise<void> {
  const json = localStorage.getItem(KEY);
  if (json) await apiSetStrict(KEY, json);
}

export async function syncSaisanRatios(): Promise<void> {
  try {
    const json = await apiGetStrict(KEY);
    if (json) localStorage.setItem(KEY, json);
  } catch { /* ignore */ }
}

export function ratioKey(category: string, name: string): string {
  return `${category || 'その他'}|${name}`;
}
