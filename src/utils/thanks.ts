// 入力後に表示する、やさしい感謝メッセージ集
// {name} は担当者名（例：塗装部）に置き換わります。

const MESSAGES: string[] = [
  'お疲れさまでした。今日も入力してくれてありがとう 🍵',
  'ひと手間、ありがとう。数字の向こうに、あなたの一日があります ✨',
  'しっかり届きました。{name}のがんばり、ちゃんと残りましたよ 📖',
  'ありがとう。あなたの積み重ねが、工房の毎日をつくっています 🪵',
  '無事に保存できました。少し肩の力を抜いてね ☕',
  'いつも丁寧な入力をありがとう。頼りにしています 🌷',
  'おつかれさまです。あなたの一つひとつが、大きな力になっています 💪',
  'ありがとう。今日も一日、よくがんばりました 🌸',
  '記録できました。あなたの正確な仕事に、いつも助けられています 😊',
  '{name}のみなさん、今日もありがとう。よい一日になりますように 🌱',
];

const MORNING = 'おはようございます。今日も一日、よろしくお願いします 🌅';
const EVENING = '今日も一日おつかれさまでした。ゆっくり休んでね 🌙';

// 直前と同じメッセージが続かないように覚えておく
let lastIndex = -1;

export function pickThanks(name = 'みなさん'): string {
  const h = new Date().getHours();

  // 朝(〜9時)・夜(19時〜)は、たまに時間帯のあいさつを出す（約35%）
  if ((h < 9 || h >= 19) && Math.random() < 0.35) {
    return (h < 9 ? MORNING : EVENING).replace('{name}', name);
  }

  let idx = Math.floor(Math.random() * MESSAGES.length);
  if (idx === lastIndex) idx = (idx + 1) % MESSAGES.length; // 連続で同じを避ける
  lastIndex = idx;
  return MESSAGES[idx].replace('{name}', name);
}
