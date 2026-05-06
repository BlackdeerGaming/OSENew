import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, SkipForward, Play, XOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConflictModal({ 
  isOpen, 
  onResolve, // (decision) => void where decision is 'continue', 'skip', 'cancel'
  conflictInfo // { type, data, existing }
}) {
  if (!isOpen || !conflictInfo) return null;

  const { type, data } = conflictInfo;
  
  const typeLabels = {
    'dependencias': 'Dependencia',
    'series': 'Serie Documental',
    'subseries': 'Subserie Documental',
    'TRD': 'Registro de Valoración TRD'
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-amber-50">
            <div className="p-3 bg-amber-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Posible duplicado detectado</h2>
              <p className="text-sm text-amber-700 font-medium">Ya existe un registro con la misma información.</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Detalles del Conflicto</h3>
              <div className="grid grid-cols-2 gap-y-3">
                <div className="text-xs font-bold text-slate-500">Tipo:</div>
                <div className="text-xs font-black text-slate-800">{typeLabels[type] || type}</div>
                
                {data.codigo && (
                  <>
                    <div className="text-xs font-bold text-slate-500">Código:</div>
                    <div className="text-xs font-black text-slate-800">{data.codigo}</div>
                  </>
                )}
                
                {data.nombre && (
                  <>
                    <div className="text-xs font-bold text-slate-500">Nombre:</div>
                    <div className="text-xs font-black text-slate-800">{data.nombre}</div>
                  </>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Si continúas, podrías crear información duplicada que ensucie la base de datos de la entidad. ¿Cómo deseas proceder?
            </p>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onResolve('continue')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              <Play className="w-4 h-4" />
              Continuar
            </button>
            
            <button
              onClick={() => onResolve('skip')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white hover:bg-primary/90 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <SkipForward className="w-4 h-4" />
              Omitir
            </button>

            <button
              onClick={() => onResolve('cancel')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              <XOctagon className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
