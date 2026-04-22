import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 min-h-[400px]">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <AlertTriangle className="w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 mb-2">¡Ups! Algo salió mal</h2>
          <p className="text-slate-500 max-w-md mb-8 font-medium">
            La vista actual ha encontrado un error inesperado. No te preocupes, tus datos están a salvo.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              <RefreshCcw className="w-4 h-4" />
              Reintentar Vista
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <Home className="w-4 h-4" />
              Ir al Inicio
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-12 p-4 bg-slate-100 rounded-lg text-left max-w-2xl w-full overflow-auto">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Error Log (Dev Only):</p>
              <pre className="text-xs text-rose-600 font-mono">
                {this.state.error?.toString()}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
