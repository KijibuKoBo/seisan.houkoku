import { useEffect, useState } from 'react';
import { ChangeLogEntry } from '../types';
import './ChangeLog.css';

interface Props {
  getChangeLogs: () => Promise<ChangeLogEntry[]>;
  onClose: () => void;
}

export default function ChangeLog({ getChangeLogs, onClose }: Props) {
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChangeLogs().then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const formatTs = (ts: string) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div className="cl-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cl-modal">
        <div className="cl-header">
          <div className="cl-title">変更ログ</div>
          <button className="cl-close" onClick={onClose}>✕</button>
        </div>

        <div className="cl-body">
          {loading ? (
            <div className="cl-loading">読み込み中...</div>
          ) : logs.length === 0 ? (
            <div className="cl-empty">変更履歴がありません</div>
          ) : (
            <table className="cl-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>ユーザー</th>
                  <th>対象</th>
                  <th>変更内容</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="cl-ts">{formatTs(log.ts)}</td>
                    <td className="cl-user">{log.user}</td>
                    <td className="cl-ym">令和{log.year}年 {log.month}月</td>
                    <td className="cl-summary">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
