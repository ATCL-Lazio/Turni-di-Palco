import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen app-gradient flex items-center justify-center px-6">
          <div className="bg-[#1a1617] border border-[#2d2728] rounded-xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#a82847] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">⚠️</span>
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">
                Errore nel minigioco
              </h3>
              <p className="text-[#b8b2b3] text-sm mb-4">
                Si è verificato un errore durante il minigioco. Riprova più tardi.
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="bg-[#f4bf4f] text-[#0f0d0e] px-6 py-2 rounded-lg font-semibold hover:bg-[#f4bf4f]/90 transition-colors"
              >
                Riprova
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
