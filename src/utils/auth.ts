import { User, AuthSession, Role } from '../types';
import { apiSet, apiSetStrict } from './api';

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
  const json = JSON.stringify(users);
  localStorage.setItem(USERS_KEY, json);
  apiSet(USERS_KEY, json);
}

export async function pushUsersToServer(): Promise<void> {
  const json = localStorage.getItem(USERS_KEY);
  if (json) await apiSetStrict(USERS_KEY, json);
}

// 既定ユーザーの定義（初期作成・マイグレーション両方で使用）
const DEFAULT_USERS: { id: string; password: string; displayName: string; role: Role }[] = [
  { id: 'admin',  password: 'admin123', displayName: '管理者',   role: 'admin' },
  { id: 'jimu',   password: 'jimu123',  displayName: '事務',     role: 'viewer' },
  { id: 'kobo',   password: '7722',     displayName: '木地工房', role: 'admin' },
  { id: 'tosou',  password: 'kobo7722', displayName: '塗装部',   role: 'tosou' },
  { id: 'matome', password: 'kobo7722', displayName: 'まとめ部', role: 'matome' },
  { id: 'eigyou', password: 'kobo7722', displayName: '営業部',   role: 'eigyou' },
];

export async function initDefaultUsers(): Promise<void> {
  try {
    const existing = loadUsers();
    if (existing.length > 0) return;
    const users: User[] = [];
    for (const d of DEFAULT_USERS) {
      users.push({ id: d.id, passwordHash: await sha256(d.password), displayName: d.displayName, role: d.role });
    }
    saveUsers(users);
  } catch (e) {
    console.error('initDefaultUsers failed:', e);
  }
}

// 既存環境に不足している既定ユーザー（kobo/tosou/matome など）を補完する
export async function ensureDefaultUsers(): Promise<void> {
  try {
    const users = loadUsers();
    if (users.length === 0) return; // initDefaultUsersが処理
    let changed = false;
    const next = [...users];
    for (const d of DEFAULT_USERS) {
      if (d.id === 'admin' || d.id === 'jimu') continue; // 既存の可能性が高いものは触らない
      if (next.find(u => u.id === d.id)) continue;
      next.push({ id: d.id, passwordHash: await sha256(d.password), displayName: d.displayName, role: d.role });
      changed = true;
    }
    if (changed) saveUsers(next);
  } catch (e) {
    console.error('ensureDefaultUsers failed:', e);
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
