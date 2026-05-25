import { KijiItem } from '../types';
import './KijiReport.css';

interface Props {
  year: number;
  month: number;
  items: KijiItem[];
  onClose: () => void;
}

const CAT_STYLE: Record<string, { bg: string; color: string }> = {
  'Ca':    { bg: '#b2dfdb', color: '#00695c' },
  'MP':    { bg: '#b3e5fc', color: '#01579b' },
  '仏壇':  { bg: '#e1bee7', color: '#6a1b9a' },
  'リリー':{ bg: '#f8bbd0', color: '#880e4f' },
  'PC':    { bg: '#bbdefb', color: '#1565c0' },
  '特注':  { bg: '#fff9c4', color: '#e65100' },
  'その他':{ bg: '#f5f5f5', color: '#757575' },
};

function catStyle(cat: string) {
  return CAT_STYLE[cat] ?? { bg: '#f0f0f0', color: '#555' };
}

function catAbbr(cat: string) {
  return cat === '仏壇' ? '仏' : cat;
}

// ── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ cats, active }: { cats: string[]; active: KijiItem[] }) {
  const total = active.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <div className="kr-chart-empty">データなし</div>;

  const R = 48; const CX = 58; const CY = 58;
  let start = -Math.PI / 2;

  const slices = cats.map(cat => {
    const cnt = active.filter(i => (i.category || 'その他') === cat)
                      .reduce((s, i) => s + i.count, 0);
    const angle = (cnt / total) * 2 * Math.PI;
    const end = start + angle;
    const x1 = CX + R * Math.cos(start); const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end);   const y2 = CY + R * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    const path = cnt > 0 ? `M${CX},${CY} L${x1},${y1} A${R},${R},0,${large},1,${x2},${y2}Z` : '';
    start = end;
    return { cat, cnt, path, color: catStyle(cat).color };
  });

  return (
    <div className="kr-donut-wrap">
      <svg width="116" height="116" viewBox="0 0 116 116">
        {slices.map((s, i) => s.path && <path key={i} d={s.path} fill={s.color} opacity={0.82} />)}
        <circle cx={CX} cy={CY} r={R * 0.46} fill="white" />
      </svg>
      <div className="kr-donut-legend">
        {slices.filter(s => s.cnt > 0).map(s => (
          <div key={s.cat} className="kr-leg-row">
            <span className="kr-leg-dot" style={{ background: s.color }} />
            <span className="kr-leg-name">{s.cat}</span>
            <span className="kr-leg-val">{s.cnt}本</span>
            <span className="kr-leg-pct">({((s.cnt / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Auto notes ───────────────────────────────────────────────────────────────

function genNotes(totalCount: number, totalAmount: number, cats: string[], active: KijiItem[]): string[] {
  const notes: string[] = [];
  notes.push(`今月の総生産本数は ${totalCount}本、総額は ¥${totalAmount.toLocaleString()} でした。`);

  if (cats.length > 0 && totalCount > 0) {
    const topCat = cats.reduce((best, cat) => {
      const c  = active.filter(i => (i.category || 'その他') === cat).reduce((s, i) => s + i.count, 0);
      const bc = active.filter(i => (i.category || 'その他') === best).reduce((s, i) => s + i.count, 0);
      return c > bc ? cat : best;
    }, cats[0]);
    const topCnt = active.filter(i => (i.category || 'その他') === topCat).reduce((s, i) => s + i.count, 0);
    const pct = Math.round((topCnt / totalCount) * 100);
    notes.push(`${topCat}カテゴリが全体の約 ${pct}% を占めています。`);
  }

  const special = active.filter(i => (i.category || 'その他') === '特注');
  if (special.length > 0) {
    const names = [...new Set(special.map(i => i.name))].join('、');
    notes.push(`特注品は ${new Set(special.map(i => i.name)).size}品番（${names}）です。`);
  }

  return notes;
}

// ── Icon SVG helpers ─────────────────────────────────────────────────────────

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  );
}
function IconYen() {
  return <span style={{ fontSize: 20, fontWeight: 'bold', lineHeight: 1 }}>¥</span>;
}
function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KijiReport({ year, month, items, onClose }: Props) {
  const active       = items.filter(i => !i.excluded);
  const totalCount   = active.reduce((s, i) => s + i.count,  0);
  const totalAmount  = active.reduce((s, i) => s + i.amount, 0);
  const productCount = new Set(active.map(i => `${i.category}_${i.name}`)).size;
  const specialItems = active.filter(i => (i.category || 'その他') === '特注');
  const specialCount = new Set(specialItems.map(i => i.name)).size;

  const cats  = [...new Set(active.map(i => i.category || 'その他'))];
  const today = new Date().toLocaleDateString('ja-JP');
  const notes = genNotes(totalCount, totalAmount, cats, active);

  return (
    <div className="kr-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kr-modal">

        {/* ── Header ── */}
        <div className="kr-header">
          <div className="kr-header-left">
            <div className="kr-header-sub">令和{year}年{month}月　木地部 生産高報告書</div>
            <div className="kr-header-title">木地部 生産高報告書</div>
          </div>
          <div className="kr-header-right">
            <div className="kr-header-date">作成日：{today}</div>
            <div className="kr-header-btns no-print">
              <button className="kr-print-btn" onClick={() => {
                document.body.classList.add('kr-printing');
                window.addEventListener('afterprint', () => document.body.classList.remove('kr-printing'), { once: true });
                window.print();
              }}>🖨 印刷</button>
              <button className="kr-close-btn" onClick={onClose}>✕ 閉じる</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="kr-body">

          {/* Summary cards */}
          <div className="kr-summary-row">
            <div className="kr-sum-card">
              <div className="kr-sum-icon" style={{ background: '#1a3a5c' }}><IconBox /></div>
              <div>
                <div className="kr-sum-label">合計本数</div>
                <div className="kr-sum-val">{totalCount}本</div>
              </div>
            </div>
            <div className="kr-sum-card">
              <div className="kr-sum-icon" style={{ background: '#00897b' }}><IconYen /></div>
              <div>
                <div className="kr-sum-label">合計金額</div>
                <div className="kr-sum-val">{totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : '—'}</div>
              </div>
            </div>
            <div className="kr-sum-card">
              <div className="kr-sum-icon" style={{ background: '#1565c0' }}><IconDoc /></div>
              <div>
                <div className="kr-sum-label">商品数</div>
                <div className="kr-sum-val">{productCount}品番</div>
              </div>
            </div>
            <div className="kr-sum-card">
              <div className="kr-sum-icon" style={{ background: '#6a1b9a' }}><IconClipboard /></div>
              <div>
                <div className="kr-sum-label">特注品</div>
                <div className="kr-sum-val">{specialCount}品番</div>
              </div>
            </div>
          </div>

          {active.length === 0 ? (
            <div className="kr-empty">この月のデータがありません</div>
          ) : (
            <>
              {/* Table section */}
              <div className="kr-section-wrap">
                <div className="kr-section-badge">生産明細</div>
                <table className="kr-table">
                  <thead>
                    <tr>
                      <th className="kr-th-code">品番</th>
                      <th className="kr-th-cat">カテゴリー</th>
                      <th className="kr-th-name">品名</th>
                      <th className="kr-th-count">本数</th>
                      <th className="kr-th-price">単価</th>
                      <th className="kr-th-amount">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map(cat => {
                      const catItems  = active.filter(i => (i.category || 'その他') === cat);
                      const catCount  = catItems.reduce((s, i) => s + i.count,  0);
                      const catAmount = catItems.reduce((s, i) => s + i.amount, 0);
                      const cs = catStyle(cat);
                      return (
                        <>
                          {catItems.map((item, idx) => (
                            <tr key={`${cat}-${idx}`} className="kr-data-row">
                              <td className="kr-td-code">{item.code}</td>
                              <td className="kr-td-cat">
                                <span className="kr-cat-chip" style={{ background: cs.bg, color: cs.color }}>
                                  {catAbbr(cat)}
                                </span>
                              </td>
                              <td className="kr-td-name">{item.name}</td>
                              <td className="kr-td-count">{item.count}本</td>
                              <td className="kr-td-price">
                                {item.unitPrice > 0 ? `¥${item.unitPrice.toLocaleString()}` : '—'}
                              </td>
                              <td className="kr-td-amount">
                                {item.amount > 0 ? `¥${item.amount.toLocaleString()}` : '—'}
                              </td>
                            </tr>
                          ))}
                          <tr className="kr-subtotal-row">
                            <td colSpan={3} className="kr-subtotal-label">
                              {catAbbr(cat)} 小計
                            </td>
                            <td className="kr-subtotal-count">{catCount}本</td>
                            <td />
                            <td className="kr-subtotal-amount" style={{ color: cs.color }}>
                              {catAmount > 0 ? `¥${catAmount.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="kr-total-row">
                      <td colSpan={3} className="kr-total-label">合　計</td>
                      <td className="kr-total-count">{totalCount}本</td>
                      <td className="kr-total-price">—</td>
                      <td className="kr-total-amount">
                        {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bottom row: donut + notes */}
              <div className="kr-bottom-row">
                <div className="kr-bottom-card">
                  <div className="kr-bottom-title">カテゴリー別 本数割合</div>
                  <DonutChart cats={cats} active={active} />
                </div>
                <div className="kr-bottom-card">
                  <div className="kr-bottom-title">📋 備考</div>
                  <ul className="kr-notes-list">
                    {notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
