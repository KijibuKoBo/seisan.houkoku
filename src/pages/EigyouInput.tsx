import { useState, useEffect } from 'react';
import { YearStore, AuthSession, SalesData, ChangeLogEntry, emptySales } from '../types';
import { saveSalesMonth, getUndoInfo, undoSales } from '../utils/store';
import { salesTotal } from '../utils/calc';
import { logChange, getChangeLogs } from '../utils/api';
import './DeptInput.css';

interface Props {
  session: AuthSession;
  store: YearStore;
  onSaved: (next: YearStore) => void;
  onLogout: () => void;
}

type SalesMemo = Partial<Record<keyof SalesData, string>>;

const SALES_LABELS: [keyof SalesData, string][] = [
  ['otsuka', '大塚'],
  ['takumi', '匠'],
  ['butsudan', '仏壇'],
  ['ippanten', '一般店'],
  ['showroom', '直販'],
  ['bukken', 'その他'],
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function EigyouInput({ session, store, onSaved, onLogout }: Props) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const availableYears = Array.from(
    new Set([currentReiwa, currentReiwa - 1, ...Object.keys(store).map(Number)])
  ).sort((a, b) => b - a);

  const [year, setYear] = useState(currentReiwa);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [sales, setSales] = useState<SalesData>(emptySales());
  const [memo, setMemo] = useState<SalesMemo>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [undoTs, setUndoTs] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const refreshUndo = () => { getUndoInfo('eigyou').then(info => setUndoTs(info ? info.ts : null)); };
  useEffect(() => { refreshUndo(); }, []);

  // 選択年月のデータを読み込む
  useEffect(() => {
    const md = store[year]?.[month];
    setSales(md?.sales ? { ...md.sales } : emptySales());
    setMemo(md?.salesMemo ? { ...md.salesMemo } : {});
  }, [year, month, store]);

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

  const updateSales = (key: keyof SalesData, v: number) => {
    setSales(prev => ({ ...prev, [key]: v }));
    setSaved(false);
  };
  const updateMemo = (key: keyof SalesData, v: string) => {
    setMemo(prev => ({ ...prev, [key]: v }));
    setSaved(false);
  };

  const total = salesTotal(sales);

  const fmtTs = (ts: string) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} `
      + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const fmtTsShort = (ts: string) => {
    const d = new Date(ts);
    return `${String(d.getMonth()+1)}/${String(d.getDate())} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    // 変更点（保存前の store と比較）
    const old = store[year]?.[month]?.sales;
    const diffs: string[] = [];
    SALES_LABELS.forEach(([key, label]) => {
      const o = old?.[key] ?? 0;
      const n = sales[key] ?? 0;
      if (o !== n) diffs.push(`${label} ${o.toLocaleString()}→${n.toLocaleString()}`);
    });
    try {
      const next = await saveSalesMonth(year, month, sales, memo);
      onSaved(next);
      if (diffs.length > 0) {
        await logChange(session.displayName, year, month, diffs.join(' ／ '));
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
      const next = await undoSales();
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

  return (
    <div className="dept-page">
      <header className="dept-header">
        <div className="dept-header-left">
          <h1>松永工房　営業部 売上入力</h1>
          <div className="dept-sub">担当：{session.displayName}</div>
        </div>
        <button className="dept-logout" onClick={onLogout}>ログアウト</button>
      </header>

      <main className="dept-main">
        <div className="dept-toolbar">
          <label>対象：</label>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setSaved(false); }}>
            {availableYears.map(y => <option key={y} value={y}>令和{y}年</option>)}
          </select>
          <select value={month} onChange={e => { setMonth(Number(e.target.value)); setSaved(false); }}>
            {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
          <span className="dept-hint">各項目の金額を入力して「保存」を押してください。</span>
        </div>

        <div className="dept-card">
          <table className="dept-table dept-sales-table">
            <thead>
              <tr>
                <th className="dept-th-month">項目</th>
                <th>金額（円）</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              {SALES_LABELS.map(([key, label]) => (
                <tr key={key}>
                  <td className="dept-td-month">{label}</td>
                  <td>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={sales[key] === 0 ? '' : sales[key]}
                      placeholder="0"
                      onChange={e => updateSales(key, Number(e.target.value) || 0)}
                    />
                    <span className="dept-unit">円</span>
                  </td>
                  <td>
                    <input
                      type="text" className="dept-memo-input" placeholder="備考"
                      value={memo[key] ?? ''}
                      onChange={e => updateMemo(key, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="dept-td-month">合計</td>
                <td className="dept-total">¥{total.toLocaleString()}</td>
                <td />
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
                    <tr><th>日時</th><th>対象</th><th>変更内容</th></tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td className="dept-history-ts">{fmtTs(l.ts)}</td>
                        <td className="dept-history-ts">令和{l.year}年{l.month}月</td>
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
