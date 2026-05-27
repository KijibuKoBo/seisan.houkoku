const API = './api.php';
const TOKEN = 'mtsng_api_2024';

const SYNC_KEYS = ['matsunaga_seisan', 'matsunaga_kiji_items', 'matsunaga_users'] as const;

export async function apiSet(key: string, value: string): Promise<void> {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': TOKEN },
      body: JSON.stringify({ key, value }),
    });
  } catch { /* best effort — app still works via localStorage */ }
}

export async function logChange(user: string, year: number, month: number, summary: string): Promise<void> {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': TOKEN },
      body: JSON.stringify({ action: 'log', user, year, month, summary }),
    });
  } catch { /* best effort */ }
}

export async function getChangeLogs(): Promise<import('../types').ChangeLogEntry[]> {
  try {
    const res = await fetch(`${API}?log=1`, { headers: { 'X-Token': TOKEN } });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// On startup: pull server data into localStorage, and migrate local-only data up
export async function syncFromServer(): Promise<void> {
  try {
    const res = await fetch(API, { headers: { 'X-Token': TOKEN } });
    if (!res.ok) return;
    const serverData: Record<string, string> = await res.json();

    for (const key of SYNC_KEYS) {
      const serverVal = serverData[key];
      const localVal  = localStorage.getItem(key);

      if (!serverVal) {
        // サーバーにデータなし → ローカルをアップロード
        if (localVal) await apiSet(key, localVal);
        continue;
      }

      if (!localVal) {
        // ローカルにデータなし → サーバーから取得
        localStorage.setItem(key, serverVal);
        continue;
      }

      // 両方にデータあり
      if (key === 'matsunaga_kiji_items') {
        // 月別キー（"year_month"）でマージ: ローカルにない月はサーバーから補完
        // ローカルにある月はローカル優先（サーバー未反映の可能性があるため）
        try {
          const srv: Record<string, unknown[]> = JSON.parse(serverVal);
          const loc: Record<string, unknown[]> = JSON.parse(localVal);
          let changed = false;
          for (const ym of Object.keys(srv)) {
            if (!loc[ym] || loc[ym].length === 0) {
              loc[ym] = srv[ym];
              changed = true;
            }
          }
          if (changed) {
            const merged = JSON.stringify(loc);
            localStorage.setItem(key, merged);
            await apiSet(key, merged);
          } else {
            // ローカルが最新 → サーバーに反映
            await apiSet(key, localVal);
          }
        } catch {
          localStorage.setItem(key, serverVal);
        }
      } else {
        // 他のキーはサーバー優先（ユーザー情報・売上データ）
        localStorage.setItem(key, serverVal);
      }
    }
  } catch { /* API unreachable — fall back to localStorage silently */ }
}
