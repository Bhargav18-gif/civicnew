import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[CIVICCONNECT RUNTIME ERROR]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#101826]/90 border border-red-500/30 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-red-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 font-display">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-6">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-left mb-6 overflow-auto max-h-36">
                <p className="text-xs text-red-300 font-mono break-all">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors"
              >
                <RefreshCw size={15} />
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors"
              >
                <Home size={15} />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
