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

// On startup: pull server data into localStorage, and migrate local-only data up
export async function syncFromServer(): Promise<void> {
  try {
    const res = await fetch(API, { headers: { 'X-Token': TOKEN } });
    if (!res.ok) return;
    const serverData: Record<string, string> = await res.json();

    for (const key of SYNC_KEYS) {
      if (serverData[key]) {
        localStorage.setItem(key, serverData[key]);
      } else {
        const local = localStorage.getItem(key);
        if (local) await apiSet(key, local);
      }
    }
  } catch { /* API unreachable — fall back to localStorage silently */ }
}

// Force-upload all local data to server; returns true on success
export async function forcePushToServer(): Promise<boolean> {
  try {
    for (const key of SYNC_KEYS) {
      const local = localStorage.getItem(key);
      if (!local) continue;
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Token': TOKEN },
        body: JSON.stringify({ key, value: local }),
      });
      if (!res.ok) return false;
    }
    return true;
  } catch {
    return false;
  }
}
