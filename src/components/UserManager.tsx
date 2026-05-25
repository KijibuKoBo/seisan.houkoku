import { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { loadUsers, addUser, changePassword, updateUser, deleteUser } from '../utils/auth';

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ id: '', password: '', displayName: '', role: 'viewer' as Role });
  const [pwForm, setPwForm] = useState<{ userId: string; pw: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = () => setUsers(loadUsers());
  useEffect(() => { refresh(); }, []);

  const notify = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 2500); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await addUser(form.id, form.password, form.displayName, form.role);
      setForm({ id: '', password: '', displayName: '', role: 'viewer' });
      refresh();
      notify('ユーザーを追加しました');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    }
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm) return;
    try {
      await changePassword(pwForm.userId, pwForm.pw);
      setPwForm(null);
      notify('パスワードを変更しました');
    } catch {
      setError('パスワード変更に失敗しました');
    }
  };

  const handleRoleChange = (userId: string, role: Role) => {
    updateUser(userId, { role });
    refresh();
    notify('権限を変更しました');
  };

  const handleDelete = (userId: string) => {
    if (userId === 'admin') { setError('adminユーザーは削除できません'); return; }
    if (!confirm(`ユーザー「${userId}」を削除しますか？`)) return;
    deleteUser(userId);
    refresh();
    notify('ユーザーを削除しました');
  };

  return (
    <div className="user-manager">
      <h2>ユーザー管理</h2>

      {error && <div className="um-error">{error}</div>}
      {success && <div className="um-success">{success}</div>}

      <section className="um-section">
        <h3>ユーザー一覧</h3>
        <table className="um-table">
          <thead>
            <tr>
              <th>ID</th><th>表示名</th><th>権限</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.displayName}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value as Role)}
                    className="role-select"
                  >
                    <option value="admin">管理者</option>
                    <option value="viewer">閲覧のみ</option>
                  </select>
                </td>
                <td className="um-actions">
                  <button className="btn-sm" onClick={() => setPwForm({ userId: u.id, pw: '' })}>
                    PW変更
                  </button>
                  <button className="btn-sm danger" onClick={() => handleDelete(u.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pwForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPwForm(null)}>
          <div className="modal" style={{ width: 360 }}>
            <div className="modal-header">
              <h2>パスワード変更 ({pwForm.userId})</h2>
              <button className="modal-close" onClick={() => setPwForm(null)}>✕</button>
            </div>
            <form onSubmit={handleChangePw} style={{ padding: 16 }}>
              <div className="login-field">
                <label>新しいパスワード</label>
                <input
                  type="password"
                  value={pwForm.pw}
                  onChange={e => setPwForm(p => p ? { ...p, pw: e.target.value } : null)}
                  required
                  minLength={4}
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setPwForm(null)}>キャンセル</button>
                <button type="submit" className="btn-primary">変更</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="um-section">
        <h3>新規ユーザー追加</h3>
        <form onSubmit={handleAdd} className="um-add-form">
          <div className="um-form-row">
            <label>ID</label>
            <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} required placeholder="英数字" pattern="[a-zA-Z0-9_]+" />
          </div>
          <div className="um-form-row">
            <label>表示名</label>
            <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} required />
          </div>
          <div className="um-form-row">
            <label>パスワード</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={4} />
          </div>
          <div className="um-form-row">
            <label>権限</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
              <option value="viewer">閲覧のみ</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">追加</button>
        </form>
      </section>
    </div>
  );
}
