import { useState, useEffect } from 'react';
import { MonthData, emptyMonth, SalesData, KijiItem } from '../types';
import { formatAmount, salesTotal } from '../utils/calc';
import PdfUploader from './PdfUploader';
import { PdfParseResult } from '../utils/pdfParser';

interface Props {
  year: number;
  month: number;
  initial: MonthData | null;
  prevMonth: MonthData | null;
  prevYearMonth: MonthData | null;
  onSave: (data: MonthData, kijiItems: KijiItem[]) => void;
  onClose: () => void;
}

function numInput(value: number, onChange: (n: number) => void) {
  return (
    <input
      type="number"
      min={0}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={e => onChange(parseInt(e.target.value) || 0)}
    />
  );
}

export default function MonthModal({ year, month, initial, prevMonth, prevYearMonth, onSave, onClose }: Props) {
  const [data, setData] = useState<MonthData>(initial ?? emptyMonth(month));
  const [activeTab, setActiveTab] = useState<'sales' | 'kiji' | 'tosou' | 'matome'>('sales');
  const [pendingKijiItems, setPendingKijiItems] = useState<KijiItem[]>([]);

  useEffect(() => {
    setData(initial ?? emptyMonth(month));
  }, [initial, month]);

  const setSales = (key: keyof SalesData, val: number) => {
    setData(d => ({ ...d, sales: { ...d.sales, [key]: val } }));
  };

  const setSalesMemo = (key: keyof SalesData, val: string) => {
    setData(d => ({ ...d, salesMemo: { ...d.salesMemo, [key]: val } }));
  };

  const handlePdfResult = (result: PdfParseResult) => {
    setData(d => ({ ...d, kiji: { count: result.totalCount, amount: result.totalAmount } }));
    const items = result.items.map(i => ({ ...i, year, month }));
    setPendingKijiItems(items);
    setActiveTab('kiji');
  };

  const SALES_LABELS: [keyof SalesData, string][] = [
    ['otsuka', '大塚'],
    ['takumi', '匠'],
    ['butsudan', '仏壇'],
    ['ippanten', '一般店'],
    ['showroom', 'ショールーム'],
    ['bukken', 'その他'],
  ];

  const renderRef = (current: number, prev: number | undefined, label: string) => {
    if (prev === undefined || prev === 0) return null;
    const ratio = Math.round((current / prev) * 100);
    const sign = ratio >= 100 ? 'up' : 'down';
    return (
      <span className={`ref-badge ${sign}`}>
        {label} {formatAmount(prev)} ({ratio}%)
      </span>
    );
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>令和{year}年 {month}月 データ入力</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          {([
            ['sales', '営業部'],
            ['kiji', '木地部'],
            ['tosou', '塗装部'],
            ['matome', 'まとめ'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`tab-btn ${activeTab === key ? 'active' : ''} tab-${key}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {activeTab === 'sales' && (
            <div className="entry-section">
              <table className="entry-table">
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>金額（円）</th>
                    <th>備考</th>
                  </tr>
                </thead>
                <tbody>
                  {SALES_LABELS.map(([key, label]) => (
                    <tr key={key}>
                      <td className="label-cell">{label}</td>
                      <td>{numInput(data.sales[key], v => setSales(key, v))}</td>
                      <td className="ref-cell">
                        <input
                          type="text"
                          className="memo-input"
                          placeholder="備考"
                          value={data.salesMemo?.[key] ?? ''}
                          onChange={e => setSalesMemo(key, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="label-cell">合計</td>
                    <td className="num bold">¥{formatAmount(salesTotal(data.sales))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'kiji' && (
            <div className="entry-section">
              <div className="section-hint">PDFをアップロードすると本数・金額が自動入力されます（品番・品名も分析ページに保存されます）</div>
              <PdfUploader onResult={handlePdfResult} contextYear={year} contextMonth={month} />
              <table className="entry-table" style={{ marginTop: '1rem' }}>
                <tbody>
                  <tr>
                    <td className="label-cell">本数</td>
                    <td>
                      {numInput(data.kiji.count, v => setData(d => ({ ...d, kiji: { ...d.kiji, count: v } })))}
                      <span className="unit">本</span>
                    </td>
                    <td className="ref-cell">
                      {renderRef(data.kiji.count, prevYearMonth?.kiji.count, '前年')}
                      {renderRef(data.kiji.count, prevMonth?.kiji.count, '前月')}
                    </td>
                  </tr>
                  <tr>
                    <td className="label-cell">金額</td>
                    <td>
                      {numInput(data.kiji.amount, v => setData(d => ({ ...d, kiji: { ...d.kiji, amount: v } })))}
                      <span className="unit">円</span>
                    </td>
                    <td className="ref-cell">
                      {renderRef(data.kiji.amount, prevYearMonth?.kiji.amount, '前年')}
                      {renderRef(data.kiji.amount, prevMonth?.kiji.amount, '前月')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'tosou' && (
            <div className="entry-section">
              <table className="entry-table">
                <tbody>
                  <tr>
                    <td className="label-cell">本数</td>
                    <td>
                      {numInput(data.tosou.count, v => setData(d => ({ ...d, tosou: { ...d.tosou, count: v } })))}
                      <span className="unit">本</span>
                    </td>
                    <td className="ref-cell">
                      {renderRef(data.tosou.count, prevYearMonth?.tosou.count, '前年')}
                      {renderRef(data.tosou.count, prevMonth?.tosou.count, '前月')}
                    </td>
                  </tr>
                  <tr>
                    <td className="label-cell">金額</td>
                    <td>
                      {numInput(data.tosou.amount, v => setData(d => ({ ...d, tosou: { ...d.tosou, amount: v } })))}
                      <span className="unit">円</span>
                    </td>
                    <td className="ref-cell">
                      {renderRef(data.tosou.amount, prevYearMonth?.tosou.amount, '前年')}
                      {renderRef(data.tosou.amount, prevMonth?.tosou.amount, '前月')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'matome' && (
            <div className="entry-section">
              <table className="entry-table">
                <tbody>
                  <tr>
                    <td className="label-cell">本数</td>
                    <td>
                      {numInput(data.matome.count, v => setData(d => ({ ...d, matome: { ...d.matome, count: v } })))}
                      <span className="unit">本</span>
                    </td>
                    <td className="ref-cell">
                      {renderRef(data.matome.count, prevYearMonth?.matome.count, '前年')}
                      {renderRef(data.matome.count, prevMonth?.matome.count, '前月')}
                    </td>
                  </tr>
                  <tr>
                    <td className="label-cell">金額</td>
                    <td>
                      {numInput(data.matome.amount, v => setData(d => ({ ...d, matome: { ...d.matome, amount: v } })))}
                      <span className="unit">円</span>
                    </td>
                    <td className="ref-cell">
                      {renderRef(data.matome.amount, prevYearMonth?.matome.amount, '前年')}
                      {renderRef(data.matome.amount, prevMonth?.matome.amount, '前月')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" onClick={() => onSave(data, pendingKijiItems)}>保存</button>
        </div>
      </div>
    </div>
  );
}
