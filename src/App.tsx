import { useState, useCallback } from 'react';
import { YearStore, MonthData } from './types';
import { loadStore, saveStore, setMonthData } from './utils/store';
import YearlyTable, { CompactSummary } from './components/YearlyTable';
import MonthModal from './components/MonthModal';
import './App.css';

// 現在の令和年を計算（令和1年 = 2019年）
const currentReiwa = new Date().getFullYear() - 2018;

function getDefaultYears(): number[] {
  const years = [];
  for (let y = currentReiwa; y >= Math.max(1, currentReiwa - 5); y--) {
    years.push(y);
  }
  return years;
}

export default function App() {
  const [store, setStore] = useState<YearStore>(loadStore);
  const [selectedYear, setSelectedYear] = useState(currentReiwa);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);

  const availableYears = Array.from(
    new Set([...getDefaultYears(), ...Object.keys(store).map(Number)])
  ).sort((a, b) => b - a);

  const handleSave = useCallback((data: MonthData) => {
    if (editingMonth === null) return;
    const next = setMonthData(store, selectedYear, editingMonth, data);
    setStore(next);
    saveStore(next);
    setEditingMonth(null);
  }, [store, selectedYear, editingMonth]);

  const getPrevMonthData = (month: number): MonthData | null => {
    if (month === 1) {
      return store[selectedYear - 1]?.[12] ?? null;
    }
    return store[selectedYear]?.[month - 1] ?? null;
  };

  const getPrevYearMonthData = (month: number): MonthData | null => {
    return store[selectedYear - 1]?.[month] ?? null;
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>松永工房 生産月次報告</h1>
        </div>
        <div className="year-selector">
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
            onClick={() => {
              const newYear = Math.min(...availableYears) - 1;
              if (newYear >= 1) setSelectedYear(newYear);
            }}
            title="過去年を追加"
          >
            ＋
          </button>
        </div>
      </header>

      <main className="app-main">
        <CompactSummary year={selectedYear} store={store} />
        <YearlyTable
          year={selectedYear}
          store={store}
          onEditMonth={setEditingMonth}
        />
      </main>

      {editingMonth !== null && (
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
