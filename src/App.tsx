import { useState, useCallback, useEffect } from 'react';
import { YearStore, MonthData, AuthSession, KijiItem } from './types';
import { loadStore, saveStore, setMonthData } from './utils/store';
import { initDefaultUsers, ensureKoboUser, getSession, logout } from './utils/auth';
import { saveKijiItems, migrateCategories, pushKijiToServer } from './utils/kijiStore';
import { syncFromServer, logChange, getChangeLogs } from './utils/api';
import { seedCostDatabaseIfEmpty } from './utils/costStore';
import YearlyTable, { CompactSummary } from './components/YearlyTable';
import MonthModal from './components/MonthModal';
import LoginPage from './components/LoginPage';
import UserManager from './components/UserManager';
import KijiAnalysis from './pages/KijiAnalysis';
import CostDatabase from './pages/CostDatabase';
import KijiReport from './components/KijiReport';
import YearlyReport from './components/YearlyReport';
import ChangeLog from './components/ChangeLog';
import './App.css';

const currentReiwa = new Date().getFullYear() - 2018;

function getDefaultYears(): number[] {
  return Array.from({ length: 6 }, (_, i) => currentReiwa - i);
}

type Page = 'report' | 'kiji' | 'cost' | 'users';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(getSession);
  const [store, setStore] = useState<YearStore>(loadStore);
  const [selectedYear, setSelectedYear] = useState(currentReiwa);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [page, setPage] = useState<Page>('report');
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [showYearlyReport, setShowYearlyReport] = useState(false);
  const [showKijiReport, setShowKijiReport] = useState(false);
  const [showChangeLog, setShowChangeLog] = useState(false);

  useEffect(() => {
    // 重要: 起動時の順序
    // 1. サーバーから最新ユーザー一覧を取得（ローカルが空でも上書きしない）
    // 2. ローカルがまだ空ならデフォルトユーザーを作成（=新規環境のみ）
    // 3. 既存環境にkoboがいなければ補完（マイグレーション）
    syncFromServer()
      .then(() => setSyncError(false))
      .catch(() => setSyncError(true))
      .finally(async () => {
        await initDefaultUsers();
        await ensureKoboUser();
        migrateCategories();
        seedCostDatabaseIfEmpty();
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
    const prev = store[selectedYear]?.[editingMonth];
    const next = setMonthData(store, selectedYear, editingMonth, data);
    setStore(next);
    saveStore(next);
    if (kijiItems.length > 0) {
      saveKijiItems(selectedYear, editingMonth, kijiItems);
      pushKijiToServer();
    }

    const labels: Record<string, string> = {
      otsuka: '大塚', takumi: '匠', butsudan: '仏壇',
      ippanten: '一般店', showroom: '直販', bukken: 'その他',
    };
    const diffs: string[] = [];
    (Object.keys(labels) as (keyof typeof data.sales)[]).forEach(k => {
      const o = prev?.sales[k] ?? 0;
      const n = data.sales[k];
      if (o !== n) diffs.push(`${labels[k]}: ${o.toLocaleString()}→${n.toLocaleString()}`);
    });
    (['kiji', 'tosou', 'matome'] as const).forEach(s => {
      const sLabel = s === 'kiji' ? '木地' : s === 'tosou' ? '塗装' : 'まとめ';
      if ((prev?.[s].count ?? 0) !== data[s].count)
        diffs.push(`${sLabel}本数: ${prev?.[s].count ?? 0}→${data[s].count}`);
      if ((prev?.[s].amount ?? 0) !== data[s].amount)
        diffs.push(`${sLabel}金額: ${(prev?.[s].amount ?? 0).toLocaleString()}→${data[s].amount.toLocaleString()}`);
    });
    if (diffs.length > 0) {
      logChange(session!.displayName, selectedYear, editingMonth, diffs.join(' / '));
    }

    setEditingMonth(null);
  }, [store, selectedYear, editingMonth, session]);

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
            <button className="nav-btn" onClick={() => setShowKijiReport(true)}>
              木地部月次報告
            </button>
            {session.userId === 'admin' && (
              <button className={`nav-btn ${page === 'cost' ? 'active' : ''}`} onClick={() => setPage('cost')}>
                原価管理
              </button>
            )}
            {canEdit && (
              <button className={`nav-btn ${page === 'users' ? 'active' : ''}`} onClick={() => setPage('users')}>
                ユーザー管理
              </button>
            )}
          </nav>
        </div>
        <div className="header-right">
          {syncError && (
            <span style={{ fontSize: 11, color: '#ffcccc', marginRight: 8 }}>
              ⚠ サーバー接続エラー（ローカルデータで表示中）
            </span>
          )}
          <span className="session-info">
            {session.displayName}
            {session.role === 'admin' && <span className="role-badge">管理者</span>}
          </span>
          <button className="changelog-btn" onClick={() => setShowChangeLog(true)}>変更ログ</button>
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
                className="yearly-report-btn"
                onClick={() => setShowYearlyReport(true)}
                style={{ marginLeft: 'auto' }}
              >📊 年次報告書</button>
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

        {page === 'cost' && session.userId === 'admin' && <CostDatabase />}

        {page === 'users' && canEdit && <UserManager />}
      </main>

      {showChangeLog && (
        <ChangeLog getChangeLogs={getChangeLogs} onClose={() => setShowChangeLog(false)} />
      )}

      {showYearlyReport && (
        <YearlyReport
          store={store}
          defaultYear={selectedYear}
          onClose={() => setShowYearlyReport(false)}
        />
      )}

      {showKijiReport && (
        <KijiReport
          defaultYear={selectedYear}
          defaultMonth={new Date().getMonth() + 1}
          onClose={() => setShowKijiReport(false)}
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
