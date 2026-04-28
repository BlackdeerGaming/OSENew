import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Cloud, AlertTriangle } from 'lucide-react';

const StatusModal = ({ isOpen, type, message, onResolve }) => {
  if (!isOpen) return null;

  const STATUS_CONFIG = {
    loading: {
      icon: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
      title: 'Sincronizando con la nube',
      bg: 'bg-primary/5',
      accent: 'border-primary/20'
    },
    success: {
      icon: <div className="p-3 bg-emerald-500/10 rounded-full"><CheckCircle2 className="w-12 h-12 text-emerald-500" /></div>,
      title: 'Operación Exitosa',
      bg: 'bg-emerald-500/5',
      accent: 'border-emerald-500/20'
    },
    error: {
      icon: <div className="p-3 bg-rose-500/10 rounded-full"><XCircle className="w-12 h-12 text-rose-500" /></div>,
      title: 'Error de Sincronización',
      bg: 'bg-rose-500/5',
      accent: 'border-rose-500/20'
    },
    warning: {
      icon: <div className="p-3 bg-amber-500/10 rounded-full"><AlertTriangle className="w-12 h-12 text-amber-500" /></div>,
      title: 'Atención',
      bg: 'bg-amber-500/5',
      accent: 'border-amber-500/20'
    }
  };

  const config = STATUS_CONFIG[type] || STATUS_CONFIG.loading;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={type !== 'loading' ? onResolve : undefined}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className={`relative w-full max-w-sm rounded-2xl border ${config.accent} ${config.bg} p-8 shadow-2xl backdrop-blur-xl bg-white/95 ring-1 ring-white/20`}
        >
          <div className="flex flex-col items-center text-center">
            {/* Status Icon */}
            <div className="mb-6">
              {config.icon}
            </div>

            {/* Title & Message */}
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {config.title}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-8">
              {message || 'Procesando solicitud...'}
            </p>

            {/* Action Button */}
            {type !== 'loading' && (
              <button
                onClick={onResolve}
                className="w-full py-3 px-6 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/20"
              >
                Entendido
              </button>
            )}

            {/* Cloud Status Indicator */}
            <div className="mt-6 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">
              <Cloud className="w-3 h-3" />
              <span>Conexión AWS Cloud</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StatusModal;
