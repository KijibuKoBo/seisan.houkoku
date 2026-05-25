import { User, AuthSession, Role } from '../types';

const USERS_KEY = 'matsunaga_users';
const SESSION_KEY = 'matsunaga_session';

// crypto.subtle は HTTPS または localhost でのみ利用可能
// HTTP環境ではフォールバックの簡易ハッシュを使う
async function sha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { /* fall through */ }
  }
  // HTTP環境フォールバック（内部ツール用簡易ハッシュ）
  return djb2Hash(text);
}

function djb2Hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h, 33) ^ text.charCodeAt(i);
  }
  return 'http_' + (h >>> 0).toString(16).padStart(8, '0') + '_' + text.length;
}

export function isSecureContext(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

export function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function initDefaultUsers(): Promise<void> {
  try {
    const existing = loadUsers();
    if (existing.length > 0) return;
    const adminHash = await sha256('admin123');
    const jimuHash = await sha256('jimu123');
    saveUsers([
      { id: 'admin', passwordHash: adminHash, displayName: '管理者', role: 'admin' },
      { id: 'jimu', passwordHash: jimuHash, displayName: '事務', role: 'viewer' },
    ]);
  } catch (e) {
    console.error('initDefaultUsers failed:', e);
  }
}

export async function login(id: string, password: string): Promise<AuthSession | null> {
  const users = loadUsers();
  const user = users.find(u => u.id === id);
  if (!user) return null;
  const hash = await sha256(password);
  if (hash !== user.passwordHash) return null;
  const session: AuthSession = { userId: user.id, displayName: user.displayName, role: user.role };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function addUser(id: string, password: string, displayName: string, role: Role): Promise<void> {
  const users = loadUsers();
  if (users.find(u => u.id === id)) throw new Error('そのIDは既に使用されています');
  const passwordHash = await sha256(password);
  saveUsers([...users, { id, passwordHash, displayName, role }]);
}

export async function changePassword(id: string, newPassword: string): Promise<void> {
  const users = loadUsers();
  const i = users.findIndex(u => u.id === id);
  if (i < 0) throw new Error('ユーザーが見つかりません');
  users[i] = { ...users[i], passwordHash: await sha256(newPassword) };
  saveUsers(users);
}

export function updateUser(id: string, patch: Partial<Pick<User, 'displayName' | 'role'>>): void {
  const users = loadUsers();
  const i = users.findIndex(u => u.id === id);
  if (i < 0) return;
  users[i] = { ...users[i], ...patch };
  saveUsers(users);
}

export function deleteUser(id: string): void {
  saveUsers(loadUsers().filter(u => u.id !== id));
}
