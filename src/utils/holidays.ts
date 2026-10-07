// 日本の祝日と稼働日数の計算
// 対象：固定祝日・ハッピーマンデー・春分/秋分・振替休日
// （国民の休日などの稀なケースは簡易対応）

function nthMonday(year: number, month: number, n: number): number {
  // month: 1-12。第n月曜の日付を返す
  const first = new Date(year, month - 1, 1).getDay(); // 0=日
  const firstMonday = ((8 - first) % 7) + 1; // 最初の月曜の日
  return firstMonday + (n - 1) * 7;
}

function vernalEquinox(year: number): number {
  // 春分の日（1980-2099で有効）
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}
function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

// その年の全祝日（"M-D" の集合）
function holidaysOfYear(year: number): Set<string> {
  const h = new Set<string>();
  const add = (m: number, d: number) => h.add(`${m}-${d}`);

  add(1, 1);                       // 元日
  add(1, nthMonday(year, 1, 2));   // 成人の日
  add(2, 11);                      // 建国記念の日
  if (year >= 2020) add(2, 23);    // 天皇誕生日
  add(3, vernalEquinox(year));     // 春分の日
  add(4, 29);                      // 昭和の日
  add(5, 3);                       // 憲法記念日
  add(5, 4);                       // みどりの日
  add(5, 5);                       // こどもの日
  add(7, nthMonday(year, 7, 3));   // 海の日
  if (year >= 2016) add(8, 11);    // 山の日
  add(9, nthMonday(year, 9, 3));   // 敬老の日
  add(9, autumnalEquinox(year));   // 秋分の日
  add(10, nthMonday(year, 10, 2)); // スポーツの日
  add(11, 3);                      // 文化の日
  add(11, 23);                     // 勤労感謝の日

  // 振替休日：祝日が日曜なら、翌日以降の平日を休みにする
  const extra: string[] = [];
  for (const key of h) {
    const [m, d] = key.split('-').map(Number);
    const dow = new Date(year, m - 1, d).getDay();
    if (dow === 0) {
      // 次の平日（祝日でない日）を振替に
      let nd = new Date(year, m - 1, d + 1);
      while (h.has(`${nd.getMonth() + 1}-${nd.getDate()}`)) {
        nd = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate() + 1);
      }
      extra.push(`${nd.getMonth() + 1}-${nd.getDate()}`);
    }
  }
  extra.forEach(k => h.add(k));
  return h;
}

export interface MonthWorkInfo {
  weekdayWorkdays: number;   // 平日（月〜金）で祝日でない日数
  holidays: number[];        // その月の祝日の「日」
  saturdays: number[];       // その月の土曜の「日」
  daysInMonth: number;
}

// 西暦year・month(1-12) の稼働日情報
export function getMonthWorkInfo(year: number, month: number): MonthWorkInfo {
  const holSet = holidaysOfYear(year);
  const daysInMonth = new Date(year, month, 0).getDate();
  let weekdayWorkdays = 0;
  const holidays: number[] = [];
  const saturdays: number[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=日,6=土
    const isHol = holSet.has(`${month}-${d}`);
    if (isHol) holidays.push(d);
    if (dow === 6) saturdays.push(d);
    if (dow >= 1 && dow <= 5 && !isHol) weekdayWorkdays++;
  }
  return { weekdayWorkdays, holidays, saturdays, daysInMonth };
}

// 稼働日数 = 平日稼働日 + 出勤する土曜の数（祝日の土曜は除外）
export function calcWorkdays(info: MonthWorkInfo, workingSaturdays: number[], year: number, month: number): number {
  const holSet = holidaysOfYear(year);
  const satCount = workingSaturdays.filter(d => !holSet.has(`${month}-${d}`)).length;
  return info.weekdayWorkdays + satCount;
}
