import { useState, useCallback } from 'react';
import { ProductDef, CATEGORIES, CATEGORY_FULL } from '../utils/productList';
import { loadCostDatabase, saveCostDatabase, pushCostDbToServer } from '../utils/costStore';
import { loadSaisanSettings } from '../utils/saisanSettings';
import './CostDatabase.css';

const CAT_ORDER = ['Co', 'MP', '仏壇', 'PC', 'リリー', '特注', 'その他'] as const;

interface EditState { idx: number; name: string; unitPrice: string; labor: string; material: string }

const toNum = (s: string): number | undefined => {
  const t = s.replace(/[^0-9]/g, '');
  if (t === '') return undefined;
  const n = parseInt(t, 10);
  return isNaN(n) ? undefined : n;
};

// 木地代 = 手間代+材料代（どちらか入力あり）。両方空なら手入力の木地代。
function computePrice(labor?: number, material?: number, manual?: number): number {
  if (labor != null || material != null) return (labor ?? 0) + (material ?? 0);
  return manual ?? 0;
}
function displayPrice(p: ProductDef): number {
  return computePrice(p.labor, p.material, p.unitPrice);
}

export default function CostDatabase() {
  const [products, setProducts] = useState<ProductDef[]>(() => loadCostDatabase());
  const [activeTab, setActiveTab] = useState<string>('Co');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [addName, setAddName] = useState('');
  const [addLabor, setAddLabor] = useState('');
  const [addMaterial, setAddMaterial] = useState('');
  const [saved, setSaved] = useState(false);

  const settings = loadSaisanSettings();
  const dailyWage = settings.dailyWage || 20000;
  const hoursPerDay = settings.hoursPerDay || 8;

  // 1本あたりの完成日数（手間代 ÷ 日当）
  const daysPerUnit = (labor?: number): number | null => {
    if (labor == null || labor <= 0) return null;
    return labor / dailyWage;
  };
  const daysOfLabel = (labor?: number): string => {
    const d = daysPerUnit(labor);
    if (d == null) return '—';
    return `${d.toFixed(2)}日 (${(d * hoursPerDay).toFixed(1)}h)`;
  };

  const filtered = products.filter(p => p.category === activeTab);

  const commit = useCallback((next: ProductDef[]) => {
    setProducts(next);
    saveCostDatabase(next);
    pushCostDbToServer()
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      })
      .catch(e => {
        alert(`サーバー保存に失敗しました。他の端末には反映されません。\n\n${e instanceof Error ? e.message : ''}`);
      });
  }, []);

  const startEdit = (globalIdx: number, p: ProductDef) => {
    setEditing({
      idx: globalIdx,
      name: p.name,
      unitPrice: String(p.unitPrice),
      labor: p.labor != null ? String(p.labor) : '',
      material: p.material != null ? String(p.material) : '',
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editing.name.trim()) return;
    const labor = toNum(editing.labor);
    const material = toNum(editing.material);
    const price = computePrice(labor, material, toNum(editing.unitPrice));
    const next = products.map((p, i) =>
      i === editing.idx ? { ...p, name: editing.name.trim(), unitPrice: price, labor, material } : p
    );
    commit(next);
    setEditing(null);
  };

  const deleteItem = (globalIdx: number) => {
    if (!confirm(`「${products[globalIdx].name}」を削除しますか？`)) return;
    commit(products.filter((_, i) => i !== globalIdx));
  };

  const addItem = () => {
    const name = addName.trim();
    if (!name) return;
    if (products.some(p => p.category === activeTab && p.name === name)) {
      alert('同じ品名が既に存在します');
      return;
    }
    const labor = toNum(addLabor);
    const material = toNum(addMaterial);
    commit([...products, {
      name, category: activeTab,
      unitPrice: computePrice(labor, material, 0),
      labor, material,
    }]);
    setAddName(''); setAddLabor(''); setAddMaterial('');
  };

  // 予定本数の変更（即時ローカル反映。確定時に保存）
  const changePlanned = (globalIdx: number, v: string) => {
    const qty = toNum(v);
    setProducts(prev => prev.map((p, i) => i === globalIdx ? { ...p, plannedQty: qty } : p));
  };
  const persistPlanned = () => {
    saveCostDatabase(products);
    pushCostDbToServer().catch(() => { /* ローカルには保存済み */ });
  };

  const globalIndices = products
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.category === activeTab)
    .map(({ i }) => i);

  const yen = (n?: number) => (n != null && n > 0 ? `¥${n.toLocaleString()}` : n === 0 ? '¥0' : '—');

  // 編集中の木地代（自動計算）
  const editPrice = editing ? computePrice(toNum(editing.labor), toNum(editing.material), toNum(editing.unitPrice)) : 0;
  const editHasBreakdown = editing ? (toNum(editing.labor) != null || toNum(editing.material) != null) : false;

  return (
    <div className="cd-wrap">
      <div className="cd-header">
        <div>
          <div className="cd-title">原価データベース</div>
          <div className="cd-subtitle">木地代＝手間代＋材料代（自動計算）／完成日数＝手間代÷日当{dailyWage.toLocaleString()}円</div>
        </div>
        {saved && <span className="cd-saved">✓ 保存しました</span>}
      </div>

      <div className="cd-tabs">
        {CAT_ORDER.map(cat => (
          <button
            key={cat}
            className={`cd-tab ${activeTab === cat ? 'active' : ''}`}
            onClick={() => { setActiveTab(cat); setEditing(null); }}
          >
            {CATEGORY_FULL[cat] ?? cat}
            <span className="cd-tab-cnt">
              {products.filter(p => p.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      <div className="cd-body">
        <table className="cd-table">
          <thead>
            <tr>
              <th className="cd-th-no">#</th>
              <th className="cd-th-name">品名</th>
              <th className="cd-th-price">手間代</th>
              <th className="cd-th-price">材料代</th>
              <th className="cd-th-price">木地代<span className="cd-auto">自動</span></th>
              <th className="cd-th-days">完成日数(1本)</th>
              <th className="cd-th-qty">予定本数</th>
              <th className="cd-th-days">所要日数</th>
              <th className="cd-th-act">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, li) => {
              const gi = globalIndices[li];
              const isEditing = editing?.idx === gi;
              const dpu = daysPerUnit(p.labor);
              const totalDays = dpu != null && p.plannedQty ? dpu * p.plannedQty : null;
              return (
                <tr key={gi} className={isEditing ? 'cd-row editing' : 'cd-row'}>
                  <td className="cd-td-no">{li + 1}</td>
                  <td className="cd-td-name">
                    {isEditing ? (
                      <input className="cd-input" value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
                    ) : p.name}
                  </td>
                  <td className="cd-td-price">
                    {isEditing ? (
                      <input className="cd-input cd-input-price" placeholder="—" value={editing.labor}
                        onChange={e => setEditing({ ...editing, labor: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                    ) : yen(p.labor)}
                  </td>
                  <td className="cd-td-price">
                    {isEditing ? (
                      <input className="cd-input cd-input-price" placeholder="—" value={editing.material}
                        onChange={e => setEditing({ ...editing, material: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                    ) : yen(p.material)}
                  </td>
                  <td className="cd-td-price cd-price-auto">
                    {isEditing ? (
                      editHasBreakdown
                        ? <span className="cd-computed">{yen(editPrice)}</span>
                        : <input className="cd-input cd-input-price" placeholder="木地代" value={editing.unitPrice}
                            onChange={e => setEditing({ ...editing, unitPrice: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                    ) : yen(displayPrice(p))}
                  </td>
                  <td className="cd-td-days">{daysOfLabel(p.labor)}</td>
                  <td className="cd-td-qty">
                    <input className="cd-input cd-qty-input" type="number" min={0} placeholder="—"
                      value={p.plannedQty ?? ''}
                      onChange={e => changePlanned(gi, e.target.value)}
                      onBlur={persistPlanned} />
                    <span className="cd-qty-unit">本</span>
                  </td>
                  <td className="cd-td-days cd-total-days">
                    {totalDays != null ? `${totalDays.toFixed(1)}日` : '—'}
                  </td>
                  <td className="cd-td-act">
                    {isEditing ? (
                      <>
                        <button className="cd-btn save" onClick={saveEdit}>保存</button>
                        <button className="cd-btn cancel" onClick={() => setEditing(null)}>取消</button>
                      </>
                    ) : (
                      <>
                        <button className="cd-btn edit" onClick={() => startEdit(gi, p)}>編集</button>
                        <button className="cd-btn del" onClick={() => deleteItem(gi)}>削除</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row */}
        <div className="cd-add-row">
          <span className="cd-add-label">＋ 追加</span>
          <input className="cd-input cd-add-name" placeholder="品名"
            value={addName} onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()} />
          <input className="cd-input cd-input-price" placeholder="手間代"
            value={addLabor} onChange={e => setAddLabor(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()} />
          <input className="cd-input cd-input-price" placeholder="材料代"
            value={addMaterial} onChange={e => setAddMaterial(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()} />
          <span className="cd-add-price-preview">
            木地代 {yen(computePrice(toNum(addLabor), toNum(addMaterial), 0))}
          </span>
          <button className="cd-btn add" onClick={addItem}>追加</button>
        </div>

        <div className="cd-note">
          ※ 木地代は手間代＋材料代で自動計算されます。予定本数を入れると「完成日数×本数＝所要日数」が出ます。
          手間代・材料代は採算分析に使われます。
        </div>
      </div>
    </div>
  );
}
