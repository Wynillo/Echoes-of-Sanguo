import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', gap: '1rem', padding: '2rem', background: '#080c18', color: '#e0e0e0',
          fontFamily: 'monospace', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠</div>
          <div style={{ color: '#f07070', fontWeight: 'bold' }}>Ein Fehler ist aufgetreten</div>
          <div style={{ fontSize: '0.8rem', color: '#888', maxWidth: '40rem', wordBreak: 'break-word' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={this.reset}
            style={{
              marginTop: '1rem', padding: '0.6rem 1.5rem', borderRadius: '0.4rem',
              background: '#1a2a4a', color: '#c8a84b', border: '1px solid #c8a84b',
              cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            {this.props.onReset ? '← Zurück zum Titel' : '⟳ Neu laden'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
