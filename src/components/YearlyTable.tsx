import { YearStore, MonthData } from '../types';
import {
  salesTotal, yearTotal, yearAvg, yoyRatio,
  formatAmount, formatRatio, GETTERS
} from '../utils/calc';

interface Props {
  year: number;
  store: YearStore;
  onEditMonth: (month: number) => void;
  readOnly?: boolean;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type RowDef = {
  label: string;
  indent?: boolean;
  className?: string;
  getter: (m: MonthData) => number;
  isCount?: boolean;
};

const ROWS: RowDef[] = [
  { label: '営業', className: 'row-sales', getter: GETTERS.salesTotal },
  { label: '　大塚', indent: true, className: 'row-sales-sub', getter: GETTERS.otsuka },
  { label: '　匠', indent: true, className: 'row-sales-sub', getter: GETTERS.takumi },
  { label: '　仏壇', indent: true, className: 'row-sales-sub', getter: GETTERS.butsudan },
  { label: '　一般店', indent: true, className: 'row-sales-sub', getter: GETTERS.ippanten },
  { label: '　ショールーム', indent: true, className: 'row-sales-sub', getter: GETTERS.showroom },
  { label: '　物件', indent: true, className: 'row-sales-sub', getter: GETTERS.bukken },
  { label: '木地（金額）', className: 'row-kiji', getter: GETTERS.kijiAmount },
  { label: '木地（本数）', className: 'row-kiji', getter: GETTERS.kijiCount, isCount: true },
  { label: '塗装（金額）', className: 'row-tosou', getter: GETTERS.tosouAmount },
  { label: '塗装（本数）', className: 'row-tosou', getter: GETTERS.tosouCount, isCount: true },
  { label: 'まとめ（金額）', className: 'row-matome', getter: GETTERS.matomeAmount },
  { label: 'まとめ（本数）', className: 'row-matome', getter: GETTERS.matomeCount, isCount: true },
];

function CellValue({ value, isCount }: { value: number; isCount?: boolean }) {
  if (value === 0) return <span className="zero">0</span>;
  if (isCount) return <>{value.toLocaleString('ja-JP')}本</>;
  return <>{formatAmount(value)}</>;
}

export default function YearlyTable({ year, store, onEditMonth, readOnly }: Props) {
  const months = store[year] ?? {};

  return (
    <div className="table-wrapper">
      <table className="yearly-table">
        <thead>
          <tr>
            <th className="label-col">令和{year}年</th>
            {MONTHS.map(m => (
              <th key={m} className="month-col">
                <button className="month-btn" onClick={() => !readOnly && onEditMonth(m)} style={readOnly ? { cursor: 'default' } : {}}>
                  {m}月
                  {months[m] && <span className="has-data" title="データあり">●</span>}
                </button>
              </th>
            ))}
            <th className="sum-col">年計</th>
            <th className="avg-col">月平均</th>
            <th className="yoy-col">前年比</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => {
            const total = yearTotal(store, year, row.getter);
            const avg = yearAvg(store, year, row.getter);
            const yoy = yoyRatio(store, year, row.getter);
            return (
              <tr key={row.label} className={row.className ?? ''}>
                <td className="label-col">{row.label}</td>
                {MONTHS.map(m => {
                  const md = months[m];
                  const val = md ? row.getter(md) : 0;
                  return (
                    <td
                      key={m}
                      className={`data-cell ${readOnly ? '' : 'editable'}`}
                      onClick={() => !readOnly && onEditMonth(m)}
                      title={readOnly ? '' : 'クリックして編集'}
                    >
                      <CellValue value={val} isCount={row.isCount} />
                    </td>
                  );
                })}
                <td className="sum-col bold">
                  <CellValue value={total} isCount={row.isCount} />
                </td>
                <td className="avg-col">
                  <CellValue value={avg} isCount={row.isCount} />
                </td>
                <td className={`yoy-col ${yoy !== null ? (yoy >= 100 ? 'yoy-up' : 'yoy-down') : ''}`}>
                  {formatRatio(yoy)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="footer-note">
            <td colSpan={MONTHS.length + 4}>
              {readOnly ? '※ 閲覧モード（編集権限なし）' : '※ 月のセルをクリックするとデータを入力できます'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function CompactSummary({ year, store }: { year: number; store: YearStore }) {
  const kijiTotal = yearTotal(store, year, GETTERS.kijiAmount);
  const kijiYoy = yoyRatio(store, year, GETTERS.kijiAmount);
  const salesTotalVal = yearTotal(store, year, GETTERS.salesTotal);
  const salesYoy = yoyRatio(store, year, GETTERS.salesTotal);

  return (
    <div className="compact-summary">
      <div className="summary-card card-kiji">
        <div className="card-label">木地 年計</div>
        <div className="card-value">¥{formatAmount(kijiTotal)}</div>
        <div className={`card-yoy ${kijiYoy !== null ? (kijiYoy >= 100 ? 'up' : 'down') : ''}`}>
          前年比 {formatRatio(kijiYoy)}
        </div>
      </div>
      <div className="summary-card card-sales">
        <div className="card-label">営業 年計</div>
        <div className="card-value">¥{formatAmount(salesTotalVal)}</div>
        <div className={`card-yoy ${salesYoy !== null ? (salesYoy >= 100 ? 'up' : 'down') : ''}`}>
          前年比 {formatRatio(salesYoy)}
        </div>
      </div>
      <div className="summary-card card-kiji">
        <div className="card-label">木地 本数 年計</div>
        <div className="card-value">{yearTotal(store, year, GETTERS.kijiCount).toLocaleString('ja-JP')}本</div>
        <div className={`card-yoy ${(yoyRatio(store, year, GETTERS.kijiCount) ?? 100) >= 100 ? 'up' : 'down'}`}>
          前年比 {formatRatio(yoyRatio(store, year, GETTERS.kijiCount))}
        </div>
      </div>
    </div>
  );
}
