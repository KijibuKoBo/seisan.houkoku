import { useState } from 'react';
import { login } from '../utils/auth';
import { AuthSession } from '../types';

interface Props {
  onLogin: (session: AuthSession) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await login(id, password);
      if (session) {
        onLogin(session);
      } else {
        setError('IDまたはパスワードが正しくありません');
      }
    } catch {
      setError('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-box">
        <div className="login-logo">松永工房</div>
        <h2 className="login-title">生産月次報告システム</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>ユーザーID</label>
            <input
              type="text"
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="ID"
              autoFocus
              required
            />
          </div>
          <div className="login-field">
            <label>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="パスワード"
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
