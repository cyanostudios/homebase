// client/src/core/ui/ErrorBoundary.tsx
// Catches React errors and displays them instead of a white screen
import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 600,
          margin: '40px auto',
        }}>
          <h1 style={{ color: '#c00', marginBottom: 16 }}>Ett fel uppstod</h1>
          <pre style={{
            background: '#f5f5f5',
            padding: 16,
            overflow: 'auto',
            fontSize: 13,
          }}>
            {this.state.error.message}
          </pre>
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer' }}>Stack trace</summary>
            <pre style={{
              background: '#f5f5f5',
              padding: 16,
              overflow: 'auto',
              fontSize: 11,
              marginTop: 8,
            }}>
              {this.state.error.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
