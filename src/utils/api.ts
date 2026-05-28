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

// kiji_items のみマージ戦略: ローカル優先・サーバーにない月はサーバーから補完
function mergeKijiItems(serverJson: string | undefined): void {
  const localJson = localStorage.getItem('matsunaga_kiji_items');

  if (!serverJson) {
    if (localJson) apiSet('matsunaga_kiji_items', localJson);
    return;
  }
  if (!localJson) {
    localStorage.setItem('matsunaga_kiji_items', serverJson);
    return;
  }

  try {
    const server: Record<string, unknown[]> = JSON.parse(serverJson);
    const local:  Record<string, unknown[]> = JSON.parse(localJson);
    // ローカルを優先、サーバーにしか存在しない月はサーバーから補完
    const merged = { ...server, ...local };
    const mergedJson = JSON.stringify(merged);
    localStorage.setItem('matsunaga_kiji_items', mergedJson);
    apiSet('matsunaga_kiji_items', mergedJson);
  } catch {
    // パース失敗時はローカルをそのまま維持
    apiSet('matsunaga_kiji_items', localJson);
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
