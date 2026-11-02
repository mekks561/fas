import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white p-8">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/50 rounded-xl p-6 shadow-2xl shadow-red-500/10">
            <h2 className="text-2xl font-bold text-red-400 mb-4">系统崩溃 (System Failure)</h2>
            <div className="bg-black/50 rounded-lg p-4 mb-6 font-mono text-sm text-red-300/80 overflow-auto max-h-48">
              {this.state.error?.message || '未知运行时错误'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
            >
              重启银河指挥系统
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
