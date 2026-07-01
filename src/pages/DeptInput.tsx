import { useState, useEffect } from 'react';
import { YearStore, AuthSession, SectionData, ChangeLogEntry } from '../types';
import { saveDeptMonths, getUndoInfo, undoDept } from '../utils/store';
import { logChange, getChangeLogs } from '../utils/api';
import './DeptInput.css';

interface Props {
  session: AuthSession;
  dept: 'tosou' | 'matome';
  store: YearStore;
  onSaved: (next: YearStore) => void;
  onLogout: () => void;
}

const DEPT_LABEL: Record<'tosou' | 'matome', string> = {
  tosou: '塗装部',
  matome: 'まとめ部',
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function DeptInput({ session, dept, store, onSaved, onLogout }: Props) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const availableYears = Array.from(
    new Set([currentReiwa, currentReiwa - 1, ...Object.keys(store).map(Number)])
  ).sort((a, b) => b - a);

  const [year, setYear] = useState(currentReiwa);
  const [rows, setRows] = useState<Record<number, SectionData>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 元に戻す（直前の保存を1回だけ取り消し）
  const [undoTs, setUndoTs] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const refreshUndo = () => {
    getUndoInfo(dept).then(info => setUndoTs(info ? info.ts : null));
  };
  useEffect(() => { refreshUndo(); }, [dept]);

  // 入力履歴
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadHistory = () => {
    setLogsLoading(true);
    getChangeLogs()
      .then(all => setLogs(all.filter(l => l.user === session.displayName)))
      .finally(() => setLogsLoading(false));
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory();
  };

  const fmtTs = (ts: string) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} `
      + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // 選択年のデータを読み込む
  useEffect(() => {
    const next: Record<number, SectionData> = {};
    MONTHS.forEach(m => {
      const sec = store[year]?.[m]?.[dept];
      next[m] = { count: sec?.count ?? 0, amount: sec?.amount ?? 0 };
    });
    setRows(next);
  }, [year, store, dept]);

  const update = (m: number, field: 'count' | 'amount', value: number) => {
    setRows(prev => ({ ...prev, [m]: { ...prev[m], [field]: value } }));
    setSaved(false);
  };

  const totalCount  = MONTHS.reduce((s, m) => s + (rows[m]?.count ?? 0), 0);
  const totalAmount = MONTHS.reduce((s, m) => s + (rows[m]?.amount ?? 0), 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    // 変更点（保存前の store の値と比較）を月ごとに集計
    const diffs: string[] = [];
    MONTHS.forEach(m => {
      const oldSec = store[year]?.[m]?.[dept];
      const oc = oldSec?.count ?? 0, oa = oldSec?.amount ?? 0;
      const nc = rows[m]?.count ?? 0, na = rows[m]?.amount ?? 0;
      if (oc !== nc || oa !== na) {
        diffs.push(`${m}月 本数${oc}→${nc} / 金額${oa.toLocaleString()}→${na.toLocaleString()}`);
      }
    });
    try {
      const next = await saveDeptMonths(year, dept, rows);
      onSaved(next);
      if (diffs.length > 0) {
        await logChange(session.displayName, year, 0, `令和${year}年　${diffs.join(' ／ ')}`);
      }
      setSaved(true);
      refreshUndo();
      if (showHistory) loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'サーバー保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!window.confirm('直前の保存を取り消して、1つ前の状態に戻します。よろしいですか？\n（戻せるのは1回だけです）')) return;
    setUndoing(true);
    setError('');
    try {
      const next = await undoDept(dept);
      if (next) {
        onSaved(next);
        setSaved(false);
        setUndoTs(null);
        if (showHistory) loadHistory();
        alert('1つ前の状態に戻しました。');
      } else {
        setUndoTs(null);
        alert('戻せる保存がありませんでした。');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '元に戻す処理に失敗しました');
    } finally {
      setUndoing(false);
    }
  };

  const fmtTsShort = (ts: string) => {
    const d = new Date(ts);
    return `${String(d.getMonth()+1)}/${String(d.getDate())} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div className="dept-page">
      <header className="dept-header">
        <div className="dept-header-left">
          <h1>松永工房　{DEPT_LABEL[dept]} 生産入力</h1>
          <div className="dept-sub">担当：{session.displayName}</div>
        </div>
        <button className="dept-logout" onClick={onLogout}>ログアウト</button>
      </header>

      <main className="dept-main">
        <div className="dept-toolbar">
          <label>対象年：</label>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setSaved(false); }}>
            {availableYears.map(y => <option key={y} value={y}>令和{y}年</option>)}
          </select>
          <span className="dept-hint">各月の本数・金額を入力して「保存」を押してください。</span>
        </div>

        <div className="dept-card">
          <table className="dept-table">
            <thead>
              <tr>
                <th className="dept-th-month">月</th>
                <th>本数</th>
                <th>金額（円）</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map(m => (
                <tr key={m}>
                  <td className="dept-td-month">{m}月</td>
                  <td>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={rows[m]?.count ?? 0}
                      onChange={e => update(m, 'count', Number(e.target.value))}
                    />
                    <span className="dept-unit">本</span>
                  </td>
                  <td>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={rows[m]?.amount ?? 0}
                      onChange={e => update(m, 'amount', Number(e.target.value))}
                    />
                    <span className="dept-unit">円</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="dept-td-month">年計</td>
                <td className="dept-total">{totalCount.toLocaleString()}本</td>
                <td className="dept-total">¥{totalAmount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          {error && <div className="dept-error">⚠ {error}</div>}

          <div className="dept-actions">
            <button className="dept-save-btn" onClick={handleSave} disabled={saving || undoing}>
              {saving ? 'サーバーに保存中...' : saved ? '✓ 保存しました' : '💾 保存する'}
            </button>
            {undoTs && (
              <button className="dept-undo-btn" onClick={handleUndo} disabled={undoing || saving}>
                {undoing ? '戻しています...' : `↩ 直前の保存を戻す（${fmtTsShort(undoTs)}）`}
              </button>
            )}
          </div>
          {undoTs && (
            <div className="dept-undo-note">
              ※ 直前に保存した内容を1回だけ元に戻せます（どの端末からでも可）。
            </div>
          )}
        </div>

        {/* 入力履歴 */}
        <div className="dept-history-wrap">
          <button className="dept-history-toggle" onClick={toggleHistory}>
            {showHistory ? '▲ 入力履歴を閉じる' : '📋 自分の入力履歴を見る'}
          </button>
          {showHistory && (
            <div className="dept-card dept-history-card">
              {logsLoading ? (
                <div className="dept-history-empty">読み込み中...</div>
              ) : logs.length === 0 ? (
                <div className="dept-history-empty">まだ履歴がありません</div>
              ) : (
                <table className="dept-history-table">
                  <thead>
                    <tr><th>日時</th><th>変更内容</th></tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td className="dept-history-ts">{fmtTs(l.ts)}</td>
                        <td className="dept-history-sum">{l.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
