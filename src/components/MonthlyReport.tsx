import { useState, useRef } from 'react';
import { YearStore, MonthData, SalesData } from '../types';
import './MonthlyReport.css';

interface Props {
  store: YearStore;
  defaultYear: number;
  defaultMonth?: number;
  onClose: () => void;
}

const CHANNELS: { key: keyof SalesData; label: string; color: string; abbr: string }[] = [
  { key: 'otsuka',    label: '大塚',        color: '#4472C4', abbr: '大' },
  { key: 'takumi',   label: '匠',          color: '#5BA554', abbr: '匠' },
  { key: 'butsudan', label: '仏壇',        color: '#7B2D8B', abbr: '仏' },
  { key: 'ippanten', label: '一般店',      color: '#E67E22', abbr: '店' },
  { key: 'showroom', label: '直販', color: '#E74C3C', abbr: 'SR' },
  { key: 'bukken',   label: 'その他',      color: '#95A5A6', abbr: '他' },
];

const SECTIONS = [
  { key: 'kiji',   title: '木地製造部', icon: '🪵', color: '#2e7d32' },
  { key: 'tosou',  title: '塗装部',     icon: '🎨', color: '#1565c0' },
  { key: 'matome', title: 'まとめ部',   icon: '📦', color: '#6a1b9a' },
] as const;

function stTotal(d: MonthData | null | undefined): number {
  if (!d) return 0;
  return d.sales.otsuka + d.sales.takumi + d.sales.butsudan +
         d.sales.ippanten + d.sales.showroom + d.sales.bukken;
}

function calcPct(cur: number, base: number): number | null {
  return base > 0 ? Math.round((cur / base) * 100) : null;
}

function pctStr(cur: number, base: number): string {
  const p = calcPct(cur, base);
  return p !== null ? `${p}%` : '—';
}

function yen(n: number): string {
  return n === 0 ? '—' : `¥${n.toLocaleString('ja-JP')}`;
}

function PctCell({ cur, base, className }: { cur: number; base: number; className?: string }) {
  const p = calcPct(cur, base);
  const dir = p === null ? 'na' : p >= 100 ? 'up' : 'down';
  return <span className={`pct-val ${dir} ${className ?? ''}`}>{p !== null ? `${p}%` : '—'}</span>;
}

// ─── Section bar chart ────────────────────────────────────────────────────────

function SectionBarChart({ prevCount, curCount, prevAmount, curAmount, color }:
  { prevCount: number; curCount: number; prevAmount: number; curAmount: number; color: string }) {

  const cp = prevCount  > 0 ? Math.min(Math.round((curCount  / prevCount)  * 100), 200) : 0;
  const ap = prevAmount > 0 ? Math.min(Math.round((curAmount / prevAmount) * 100), 200) : 0;
  const maxP = Math.max(cp, ap, 110);
  const H = 100; const chartH = 72; const btm = H - 16;

  const barH = (v: number) => Math.round((v / maxP) * chartH);
  const yPos = (v: number) => btm - barH(v);

  return (
    <svg width="130" height={H} viewBox={`0 0 130 ${H}`} style={{ overflow: 'visible' }}>
      {[0, 50, 100, ...(maxP > 110 ? [150] : [])].map(v => {
        const y = btm - (v / maxP) * chartH;
        return (
          <g key={v}>
            <line x1="14" x2="126" y1={y} y2={y} stroke="#e8e8e8" strokeWidth="0.8" />
            <text x="12" y={y + 3} textAnchor="end" fontSize="7" fill="#bbb">{v}%</text>
          </g>
        );
      })}
      {/* 本数 group */}
      <rect x="18" y={yPos(100)} width="18" height={barH(100)} fill="#d8d8d8" rx="2" />
      <rect x="38" y={yPos(cp)}  width="18" height={barH(cp)}  fill={color} rx="2" opacity={0.9} />
      <text x="37" y={btm + 11} textAnchor="middle" fontSize="7.5" fill="#666">本数</text>
      {/* 金額 group */}
      <rect x="72" y={yPos(100)} width="18" height={barH(100)} fill="#d8d8d8" rx="2" />
      <rect x="92" y={yPos(ap)}  width="18" height={barH(ap)}  fill={color} rx="2" opacity={0.9} />
      <text x="91" y={btm + 11} textAnchor="middle" fontSize="7.5" fill="#666">金額</text>
    </svg>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ cur, prevY }: { cur: MonthData | null; prevY: MonthData | null }) {
  const total = stTotal(cur);
  const R = 52; const CX = 65; const CY = 65;

  if (total === 0) {
    return <div className="chart-empty-sm">データなし</div>;
  }

  let startAngle = -Math.PI / 2;
  const slices = CHANNELS.map(ch => {
    const val = cur?.sales[ch.key] ?? 0;
    const angle = total > 0 ? (val / total) * 2 * Math.PI : 0;
    const end = startAngle + angle;
    const x1 = CX + R * Math.cos(startAngle); const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(end);         const y2 = CY + R * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    const path = val > 0 ? `M${CX},${CY} L${x1},${y1} A${R},${R},0,${large},1,${x2},${y2}Z` : '';
    const p = calcPct(val, prevY?.sales[ch.key] ?? 0);
    startAngle = end;
    return { ...ch, val, p, path };
  });

  return (
    <div className="mr-donut-wrap">
      <svg width="130" height="130" viewBox="0 0 130 130">
        {slices.map((s, i) => s.path && <path key={i} d={s.path} fill={s.color} opacity={0.88} />)}
        <circle cx={CX} cy={CY} r={R * 0.5} fill="white" />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="8.5" fill="#777">営業合計</text>
      </svg>
      <div className="mr-donut-legend">
        {slices.map(s => (
          <div key={s.key} className="mr-legend-row">
            <span className="mr-legend-dot" style={{ background: s.color }} />
            <span className="mr-legend-name">{s.label}</span>
            <span className={`mr-legend-pct ${s.p === null ? 'na' : s.p >= 100 ? 'up' : 'down'}`}>
              {s.p !== null ? `${s.p}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Auto insights ────────────────────────────────────────────────────────────

function genPoints(cur: MonthData | null, prevY: MonthData | null): string[] {
  if (!cur) return [];
  const pts: string[] = [];

  const ranked = CHANNELS.map(ch => ({
    label: ch.label,
    cur: cur.sales[ch.key] ?? 0,
    p: calcPct(cur.sales[ch.key] ?? 0, prevY?.sales[ch.key] ?? 0),
  })).filter(c => c.cur > 0 && c.p !== null).sort((a, b) => (b.p ?? 0) - (a.p ?? 0));

  if (ranked.length > 0 && ranked[0].p !== null) {
    const best = ranked[0];
    pts.push(best.p! >= 110
      ? `${best.label}部門が前年同月比${best.p}%と大きく伸長し、全体の売上を牽引しています。`
      : best.p! >= 100
        ? `${best.label}部門が前年同月比${best.p}%とプラス成長を達成しています。`
        : `全部門で前年実績を下回っており、厳しい状況が続いています。`);
  }

  const bp = calcPct(cur.sales.butsudan, prevY?.sales.butsudan ?? 0);
  if (bp !== null && cur.sales.butsudan > 0) {
    pts.push(bp >= 100
      ? `仏壇部門もプラス成長となり、堅調に推移しています。`
      : `仏壇部門は前年同月比${bp}%と苦戦しています。`);
  }

  const kp = calcPct(cur.kiji.count, prevY?.kiji.count ?? 0);
  const ka = calcPct(cur.kiji.amount, prevY?.kiji.amount ?? 0);
  if (kp !== null || ka !== null) {
    pts.push((kp ?? 0) < 100 && (ka ?? 0) >= 90
      ? `木地製造部・まとめ部の本数は前年を下回っていますが、金額面では一定の成果を確保しています。`
      : (kp ?? 0) >= 100
        ? `木地製造部は本数・金額ともに前年を上回る好調な実績となっています。`
        : `木地製造部は本数・金額ともに前年を下回っており、改善が必要な状況です。`);
  }

  return pts.slice(0, 3);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MonthlyReport({ store, defaultYear, defaultMonth, onClose }: Props) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const allYears = [...new Set([...Object.keys(store).map(Number), currentReiwa])].sort((a, b) => b - a);

  const [selYear, setSelYear]   = useState(defaultYear);
  const [selMonth, setSelMonth] = useState(defaultMonth ?? new Date().getMonth() + 1);
  const [orient, setOrient]     = useState<'portrait' | 'landscape'>('portrait');
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const cur   = store[selYear]?.[selMonth]      ?? null;
  const prevM = selMonth === 1
    ? (store[selYear - 1]?.[12]     ?? null)
    : (store[selYear]?.[selMonth - 1] ?? null);
  const prevY = store[selYear - 1]?.[selMonth]  ?? null;

  const stCur   = stTotal(cur);
  const stPrevM = stTotal(prevM);
  const stPrevY = stTotal(prevY);
  const stPct   = calcPct(stCur, stPrevY);
  const today   = new Date().toLocaleDateString('ja-JP');
  const points  = genPoints(cur, prevY);

  const fileName = `月次報告書_令和${selYear}年${selMonth}月.pdf`;

  const buildPdfBlob = async (): Promise<Blob> => {
    const el = modalRef.current!;
    const hidden = Array.from(el.querySelectorAll<HTMLElement>('.no-print'));
    hidden.forEach(e => { e.style.display = 'none'; });
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: orient, unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const aspect = canvas.width / canvas.height;
      let w = pageW; let h = pageW / aspect;
      if (h > pageH) { h = pageH; w = pageH * aspect; }
      pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      return pdf.output('blob');
    } finally {
      hidden.forEach(e => { e.style.display = ''; });
    }
  };

  const handlePdfExport = async () => {
    if (!modalRef.current) return;
    setPdfLoading(true);
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally { setPdfLoading(false); }
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
    } finally { setLineLoading(false); }
  };

  const handlePrint = () => {
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 ${orient}; margin: 9mm; }`;
    document.head.appendChild(style);
    document.body.classList.add('mr-printing');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('mr-printing');
      document.head.removeChild(style);
    }, { once: true });
    window.print();
  };

  const channelLabel = (ch: typeof CHANNELS[0]) =>
    ch.key === 'bukken' && cur?.salesMemo?.bukken
      ? `${ch.label}（${cur.salesMemo.bukken}）`
      : ch.label;

  const secData = (key: 'kiji' | 'tosou' | 'matome') => ({
    count:       cur?.[key].count  ?? 0,
    amount:      cur?.[key].amount ?? 0,
    prevYCount:  prevY?.[key].count  ?? 0,
    prevYAmount: prevY?.[key].amount ?? 0,
  });

  return (
    <div className="mr-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mr-modal" ref={modalRef}>

        {/* ── Header ── */}
        <div className="mr-header">
          <div>
            <div className="mr-company">松永工房</div>
            <div className="mr-title">生産月別成績表</div>
            <div className="mr-period">令和{selYear}年 {selMonth}月度</div>
          </div>
          <div className="mr-header-right">
            <div className="mr-created">作成日：{today}</div>
            <div className="mr-hcontrols no-print">
              <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
                {allYears.map(y => <option key={y} value={y}>令和{y}年</option>)}
              </select>
              <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
                {Array.from({length:12},(_,i)=>i+1).map(m =>
                  <option key={m} value={m}>{m}月</option>)}
              </select>
              <div className="mr-orient-toggle">
                <button
                  className={`mr-orient-btn ${orient === 'portrait' ? 'active' : ''}`}
                  onClick={() => setOrient('portrait')}
                  title="縦向き"
                >縦</button>
                <button
                  className={`mr-orient-btn ${orient === 'landscape' ? 'active' : ''}`}
                  onClick={() => setOrient('landscape')}
                  title="横向き"
                >横</button>
              </div>
              <button className="mr-print-btn" onClick={handlePrint}>🖨 印刷</button>
              <button className="mr-print-btn" onClick={handlePdfExport} disabled={pdfLoading}>
                {pdfLoading ? '生成中...' : '📄 PDF'}
              </button>
              <button className="mr-print-btn mr-line-btn" onClick={handleLineShare} disabled={lineLoading}>
                {lineLoading ? '生成中...' : '📤 LINE'}
              </button>
              <button className="mr-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="mr-body">

          {/* Top row: summary card + donut */}
          <div className="mr-top-row">
            <div className="mr-card">
              <div className="mr-card-label">全体サマリー（合計）</div>
              <div className="mr-summary-grid">
                <div>
                  <div className="mr-sg-head">当月実績</div>
                  <div className="mr-sg-big">{stCur > 0 ? `¥${stCur.toLocaleString()}` : '—'}</div>
                </div>
                <div>
                  <div className="mr-sg-head">前年同月実績</div>
                  <div className="mr-sg-prev">{stPrevY > 0 ? `¥${stPrevY.toLocaleString()}` : '—'}</div>
                </div>
                <div>
                  <div className="mr-sg-head">前年同月比</div>
                  <div className={`mr-sg-ratio ${stPct === null ? 'na' : stPct >= 100 ? 'up' : 'down'}`}>
                    {stPct !== null ? `${stPct}%` : '—'}
                    {stPct !== null && stPct >= 100 && ' ↗'}
                    {stPct !== null && stPct < 100  && ' ↘'}
                  </div>
                </div>
                <div>
                  <div className="mr-sg-head">前月比</div>
                  <div className={`mr-sg-ratio ${(() => { const p = calcPct(stCur, stPrevM); return p === null ? 'na' : p >= 100 ? 'up' : 'down'; })()}`}>
                    {pctStr(stCur, stPrevM)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mr-card">
              <div className="mr-card-label">部門別 前年同月比</div>
              <DonutChart cur={cur} prevY={prevY} />
            </div>
          </div>

          {/* Department table */}
          <div className="mr-sec-title">部門別実績</div>
          <table className="mr-dept-table">
            <thead>
              <tr>
                <th className="mr-th-name">部門 / 項目</th>
                <th className="mr-th-num">前年同月実績</th>
                <th className="mr-th-num">当月実績</th>
                <th className="mr-th-pct">前年同月比</th>
                <th className="mr-th-pct">前月比</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map(ch => {
                const c  = cur?.sales[ch.key]   ?? 0;
                const py = prevY?.sales[ch.key] ?? 0;
                const pm = prevM?.sales[ch.key] ?? 0;
                const p  = calcPct(c, py);
                const pm2 = calcPct(c, pm);
                return (
                  <tr key={ch.key} className="mr-dept-row">
                    <td>
                      <div className="mr-dept-cell">
                        <span className="mr-icon-circle" style={{ background: ch.color }}>{ch.abbr}</span>
                        {channelLabel(ch)}
                      </div>
                    </td>
                    <td className="mr-td-num">{yen(py)}</td>
                    <td className="mr-td-num">{yen(c)}</td>
                    <td className="mr-td-pct">
                      <PctCell cur={c} base={py} />
                    </td>
                    <td className="mr-td-pct">
                      <PctCell cur={c} base={pm} />
                    </td>
                  </tr>
                );
              })}
              <tr className="mr-dept-total">
                <td><div className="mr-dept-cell">営業部　合計</div></td>
                <td className="mr-td-num">{yen(stPrevY)}</td>
                <td className="mr-td-num">{yen(stCur)}</td>
                <td className="mr-td-pct"><PctCell cur={stCur} base={stPrevY} /></td>
                <td className="mr-td-pct"><PctCell cur={stCur} base={stPrevM} /></td>
              </tr>
            </tbody>
          </table>

          {/* Section cards */}
          <div className="mr-sec-cards">
            {SECTIONS.map(s => {
              const d = secData(s.key);
              const cp = calcPct(d.count,  d.prevYCount);
              const ap = calcPct(d.amount, d.prevYAmount);
              return (
                <div key={s.key} className="mr-sec-card" style={{ borderTop: `4px solid ${s.color}` }}>
                  <div className="mr-sc-title" style={{ color: s.color }}>
                    {s.icon} {s.title}
                  </div>
                  <div className="mr-sc-row">
                    <span className="mr-sc-label">本数</span>
                    <span className="mr-sc-val">{d.count > 0 ? `${d.count.toLocaleString()}本` : '—'}</span>
                    {cp !== null && (
                      <span className={`mr-sc-pct ${cp >= 100 ? 'up' : 'down'}`}>（前年比 {cp}%）</span>
                    )}
                  </div>
                  <div className="mr-sc-row">
                    <span className="mr-sc-label">金額</span>
                    <span className="mr-sc-val">{yen(d.amount)}</span>
                    {ap !== null && (
                      <span className={`mr-sc-pct ${ap >= 100 ? 'up' : 'down'}`}>（前年比 {ap}%）</span>
                    )}
                  </div>
                  <div className="mr-chart-wrap">
                    <SectionBarChart
                      prevCount={d.prevYCount} curCount={d.count}
                      prevAmount={d.prevYAmount} curAmount={d.amount}
                      color={s.color}
                    />
                    <div className="mr-chart-legend">
                      <span><span className="mr-legend-sq" style={{ background: '#d8d8d8' }} />前年同月</span>
                      <span><span className="mr-legend-sq" style={{ background: s.color }} />当月</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Points */}
          {points.length > 0 && (
            <div className="mr-points">
              <div className="mr-points-title">💡 ポイント</div>
              <ul className="mr-points-list">
                {points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
