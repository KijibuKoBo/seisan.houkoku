import { Component, ReactNode } from 'react';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', background: '#f0f2f5',
        fontFamily: 'Meiryo, sans-serif', textAlign: 'center', padding: 24,
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#c00', marginBottom: 12 }}>アプリの起動に失敗しました</h2>
        <p style={{ color: '#666', marginBottom: 16, fontSize: 13 }}>
          ブラウザのキャッシュをクリアして再度お試しください。
        </p>
        <pre style={{
          background: '#fff', border: '1px solid #ddd', borderRadius: 4,
          padding: '10px 16px', fontSize: 11, color: '#555',
          maxWidth: 600, overflow: 'auto', textAlign: 'left',
        }}>
          {this.state.error?.message}
        </pre>
        <button
          onClick={() => { localStorage.clear(); sessionStorage.clear(); location.reload(); }}
          style={{
            marginTop: 16, padding: '8px 20px', background: '#1a3a5c', color: 'white',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
          }}
        >
          データをリセットして再起動
        </button>
      </div>
    );
  }
}
