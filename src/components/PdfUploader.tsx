import { useState, useRef } from 'react';
import { parsePdf, PdfParseResult } from '../utils/pdfParser';

interface Props {
  onResult: (result: PdfParseResult) => void;
  contextYear?: number;
  contextMonth?: number;
}

export default function PdfUploader({ onResult, contextYear, contextMonth }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PdfParseResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setError('PDFファイルを選択してください');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await parsePdf(file, contextYear, contextMonth);
      setPreview(result);
      onResult(result);
    } catch (e) {
      setError('PDF読み込みに失敗しました。ファイルを確認してください。');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="pdf-uploader">
      <div
        className={`drop-zone ${loading ? 'loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        {loading ? (
          <span>読み込み中...</span>
        ) : (
          <span>📄 木地部PDFをここにドロップ<br />またはクリックして選択</span>
        )}
      </div>

      {error && <div className="pdf-error">{error}</div>}

      {preview && (
        <div className="pdf-preview">
          <div className="pdf-preview-header">
            {preview.year && preview.month
              ? `令和${preview.year}年 ${preview.month}月生産高`
              : 'PDF読み込み完了'}
          </div>
          <div className="pdf-preview-totals">
            <span>合計本数：<strong>{preview.totalCount}本</strong></span>
            <span>合計金額：<strong>¥{preview.totalAmount.toLocaleString('ja-JP')}</strong></span>
          </div>
          {preview.items.length > 0 && (
            <table className="pdf-items-table">
              <thead>
                <tr>
                  <th>品番</th>
                  <th>品名</th>
                  <th>本数</th>
                  <th>金額</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item, i) => (
                  <tr key={i} className={item.excluded ? 'excluded' : ''}>
                    <td>{item.code}</td>
                    <td>{item.name} {item.excluded && <span className="excluded-badge">※集計外</span>}</td>
                    <td className="num">{item.count}</td>
                    <td className="num">{item.amount > 0 ? item.amount.toLocaleString('ja-JP') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
