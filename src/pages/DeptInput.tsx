import { useState, useEffect } from 'react';
import { YearStore, AuthSession, SectionData } from '../types';
import { saveDeptMonths } from '../utils/store';
import { logChange } from '../utils/api';
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
    try {
      const next = await saveDeptMonths(year, dept, rows);
      onSaved(next);
      // 変更ログ（月ごとの合計だけ簡潔に）
      logChange(session.displayName, year, 0,
        `${DEPT_LABEL[dept]} ${year}年 一括更新（本数計${totalCount} / 金額計${totalAmount.toLocaleString()}）`);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'サーバー保存に失敗しました');
    } finally {
      setSaving(false);
    }
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
            <button className="dept-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'サーバーに保存中...' : saved ? '✓ 保存しました' : '💾 保存する'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
