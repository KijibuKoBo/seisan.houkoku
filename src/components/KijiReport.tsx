import { useRef, useState, useMemo } from 'react';
import { KijiItem } from '../types';
import { CATEGORY_FULL } from '../utils/productList';
import { loadKijiItems, getAvailableKijiYears } from '../utils/kijiStore';
import './KijiReport.css';

interface Props {
  defaultYear?: number;
  defaultMonth?: number;
  onClose: () => void;
}

const CAT_STYLE: Record<string, { bg: string; color: string }> = {
  'Co':    { bg: '#b2dfdb', color: '#00695c' },
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

// ── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ cats, items, getValue, unit }: {
  cats: string[];
  items: KijiItem[];
  getValue: (i: KijiItem) => number;
  unit: string;
}) {
  const total = items.reduce((s, i) => s + getValue(i), 0);
  if (total === 0) return <div className="kr-chart-empty">データなし</div>;

  const R = 48; const CX = 58; const CY = 58;
  let start = -Math.PI / 2;

  const slices = cats.map(cat => {
    const val = items.filter(i => (i.category || 'その他') === cat)
                     .reduce((s, i) => s + getValue(i), 0);
    const angle = (val / total) * 2 * Math.PI;
    const end = start + angle;
    const x1 = CX + R * Math.cos(start); const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end);   const y2 = CY + R * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    const path = val > 0 ? `M${CX},${CY} L${x1},${y1} A${R},${R},0,${large},1,${x2},${y2}Z` : '';
    start = end;
    return { cat, val, path, color: catStyle(cat).color };
  });

  return (
    <div className="kr-donut-wrap">
      <svg width="116" height="116" viewBox="0 0 116 116">
        {slices.map((s, i) => s.path && <path key={i} d={s.path} fill={s.color} opacity={0.82} />)}
        <circle cx={CX} cy={CY} r={R * 0.46} fill="white" />
      </svg>
      <div className="kr-donut-legend">
        {slices.filter(s => s.val > 0).map(s => (
          <div key={s.cat} className="kr-leg-row">
            <span className="kr-leg-dot" style={{ background: s.color }} />
            <span className="kr-leg-name">{CATEGORY_FULL[s.cat] ?? s.cat}</span>
            <span className="kr-leg-val">{unit === '本' ? `${s.val}本` : `¥${s.val.toLocaleString()}`}</span>
            <span className="kr-leg-pct">({((s.val / total) * 100).toFixed(1)}%)</span>
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

export default function KijiReport({ defaultYear, defaultMonth, onClose }: Props) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const availableYears = useMemo(() => {
    const ky = getAvailableKijiYears();
    return ky.length > 0 ? ky : [currentReiwa];
  }, []);
  const [year,  setYear]  = useState(defaultYear  ?? availableYears[0] ?? currentReiwa);
  const [month, setMonth] = useState(defaultMonth ?? new Date().getMonth() + 1);
  const items = useMemo(() => loadKijiItems(year, month), [year, month]);

  const modalRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);

  const fileName = `木地部生産高報告書_令和${year}年${month}月.pdf`;

  const buildPdfBlob = async (): Promise<Blob> => {
    const el = modalRef.current!;
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#f0f4f8' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    if (pdfH <= pdf.internal.pageSize.getHeight()) {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    } else {
      const pageH = pdf.internal.pageSize.getHeight();
      let y = 0;
      while (y < pdfH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -y, pdfW, pdfH);
        y += pageH;
      }
    }
    return pdf.output('blob');
  };

  const handlePdfExport = async () => {
    if (!modalRef.current) return;
    setPdfLoading(true);
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleLineShare = async () => {
    if (!modalRef.current) return;
    setLineLoading(true);
    try {
      const blob = await buildPdfBlob();
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        alert('このブラウザはファイル共有に対応していません。\nPDF出力してLINEから送信してください。');
      }
    } finally {
      setLineLoading(false);
    }
  };

  const active       = items.filter(i => !i.excluded);
  const totalCount   = active.reduce((s, i) => s + i.count,  0);
  const totalAmount  = items.reduce((s, i) => s + i.amount, 0);  // 本数に含まない品目も金額には含む
  const productCount = new Set(active.map(i => `${i.category}_${i.name}`)).size;
  const specialItems = active.filter(i => (i.category || 'その他') === '特注');
  const specialCount = new Set(specialItems.map(i => i.name)).size;

  // 除外含む全カテゴリーで行を並べるが、ドーナツ・備考は active のみ
  const cats  = [...new Set(items.map(i => i.category || 'その他'))];
  const today = new Date().toLocaleDateString('ja-JP');
  const notes = genNotes(totalCount, totalAmount, [...new Set(active.map(i => i.category || 'その他'))], active);

  return (
    <div className="kr-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kr-modal" ref={modalRef}>

        {/* ── Header ── */}
        <div className="kr-header">
          <div className="kr-header-left">
            <div className="kr-header-sub">令和{year}年{month}月　木地部 生産高報告書</div>
            <div className="kr-header-title">木地部 生産高報告書</div>
            <div className="kr-month-picker no-print">
              <select value={year} onChange={e => setYear(Number(e.target.value))}>
                {availableYears.map(y => <option key={y} value={y}>令和{y}年</option>)}
              </select>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                  <option key={m} value={m}>{m}月</option>
                )}
              </select>
            </div>
          </div>
          <div className="kr-header-right">
            <div className="kr-header-date">作成日：{today}</div>
            <div className="kr-header-btns no-print">
              <button className="kr-print-btn" onClick={() => {
                document.body.classList.add('kr-printing');
                window.addEventListener('afterprint', () => document.body.classList.remove('kr-printing'), { once: true });
                window.print();
              }}>🖨 印刷</button>
              <button className="kr-print-btn" onClick={handlePdfExport} disabled={pdfLoading}>
                {pdfLoading ? '生成中...' : '📄 PDF出力'}
              </button>
              <button className="kr-print-btn kr-line-btn" onClick={handleLineShare} disabled={lineLoading}>
                {lineLoading ? '生成中...' : '📤 LINEで送る'}
              </button>
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
                <div className="kr-sum-val">{productCount}品目</div>
              </div>
            </div>
            <div className="kr-sum-card">
              <div className="kr-sum-icon" style={{ background: '#6a1b9a' }}><IconClipboard /></div>
              <div>
                <div className="kr-sum-label">特注品</div>
                <div className="kr-sum-val">{specialCount}品目</div>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
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
                      const catItems = items.filter(i => (i.category || 'その他') === cat);
                      const cs = catStyle(cat);
                      return catItems.map((item, idx) => (
                        <tr key={`${cat}-${idx}`} className={`kr-data-row${item.excluded ? ' kr-excluded-row' : ''}`}>
                          <td className="kr-td-code">{item.code}</td>
                          <td className="kr-td-cat">
                            <span className="kr-cat-chip" style={{ background: cs.bg, color: cs.color }}>
                              {cat}
                            </span>
                          </td>
                          <td className="kr-td-name">{item.name}</td>
                          <td className="kr-td-count">
                            {item.excluded
                              ? <><span style={{ color: '#aaa' }}>{item.count}本</span><span className="kr-excluded-note">本数に含まない</span></>
                              : `${item.count}本`}
                          </td>
                          <td className="kr-td-price">
                            {item.unitPrice > 0 ? `¥${item.unitPrice.toLocaleString()}` : '—'}
                          </td>
                          <td className="kr-td-amount">
                            {item.amount > 0 ? `¥${item.amount.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      ));
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

              {/* Bottom row: donuts + notes */}
              <div className="kr-bottom-row">
                <div className="kr-bottom-card">
                  <div className="kr-bottom-title">カテゴリー別 本数割合</div>
                  <DonutChart cats={cats} items={active} getValue={i => i.count} unit="本" />
                </div>
                <div className="kr-bottom-card">
                  <div className="kr-bottom-title">カテゴリー別 金額割合</div>
                  <DonutChart cats={cats} items={items} getValue={i => i.amount} unit="円" />
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
