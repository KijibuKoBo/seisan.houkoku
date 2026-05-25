import { useState, useMemo, useEffect } from 'react';
import { KijiItem, YearStore } from '../types';
import { loadAllKijiItems, getAvailableKijiYears, loadKijiItems, saveKijiItems, renameKijiItems, renameKijiItemsByName } from '../utils/kijiStore';
import { PRODUCT_LIST, CATEGORIES } from '../utils/productList';
import KijiReport from '../components/KijiReport';
import './KijiAnalysis.css';

// ─── aggregate helpers ───────────────────────────────────────────────────────

interface ProductStat {
  key: string;
  code: string;
  category: string;
  name: string;
  totalCount: number;
  totalAmount: number;
  months: { year: number; month: number; count: number; amount: number }[];
}

interface CategoryStat {
  category: string;
  totalCount: number;
  totalAmount: number;
  products: ProductStat[];
}

interface MonthStat {
  year: number;
  month: number;
  totalCount: number;
  totalAmount: number;
}

function groupByProduct(items: KijiItem[]): ProductStat[] {
  const map = new Map<string, ProductStat>();
  for (const item of items) {
    if (item.excluded) continue;
    // Key by category+name so same-name products always merge
    const k = `${item.category}_${item.name}`;
    if (!map.has(k)) {
      map.set(k, { key: k, code: item.code, category: item.category, name: item.name, totalCount: 0, totalAmount: 0, months: [] });
    }
    const s = map.get(k)!;
    s.totalCount += item.count;
    s.totalAmount += item.amount;
    // Clear code if multiple lot numbers exist for this product
    if (s.code !== item.code) s.code = '';
    s.months.push({ year: item.year, month: item.month, count: item.count, amount: item.amount });
  }
  return [...map.values()].sort((a, b) => b.totalCount - a.totalCount);
}

function groupByCategory(items: KijiItem[], products: ProductStat[]): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  for (const item of items) {
    if (item.excluded) continue;
    const cat = item.category || 'その他';
    if (!map.has(cat)) map.set(cat, { category: cat, totalCount: 0, totalAmount: 0, products: [] });
    const s = map.get(cat)!;
    s.totalCount += item.count;
    s.totalAmount += item.amount;
  }
  for (const p of products) {
    const cat = p.category || 'その他';
    if (map.has(cat)) map.get(cat)!.products.push(p);
  }
  return [...map.values()].sort((a, b) => b.totalCount - a.totalCount);
}

function groupByMonth(items: KijiItem[]): MonthStat[] {
  const map = new Map<string, MonthStat>();
  for (const item of items) {
    if (item.excluded) continue;
    const k = `${item.year}_${item.month}`;
    if (!map.has(k)) map.set(k, { year: item.year, month: item.month, totalCount: 0, totalAmount: 0 });
    const s = map.get(k)!;
    s.totalCount += item.count;
    s.totalAmount += item.amount;
  }
  return [...map.values()].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

// ─── chart helpers ───────────────────────────────────────────────────────────

const COLORS = ['#4a9ede', '#5daa5a', '#e07b39', '#9a5daa', '#e0c23a', '#5aaab0', '#e05a7a', '#7a8ab0'];

function fmt(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString('ja-JP');
}

function HBar({ label, value, max, color, onClick, sub }:
  { label: string; value: number; max: number; color: string; onClick?: () => void; sub?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={`hbar-row ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="hbar-label" title={label}>{label}</div>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="hbar-value">{value.toLocaleString()}{sub}</div>
    </div>
  );
}

function LineChart({ data, xLabel, yLabel, color }:
  { data: { x: string; y: number }[]; xLabel?: string; yLabel?: string; color: string }) {
  if (data.length === 0) return <div className="chart-empty">データなし</div>;
  const W = 560; const H = 160;
  const pad = { top: 16, right: 16, bottom: 32, left: 52 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => d.y), 1);
  const pts = data.map((d, i) => ({
    x: pad.left + (data.length > 1 ? (i / (data.length - 1)) * iW : iW / 2),
    y: pad.top + iH - (d.y / maxY) * iH,
    v: d.y, label: d.x,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${path} L${pts[pts.length - 1].x},${pad.top + iH} L${pts[0].x},${pad.top + iH}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-chart">
      {/* y grid */}
      {[0, 0.5, 1].map(t => {
        const y = pad.top + iH * (1 - t);
        return <g key={t}>
          <line x1={pad.left} x2={pad.left + iW} y1={y} y2={y} stroke="#eee" />
          <text x={pad.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#999">
            {fmt(maxY * t)}
          </text>
        </g>;
      })}
      <path d={area} fill={color} opacity={0.15} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={color} />
          <text x={p.x} y={pad.top + iH + 14} textAnchor="middle" fontSize="9" fill="#666">{p.label}</text>
          {data.length <= 6 && (
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill={color}>{p.v.toLocaleString()}</text>
          )}
        </g>
      ))}
      {xLabel && <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#999">{xLabel}</text>}
      {yLabel && <text x={10} y={H / 2} textAnchor="middle" fontSize="9" fill="#999" transform={`rotate(-90,10,${H/2})`}>{yLabel}</text>}
    </svg>
  );
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="chart-empty">データなし</div>;
  const R = 60; const CX = 80; const CY = 80;
  let startAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const end = startAngle + angle;
    const x1 = CX + R * Math.cos(startAngle); const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(end); const y2 = CY + R * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    const mid = startAngle + angle / 2;
    const lx = CX + (R + 20) * Math.cos(mid); const ly = CY + (R + 20) * Math.sin(mid);
    const path = `M${CX},${CY} L${x1},${y1} A${R},${R},0,${large},1,${x2},${y2}Z`;
    startAngle = end;
    return { ...d, path, lx, ly, pct: Math.round((d.value / total) * 100), i };
  });
  return (
    <svg viewBox="0 0 200 160" className="donut-chart">
      {slices.map(s => (
        <g key={s.i}>
          <path d={s.path} fill={s.color} opacity={0.85} />
          {s.pct >= 8 && (
            <text x={s.lx} y={s.ly} textAnchor="middle" fontSize="9" fill="#333">
              {s.pct}%
            </text>
          )}
        </g>
      ))}
      <circle cx={CX} cy={CY} r={R * 0.55} fill="white" />
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize="10" fill="#555">
        {total.toLocaleString()}本
      </text>
    </svg>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type Tab = 'ranking' | 'product' | 'category' | 'monthly' | 'yearly' | 'manage';

const TAB_LABELS: [Tab, string][] = [
  ['ranking', 'ランキング'],
  ['product', '製品別'],
  ['category', 'カテゴリー別'],
  ['monthly', '月別トレンド'],
  ['yearly', '年別比較'],
  ['manage', '品目管理'],
];

interface KijiAnalysisProps {
  store: YearStore;
  onSaveMonthKiji: (year: number, month: number, count: number, amount: number) => void;
  canEdit: boolean;
}

export default function KijiAnalysis({ store, onSaveMonthKiji, canEdit }: KijiAnalysisProps) {
  const [tab, setTab] = useState<Tab>('ranking');
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductStat | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryStat | null>(null);
  const [rankBy, setRankBy] = useState<'count' | 'amount'>('count');

  const [allItems, setAllItems] = useState<KijiItem[]>(() => loadAllKijiItems());
  const refreshItems = () => setAllItems(loadAllKijiItems());
  const availableYears = useMemo(() => getAvailableKijiYears(), []);

  // 製品別タブの編集モード
  const [productEditMode, setProductEditMode] = useState(false);
  const [productEdits, setProductEdits] = useState<Record<string, { category: string; name: string }>>({});

  const handleProductEditSave = () => {
    for (const [key, edit] of Object.entries(productEdits)) {
      const product = products.find(p => p.key === key);
      if (!product) continue;
      if (product.category !== edit.category || product.name !== edit.name) {
        renameKijiItemsByName(product.category, product.name, edit.category, edit.name);
      }
    }
    setProductEdits({});
    setProductEditMode(false);
    refreshItems();
  };

  const currentReiwa = new Date().getFullYear() - 2018;
  const effectiveYears = selectedYears.length > 0
    ? selectedYears
    : availableYears.length > 0 ? availableYears : [currentReiwa];

  const filteredItems = useMemo(
    () => allItems.filter(i => effectiveYears.includes(i.year)),
    [allItems, effectiveYears]
  );

  const products = useMemo(() => groupByProduct(filteredItems), [filteredItems]);
  const categories = useMemo(() => groupByCategory(filteredItems, products), [filteredItems, products]);
  const monthStats = useMemo(() => groupByMonth(filteredItems), [filteredItems]);

  const maxCount = products[0]?.totalCount ?? 1;
  const maxAmount = products[0]?.totalAmount ?? 1;

  const toggleYear = (y: number) => {
    setSelectedYears(prev =>
      prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]
    );
  };

  return (
    <div className="kiji-analysis">
      {/* Year filter */}
      <div className="kiji-year-filter">
        <span className="filter-label">対象年：</span>
        <button
          className={`year-chip ${selectedYears.length === 0 ? 'active' : ''}`}
          onClick={() => setSelectedYears([])}
        >すべて</button>
        {availableYears.map(y => (
          <button
            key={y}
            className={`year-chip ${selectedYears.includes(y) ? 'active' : ''}`}
            onClick={() => toggleYear(y)}
          >令和{y}年</button>
        ))}
        <span className="filter-total">
          集計：{filteredItems.filter(i => !i.excluded).reduce((s, i) => s + i.count, 0).toLocaleString()}本 /
          ¥{filteredItems.filter(i => !i.excluded).reduce((s, i) => s + i.amount, 0).toLocaleString()}
        </span>
      </div>

      {/* Tabs */}
      <div className="kiji-tabs">
        {TAB_LABELS.map(([key, label]) => (
          <button
            key={key}
            className={`kiji-tab ${tab === key ? 'active' : ''}`}
            onClick={() => { setTab(key); setSelectedProduct(null); setSelectedCategory(null); }}
          >{label}</button>
        ))}
      </div>

      <div className="kiji-content">

        {/* empty state for analysis tabs */}
        {allItems.length === 0 && tab !== 'manage' && (
          <div className="kiji-empty">
            <div className="kiji-empty-icon">📄</div>
            <p>木地部のPDFデータがまだありません。</p>
            <p>月次入力画面でPDFをアップロードするか、「品目管理」タブから手動入力できます。</p>
          </div>
        )}

        {/* ── ランキング ── */}
        {tab === 'ranking' && allItems.length > 0 && (
          <div className="kiji-section">
            <div className="rank-toggle">
              <button className={rankBy === 'count' ? 'active' : ''} onClick={() => setRankBy('count')}>本数順</button>
              <button className={rankBy === 'amount' ? 'active' : ''} onClick={() => setRankBy('amount')}>金額順</button>
            </div>
            <div className="two-col">
              <div>
                <h3 className="section-title">製品 Top10
                  <span className="title-sub">（クリックで製品詳細）</span>
                </h3>
                {[...products]
                  .sort((a, b) => rankBy === 'count' ? b.totalCount - a.totalCount : b.totalAmount - a.totalAmount)
                  .slice(0, 10)
                  .map((p, i) => (
                    <HBar
                      key={p.key}
                      label={`${i + 1}. ${p.code ? `[${p.code}] ` : ''}${p.category} ${p.name}`}
                      value={rankBy === 'count' ? p.totalCount : p.totalAmount}
                      max={rankBy === 'count' ? maxCount : maxAmount}
                      color={COLORS[i % COLORS.length]}
                      sub={rankBy === 'count' ? '本' : '円'}
                      onClick={() => { setSelectedProduct(p); setTab('product'); }}
                    />
                  ))}
              </div>
              <div>
                <h3 className="section-title">カテゴリー別
                  <span className="title-sub">（クリックで詳細）</span>
                </h3>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <DonutChart data={categories.map((c, i) => ({
                    label: c.category, value: c.totalCount, color: COLORS[i % COLORS.length]
                  }))} />
                  <div style={{ flex: 1 }}>
                    {categories.map((c, i) => (
                      <HBar
                        key={c.category}
                        label={c.category || 'その他'}
                        value={rankBy === 'count' ? c.totalCount : c.totalAmount}
                        max={rankBy === 'count'
                          ? Math.max(...categories.map(x => x.totalCount))
                          : Math.max(...categories.map(x => x.totalAmount))}
                        color={COLORS[i % COLORS.length]}
                        sub={rankBy === 'count' ? '本' : '円'}
                        onClick={() => { setSelectedCategory(c); setTab('category'); }}
                      />
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="cat-legend">
                  {categories.map((c, i) => (
                    <span key={c.category} className="legend-item">
                      <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                      {c.category || 'その他'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 製品別 ── */}
        {tab === 'product' && allItems.length > 0 && (
          <div className="kiji-section">
            {selectedProduct ? (
              <ProductDetail product={selectedProduct} onBack={() => { setSelectedProduct(null); setProductEditMode(false); setProductEdits({}); }} allItems={allItems} availableYears={availableYears} />
            ) : (
              <>
                <div className="product-list-header">
                  <h3 className="section-title" style={{ margin: 0 }}>
                    全製品一覧
                    {!productEditMode && <span className="title-sub">（クリックで詳細）</span>}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {productEditMode ? (
                      <>
                        <button className="prod-edit-save-btn" onClick={handleProductEditSave}
                          disabled={Object.keys(productEdits).length === 0}>
                          ✓ 変更を保存
                        </button>
                        <button className="prod-edit-cancel-btn" onClick={() => { setProductEditMode(false); setProductEdits({}); }}>
                          キャンセル
                        </button>
                      </>
                    ) : (
                      canEdit && (
                        <button className="prod-edit-btn" onClick={() => setProductEditMode(true)}>
                          ✏️ カテゴリー・品名を編集
                        </button>
                      )
                    )}
                  </div>
                </div>
                {productEditMode && (
                  <p className="prod-edit-hint">
                    カテゴリーや品名を変更して「変更を保存」を押すと、全月のデータが一括更新されます。同じカテゴリー＋品名になったものは統合されます。
                  </p>
                )}
                <table className="kiji-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>カテゴリー</th><th>品名</th>
                      <th>総本数</th><th>総金額</th><th>平均単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const edit = productEdits[p.key];
                      const curCat  = edit?.category ?? p.category;
                      const curName = edit?.name     ?? p.name;
                      const changed = edit && (edit.category !== p.category || edit.name !== p.name);
                      return (
                        <tr
                          key={p.key}
                          className={productEditMode ? (changed ? 'prod-row-changed' : '') : 'clickable'}
                          onClick={!productEditMode ? () => setSelectedProduct(p) : undefined}
                        >
                          <td onClick={e => productEditMode && e.stopPropagation()}>
                            {productEditMode ? (
                              <select
                                className="prod-cat-select"
                                value={curCat}
                                onChange={e => setProductEdits(prev => ({
                                  ...prev,
                                  [p.key]: { category: e.target.value, name: curName },
                                }))}
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value={p.category}>{p.category}</option>
                              </select>
                            ) : (
                              <span className="cat-badge">{p.category || '—'}</span>
                            )}
                          </td>
                          <td onClick={e => productEditMode && e.stopPropagation()}>
                            {productEditMode ? (
                              <input
                                className="prod-name-input"
                                value={curName}
                                onChange={e => setProductEdits(prev => ({
                                  ...prev,
                                  [p.key]: { category: curCat, name: e.target.value },
                                }))}
                              />
                            ) : p.name}
                          </td>
                          <td className="num">{p.totalCount.toLocaleString()}本</td>
                          <td className="num">¥{p.totalAmount.toLocaleString()}</td>
                          <td className="num">
                            {p.totalCount > 0 ? `¥${Math.round(p.totalAmount / p.totalCount).toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ── カテゴリー別 ── */}
        {tab === 'category' && allItems.length > 0 && (
          <div className="kiji-section">
            {selectedCategory ? (
              <CategoryDetail category={selectedCategory} onBack={() => setSelectedCategory(null)} />
            ) : (
              <>
                <h3 className="section-title">カテゴリー別集計（クリックで詳細）</h3>
                <div className="two-col">
                  <div>
                    <DonutChart data={categories.map((c, i) => ({
                      label: c.category, value: c.totalCount, color: COLORS[i % COLORS.length]
                    }))} />
                    <div className="cat-legend" style={{ marginTop: 8 }}>
                      {categories.map((c, i) => (
                        <span key={c.category} className="legend-item">
                          <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                          {c.category || 'その他'} ({c.totalCount}本)
                        </span>
                      ))}
                    </div>
                  </div>
                  <table className="kiji-table">
                    <thead>
                      <tr><th>カテゴリー</th><th>本数</th><th>金額</th><th>製品数</th></tr>
                    </thead>
                    <tbody>
                      {categories.map((c, i) => (
                        <tr key={c.category} className="clickable" onClick={() => setSelectedCategory(c)}>
                          <td><span className="cat-badge" style={{ background: COLORS[i % COLORS.length] + '33' }}>{c.category || 'その他'}</span></td>
                          <td className="num">{c.totalCount.toLocaleString()}本</td>
                          <td className="num">¥{c.totalAmount.toLocaleString()}</td>
                          <td className="num">{c.products.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 月別トレンド ── */}
        {tab === 'monthly' && allItems.length > 0 && (
          <div className="kiji-section">
            <h3 className="section-title">月別生産推移</h3>
            {effectiveYears.map(y => {
              const data = Array.from({ length: 12 }, (_, i) => {
                const s = monthStats.find(m => m.year === y && m.month === i + 1);
                return { x: `${i + 1}月`, y: s?.totalCount ?? 0 };
              });
              const hasData = data.some(d => d.y > 0);
              if (!hasData) return null;
              return (
                <div key={y} className="trend-block">
                  <div className="trend-year-label">令和{y}年</div>
                  <LineChart data={data} xLabel="月" yLabel="本数" color={COLORS[y % COLORS.length]} />
                  <div className="trend-table">
                    {data.map((d, i) => d.y > 0 && (
                      <span key={i} className="trend-chip">
                        {d.x}: <strong>{d.y}</strong>本
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 品目管理 ── */}
        {tab === 'manage' && (
          <ManageTab
            availableYears={availableYears}
            store={store}
            onSaveMonthKiji={onSaveMonthKiji}
            canEdit={canEdit}
            onRefresh={refreshItems}
          />
        )}

        {/* ── 年別比較 ── */}
        {tab === 'yearly' && allItems.length > 0 && (
          <div className="kiji-section">
            <h3 className="section-title">年別比較</h3>
            {(() => {
              const yearData = availableYears.map(y => {
                const items = allItems.filter(i => i.year === y && !i.excluded);
                return {
                  x: `R${y}年`,
                  y: items.reduce((s, i) => s + i.count, 0),
                  amount: items.reduce((s, i) => s + i.amount, 0),
                };
              }).reverse();
              const maxC = Math.max(...yearData.map(d => d.y), 1);
              const maxA = Math.max(...yearData.map(d => d.amount), 1);
              return (
                <div className="two-col">
                  <div>
                    <h4>生産本数</h4>
                    {yearData.map((d, i) => (
                      <HBar key={d.x} label={d.x} value={d.y} max={maxC} color={COLORS[i % COLORS.length]} sub="本" />
                    ))}
                  </div>
                  <div>
                    <h4>生産金額</h4>
                    {yearData.map((d, i) => (
                      <HBar key={d.x} label={d.x} value={d.amount} max={maxA} color={COLORS[i % COLORS.length]} sub="円" />
                    ))}
                  </div>
                </div>
              );
            })()}
            <div style={{ marginTop: 20 }}>
              <h4>年別詳細</h4>
              <table className="kiji-table">
                <thead>
                  <tr><th>年度</th><th>月数</th><th>総本数</th><th>総金額</th><th>月平均本数</th><th>前年比（本数）</th></tr>
                </thead>
                <tbody>
                  {availableYears.map((y, idx) => {
                    const items = allItems.filter(i => i.year === y && !i.excluded);
                    const count = items.reduce((s, i) => s + i.count, 0);
                    const amount = items.reduce((s, i) => s + i.amount, 0);
                    const months = new Set(items.map(i => i.month)).size;
                    const prevCount = idx < availableYears.length - 1
                      ? allItems.filter(i => i.year === availableYears[idx + 1] && !i.excluded).reduce((s, i) => s + i.count, 0)
                      : 0;
                    const yoy = prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
                    return (
                      <tr key={y}>
                        <td>令和{y}年</td>
                        <td className="num">{months}ヶ月</td>
                        <td className="num">{count.toLocaleString()}本</td>
                        <td className="num">¥{amount.toLocaleString()}</td>
                        <td className="num">{months > 0 ? Math.round(count / months).toLocaleString() : '—'}本</td>
                        <td className={`num ${yoy !== null ? (yoy >= 100 ? 'yoy-up' : 'yoy-down') : ''}`}>
                          {yoy !== null ? `${yoy}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Product detail ──────────────────────────────────────────────────────────

function ProductDetail({ product, onBack, allItems, availableYears }:
  { product: ProductStat; onBack: () => void; allItems: KijiItem[]; availableYears: number[] }) {

  const productItems = allItems.filter(
    i => i.category === product.category && i.name === product.name && !i.excluded
  );

  // Monthly data for each year
  const yearMonthData = availableYears.map(y => ({
    year: y,
    months: Array.from({ length: 12 }, (_, m) => {
      const s = productItems.filter(i => i.year === y && i.month === m + 1);
      return { month: m + 1, count: s.reduce((a, i) => a + i.count, 0) };
    }),
  })).filter(yd => yd.months.some(m => m.count > 0));

  // Peak month
  const allMonthCounts = Array.from({ length: 12 }, (_, m) => ({
    month: m + 1,
    count: productItems.filter(i => i.month === m + 1).reduce((a, i) => a + i.count, 0),
  }));
  const peakMonth = [...allMonthCounts].sort((a, b) => b.count - a.count)[0];

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← 一覧に戻る</button>
      <div className="product-detail-header">
        <div>
          {product.code && <span className="detail-code">[{product.code}]</span>}
          {product.category && <span className="cat-badge">{product.category}</span>}
          <strong className="detail-name">{product.name}</strong>
        </div>
        <div className="detail-stats">
          <span>累計 <strong>{product.totalCount.toLocaleString()}</strong>本</span>
          <span>累計金額 <strong>¥{product.totalAmount.toLocaleString()}</strong></span>
          {peakMonth?.count > 0 && <span>最多月 <strong>{peakMonth.month}月</strong> ({peakMonth.count}本)</span>}
        </div>
      </div>

      <h4 style={{ margin: '12px 0 6px' }}>月別生産本数（全期間）</h4>
      <LineChart
        data={allMonthCounts.map(m => ({ x: `${m.month}月`, y: m.count }))}
        xLabel="月"
        yLabel="本数"
        color="#4a9ede"
      />

      {yearMonthData.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 6px' }}>年・月別詳細</h4>
          <table className="kiji-table">
            <thead>
              <tr>
                <th>年度</th>
                {Array.from({ length: 12 }, (_, i) => <th key={i}>{i + 1}月</th>)}
                <th>年計</th>
              </tr>
            </thead>
            <tbody>
              {yearMonthData.map(yd => {
                const total = yd.months.reduce((s, m) => s + m.count, 0);
                return (
                  <tr key={yd.year}>
                    <td>R{yd.year}</td>
                    {yd.months.map(m => (
                      <td key={m.month} className={`num ${m.count === 0 ? 'zero' : ''}`}>
                        {m.count || '—'}
                      </td>
                    ))}
                    <td className="num bold">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── Category detail ─────────────────────────────────────────────────────────

function CategoryDetail({ category, onBack }:
  { category: CategoryStat; onBack: () => void }) {
  return (
    <div>
      <button className="back-btn" onClick={onBack}>← カテゴリー一覧に戻る</button>
      <h3 style={{ margin: '12px 0' }}>
        カテゴリー：<span className="cat-badge">{category.category || 'その他'}</span>
        <span style={{ fontSize: 14, marginLeft: 12 }}>
          総計 {category.totalCount.toLocaleString()}本 / ¥{category.totalAmount.toLocaleString()}
        </span>
      </h3>
      <table className="kiji-table">
        <thead>
          <tr><th>品番</th><th>品名</th><th>総本数</th><th>総金額</th><th>構成比</th></tr>
        </thead>
        <tbody>
          {[...category.products].sort((a, b) => b.totalCount - a.totalCount).map(p => (
            <tr key={p.key}>
              <td>{p.code}</td>
              <td>{p.name}</td>
              <td className="num">{p.totalCount.toLocaleString()}本</td>
              <td className="num">¥{p.totalAmount.toLocaleString()}</td>
              <td className="num">
                {category.totalCount > 0 ? `${Math.round((p.totalCount / category.totalCount) * 100)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="kiji-bar-section">
        {[...category.products].sort((a, b) => b.totalCount - a.totalCount).map((p, i) => (
          <HBar
            key={p.key}
            label={`${p.code ? `[${p.code}] ` : ''}${p.name}`}
            value={p.totalCount}
            max={category.products[0]?.totalCount ?? 1}
            color={COLORS[i % COLORS.length]}
            sub="本"
          />
        ))}
      </div>
    </div>
  );
}

// ─── Manage tab ───────────────────────────────────────────────────────────────

function ManageTab({ availableYears, store, onSaveMonthKiji, canEdit, onRefresh }: {
  availableYears: number[];
  store: YearStore;
  onSaveMonthKiji: (year: number, month: number, count: number, amount: number) => void;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const yearOptions = [...new Set([...availableYears, currentReiwa, currentReiwa - 1])].sort((a, b) => b - a);

  const [selYear, setSelYear] = useState(yearOptions[0] ?? currentReiwa);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [items, setItems] = useState<KijiItem[]>([]);
  const [origItems, setOrigItems] = useState<KijiItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // New item entry state
  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);
  const [newProductName, setNewProductName] = useState('');
  const [newCount, setNewCount] = useState(1);
  const [newAmount, setNewAmount] = useState(0);
  const [newUnitPrice, setNewUnitPrice] = useState(0);
  const [amountManual, setAmountManual] = useState(false);

  const filteredProducts = PRODUCT_LIST.filter(p => p.category === newCategory);

  useEffect(() => {
    const loaded = loadKijiItems(selYear, selMonth);
    setItems(loaded);
    setOrigItems(loaded);
    const md = store[selYear]?.[selMonth];
    const active = loaded.filter(i => !i.excluded);
    setTotalCount(md?.kiji.count ?? active.reduce((s, i) => s + i.count, 0));
    setTotalAmount(md?.kiji.amount ?? active.reduce((s, i) => s + i.amount, 0));
    setSaved(false);
  }, [selYear, selMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const recomputeTotals = (updated: KijiItem[]) => {
    const active = updated.filter(i => !i.excluded);
    setTotalCount(active.reduce((s, i) => s + i.count, 0));
    setTotalAmount(active.reduce((s, i) => s + i.amount, 0));
  };

  const updateItem = (idx: number, field: 'category' | 'name' | 'count' | 'amount', value: string | number) => {
    setItems(prev => {
      const next = prev.map((item, i) => i === idx ? { ...item, [field]: value } : item);
      if (field === 'count' || field === 'amount') recomputeTotals(next);
      return next;
    });
  };

  const handleProductSelect = (name: string) => {
    setNewProductName(name);
    const product = filteredProducts.find(p => p.name === name);
    if (product) {
      setNewUnitPrice(product.unitPrice);
      if (!amountManual) setNewAmount(product.unitPrice * newCount);
    } else {
      setNewUnitPrice(0);
    }
  };

  const handleNewCountChange = (count: number) => {
    setNewCount(count);
    if (!amountManual) setNewAmount(newUnitPrice * count);
  };

  const handleAddItem = () => {
    if (!newProductName || newCount <= 0) return;
    const newItem: KijiItem = {
      year: selYear, month: selMonth, code: '',
      category: newCategory, name: newProductName,
      count: newCount, unitPrice: newUnitPrice, amount: newAmount, excluded: false,
    };
    const updated = [...items, newItem];
    setItems(updated);
    recomputeTotals(updated);
    setNewProductName('');
    setNewCount(1);
    setNewAmount(0);
    setAmountManual(false);
    setSaved(false);
  };

  const removeItem = (idx: number) => {
    setItems(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      recomputeTotals(updated);
      return updated;
    });
    setSaved(false);
  };

  const handleSave = () => {
    for (let i = 0; i < origItems.length; i++) {
      const orig = origItems[i];
      const curr = items[i];
      if (!curr) continue;
      if (orig.category !== curr.category || orig.name !== curr.name) {
        renameKijiItems(orig.code, orig.category, orig.name, curr.category, curr.name);
      }
    }
    saveKijiItems(selYear, selMonth, items);
    onSaveMonthKiji(selYear, selMonth, totalCount, totalAmount);
    setOrigItems(items);
    setSaved(true);
    onRefresh();
  };

  return (
    <div className="kiji-section">
      <div className="manage-selectors">
        <label>年：</label>
        <select value={selYear} onChange={e => { setSelYear(Number(e.target.value)); setSaved(false); }}>
          {yearOptions.map(y => <option key={y} value={y}>令和{y}年</option>)}
        </select>
        <label>月：</label>
        <select value={selMonth} onChange={e => { setSelMonth(Number(e.target.value)); setSaved(false); }}>
          {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
      </div>

      {/* Product entry form */}
      {canEdit && (
        <div className="manage-add-form">
          <div className="manage-add-title">品目を追加</div>
          <div className="manage-add-row">
            <label>カテゴリー：</label>
            <select
              value={newCategory}
              onChange={e => {
                setNewCategory(e.target.value);
                setNewProductName(''); setNewUnitPrice(0); setNewAmount(0); setAmountManual(false);
              }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <label>品名：</label>
            <select
              value={filteredProducts.some(p => p.name === newProductName) ? newProductName : ''}
              onChange={e => handleProductSelect(e.target.value)}
            >
              <option value="">-- 選択 --</option>
              {filteredProducts.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>

            <input
              className="manage-input name-input"
              placeholder="または直接入力"
              value={newProductName}
              onChange={e => {
                setNewProductName(e.target.value);
                if (!filteredProducts.some(p => p.name === e.target.value)) { setNewUnitPrice(0); }
              }}
            />
          </div>
          <div className="manage-add-row">
            <label>本数：</label>
            <input
              type="number" className="manage-num-input small" value={newCount} min={1}
              onChange={e => handleNewCountChange(Number(e.target.value))}
            />
            <span>本</span>
            <span className="manage-price-hint">単価：¥{newUnitPrice.toLocaleString()}</span>
            <label>金額：</label>
            <input
              type="number" className="manage-num-input wide" value={newAmount} min={0}
              onChange={e => { setNewAmount(Number(e.target.value)); setAmountManual(true); }}
            />
            <span>円</span>
            <button
              className="manage-add-btn"
              onClick={handleAddItem}
              disabled={!newProductName || newCount <= 0}
            >＋ 追加</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p style={{color:'#999',margin:'24px 0'}}>この月のデータがありません</p>
      ) : (
        <table className="kiji-table manage-table">
          <thead>
            <tr>
              <th>品番</th><th>カテゴリー</th><th>品名</th>
              <th>本数</th><th>金額</th><th>除外</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className={item.excluded ? 'excluded-row' : ''}>
                <td>{item.code}</td>
                <td>
                  {canEdit ? (
                    <input className="manage-input" value={item.category}
                      onChange={e => updateItem(idx, 'category', e.target.value)} />
                  ) : item.category}
                </td>
                <td>
                  {canEdit ? (
                    <input className="manage-input name-input" value={item.name}
                      onChange={e => updateItem(idx, 'name', e.target.value)} />
                  ) : item.name}
                </td>
                <td className="num">
                  {canEdit ? (
                    <input type="number" className="manage-num-input small" value={item.count} min={0}
                      onChange={e => updateItem(idx, 'count', Number(e.target.value))} />
                  ) : `${item.count}本`}
                </td>
                <td className="num">
                  {canEdit ? (
                    <input type="number" className="manage-num-input" value={item.amount} min={0}
                      onChange={e => updateItem(idx, 'amount', Number(e.target.value))} />
                  ) : (item.amount > 0 ? `¥${item.amount.toLocaleString()}` : '—')}
                </td>
                <td className="num">{item.excluded ? '✓' : ''}</td>
                {canEdit && (
                  <td>
                    <button className="manage-del-btn" onClick={() => removeItem(idx)} title="削除">✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="manage-totals">
        <div className="manage-total-row">
          <span className="manage-total-label">木地部 月次合計　本数：</span>
          {canEdit ? (
            <input type="number" className="manage-num-input" value={totalCount}
              onChange={e => setTotalCount(Number(e.target.value))} />
          ) : <strong>{totalCount}</strong>}
          <span>本</span>
          <span className="manage-total-label" style={{marginLeft:24}}>金額：</span>
          {canEdit ? (
            <input type="number" className="manage-num-input wide" value={totalAmount}
              onChange={e => setTotalAmount(Number(e.target.value))} />
          ) : <strong>{totalAmount.toLocaleString()}</strong>}
          <span>円</span>
        </div>
        <button className="kiji-report-btn" onClick={() => setShowReport(true)}>
          📄 木地部月次報告
        </button>
        {canEdit && (
          <button className="manage-save-btn" onClick={handleSave}>
            {saved ? '✓ 保存しました' : '月次データに反映'}
          </button>
        )}
      </div>

      {showReport && (
        <KijiReport
          year={selYear}
          month={selMonth}
          items={items}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
