import { Component, type ReactNode } from 'react';

interface Props { modName: string; children: ReactNode }
interface State { error: Error | null }

export default class ModificationErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, border: '1px solid #f5c2c2', borderRadius: 6, backgroundColor: '#fff5f5' }}>
          <strong style={{ color: '#c62828', fontSize: 13 }}>⚠ Erro em "{this.props.modName}"</strong>
          <p style={{ fontSize: 12, color: '#666', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
