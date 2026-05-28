import { useRef, useState } from 'react';
import { YearStore } from '../types';
import { salesTotal } from '../utils/calc';
import './YearlyReport.css';

interface Props {
  store: YearStore;
  defaultYear: number;
  onClose: () => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const SALES_ROWS = [
  { key: 'otsuka'   as const, label: '大塚' },
  { key: 'takumi'   as const, label: '匠' },
  { key: 'butsudan' as const, label: '仏壇' },
  { key: 'ippanten' as const, label: '一般店' },
  { key: 'showroom' as const, label: '直販' },
  { key: 'bukken'   as const, label: 'その他' },
];

const SECTIONS = [
  { key: 'kiji'   as const, label: '木地' },
  { key: 'tosou'  as const, label: '塗装' },
  { key: 'matome' as const, label: 'まとめ' },
];

function fmt(n: number): string {
  return n > 0 ? n.toLocaleString() : '—';
}
function fmtCnt(n: number): string {
  return n > 0 ? `${n}本` : '—';
}
function yoy(cur: number, prev: number): string {
  if (prev === 0 || cur === 0) return '—';
  const r = Math.round((cur / prev) * 100);
  return `${r}%`;
}
function yoyClass(cur: number, prev: number): string {
  if (prev === 0 || cur === 0) return '';
  return cur >= prev ? 'yr-up' : 'yr-down';
}

export default function YearlyReport({ store, defaultYear, onClose }: Props) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const availableYears = Array.from(
    new Set([...Object.keys(store).map(Number), currentReiwa, currentReiwa - 1])
  ).sort((a, b) => b - a);

  const [year, setYear] = useState(defaultYear);
  const modalRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const prev = year - 1;
  const md  = (m: number) => store[year]?.[m];
  const pmd = (m: number) => store[prev]?.[m];

  const handlePdfExport = async () => {
    const el = modalRef.current;
    if (!el) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = (canvas.height * pw) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      let y = 0;
      while (y < ph) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -y, pw, ph);
        y += pageH;
      }
      pdf.save(`年次報告書_令和${year}年度.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  const today = new Date().toLocaleDateString('ja-JP');

  // ── 年計 helpers ──────────────────────────────────────────────────────────
  const yearSales   = MONTHS.reduce((s, m) => s + salesTotal(md(m)?.sales  ?? { otsuka:0,takumi:0,butsudan:0,ippanten:0,showroom:0,bukken:0 }), 0);
  const prevSales   = MONTHS.reduce((s, m) => s + salesTotal(pmd(m)?.sales ?? { otsuka:0,takumi:0,butsudan:0,ippanten:0,showroom:0,bukken:0 }), 0);

  return (
    <div className="yr-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="yr-modal" ref={modalRef}>

        {/* ── Header ── */}
        <div className="yr-header">
          <div className="yr-header-left">
            <div className="yr-header-sub">松永工房　年次生産報告書</div>
            <div className="yr-header-title">年次生産報告書</div>
            <div className="yr-year-line">
              <select className="yr-year-select no-print" value={year} onChange={e => setYear(Number(e.target.value))}>
                {availableYears.map(y => <option key={y} value={y}>令和{y}年度</option>)}
              </select>
              <span className="yr-year-print">令和{year}年度</span>
            </div>
          </div>
          <div className="yr-header-right no-print">
            <div className="yr-header-date">作成日：{today}</div>
            <div className="yr-header-btns">
              <button className="yr-btn" onClick={() => {
                document.body.classList.add('yr-printing');
                window.addEventListener('afterprint', () => document.body.classList.remove('yr-printing'), { once: true });
                window.print();
              }}>🖨 印刷</button>
              <button className="yr-btn" onClick={handlePdfExport} disabled={pdfLoading}>
                {pdfLoading ? '生成中...' : '📄 PDF出力'}
              </button>
              <button className="yr-btn yr-close" onClick={onClose}>✕ 閉じる</button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="yr-body">
          <table className="yr-table">
            <thead>
              <tr>
                <th className="yr-th-label">区分</th>
                {MONTHS.map(m => <th key={m} className="yr-th-month">{m}月</th>)}
                <th className="yr-th-total">年計</th>
                <th className="yr-th-yoy">前年比</th>
              </tr>
            </thead>
            <tbody>

              {/* ── 営業合計 ── */}
              <tr className="yr-group-hd">
                <td>営業合計</td>
                {MONTHS.map(m => {
                  const v = salesTotal(md(m)?.sales ?? { otsuka:0,takumi:0,butsudan:0,ippanten:0,showroom:0,bukken:0 });
                  return <td key={m} className="yr-num">{fmt(v)}</td>;
                })}
                <td className="yr-num yr-total-cell">{fmt(yearSales)}</td>
                <td className={`yr-num yr-yoy-cell ${yoyClass(yearSales, prevSales)}`}>{yoy(yearSales, prevSales)}</td>
              </tr>

              {SALES_ROWS.map(row => {
                const yr = MONTHS.reduce((s, m) => s + (md(m)?.sales[row.key]  ?? 0), 0);
                const pr = MONTHS.reduce((s, m) => s + (pmd(m)?.sales[row.key] ?? 0), 0);
                return (
                  <tr key={row.key} className="yr-sub-row">
                    <td className="yr-sub-label">└ {row.label}</td>
                    {MONTHS.map(m => <td key={m} className="yr-num">{fmt(md(m)?.sales[row.key] ?? 0)}</td>)}
                    <td className="yr-num yr-total-cell">{fmt(yr)}</td>
                    <td className={`yr-num yr-yoy-cell ${yoyClass(yr, pr)}`}>{yoy(yr, pr)}</td>
                  </tr>
                );
              })}

              {/* ── 木地・塗装・まとめ ── */}
              {SECTIONS.map(sec => {
                const amtYr  = MONTHS.reduce((s, m) => s + (md(m)?.[sec.key].amount  ?? 0), 0);
                const amtPr  = MONTHS.reduce((s, m) => s + (pmd(m)?.[sec.key].amount ?? 0), 0);
                const cntYr  = MONTHS.reduce((s, m) => s + (md(m)?.[sec.key].count   ?? 0), 0);
                const cntPr  = MONTHS.reduce((s, m) => s + (pmd(m)?.[sec.key].count  ?? 0), 0);
                return [
                  <tr key={`${sec.key}-sep`} className="yr-section-sep"><td colSpan={15} /></tr>,
                  <tr key={`${sec.key}-amt`} className="yr-section-hd">
                    <td>{sec.label}（金額）</td>
                    {MONTHS.map(m => <td key={m} className="yr-num">{fmt(md(m)?.[sec.key].amount ?? 0)}</td>)}
                    <td className="yr-num yr-total-cell">{fmt(amtYr)}</td>
                    <td className={`yr-num yr-yoy-cell ${yoyClass(amtYr, amtPr)}`}>{yoy(amtYr, amtPr)}</td>
                  </tr>,
                  <tr key={`${sec.key}-cnt`} className="yr-section-cnt">
                    <td>{sec.label}（本数）</td>
                    {MONTHS.map(m => <td key={m} className="yr-num">{fmtCnt(md(m)?.[sec.key].count ?? 0)}</td>)}
                    <td className="yr-num yr-total-cell">{fmtCnt(cntYr)}</td>
                    <td className={`yr-num yr-yoy-cell ${yoyClass(cntYr, cntPr)}`}>{yoy(cntYr, cntPr)}</td>
                  </tr>,
                ];
              })}

            </tbody>
          </table>

          <div className="yr-footer-note">
            ※ 前年比は令和{prev}年度との比較です。データのない月は「—」と表示します。
          </div>
        </div>
      </div>
    </div>
  );
}
