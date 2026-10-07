import { apiSet, apiSetStrict, apiGetStrict } from './api';

const KEY = 'matsunaga_saisan_settings';

export interface SaisanSettings {
  people: number;      // 工場の人数
  dailyWage: number;   // 日当（1人1日）
  hoursPerDay: number; // 1日の作業時間
  estimateRate: number; // 手間/材料が未登録の品目の、手間代の割合（%）
}

export const DEFAULT_SETTINGS: SaisanSettings = {
  people: 6,
  dailyWage: 20000,
  hoursPerDay: 8,
  estimateRate: 50,
};

export function loadSaisanSettings(): SaisanSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw);
    return {
      people: s.people ?? DEFAULT_SETTINGS.people,
      dailyWage: s.dailyWage ?? DEFAULT_SETTINGS.dailyWage,
      hoursPerDay: s.hoursPerDay ?? DEFAULT_SETTINGS.hoursPerDay,
      estimateRate: s.estimateRate ?? DEFAULT_SETTINGS.estimateRate,
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSaisanSettings(s: SaisanSettings): void {
  const json = JSON.stringify(s);
  localStorage.setItem(KEY, json);
  apiSet(KEY, json);
}

// サーバー保存を確実にする（失敗時は例外）
export async function pushSaisanSettings(): Promise<void> {
  const json = localStorage.getItem(KEY);
  if (json) await apiSetStrict(KEY, json);
}

// 起動時にサーバーから設定を取得（失敗時は無視）
export async function syncSaisanSettings(): Promise<void> {
  try {
    const json = await apiGetStrict(KEY);
    if (json) localStorage.setItem(KEY, json);
  } catch { /* ignore */ }
}
