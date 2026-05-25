import { useState } from 'react';
import { YearStore, MonthData, SalesData } from '../types';
import './MonthlyReport.css';

interface Props {
  store: YearStore;
  defaultYear: number;
  onClose: () => void;
}

const SALES_LABELS: { key: keyof SalesData; label: string }[] = [
  { key: 'otsuka',    label: '大塚' },
  { key: 'takumi',   label: '匠' },
  { key: 'butsudan', label: '仏壇' },
  { key: 'ippanten', label: '一般店' },
  { key: 'showroom', label: 'ショールーム' },
  { key: 'bukken',   label: '物件' },
];

function salesTotal(d: MonthData | null | undefined): number {
  if (!d) return 0;
  return Object.values(d.sales).reduce((s, v) => s + (v as number), 0);
}

function pct(cur: number, base: number): string {
  if (!base || !cur) return '—';
  return `${Math.round((cur / base) * 100)}%`;
}

function upDown(cur: number, base: number): string {
  if (!base || !cur) return '';
  return cur >= base ? 'up' : 'down';
}

function yen(n: number): string {
  return n === 0 ? '—' : `¥${n.toLocaleString('ja-JP')}`;
}

function hon(n: number): string {
  return n === 0 ? '—' : `${n.toLocaleString()}本`;
}

interface RowProps {
  label: string;
  py: number;
  cur: number;
  pm: number;
  fmt: (n: number) => string;
  indent?: boolean;
  bold?: boolean;
}

function Row({ label, py, cur, pm, fmt, indent, bold }: RowProps) {
  return (
    <tr className={bold ? 'total-row' : 'sub-row'}>
      <td className={`col-dept${indent ? ' indent' : ''}`}>{label}</td>
      <td className="col-num">{fmt(py)}</td>
      <td className="col-num">{fmt(cur)}</td>
      <td className={`col-pct ${upDown(cur, py)}`}>{pct(cur, py)}</td>
      <td className={`col-pct ${upDown(cur, pm)}`}>{pct(cur, pm)}</td>
    </tr>
  );
}

export default function MonthlyReport({ store, defaultYear, onClose }: Props) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const allYears = [...new Set([
    ...Object.keys(store).map(Number),
    currentReiwa,
  ])].sort((a, b) => b - a);

  const [selYear, setSelYear] = useState(defaultYear);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);

  const cur  = store[selYear]?.[selMonth] ?? null;
  const prevM = selMonth === 1
    ? (store[selYear - 1]?.[12] ?? null)
    : (store[selYear]?.[selMonth - 1] ?? null);
  const prevY = store[selYear - 1]?.[selMonth] ?? null;

  const stCur  = salesTotal(cur);
  const stPrevM = salesTotal(prevM);
  const stPrevY = salesTotal(prevY);

  return (
    <div className="report-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-modal">

        {/* Controls */}
        <div className="report-controls no-print">
          <div className="report-selectors">
            <label>年：</label>
            <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
              {allYears.map(y => <option key={y} value={y}>令和{y}年</option>)}
            </select>
            <label>月：</label>
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
              {Array.from({length:12},(_,i)=>i+1).map(m =>
                <option key={m} value={m}>{m}月</option>
              )}
            </select>
          </div>
          <div className="report-actions">
            <button className="report-print-btn" onClick={() => window.print()}>🖨️ 印刷</button>
            <button className="report-close-btn" onClick={onClose}>✕ 閉じる</button>
          </div>
        </div>

        {/* Print area */}
        <div className="print-area">
          <div className="report-header">
            <h2>松永工房　生産月別成績表</h2>
            <p>令和{selYear}年&nbsp;{selMonth}月度</p>
          </div>

          <table className="report-table">
            <thead>
              <tr>
                <th className="col-dept">部門 / 項目</th>
                <th className="col-num">前年同月実績</th>
                <th className="col-num">当月実績</th>
                <th className="col-pct">前年比</th>
                <th className="col-pct">前月比</th>
              </tr>
            </thead>
            <tbody>
              {/* 営業部 */}
              <tr className="section-header">
                <td colSpan={5}>【 営業部 】</td>
              </tr>
              {SALES_LABELS.map(({ key, label }) => {
                const c  = cur?.sales[key]   ?? 0;
                const pm = prevM?.sales[key] ?? 0;
                const py = prevY?.sales[key] ?? 0;
                return <Row key={key} label={label} py={py} cur={c} pm={pm} fmt={yen} indent />;
              })}
              <Row label="営業部　合計" py={stPrevY} cur={stCur} pm={stPrevM} fmt={yen} bold />

              {/* 木地製造部 */}
              <tr className="section-header">
                <td colSpan={5}>【 木地製造部 】</td>
              </tr>
              <Row
                label="本数" indent
                py={prevY?.kiji.count ?? 0} cur={cur?.kiji.count ?? 0} pm={prevM?.kiji.count ?? 0}
                fmt={hon}
              />
              <Row
                label="金額" indent
                py={prevY?.kiji.amount ?? 0} cur={cur?.kiji.amount ?? 0} pm={prevM?.kiji.amount ?? 0}
                fmt={yen}
              />

              {/* 塗装部 */}
              <tr className="section-header">
                <td colSpan={5}>【 塗装部 】</td>
              </tr>
              <Row
                label="本数" indent
                py={prevY?.tosou.count ?? 0} cur={cur?.tosou.count ?? 0} pm={prevM?.tosou.count ?? 0}
                fmt={hon}
              />
              <Row
                label="金額" indent
                py={prevY?.tosou.amount ?? 0} cur={cur?.tosou.amount ?? 0} pm={prevM?.tosou.amount ?? 0}
                fmt={yen}
              />

              {/* まとめ部 */}
              <tr className="section-header">
                <td colSpan={5}>【 まとめ部 】</td>
              </tr>
              <Row
                label="本数" indent
                py={prevY?.matome.count ?? 0} cur={cur?.matome.count ?? 0} pm={prevM?.matome.count ?? 0}
                fmt={hon}
              />
              <Row
                label="金額" indent
                py={prevY?.matome.amount ?? 0} cur={cur?.matome.amount ?? 0} pm={prevM?.matome.amount ?? 0}
                fmt={yen}
              />
            </tbody>
          </table>

          <div className="report-footer">
            作成日：{new Date().toLocaleDateString('ja-JP')}
          </div>
        </div>
      </div>
    </div>
  );
}
