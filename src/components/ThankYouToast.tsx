import { useEffect, useState } from 'react';
import './ThankYouToast.css';

interface Props {
  message: string;
  onDone: () => void;
}

// 入力保存後に、ふわっと表示されるやさしい感謝メッセージ
export default function ThankYouToast({ message, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // 4.5秒表示 → フェードアウト → 消える
    const t1 = setTimeout(() => setLeaving(true), 4500);
    const t2 = setTimeout(onDone, 5100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  const dismiss = () => { setLeaving(true); setTimeout(onDone, 500); };

  return (
    <div className={`ty-wrap ${leaving ? 'ty-leaving' : ''}`} onClick={dismiss}>
      <div className="ty-card">
        <div className="ty-hearts">
          <span>♡</span><span>✨</span><span>♡</span>
        </div>
        <div className="ty-msg">{message}</div>
        <div className="ty-hint">タップで閉じる</div>
      </div>
    </div>
  );
}
