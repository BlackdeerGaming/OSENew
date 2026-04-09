import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, Scan, Database, CheckCircle2, AlertCircle, Loader2, Search, Table, Trash2, ArrowRight, Eye, Printer, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_BASE_URL from '../../config/api';
import TRDReportDANE from '../trd/TRDGenerator';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

const TRDImportView = ({ onImportComplete, currentUser }) => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); 
  const [detectedActions, setDetectedActions] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [error, setError] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setStatus('idle');
      setError(null);
      setAiResponse(null);
      setSelectedIndices(new Set());
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: false
  });

  const handleStartAnalysis = async () => {
    if (!file) return;
    setStatus('analyzing');
    setError(null);
    setAiResponse(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-trd`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Error al analizar. Verifique que el documento sea legible.');

      const data = await response.json();
      const actions = data.actions || [];
      setDetectedActions(actions);
      // Por defecto seleccionamos todo
      setSelectedIndices(new Set(actions.map((_, i) => i)));
      setAiResponse(data.message || data.raw || "Análisis completado.");
      setStatus('reviewing');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const handleCommit = async () => {
    const actionsToRun = detectedActions.filter((_, i) => selectedIndices.has(i));
    if (actionsToRun.length === 0) return alert("Selecciona al menos un registro para importar.");

    setStatus('committing');
    try {
      if (onImportComplete) {
        await onImportComplete(actionsToRun);
      }
      setStatus('success');
    } catch (err) {
      setError("Error al sincronizar con la nube.");
      setStatus('reviewing');
    }
  };

  const toggleSelection = (index) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked) setSelectedIndices(new Set(detectedActions.map((_, i) => i)));
    else setSelectedIndices(new Set());
  };

  // Convertimos las acciones seleccionadas al formato que espera el reporte DANE
  const previewRows = useMemo(() => {
    return detectedActions
      .filter((_, i) => selectedIndices.has(i))
      .filter(a => a.entity === 'trd_records' || a.entity === 'valoracion')
      .map(a => ({
        id: a.id || Math.random().toString(),
        dependencia: a.payload.dependenciaNombre || "Oficina Detectada",
        codigo: a.payload.codigo || "",
        serie: a.payload.serieNombre || a.payload.serie || "",
        subserie: a.payload.subserieNombre || a.payload.subserie || "",
        tipoDocumental: a.payload.tipoDocumental || "",
        retencionGestion: a.payload.retencionGestion || 0,
        retencionCentral: a.payload.retencionCentral || 0,
        disposicion: a.payload.disposicion || "CT",
        procedimiento: a.payload.procedimiento || ""
      }));
  }, [detectedActions, selectedIndices]);

  const handleExportPDF = async () => {
    // Apuntamos directamente al ID interno del papel que ahora está dentro de TRDGenerator
    const element = document.getElementById('trd-final-report-area');
    if (!element) return alert("No se pudo capturar el reporte oficial.");

    const originalStyle = element.style.cssText;

    try {
      // 1. Preparar para alta resolución
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
      element.style.overflow = 'visible';
      element.style.borderColor = '#cbd5e1';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200
      });

      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Previsualizacion_TRD_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF visual:", error);
      element.style.cssText = originalStyle;
      alert("Error al procesar el reporte dinámico. Intenta cerrar y volver a abrir la previsualización.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 pb-32">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Importación Inteligente TRD</h1>
          <p className="text-slate-500 max-w-2xl">
            Sube tus archivos escaneados. Orianna IA extraerá la estructura y poblará el sistema, guardando además una copia en la 
            <span className="font-bold text-primary ml-1 underline decoration-primary/20">Biblioteca RAG</span>.
          </p>
        </div>
        {status === 'reviewing' && (
          <button 
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-900 text-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <Eye className="h-4 w-4" />
            Previsualizar Reporte DANE
          </button>
        )}
      </section>

      <AnimatePresence mode="wait">
        {status === 'idle' || status === 'analyzing' ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="px-2"
          >
            <div 
              {...getRootProps()} 
              className={`relative border-2 border-dashed rounded-3xl p-20 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-sm
                ${isDragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-slate-200 bg-white hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5'}`}
            >
              <input {...getInputProps()} />
              <div className="p-5 bg-primary/10 rounded-2xl mb-6 text-primary">
                {status === 'analyzing' ? <Loader2 className="h-12 w-12 animate-spin" /> : <FileUp className="h-12 w-12" />}
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                {file ? file.name : "Selecciona tu TRD"}
              </h3>
              <p className="text-slate-400 font-medium mb-8">Formatos admitidos: PDF, PNG, JPG (Detección OCR activada)</p>
              
              {!file && status === 'idle' && (
                <button className="px-8 py-3 bg-slate-950 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Explorar Archivos
                </button>
              )}
            </div>

            {file && status === 'idle' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center mt-8">
                <button 
                  onClick={handleStartAnalysis}
                  className="flex items-center gap-3 px-10 py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/30 hover:scale-105 hover:bg-primary/90 transition-all active:scale-95"
                >
                  <Scan className="h-6 w-6" />
                  ANALIZAR E INDEXAR EN RAG
                </button>
              </motion.div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-5 mt-8 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-medium">
                <AlertCircle className="h-6 w-6 shrink-0" />
                {error}
              </div>
            )}
          </motion.div>
        ) : status === 'reviewing' || status === 'committing' ? (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 px-2">
            
            {/* Health indicators */}
            <div className="flex flex-wrap gap-4">
               <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tighter">OCR: Alta Fidelidad</span>
               </div>
               <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tighter">Persistencia RAG: Lista</span>
               </div>
            </div>

            {/* Table Area */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-slate-900">Registros Identificados</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Valida la información antes de confirmar</p>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-xs font-bold text-slate-400">{selectedIndices.size} seleccionados de {detectedActions.length}</span>
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr className="border-b border-slate-100 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                      <th className="px-6 py-4 w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedIndices.size === detectedActions.length}
                          onChange={(e) => toggleAll(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </th>
                      <th className="px-6 py-4">Entidad</th>
                      <th className="px-6 py-4">Contenido</th>
                      <th className="px-6 py-4">Código</th>
                      <th className="px-6 py-4">Estado RAG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {detectedActions.map((action, idx) => {
                      const isSelected = selectedIndices.has(idx);
                      return (
                        <tr key={idx} className={`transition-colors hover:bg-slate-50/50 ${isSelected ? 'bg-primary/5' : ''}`}>
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelection(idx)}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              action.entity.includes('dependencias') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                              action.entity.includes('series') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                              'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                              {action.entity.replace('_records', '').replace('es', '')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{action.payload.nombre || "Registro TRD"}</span>
                              {action.payload.procedimiento && (
                                <span className="text-[10px] text-slate-400 truncate max-w-xs">{action.payload.procedimiento}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                            {action.payload.codigo || "—"}
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase">
                               <CheckCircle2 className="h-3 w-3" /> Indexado
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Floating Action Bar */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-40">
               <div className="bg-slate-900 rounded-3xl p-4 shadow-2xl flex items-center justify-between border border-white/10 ring-8 ring-slate-900/5 backdrop-blur-xl">
                  <div className="flex items-center gap-4 pl-4">
                    <div className="p-2 bg-white/10 rounded-xl">
                      <Database className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                       <p className="text-white font-black text-sm uppercase tracking-tight">Procesar Importación</p>
                       <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{selectedIndices.size} registros seleccionados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStatus('idle')} className="px-6 py-2 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors">
                      Cancelar
                    </button>
                    <button 
                      onClick={handleCommit}
                      className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      {status === 'committing' ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirmar e Importar'}
                    </button>
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-slate-200 text-center shadow-xl">
            <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-emerald-500/30">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tighter">¡Dato y Documento Sincronizados!</h2>
            <p className="text-slate-500 font-medium mb-10 max-w-sm">
              La TRD se ha estructurado en tus tablas y el archivo fuente ya está disponible en la Biblioteca RAG para Orianna.
            </p>
            <button 
              onClick={() => setStatus('idle')}
              className="flex items-center gap-3 px-10 py-4 bg-slate-950 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl"
            >
              Cargar otra TRD
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DANE PREVIEW MODAL */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setIsPreviewOpen(false)}
               className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-6xl h-full bg-slate-100 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
               {/* Modal Header */}
               <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between print:hidden">
                 <div className="flex items-center gap-3">
                   <FileText className="h-6 w-6 text-rose-600" />
                   <div>
                     <h2 className="font-black text-slate-900 uppercase text-xs tracking-tighter">Previsualización Dinámica DANE</h2>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{previewRows.length} registros seleccionados</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <button 
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                   >
                     <Printer className="h-4 w-4" />
                     DESCARGAR REPORTE DANE (PDF)
                   </button>
                   <button 
                    onClick={() => setIsPreviewOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                   >
                     <X className="h-6 w-6" />
                   </button>
                 </div>
               </div>

               {/* Modal Content - Here we inject the TRDReportDANE with the SELECTED records only */}
               <div className="flex-1 overflow-y-auto p-4 md:p-8">
                 <div id="trd-report-print-area" className="mx-auto bg-slate-100 rounded-xl overflow-hidden shadow-inner">
                    <TRDReportDANE rows={previewRows} currentUser={currentUser} />
                 </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TRDImportView;
