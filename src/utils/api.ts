const API = './api.php';
const TOKEN = 'mtsng_api_2024';

const SYNC_KEYS = ['matsunaga_seisan', 'matsunaga_kiji_items', 'matsunaga_users', 'matsunaga_cost_db'] as const;

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

// kiji_items 同期戦略: サーバー優先。ローカルにしかない月はローカルから補完し、サーバーへ送り返す。
function mergeKijiItems(serverJson: string | undefined): void {
  const localJson = localStorage.getItem('matsunaga_kiji_items');

  if (!serverJson) {
    // サーバーにデータなし → ローカルをサーバーへ送信
    if (localJson) apiSet('matsunaga_kiji_items', localJson);
    return;
  }
  if (!localJson) {
    // ローカルにデータなし → サーバーデータをそのまま使用
    localStorage.setItem('matsunaga_kiji_items', serverJson);
    return;
  }

  try {
    const server: Record<string, unknown[]> = JSON.parse(serverJson);
    const local:  Record<string, unknown[]> = JSON.parse(localJson);
    // サーバー優先: ローカルにしかない月はローカルから補完し、サーバーへ送り返す
    const merged = { ...local, ...server };
    const mergedJson = JSON.stringify(merged);
    localStorage.setItem('matsunaga_kiji_items', mergedJson);
    // ローカルにしかない月があれば補完してサーバーへ送り返す
    const hasLocalOnly = Object.keys(local).some(k => !(k in server));
    if (hasLocalOnly) apiSet('matsunaga_kiji_items', mergedJson);
  } catch {
    // パース失敗時はサーバーデータを使用
    localStorage.setItem('matsunaga_kiji_items', serverJson);
  }
}

// On startup: pull server data into localStorage, and migrate local-only data up
export async function syncFromServer(): Promise<void> {
  try {
    const res = await fetch(API, { headers: { 'X-Token': TOKEN } });
    if (!res.ok) return;
    const serverData: Record<string, string> = await res.json();

    for (const key of SYNC_KEYS) {
      if (key === 'matsunaga_kiji_items') {
        mergeKijiItems(serverData[key]);
      } else if (serverData[key]) {
        localStorage.setItem(key, serverData[key]);
      } else {
        const local = localStorage.getItem(key);
        if (local) await apiSet(key, local);
      }
    }
  } catch { /* API unreachable — fall back to localStorage silently */ }
}
