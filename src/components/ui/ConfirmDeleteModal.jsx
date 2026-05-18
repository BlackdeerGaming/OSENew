import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "¿Eliminar Valoración TRD?",
  message = "Estás a punto de borrar esta valoración TRD. Esta acción eliminará la valoración de la Tabla Final y de los Datos Estructurados asociados. ¿Deseas continuar?",
  confirmText = "Eliminar valoración",
  cancelText = "Cancelar",
  details = null, // { dependencia, serie, subserie }
  status = 'idle', // 'idle' | 'loading' | 'success' | 'error'
  errorMsg = ''
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        {/* Backdrop clickable overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={status === 'idle' || status === 'error' ? onClose : undefined}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className={cn(
            "relative w-full max-w-md rounded-2xl border p-6 shadow-2xl backdrop-blur-xl bg-white ring-1 ring-black/5 z-10 transition-all",
            status === 'success' ? "border-emerald-200 bg-emerald-50/50" : 
            status === 'error' ? "border-rose-200 bg-rose-50/50" : "border-slate-200"
          )}
        >
          {/* Close button (only when idle or error) */}
          {(status === 'idle' || status === 'error') && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex flex-col items-center text-center">
            {/* Conditional Status Visuals */}
            {status === 'loading' && (
              <div className="mb-2 flex flex-col items-center py-6">
                <div className="p-3 bg-primary/10 rounded-full mb-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Eliminando valoración...</h3>
                <p className="text-slate-500 text-xs mt-1">Sincronizando cambios de forma segura en la nube...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="mb-2 flex flex-col items-center py-4">
                <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-emerald-950">¡Eliminado con éxito!</h3>
                <p className="text-emerald-700/80 text-sm mt-1 mb-6 leading-relaxed">
                  La valoración ha sido borrada de forma permanente de la base de datos y de la Tabla Final.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="mb-2 flex flex-col items-center py-4">
                <div className="p-3 bg-rose-500/10 rounded-full mb-3">
                  <XCircle className="w-12 h-12 text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-rose-950">No se pudo eliminar</h3>
                <p className="text-rose-700/80 text-xs mt-2 leading-relaxed max-w-xs mb-6">
                  {errorMsg || "Ocurrió un error inesperado al intentar borrar la valoración de la base de datos."}
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}

            {status === 'idle' && (
              <>
                {/* Visual Icon Alert */}
                <div className="p-3 bg-rose-500/10 rounded-full mb-4">
                  <AlertTriangle className="w-8 h-8 text-rose-600 animate-pulse" />
                </div>

                {/* Title & Message */}
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {title}
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed max-w-sm mb-5">
                  {message}
                </p>

                {/* Valuation Details Card */}
                {details && (
                  <div className="w-full bg-slate-50 rounded-xl p-3 border border-slate-100 mb-6 text-left">
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Registro Seleccionado</h4>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500 shrink-0">Dependencia:</span>
                        <span className="font-bold text-slate-800 truncate" title={details.dependencia}>{details.dependencia}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500 shrink-0">Serie Documental:</span>
                        <span className="font-bold text-slate-800 truncate" title={details.serie}>{details.serie}</span>
                      </div>
                      {details.subserie && (
                        <div className="flex justify-between gap-4">
                          <span className="font-semibold text-slate-500 shrink-0">Subserie:</span>
                          <span className="font-bold text-slate-800 truncate" title={details.subserie}>{details.subserie}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Danger Warning Alert */}
                <div className="w-full text-[10px] text-rose-600 font-bold uppercase tracking-wider bg-rose-50 border border-rose-100 rounded-lg py-2 px-3 mb-6">
                  ¡Esta acción no se puede deshacer!
                </div>

                {/* Actions */}
                <div className="w-full flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-widest transition-all active:scale-95 border border-slate-200 cursor-pointer"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmText}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
