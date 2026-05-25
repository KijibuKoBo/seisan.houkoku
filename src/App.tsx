import { useState, useCallback, useEffect } from 'react';
import { YearStore, MonthData, AuthSession, KijiItem } from './types';
import { loadStore, saveStore, setMonthData } from './utils/store';
import { initDefaultUsers, getSession, logout } from './utils/auth';
import { saveKijiItems } from './utils/kijiStore';
import { syncFromServer, forcePushToServer } from './utils/api';
import YearlyTable, { CompactSummary } from './components/YearlyTable';
import MonthModal from './components/MonthModal';
import LoginPage from './components/LoginPage';
import UserManager from './components/UserManager';
import KijiAnalysis from './pages/KijiAnalysis';
import MonthlyReport from './components/MonthlyReport';
import './App.css';

const currentReiwa = new Date().getFullYear() - 2018;

function getDefaultYears(): number[] {
  return Array.from({ length: 6 }, (_, i) => currentReiwa - i);
}

type Page = 'report' | 'kiji' | 'users';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(getSession);
  const [store, setStore] = useState<YearStore>(loadStore);
  const [selectedYear, setSelectedYear] = useState(currentReiwa);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [page, setPage] = useState<Page>('report');
  const [syncing, setSyncing] = useState(true);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'ok' | 'err'>('idle');

  useEffect(() => {
    initDefaultUsers();
    syncFromServer().finally(() => {
      setStore(loadStore());
      setSyncing(false);
    });
  }, []);

  const availableYears = Array.from(
    new Set([...getDefaultYears(), ...Object.keys(store).map(Number)])
  ).sort((a, b) => b - a);

  const handleLogin = (s: AuthSession) => setSession(s);

  const handleLogout = () => { logout(); setSession(null); };

  const handleKijiMonthSave = useCallback((year: number, month: number, count: number, amount: number) => {
    const existing: MonthData = store[year]?.[month] ?? {
      month,
      sales: { otsuka: 0, takumi: 0, butsudan: 0, ippanten: 0, showroom: 0, bukken: 0 },
      kiji: { count: 0, amount: 0 },
      tosou: { count: 0, amount: 0 },
      matome: { count: 0, amount: 0 },
    };
    const updated = { ...existing, kiji: { count, amount } };
    const next = setMonthData(store, year, month, updated);
    setStore(next);
    saveStore(next);
  }, [store]);

  const handleSave = useCallback((data: MonthData, kijiItems: KijiItem[]) => {
    if (editingMonth === null) return;
    const next = setMonthData(store, selectedYear, editingMonth, data);
    setStore(next);
    saveStore(next);
    if (kijiItems.length > 0) saveKijiItems(selectedYear, editingMonth, kijiItems);
    setEditingMonth(null);
  }, [store, selectedYear, editingMonth]);

  const getPrevMonthData = (month: number): MonthData | null => {
    if (month === 1) return store[selectedYear - 1]?.[12] ?? null;
    return store[selectedYear]?.[month - 1] ?? null;
  };

  const getPrevYearMonthData = (month: number): MonthData | null =>
    store[selectedYear - 1]?.[month] ?? null;

  if (syncing) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'Meiryo, sans-serif', color: '#555', fontSize: 15,
      }}>
        データを読み込み中...
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const canEdit = session.role === 'admin';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>松永工房 生産月次報告</h1>
          <nav className="app-nav">
            <button className={`nav-btn ${page === 'report' ? 'active' : ''}`} onClick={() => setPage('report')}>
              月次集計
            </button>
            <button className={`nav-btn ${page === 'kiji' ? 'active' : ''}`} onClick={() => setPage('kiji')}>
              木地部分析
            </button>
            {canEdit && (
              <button className={`nav-btn ${page === 'users' ? 'active' : ''}`} onClick={() => setPage('users')}>
                ユーザー管理
              </button>
            )}
          </nav>
        </div>
        <div className="header-right">
          <span className="session-info">
            {session.displayName}
            {session.role === 'admin' && <span className="role-badge">管理者</span>}
          </span>
          <button
            className="sync-btn"
            disabled={pushStatus === 'pushing'}
            onClick={async () => {
              setPushStatus('pushing');
              const ok = await forcePushToServer();
              setPushStatus(ok ? 'ok' : 'err');
              setTimeout(() => setPushStatus('idle'), 3000);
            }}
          >
            {pushStatus === 'pushing' ? '送信中...' : pushStatus === 'ok' ? '✓ 同期完了' : pushStatus === 'err' ? '✗ 失敗' : '🔄 サーバーへ同期'}
          </button>
          <button className="logout-btn" onClick={handleLogout}>ログアウト</button>
        </div>
      </header>

      <main className="app-main">
        {page === 'report' && (
          <>
            <div className="year-bar">
              {availableYears.map(y => (
                <button
                  key={y}
                  className={`year-btn ${y === selectedYear ? 'active' : ''}`}
                  onClick={() => setSelectedYear(y)}
                >
                  令和{y}年
                </button>
              ))}
              <button
                className="year-btn add-year"
                onClick={() => setSelectedYear(Math.min(...availableYears) - 1)}
                title="過去年を追加"
              >＋</button>
              <button
                className="monthly-report-btn"
                onClick={() => setShowMonthlyReport(true)}
                style={{ marginLeft: 'auto' }}
              >📋 月次報告書</button>
            </div>
            <CompactSummary year={selectedYear} store={store} />
            <YearlyTable
              year={selectedYear}
              store={store}
              onEditMonth={canEdit ? setEditingMonth : () => {}}
              readOnly={!canEdit}
            />
          </>
        )}

        {page === 'kiji' && <KijiAnalysis store={store} onSaveMonthKiji={handleKijiMonthSave} canEdit={canEdit} />}

        {page === 'users' && canEdit && <UserManager />}
      </main>

      {showMonthlyReport && (
        <MonthlyReport
          store={store}
          defaultYear={selectedYear}
          onClose={() => setShowMonthlyReport(false)}
        />
      )}

      {editingMonth !== null && canEdit && (
        <MonthModal
          year={selectedYear}
          month={editingMonth}
          initial={store[selectedYear]?.[editingMonth] ?? null}
          prevMonth={getPrevMonthData(editingMonth)}
          prevYearMonth={getPrevYearMonthData(editingMonth)}
          onSave={handleSave}
          onClose={() => setEditingMonth(null)}
        />
      )}
    </div>
  );
}
