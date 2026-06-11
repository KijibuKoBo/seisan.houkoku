import { useState, useCallback } from 'react';
import { ProductDef, CATEGORIES, CATEGORY_FULL } from '../utils/productList';
import { loadCostDatabase, saveCostDatabase, pushCostDbToServer } from '../utils/costStore';
import './CostDatabase.css';

const CAT_ORDER = ['Co', 'MP', '仏壇', 'PC', 'リリー', '特注', 'その他'] as const;

interface EditState { idx: number; name: string; unitPrice: string }

export default function CostDatabase() {
  const [products, setProducts] = useState<ProductDef[]>(() => loadCostDatabase());
  const [activeTab, setActiveTab] = useState<string>('Co');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [saved, setSaved] = useState(false);

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
    setEditing({ idx: globalIdx, name: p.name, unitPrice: String(p.unitPrice) });
  };

  const saveEdit = () => {
    if (!editing) return;
    const price = parseInt(editing.unitPrice.replace(/[^0-9]/g, ''), 10);
    if (!editing.name.trim() || isNaN(price)) return;
    const next = products.map((p, i) =>
      i === editing.idx ? { ...p, name: editing.name.trim(), unitPrice: price } : p
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
    const price = parseInt(addPrice.replace(/[^0-9]/g, ''), 10);
    if (!name) return;
    if (products.some(p => p.category === activeTab && p.name === name)) {
      alert('同じ品名が既に存在します');
      return;
    }
    commit([...products, { name, category: activeTab, unitPrice: isNaN(price) ? 0 : price }]);
    setAddName('');
    setAddPrice('');
  };

  const globalIndices = products
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.category === activeTab)
    .map(({ i }) => i);

  return (
    <div className="cd-wrap">
      <div className="cd-header">
        <div>
          <div className="cd-title">原価データベース</div>
          <div className="cd-subtitle">木地代 単価（管理者専用）</div>
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
              <th className="cd-th-price">原価（円）</th>
              <th className="cd-th-act">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, li) => {
              const gi = globalIndices[li];
              const isEditing = editing?.idx === gi;
              return (
                <tr key={gi} className={isEditing ? 'cd-row editing' : 'cd-row'}>
                  <td className="cd-td-no">{li + 1}</td>
                  <td className="cd-td-name">
                    {isEditing ? (
                      <input
                        className="cd-input"
                        value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        autoFocus
                      />
                    ) : p.name}
                  </td>
                  <td className="cd-td-price">
                    {isEditing ? (
                      <input
                        className="cd-input cd-input-price"
                        value={editing.unitPrice}
                        onChange={e => setEditing({ ...editing, unitPrice: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      />
                    ) : (
                      p.unitPrice > 0 ? `¥${p.unitPrice.toLocaleString()}` : '—'
                    )}
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
          <input
            className="cd-input cd-add-name"
            placeholder="品名"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
          />
          <input
            className="cd-input cd-input-price cd-add-price"
            placeholder="原価（円）"
            value={addPrice}
            onChange={e => setAddPrice(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
          />
          <button className="cd-btn add" onClick={addItem}>追加</button>
        </div>

        <div className="cd-note">
          ※ ここで設定した単価は「品目追加」の金額入力欄に自動反映されます。
        </div>
      </div>
    </div>
  );
}
