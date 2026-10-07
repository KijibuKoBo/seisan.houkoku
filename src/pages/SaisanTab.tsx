import { useState, useMemo, useEffect } from 'react';
import { KijiItem } from '../types';
import { loadKijiItems } from '../utils/kijiStore';
import { loadCostDatabase } from '../utils/costStore';
import { PRODUCT_LIST } from '../utils/productList';
import {
  loadSaisanSettings, saveSaisanSettings, pushSaisanSettings, SaisanSettings,
} from '../utils/saisanSettings';
import { getMonthWorkInfo } from '../utils/holidays';
import { loadSaisanRatios, saveSaisanRatios, pushSaisanRatios, ratioKey, RatioMap } from '../utils/saisanRatios';
import './SaisanTab.css';

interface Props {
  availableYears: number[];
  canEdit: boolean;
}

interface SplitRow {
  key: string;
  rkey: string;        // 割合記憶用キー（カテゴリー|品名）
  category: string;
  name: string;
  count: number;
  amount: number;
  labor: number;
  material: number;
  estimated: boolean;  // マスターに手間/材料がなく割合で推定したか
  pct: number;         // 推定時の手間代割合（%）
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function yen(n: number): string { return `¥${Math.round(n).toLocaleString()}`; }

export default function SaisanTab({ availableYears, canEdit }: Props) {
  const currentReiwa = new Date().getFullYear() - 2018;
  const yearOptions = [...new Set([...availableYears, currentReiwa, currentReiwa - 1])].sort((a, b) => b - a);

  const [selYear, setSelYear] = useState(yearOptions[0] ?? currentReiwa);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);

  // 設定（人数・日当）
  const [settings, setSettings] = useState<SaisanSettings>(() => loadSaisanSettings());
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 原価マスター（手間代・材料代の内訳）。
  // 既定のマスター(PRODUCT_LIST)を土台に、保存済みの原価DBで上書きする。
  const costMap = useMemo(() => {
    const m: Record<string, { unitPrice: number; labor?: number; material?: number }> = {};
    for (const p of PRODUCT_LIST) {
      m[`${p.category}|${p.name}`] = { unitPrice: p.unitPrice, labor: p.labor, material: p.material };
    }
    for (const p of loadCostDatabase()) {
      const key = `${p.category}|${p.name}`;
      const ex = m[key];
      m[key] = {
        unitPrice: p.unitPrice,
        labor: p.labor ?? ex?.labor,
        material: p.material ?? ex?.material,
      };
    }
    return m;
  }, []);

  // 手間代割合の品目別オーバーライド（未登録品目用）
  const [ratios, setRatios] = useState<RatioMap>(() => loadSaisanRatios());

  // 対象月の品目
  const items = useMemo<KijiItem[]>(() => loadKijiItems(selYear, selMonth), [selYear, selMonth]);

  // 各品目を手間代・材料代に分割
  // マスターに登録あり → その比率。無い品目 → 品目別割合（なければ設定の初期割合）。
  const rows = useMemo<SplitRow[]>(() => {
    return items
      .filter(i => !i.excluded && (i.category || 'その他') !== '備考')
      .map((i, idx) => {
        const cat = i.category || 'その他';
        const rkey = ratioKey(cat, i.name);
        const m = costMap[`${i.category}|${i.name}`];
        let estimated = true;
        let pct = ratios[rkey] ?? settings.estimateRate;
        let ratio = pct / 100;
        if (m && m.labor != null) {
          const laborU = m.labor;
          const matU = m.material != null ? m.material : Math.max(m.unitPrice - m.labor, 0);
          const denom = laborU + matU;
          if (denom > 0) { ratio = laborU / denom; estimated = false; pct = Math.round(ratio * 100); }
        }
        const labor = Math.round(i.amount * ratio);
        const material = i.amount - labor;
        return {
          key: `${cat}_${i.name}_${idx}`,
          rkey, category: cat, name: i.name,
          count: i.count, amount: i.amount, labor, material, estimated, pct,
        };
      });
  }, [items, costMap, ratios, settings.estimateRate]);

  const totalAmount   = rows.reduce((s, r) => s + r.amount, 0);
  const totalLabor    = rows.reduce((s, r) => s + r.labor, 0);
  const totalMaterial = rows.reduce((s, r) => s + r.material, 0);

  // 稼働日（西暦に変換）
  const seireki = selYear + 2018;
  const workInfo = useMemo(() => getMonthWorkInfo(seireki, selMonth), [seireki, selMonth]);
  const [workSaturdays, setWorkSaturdays] = useState<number[]>([]);
  const [workdaysOverride, setWorkdaysOverride] = useState<number | null>(null);

  // 月が変わったら土曜出勤・上書きをリセット
  useEffect(() => { setWorkSaturdays([]); setWorkdaysOverride(null); }, [selYear, selMonth]);

  const computedWorkdays = workInfo.weekdayWorkdays + workSaturdays.length;
  const workdays = workdaysOverride ?? computedWorkdays;

  // 採算計算
  const laborCost = settings.people * settings.dailyWage * workdays; // 人件費
  const profit = totalLabor - laborCost;                              // 手間代 − 人件費
  const isProfit = profit >= 0;
  const neededPersonDays = settings.dailyWage > 0 ? totalLabor / settings.dailyWage : 0; // 必要人日
  const neededDays = settings.people > 0 ? neededPersonDays / settings.people : 0;       // 必要稼働日

  const toggleSaturday = (d: number) => {
    setWorkSaturdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    setWorkdaysOverride(null);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    saveSaisanSettings(settings);
    try {
      await pushSaisanSettings();
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch { /* サーバー失敗でもローカルには保存済み */ }
    finally { setSavingSettings(false); }
  };

  const setNum = (field: keyof SaisanSettings, v: number) => {
    setSettings(s => ({ ...s, [field]: v }));
    setSettingsSaved(false);
  };

  // 推定品目の手間代割合を変更（ローカル反映）
  const changeRatio = (rkey: string, pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    setRatios(prev => ({ ...prev, [rkey]: clamped }));
  };
  // 変更確定時にサーバー保存
  const persistRatios = () => {
    saveSaisanRatios(ratios);
    pushSaisanRatios().catch(() => { /* ローカルには保存済み */ });
  };

  return (
    <div className="kiji-section saisan">
      {/* 対象月 */}
      <div className="manage-selectors">
        <label>対象：</label>
        <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
          {yearOptions.map(y => <option key={y} value={y}>令和{y}年</option>)}
        </select>
        <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
          {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
      </div>

      {/* 設定 */}
      <div className="saisan-settings">
        <div className="saisan-settings-title">計算の前提</div>
        <div className="saisan-settings-row">
          <label>工場の人数</label>
          <input type="number" min={1} value={settings.people} disabled={!canEdit}
            onChange={e => setNum('people', Number(e.target.value))} />
          <span>人</span>

          <label>日当（1人）</label>
          <input type="number" min={0} step={1000} value={settings.dailyWage} disabled={!canEdit}
            onChange={e => setNum('dailyWage', Number(e.target.value))} />
          <span>円 / 日（{settings.hoursPerDay}時間）</span>

          <label>未登録品目の手間代</label>
          <input type="number" min={0} max={100} value={settings.estimateRate} disabled={!canEdit}
            onChange={e => setNum('estimateRate', Number(e.target.value))} />
          <span>%（初期値）</span>

          {canEdit && (
            <button className="saisan-save-btn" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? '保存中...' : settingsSaved ? '✓ 保存' : '設定を保存'}
            </button>
          )}
        </div>
      </div>

      {/* 稼働日 */}
      <div className="saisan-workdays">
        <div className="saisan-sub-title">実稼働日数（祝祭日・土日休みで計算）</div>
        <div className="saisan-workdays-row">
          <span>平日（祝日除く）<strong>{workInfo.weekdayWorkdays}日</strong></span>
          <span className="saisan-sat-label">出勤する土曜：</span>
          {workInfo.saturdays.length === 0 && <span className="saisan-dim">（この月に土曜はありません）</span>}
          {workInfo.saturdays.map(d => (
            <button key={d}
              className={`saisan-sat-chip ${workSaturdays.includes(d) ? 'on' : ''}`}
              onClick={() => toggleSaturday(d)}
            >{d}日</button>
          ))}
        </div>
        <div className="saisan-workdays-row">
          <label>実稼働日数：</label>
          <input type="number" min={0} className="saisan-wd-input"
            value={workdays}
            onChange={e => setWorkdaysOverride(Number(e.target.value))} />
          <span>日</span>
          {workdaysOverride !== null && (
            <button className="saisan-reset-btn" onClick={() => setWorkdaysOverride(null)}>自動計算に戻す</button>
          )}
          {workInfo.holidays.length > 0 && (
            <span className="saisan-dim">祝日：{workInfo.holidays.map(d => `${d}日`).join('・')}</span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="saisan-empty">この月の木地部データがありません。</p>
      ) : (
        <>
          {/* 判定カード */}
          <div className={`saisan-verdict ${isProfit ? 'profit' : 'loss'}`}>
            <div className="saisan-verdict-main">
              {isProfit ? '黒字' : '赤字'}
              <span className="saisan-verdict-amount">{isProfit ? '+' : '−'}{yen(Math.abs(profit))}</span>
            </div>
            <div className="saisan-verdict-sub">
              手間代合計（実質売上） {yen(totalLabor)} − 人件費 {yen(laborCost)}
            </div>
          </div>

          {/* 指標 */}
          <div className="saisan-metrics">
            <div className="saisan-metric">
              <div className="saisan-metric-label">当月の生産金額</div>
              <div className="saisan-metric-val">{yen(totalAmount)}</div>
            </div>
            <div className="saisan-metric">
              <div className="saisan-metric-label">材料代</div>
              <div className="saisan-metric-val mat">{yen(totalMaterial)}</div>
            </div>
            <div className="saisan-metric">
              <div className="saisan-metric-label">手間代（実質売上）</div>
              <div className="saisan-metric-val lab">{yen(totalLabor)}</div>
            </div>
            <div className="saisan-metric">
              <div className="saisan-metric-label">人件費（{settings.people}人×{yen(settings.dailyWage)}×{workdays}日）</div>
              <div className="saisan-metric-val">{yen(laborCost)}</div>
            </div>
          </div>

          {/* 何日で仕上げれば黒字か */}
          <div className="saisan-days-note">
            この手間代なら <strong>{neededDays.toFixed(1)}日</strong>（{settings.people}人で）以内に仕上げれば採算が合います。
            実稼働 <strong>{workdays}日</strong> なので、
            {workdays <= neededDays
              ? <span className="ok">　目安日数以内です（黒字）。</span>
              : <span className="ng">　{(workdays - neededDays).toFixed(1)}日 超過しています（赤字）。</span>}
            <div className="saisan-dim" style={{ marginTop: 4 }}>
              必要人日 = 手間代合計 ÷ 日当 = {neededPersonDays.toFixed(1)}人日（＝目安 {neededDays.toFixed(1)}日 × {settings.people}人）
            </div>
          </div>

          {/* 内訳表 */}
          <div className="saisan-sub-title" style={{ marginTop: 18 }}>品目別の手間代・材料代</div>
          <table className="kiji-table saisan-table">
            <thead>
              <tr>
                <th>カテゴリー</th><th>品名</th><th>本数</th>
                <th>金額</th><th>手間代</th><th>材料代</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td><span className="cat-badge">{r.category}</span></td>
                  <td>
                    {r.name}
                    {r.estimated && (
                      canEdit ? (
                        <span className="saisan-ratio-edit" title="手間代の割合（%）。変更できます">
                          手間
                          <input type="number" min={0} max={100} value={r.pct}
                            onChange={e => changeRatio(r.rkey, Number(e.target.value))}
                            onBlur={persistRatios} />
                          %
                        </span>
                      ) : <span className="saisan-est">推定{r.pct}%</span>
                    )}
                  </td>
                  <td className="num">{r.count}本</td>
                  <td className="num">{yen(r.amount)}</td>
                  <td className="num lab">{yen(r.labor)}</td>
                  <td className="num mat">{yen(r.material)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>合計</td>
                <td className="num">{yen(totalAmount)}</td>
                <td className="num lab">{yen(totalLabor)}</td>
                <td className="num mat">{yen(totalMaterial)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="saisan-dim" style={{ marginTop: 6 }}>
            ※ 手間代・材料代が原価管理に未登録の品目は、金額に対する手間代の割合（%）で計算します。
            {canEdit ? '各行の「手間○%」を変更すると、その品名の割合として記憶されます（全端末共有）。' : '割合の変更は管理者のみ可能です。'}
            原価管理に手間代・材料代を登録すると、さらに正確になります。
          </div>
        </>
      )}
    </div>
  );
}
