import { KijiItem } from '../types';
import './KijiReport.css';

interface Props {
  year: number;
  month: number;
  items: KijiItem[];
  onClose: () => void;
}

export default function KijiReport({ year, month, items, onClose }: Props) {
  const active = items.filter(i => !i.excluded);
  const totalCount  = active.reduce((s, i) => s + i.count, 0);
  const totalAmount = active.reduce((s, i) => s + i.amount, 0);

  // Group by category for subtotals
  const cats = [...new Set(active.map(i => i.category || 'その他'))];

  return (
    <div className="kiji-report-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kiji-report-modal">

        {/* Controls (hidden on print) */}
        <div className="kiji-report-controls no-print">
          <span className="kiji-report-title-ctrl">
            令和{year}年 {month}月　木地部 生産高報告書
          </span>
          <div className="kiji-report-actions">
            <button className="report-print-btn" onClick={() => window.print()}>🖨️ 印刷</button>
            <button className="report-close-btn" onClick={onClose}>✕ 閉じる</button>
          </div>
        </div>

        {/* Print area */}
        <div className="kiji-print-area">
          <div className="kiji-report-header">
            <h2>木地部　生産高報告書</h2>
            <p>令和{year}年&nbsp;{month}月度</p>
          </div>

          {active.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', padding: '32px' }}>
              この月のデータがありません
            </p>
          ) : (
            <>
              <table className="kiji-report-table">
                <thead>
                  <tr>
                    <th className="kr-code">品番</th>
                    <th className="kr-cat">カテゴリー</th>
                    <th className="kr-name">品名</th>
                    <th className="kr-count">本数</th>
                    <th className="kr-price">単価</th>
                    <th className="kr-amount">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map(cat => {
                    const catItems = active.filter(i => (i.category || 'その他') === cat);
                    const catCount  = catItems.reduce((s, i) => s + i.count, 0);
                    const catAmount = catItems.reduce((s, i) => s + i.amount, 0);
                    return (
                      <>
                        {catItems.map((item, idx) => (
                          <tr key={`${cat}-${idx}`}>
                            <td className="kr-code">{item.code}</td>
                            <td className="kr-cat">{item.category}</td>
                            <td className="kr-name">{item.name}</td>
                            <td className="kr-count">{item.count}本</td>
                            <td className="kr-price">
                              {item.unitPrice > 0 ? `¥${item.unitPrice.toLocaleString()}` : '—'}
                            </td>
                            <td className="kr-amount">
                              {item.amount > 0 ? `¥${item.amount.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        ))}
                        {cats.length > 1 && (
                          <tr className="kr-cat-total">
                            <td colSpan={3} className="kr-name" style={{ textAlign: 'right' }}>
                              {cat}　小計
                            </td>
                            <td className="kr-count">{catCount}本</td>
                            <td />
                            <td className="kr-amount">
                              {catAmount > 0 ? `¥${catAmount.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="kr-total">
                    <td colSpan={3} style={{ textAlign: 'right' }}>合　計</td>
                    <td className="kr-count">{totalCount}本</td>
                    <td />
                    <td className="kr-amount">
                      {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          <div className="kiji-report-footer">
            作成日：{new Date().toLocaleDateString('ja-JP')}
          </div>
        </div>
      </div>
    </div>
  );
}
