export interface ProductDef {
  name: string;
  category: string;
  unitPrice: number;   // 木地代（＝単価。手間代＋材料代）
  labor?: number;      // 手間代（工賃分）
  material?: number;   // 材料代
  plannedQty?: number; // 予定本数（所要日数の計算用）
}

// 略称 → 正規名（ドーナツ凡例など広い表示で使用）
export const CATEGORY_FULL: Record<string, string> = {
  'Co':    'Continue',
  'MP':    'Master Piece',
  'PC':    'Petit.Continue',
  '仏壇':  '仏壇',
  'リリー':'リリー',
  '特注':  '特注',
  'その他':'その他',
  '備考':  '備考',
};

// 原価データベースの初期シードデータ
// unitPrice=木地代、labor=手間代、material=材料代（木地代 = 手間代 + 材料代）
export const PRODUCT_LIST: ProductDef[] = [
  // ── Continue (Co) ──
  { name: 'ジュエリーチェスト',          category: 'Co', unitPrice: 32000, labor: 19000, material: 13000 },
  { name: 'ナイトテーブル2',             category: 'Co', unitPrice: 12000, labor: 8500,  material: 3500  },
  { name: 'ティーテーブル',              category: 'Co', unitPrice: 21000, labor: 9000,  material: 12000 },
  { name: 'ダイニングテーブル900',        category: 'Co', unitPrice: 26100, labor: 14000, material: 12100 },
  { name: 'ダイニングテーブル1600',       category: 'Co', unitPrice: 29300, labor: 15000, material: 14300 },
  { name: 'ダイニングテーブル1800',       category: 'Co', unitPrice: 31400, labor: 16000, material: 15400 },
  { name: 'センターテーブル',            category: 'Co', unitPrice: 16000, labor: 8000,  material: 8000  },
  { name: 'コンソール',                  category: 'Co', unitPrice: 14000, labor: 9000,  material: 5000  },
  { name: 'ワゴン280',                   category: 'Co', unitPrice: 9500,  labor: 5500,  material: 4000  },
  { name: 'プレジデントデスクエレガンス', category: 'Co', unitPrice: 29000, labor: 18000, material: 11000 },
  { name: 'デスク1100',                  category: 'Co', unitPrice: 26500, labor: 18500, material: 8000  },
  { name: 'カウチ',                      category: 'Co', unitPrice: 66500, labor: 44000, material: 22500 },
  { name: 'ドールクローゼット',          category: 'Co', unitPrice: 11000, labor: 11000, material: 0     },
  { name: 'サイドフレーム2050',          category: 'Co', unitPrice: 3650,  labor: 0,     material: 3650  },
  { name: 'サイドフレーム1980',          category: 'Co', unitPrice: 3650,  labor: 0,     material: 3650  },
  { name: 'キュリオケース530',           category: 'Co', unitPrice: 17000, labor: 10000, material: 7000  },
  { name: 'テレビボード1500',            category: 'Co', unitPrice: 28600, labor: 16500, material: 12100 },
  { name: 'テレビボード1800',            category: 'Co', unitPrice: 59000, labor: 45000, material: 14000 },
  { name: 'ブックケース',                category: 'Co', unitPrice: 22100, labor: 10000, material: 12100 },
  { name: 'ブックケース1200',            category: 'Co', unitPrice: 74200, labor: 50000, material: 24200 },
  { name: 'ベッドフレームS',             category: 'Co', unitPrice: 17700, labor: 7700,  material: 10000 },
  { name: 'ベッドフレームSD',            category: 'Co', unitPrice: 21600, labor: 8600,  material: 13000 },
  { name: 'ベッドフレームD',             category: 'Co', unitPrice: 25500, labor: 10500, material: 15000 },
  { name: 'ベッドフレームWD',            category: 'Co', unitPrice: 28500, labor: 11500, material: 17000 },
  { name: 'ハイチェスト',                category: 'Co', unitPrice: 40800, labor: 21000, material: 19800 },
  { name: 'ローチェスト',                category: 'Co', unitPrice: 29040, labor: 16500, material: 12540 },
  { name: 'リビングチェスト',            category: 'Co', unitPrice: 40800, labor: 21000, material: 19800 },
  { name: 'ビッグチェスト',              category: 'Co', unitPrice: 84800, labor: 54000, material: 30800 },
  { name: 'チェアE-02',                  category: 'Co', unitPrice: 4650,  labor: 4650,  material: 0     },
  { name: 'デスク1600',                  category: 'Co', unitPrice: 34000, labor: 18000, material: 16000 },
  { name: 'サイドチェスト',              category: 'Co', unitPrice: 13800, labor: 7000,  material: 6800  },
  { name: 'チェアE-03',                  category: 'Co', unitPrice: 4650,  labor: 4650,  material: 0     },
  { name: 'アロール一面',                category: 'Co', unitPrice: 44030, labor: 25000, material: 19030 },
  { name: 'アロール半三',                category: 'Co', unitPrice: 44030, labor: 25000, material: 19030 },
  { name: 'ルーシィー',                  category: 'Co', unitPrice: 25100, labor: 13000, material: 12100 },
  { name: 'アルバ',                      category: 'Co', unitPrice: 25000, labor: 15000, material: 10000 },
  { name: 'アルバ＊ワゴンのみ',          category: 'Co', unitPrice: 12000 },
  { name: 'アロール姿見',                category: 'Co', unitPrice: 26100, labor: 14000, material: 12100 },
  { name: 'コンパクトデスク',            category: 'Co', unitPrice: 15500, labor: 8500,  material: 7000  },
  { name: 'カンティーニュスツール',      category: 'Co', unitPrice: 5000,  labor: 3000,  material: 2000  },
  { name: 'リリイレーベルワゴン',        category: 'Co', unitPrice: 7500,  labor: 4500,  material: 3000  },
  { name: 'ワードローブ',                category: 'Co', unitPrice: 86000 },
  { name: '手元供養 メモリアルステージ', category: 'Co', unitPrice: 4800,  labor: 4000,  material: 800   },
  { name: 'デスク1600用チェスト',        category: 'Co', unitPrice: 19000, labor: 9600,  material: 9400  },

  // ── Master Piece (MP) ──
  { name: 'スツール',                       category: 'MP', unitPrice: 6800  },
  { name: 'テレビボード 210',               category: 'MP', unitPrice: 49500, labor: 31000, material: 18500 },
  { name: 'テレビボード G180',              category: 'MP', unitPrice: 35500, labor: 19000, material: 16500 },
  { name: 'テレビボード N180',              category: 'MP', unitPrice: 35100, labor: 23000, material: 12100 },
  { name: 'サイドボード N180',              category: 'MP', unitPrice: 38600, labor: 21000, material: 17600 },
  { name: 'ダイニングテーブル 1500',        category: 'MP', unitPrice: 20900, labor: 15000, material: 5900  },
  { name: 'ダイニングテーブル 1500 WN',     category: 'MP', unitPrice: 23371, labor: 15000, material: 8371  },
  { name: 'ダイニングテーブル 1800',        category: 'MP', unitPrice: 24550, labor: 17000, material: 7550  },
  { name: 'ダイニングテーブル 1800 WN',     category: 'MP', unitPrice: 26500, labor: 17000, material: 9500  },
  { name: 'ダイニングテーブルラウンド 1200WN', category: 'MP', unitPrice: 22132, labor: 15400, material: 6732 },
  { name: 'ダイニングテーブルラウンド 1200',  category: 'MP', unitPrice: 22732, labor: 16000, material: 6732 },
  { name: 'センターテーブル',              category: 'MP', unitPrice: 13300, labor: 9000,  material: 4300  },
  { name: 'センターテーブルラウンド 900',  category: 'MP', unitPrice: 20200, labor: 15000, material: 5200  },
  { name: 'センターテーブルラウンド 1200', category: 'MP', unitPrice: 21000, labor: 15000, material: 6000  },
  { name: 'サイドテーブル 35',             category: 'MP', unitPrice: 6730,  labor: 5000,  material: 1730  },
  { name: 'デスク 120',                    category: 'MP', unitPrice: 19100, labor: 12100, material: 7000  },
  { name: 'デスク 150',                    category: 'MP', unitPrice: 22950, labor: 13200, material: 9750  },
  { name: 'デスク N135',                   category: 'MP', unitPrice: 27500, labor: 17600, material: 9900  },
  { name: 'ワゴン',                        category: 'MP', unitPrice: 15000, labor: 10000, material: 5000  },
  { name: 'ドレッサー',                    category: 'MP', unitPrice: 24000, labor: 10389, material: 13611 },
  { name: 'ドレッサー姿見',               category: 'MP', unitPrice: 24200, labor: 14200, material: 10000 },
  { name: 'ローチェスト 85',              category: 'MP', unitPrice: 19800, labor: 11000, material: 8800  },
  { name: 'ローチェスト 120',             category: 'MP', unitPrice: 27200, labor: 14000, material: 13200 },
  { name: 'シェルフ ロータイプ',          category: 'MP', unitPrice: 22000, labor: 13000, material: 9000  },
  { name: 'シェルフ ハイタイプ',          category: 'MP', unitPrice: 24000, labor: 14000, material: 10000 },
  { name: 'ベッドフレーム S',             category: 'MP', unitPrice: 25800, labor: 25800, material: 0     },
  { name: 'ベッドフレーム SD',            category: 'MP', unitPrice: 27800, labor: 27800, material: 0     },
  { name: 'ベッドフレーム D',             category: 'MP', unitPrice: 26800, labor: 26800, material: 0     },
  { name: 'コーヒードリッパースタンド',   category: 'MP', unitPrice: 0     },

  // ── 仏壇 ──
  { name: 'ルーチェ',                   category: '仏壇', unitPrice: 23000, labor: 17000, material: 6000  },
  { name: 'ヌーヴォLQ',                 category: '仏壇', unitPrice: 23000, labor: 16000, material: 7000  },
  { name: 'MODE d',                     category: '仏壇', unitPrice: 18700, labor: 12000, material: 6700  },
  { name: 'IMODE α 専用台',            category: '仏壇', unitPrice: 18200, labor: 10000, material: 8200  },
  { name: 'クラリス',                   category: '仏壇', unitPrice: 17500, labor: 11500, material: 6000  },
  { name: 'セリーヌ ミニ',             category: '仏壇', unitPrice: 17500, labor: 17500, material: 0     },
  { name: 'ヌーヴォX',                  category: '仏壇', unitPrice: 22000, labor: 17500, material: 4500  },
  { name: 'ヌーヴォX 上置台',          category: '仏壇', unitPrice: 24000, labor: 15000, material: 9000  },
  { name: '八木研 ネージュ',           category: '仏壇', unitPrice: 61350, labor: 39000, material: 22350 },
  { name: '神棚',                       category: '仏壇', unitPrice: 8000,  labor: 8000,  material: 0     },
  { name: '初月',                       category: '仏壇', unitPrice: 20500, labor: 11000, material: 9500  },
  { name: '初月台付WO',                category: '仏壇', unitPrice: 48560, labor: 25000, material: 23560 },
  { name: '初月台付WN',                category: '仏壇', unitPrice: 53000, labor: 25000, material: 28000 },
  { name: 'プラニット',                 category: '仏壇', unitPrice: 48670, labor: 24000, material: 24670 },
  { name: 'プログレ',                   category: '仏壇', unitPrice: 17200, labor: 10000, material: 7200  },
  { name: 'ハロ WN',                   category: '仏壇', unitPrice: 57000, labor: 24000, material: 33000 },
  { name: 'ハロ WO',                   category: '仏壇', unitPrice: 46000, labor: 24000, material: 22000 },
  { name: 'ショパン',                   category: '仏壇', unitPrice: 26800, labor: 14000, material: 12800 },
  { name: 'ショパン上下',              category: '仏壇', unitPrice: 50600, labor: 25000, material: 25600 },
  { name: 'アマデウス',                 category: '仏壇', unitPrice: 21700, labor: 16000, material: 5700  },
  { name: 'マイセル',                   category: '仏壇', unitPrice: 29000, labor: 13000, material: 16000 },
  { name: 'ダミエ',                     category: '仏壇', unitPrice: 25600, labor: 17000, material: 8600  },
  { name: 'メモリアルボックス（丸喜）', category: '仏壇', unitPrice: 11000, labor: 5000,  material: 6000  },
  { name: 'メモリアルボックス',         category: '仏壇', unitPrice: 12000, labor: 6000,  material: 6000  },
  { name: '応天',                       category: '仏壇', unitPrice: 34100, labor: 14600, material: 19500 },
  { name: 'モーント',                   category: '仏壇', unitPrice: 21000, labor: 13500, material: 7500  },
  { name: 'ノーブル',                   category: '仏壇', unitPrice: 21500, labor: 12000, material: 9500  },
  { name: 'ノーブルキュリオ',          category: '仏壇', unitPrice: 42500, labor: 18000, material: 24500 },
  { name: 'クワトロ',                   category: '仏壇', unitPrice: 19500, labor: 10000, material: 9500  },
  { name: 'クワトロ 重ねタイプ',       category: '仏壇', unitPrice: 37000, labor: 18000, material: 19000 },
  { name: 'ノーブルミニ WN',           category: '仏壇', unitPrice: 14500, labor: 7000,  material: 7500  },
  { name: 'ノーブルミニ RO',           category: '仏壇', unitPrice: 14500, labor: 7000,  material: 7500  },
  { name: 'TINY stage ブラン',         category: '仏壇', unitPrice: 11000, labor: 6000,  material: 5000  },
  { name: 'ヴァローナ',                 category: '仏壇', unitPrice: 57000, labor: 35000, material: 22000 },
  { name: 'ブラウ',                     category: '仏壇', unitPrice: 23000, labor: 13000, material: 10000 },
  { name: 'ノーブルK',                 category: '仏壇', unitPrice: 23000, labor: 14000, material: 9000  },
  { name: 'タイニー',                   category: '仏壇', unitPrice: 11000, labor: 6000,  material: 5000  },
  { name: 'チェント',                   category: '仏壇', unitPrice: 20600, labor: 12000, material: 8600  },
  { name: 'ロンバスダーク',             category: '仏壇', unitPrice: 10500, labor: 6500,  material: 4000  },
  { name: 'ロンバスライト',             category: '仏壇', unitPrice: 10500, labor: 6500,  material: 4000  },
  { name: 'マレインダーク',             category: '仏壇', unitPrice: 20000, labor: 13000, material: 7000  },
  { name: 'マレインライト',             category: '仏壇', unitPrice: 20000, labor: 13000, material: 7000  },
  { name: 'コッテ',                     category: '仏壇', unitPrice: 14000, labor: 9000,  material: 5000  },

  // ── Petit.Continue (PC) ── 手間/材料の内訳は未設定（木地代のみ）
  { name: 'カウチ',          category: 'PC', unitPrice: 24500 },
  { name: 'ワードローブ',    category: 'PC', unitPrice: 27500 },
  { name: 'ダイニングテーブル', category: 'PC', unitPrice: 9000 },
  { name: 'センターテーブル',  category: 'PC', unitPrice: 7000 },
  { name: '姿見',            category: 'PC', unitPrice: 13000 },
  { name: 'チェア',          category: 'PC', unitPrice: 24500 },
  { name: 'ティーテーブル',  category: 'PC', unitPrice: 15000 },
  { name: 'ルーム60',        category: 'PC', unitPrice: 7300  },
  { name: 'ルーム90',        category: 'PC', unitPrice: 8350  },
  { name: 'ブックケース',    category: 'PC', unitPrice: 8000  },
  { name: 'スツール',        category: 'PC', unitPrice: 4200  },
  { name: 'ベンチ',          category: 'PC', unitPrice: 4800  },
  { name: 'ドールステージ',  category: 'PC', unitPrice: 5000  },
  { name: 'ローチェストL',   category: 'PC', unitPrice: 20670 },
  { name: 'ローチェストS',   category: 'PC', unitPrice: 17670 },
  { name: 'コンパクトディスク', category: 'PC', unitPrice: 11320 },
  { name: '学習デスク',      category: 'PC', unitPrice: 15760 },
  { name: 'ブックスタンド',  category: 'PC', unitPrice: 3500  },
  { name: 'ドールハウスL',   category: 'PC', unitPrice: 40000 },
  { name: 'ドールハウスL字', category: 'PC', unitPrice: 20000 },
  { name: 'ドールハウスM',   category: 'PC', unitPrice: 0 },
  { name: 'スタンド　大',    category: 'PC', unitPrice: 0 },
  { name: 'ドロワーチェスト', category: 'PC', unitPrice: 0 },
  { name: '密談椅子',        category: 'PC', unitPrice: 0 },
];

export const CATEGORIES = ['Co', 'MP', '仏壇', 'リリー', 'PC', '特注', 'その他', '備考'] as const;

// 製品名＋カテゴリーで手間代・材料代を引くためのマップ
const LM_MAP: Record<string, { labor?: number; material?: number }> = {};
for (const p of PRODUCT_LIST) {
  LM_MAP[`${p.category}|${p.name}`] = { labor: p.labor, material: p.material };
}

// 既存の原価データ（手間/材料なし）に初期値を補完するための参照
export function lookupLaborMaterial(category: string, name: string): { labor?: number; material?: number } | undefined {
  return LM_MAP[`${category}|${name}`];
}
