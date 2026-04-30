import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileUp, Scan, Database, CheckCircle2, AlertCircle, Loader2, Trash2, 
  ArrowRight, Eye, X, FileText, Image as ImageIcon, Download, 
  BrainCircuit, Building2, Pencil, Save, History, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
import API_BASE_URL from '../../config/api';
import ViewHeader from '../ui/ViewHeader';
import TRDExportPreview from '../trd/TRDGenerator';
import { handleExportPDFGeneral } from '../../utils/exportUtils';

const STATUS_CONFIG = {
  uploading: { label: 'Preparando...', color: 'bg-primary/10 text-primary', icon: Loader2, animate: true },
  analyzing: { label: 'Extrayendo Datos...', color: 'bg-primary/10 text-primary', icon: BrainCircuit, animate: true },
  reviewing: { label: 'Pendiente de Revisión', color: 'bg-amber-50 text-amber-600', icon: Scan, animate: false },
  success: { label: 'Integrado', color: 'bg-emerald-500 text-white shadow-emerald-200/50', icon: CheckCircle2, animate: false },
  error: { label: 'Error', color: 'bg-rose-50 text-rose-600', icon: AlertCircle, animate: false },
};

const TRDImportView = ({ onImportComplete, currentUser, currentEntity, logoBase64, imports = [], setImports, addActivityLog }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingNew, setIsProcessingNew] = useState(false);
  
  // Review System State
  const [previewImportId, setPreviewImportId] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [reviewMode, setReviewMode] = useState('data'); // 'data' | 'split'
  const [localActions, setLocalActions] = useState([]); // This is the editable version of imp.actions
  const [editingIndex, setEditingIndex] = useState(null);

  // Initial load
  useEffect(() => {
    fetchImports();
  }, [currentUser, currentEntity]);

  // Polling for analyzing tasks
  useEffect(() => {
    const hasActiveTasks = imports.some(imp => ['analyzing', 'uploading', 'processing'].includes(imp.status));
    if (!hasActiveTasks) return;
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchImports();
      }
    }, 10000); // Cada 10 segundos
    
    return () => clearInterval(interval);
  }, [imports]);

  const fetchImports = async () => {
    if (!currentUser?.token) {
      setIsLoading(false);
      return;
    }
    try {
      const entId = currentEntity?.id || '';
      const res = await fetch(`${API_BASE_URL}/rag-documents${entId ? `?entidad_id=${entId}` : ''}`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setImports(prev => {
          // Filtrar temporales que ya tienen una versión real en 'data' (por nombre de archivo)
          const dataFiles = new Set(data.map(d => d.filename || d.metadata?.source));
          const uploading = prev.filter(p => p.isUploading && !dataFiles.has(p.filename));
          
          const merged = [...uploading];
          for (const d of data) {
             const statusValue = d.status || d.metadata?.status;
             const mappedStatus = statusValue === 'success' ? 'success' : 
                                  statusValue === 'reviewing' ? 'reviewing' :
                                  statusValue === 'processing' ? 'analyzing' : 
                                  statusValue === 'uploading' ? 'uploading' :
                                  statusValue === 'error' ? 'error' : 'analyzing';

             const mappedImport = {
                id: d.id,
                filename: d.filename || d.metadata?.source || 'Documento sin nombre',
                status: mappedStatus,
                actions: d.metadata?.actions || [],
                ai_message: d.metadata?.message || null,
                ocr_engaged: true,
                isUploading: false,
                rawFile: null
             };

            const idx = merged.findIndex(m => m.id === d.id);
            if (idx >= 0) {
               merged[idx] = mappedImport;
            } else {
               merged.push(mappedImport);
            }
          }
          return merged;
        });
      }
    } catch (error) {
      console.error("Error fetching imports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const processFile = async (file) => {
    const tempId = "temp_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const newImp = {
       id: tempId,
       filename: file.name,
       status: 'analyzing',
       actions: [],
       isUploading: true,
       rawFile: file
    };
    
    setImports(prev => [newImp, ...prev]);

    const formData = new FormData();
    formData.append('file', file);
    if (currentEntity?.id) formData.append('entidad_id', currentEntity.id);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-trd`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${currentUser?.token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Error de lectura/procesamiento');
      await fetchImports();
    } catch (err) {
      setImports(prev => prev.map(imp => imp.id === tempId ? { ...imp, status: 'error', error: err.message, isUploading: false } : imp));
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      await processFile(file);
    }
  }, [imports]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: true,
    noClick: true  // Desactiva el click en el div para que solo el botón lo dispare
  });

  const handleDeleteImport = async (id, e) => {
    if (e) e.stopPropagation();
    const imp = imports.find(i => i.id === id);
    if (!imp) return;
    
    const isProcessing = ['uploading', 'analyzing', 'reviewing'].includes(imp.status);
    const msg = isProcessing 
      ? "¿Estás seguro de cancelar este proceso activo?" 
      : "¿Eliminar este registro del historial?";
      
    if (!window.confirm(msg)) return;

    setImports(prev => prev.filter(item => item.id !== id));
    try {
      await fetch(`${API_BASE_URL}/rag-documents/${id}`, { 
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${currentUser?.token}` }
      });
    } catch (err) {
      console.error("Error deleting import:", err);
    }
  };

  const handleClearHistory = async () => {
    const historyItems = imports.filter(i => i.status === 'success');
    if (historyItems.length === 0) return;
    
    if (!window.confirm(`¿Deseas limpiar todos los registros integrados (${historyItems.length})?`)) return;

    setImports(prev => prev.filter(i => i.status !== 'success'));
    try {
      await Promise.all(historyItems.map(item => 
        fetch(`${API_BASE_URL}/rag-documents/${item.id}`, { 
          method: 'DELETE',
          headers: { "Authorization": `Bearer ${currentUser?.token}` }
        })
      ));
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  };

  const openReview = (imp) => {
    setPreviewImportId(imp.id);
    // Filtro flexible: algunas versiones del prompt podrían usar TRD, trd o trd_records
    const relevantActions = (imp.actions || []).filter(a => 
      ['trd_records', 'TRD', 'trd', 'VALORACION', 'valoracion'].includes(a.entity)
    );
    setLocalActions([...relevantActions]);
    setSelectedIndices(new Set(relevantActions.map((_, i) => i)));
    setEditingIndex(null);
  };

  const toggleSelection = (index) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const currentPreviewImport = useMemo(() => imports.find(i => i.id === previewImportId), [imports, previewImportId]);

  const handleEditAction = (index, field, value) => {
    setLocalActions(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        payload: {
          ...next[index].payload,
          [field]: value
        }
      };
      return next;
    });
  };

  const handleCommit = async () => {
    if (!currentPreviewImport) return;
    
    // Preparar las acciones finales (solo las seleccionadas y editadas)
    const finalActionsToRun = localActions.filter((_, i) => selectedIndices.has(i));

    if (finalActionsToRun.length === 0) {
      alert("Debes seleccionar al menos un registro para integrar.");
      return;
    }

    try {
      setIsProcessingNew(true);
      
      // Update local state immediately for responsiveness
      setImports(prev => prev.map(imp => imp.id === currentPreviewImport.id ? { ...imp, status: 'success' } : imp));

      // 1. Ejecutar acciones en App state / Database
      if (onImportComplete) {
        await onImportComplete(finalActionsToRun);
      }

      // 2. Marcar sesión como exitosa
      const resStatus = await fetch(`${API_BASE_URL}/rag-documents/${currentPreviewImport.id}`, {
         method: 'PUT',
         headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${currentUser?.token}`
         },
         body: JSON.stringify({ status: 'success' })
      });

      if (!resStatus.ok) {
        const errorData = await resStatus.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error del servidor: ${resStatus.status}`);
      }

      if (addActivityLog) addActivityLog(`Importación TRD Exitosa: ${currentPreviewImport.filename}`);
      
      setPreviewImportId(null);
      // No forzamos un fetch inmediato pesado para evitar mostrar estados de RAG
      // Simplemente dejamos que el estado local se mantenga en 'success'
    } catch (err) {
      console.error("Error al integrar:", err);
      const detail = err.message || "Error desconocido";
      alert(`Hubo un error al guardar los datos estructurados.\nDetalle técnico: ${detail}`);
    } finally {
      setIsProcessingNew(false);
    }
  };

  const handleExportPDF = () => {
    handleExportPDFGeneral('trd-final-report-area', `PREVIEW_TRD_${currentPreviewImport?.filename || 'IMPORT'}`, 'landscape');
  };

  const exportRows = useMemo(() => {
    return localActions
      .filter((_, i) => selectedIndices.has(i))
      .map(a => ({
        id: a.id || Math.random().toString(),
        dependencia: a.payload.dependenciaNombre || "Oficina",
        codigo: a.payload.codigo || "",
        serie: a.payload.serieNombre || "",
        subserie: a.payload.subserieNombre || "",
        tipoDocumental: a.payload.tipoDocumental || "",
        retencionGestion: a.payload.retencionGestion || 0,
        retencionCentral: a.payload.retencionCentral || 0,
        disposicion: a.payload.disposicion || "CT",
        reproduccion: a.payload.reproduccion || (a.payload.disposicion === 'MT' ? 'Digitalización' : 'Ninguna'),
        soporte: a.payload.soporte || (a.payload.disposicion === 'MT' ? 'electronico' : 'fisico'),
        procedimiento: a.payload.procedimiento || ""
      }));
  }, [localActions, selectedIndices]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader
        icon={BrainCircuit}
        title="Importación TRD"
        subtitle="Conversión de documentos a estructuras oficiales"
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          
          {/* Column 1: Injection & Rules (3 cols) */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
            <div
              {...getRootProps()}
              className={cn(
                "relative group cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 p-8 flex flex-col items-center justify-center gap-4 text-center bg-card shadow-sm hover:border-primary/40",
                isDragActive ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform border-4 border-background">
                <FileUp className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[13px] font-bold text-foreground uppercase tracking-tight">Inyectar Tablas</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">PDF · PNG · JPG</p>
              </div>
              <input {...getInputProps()} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); open(); }}
                className="px-6 py-2 bg-foreground text-background text-[10px] font-bold rounded-md hover:bg-primary transition-all uppercase tracking-widest"
              >
                Seleccionar archivo
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl p-6 text-white relative overflow-hidden group shadow-md shrink-0">
                <h4 className="text-[9px] font-bold text-primary tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                   <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                   Guía de Proceso
                </h4>
                <div className="space-y-4">
                    {[
                      { t: 'Visión Neuronal', d: 'Detección de jerarquías.' },
                      { t: 'Limpieza IA', d: 'Normalización de datos.' },
                      { t: 'Integración', d: 'Aprobación final.' }
                    ].map((step, i) => (
                      <div key={i} className="flex gap-3 items-start relative">
                        <div className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[9px] font-bold text-primary">
                          {i+1}
                        </div>
                        <div className="space-y-0.5">
                           <div className="text-[10px] font-bold uppercase text-white">{step.t}</div>
                           <div className="text-[9px] text-slate-400 font-medium">{step.d}</div>
                        </div>
                      </div>
                    ))}
                </div>
            </div>
          </div>

          {/* Column 2: Active Tasks (4 cols) */}
          <div className="lg:col-span-8 xl:col-span-4 flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                     <History className="h-3 w-3 text-primary" />
                     Tareas en Curso ({imports.filter(i => i.status !== 'success').length})
                  </div>
              </div>

              <div className="space-y-3 min-h-[200px]">
                  <AnimatePresence mode="popLayout">
                      {imports.filter(i => i.status !== 'success').length === 0 ? (
                          <motion.div className="h-32 border border-border border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2 bg-secondary/10">
                              <Database className="h-6 w-6 opacity-20" />
                              <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">No hay tareas activas</span>
                          </motion.div>
                      ) : (
                          imports.filter(i => i.status !== 'success').map((imp) => {
                              const config = STATUS_CONFIG[imp.status] || STATUS_CONFIG.analyzing;
                              return (
                                  <motion.div
                                      key={imp.id}
                                      layout
                                      className="bg-card border border-border shadow-sm rounded-lg p-3.5 hover:shadow-md transition-all flex items-center justify-between gap-4 relative group"
                                  >
                                      <div className="flex items-center gap-3 min-w-0">
                                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", config.color)}>
                                              <config.icon className={cn("h-4 w-4", config.animate && "animate-spin")} />
                                          </div>
                                          <div className="flex flex-col gap-0.5 min-w-0">
                                              <span className="text-[12px] font-bold text-foreground truncate uppercase tracking-tight">{imp.filename}</span>
                                              <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider w-fit", config.color)}>
                                                  {config.label}
                                              </span>
                                          </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                          {imp.status === 'reviewing' && (
                                              <button 
                                                  onClick={() => openReview(imp)}
                                                  className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-[9px] font-bold tracking-wider transition-all uppercase flex items-center gap-1.5 shadow-sm"
                                              >
                                                  Verificar
                                                  <ArrowRight className="h-3 w-3" />
                                              </button>
                                          )}
                                          <button 
                                              onClick={(e) => handleDeleteImport(imp.id, e)} 
                                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                                          >
                                              <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                      </div>
                                  </motion.div>
                              );
                          })
                      )}
                  </AnimatePresence>
              </div>
          </div>

          {/* Column 3: History (5 cols) */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                     <ClipboardCheck className="h-3.5 w-3.5" />
                     Historial de Integración ({imports.filter(i => i.status === 'success').length})
                  </div>
                  {imports.filter(i => i.status === 'success').length > 0 && (
                    <button 
                      onClick={handleClearHistory}
                      className="text-[9px] font-bold text-muted-foreground hover:text-destructive uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Limpiar Historial
                    </button>
                  )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5 min-h-[200px]">
                  <AnimatePresence mode="popLayout">
                    {imports.filter(i => i.status === 'success').length === 0 ? (
                        <div className="sm:col-span-2 xl:col-span-1 h-32 border border-border border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2 bg-emerald-50/10">
                            <CheckCircle2 className="h-6 w-6 opacity-20 text-emerald-600" />
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Sin registros integrados</span>
                        </div>
                    ) : (
                        imports.filter(i => i.status === 'success').map(imp => (
                            <motion.div 
                              key={imp.id} 
                              layout
                              className="flex items-center justify-between p-3 bg-emerald-50/40 border border-emerald-100/50 rounded-lg group hover:shadow-sm transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[11.5px] font-bold text-slate-700 uppercase tracking-tight truncate">{imp.filename}</span>
                                        <span className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest">Integrado con éxito</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleDeleteImport(imp.id, e)}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-rose-50"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </motion.div>
                        ))
                    )}
                  </AnimatePresence>
              </div>
          </div>

        </div>
      </div>

      {/* Review & Edit Modal (The big restoration) */}
      <AnimatePresence>
        {previewImportId && currentPreviewImport && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col bg-slate-100"
          >
              {/* Review Header */}
              <div className="h-28 bg-white border-b border-slate-100 px-12 flex items-center justify-between shrink-0 shadow-2xl shadow-primary/[0.03] relative z-50">
                  <div className="flex items-center gap-8">
                      <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 border-4 border-white">
                          <Scan className="h-8 w-8" />
                      </div>
                      <div className="flex flex-col">
                          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Verificación <span className="text-primary">Neural</span></h2>
                          <div className="flex items-center gap-3 mt-2">
                             <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{currentPreviewImport.filename}</span>
                          </div>
                      </div>
                  </div>

                  <div className="flex items-center gap-8">
                      {/* Mode Toggles */}
                      <div className="flex bg-slate-50 rounded-2xl p-1.5 border border-slate-100 shadow-inner">
                          {[
                            { id: 'data', label: 'Editor Neural', icon: Database },
                            { id: 'split', label: 'Proyección Final', icon: ImageIcon }
                          ].map(btn => (
                            <button 
                              key={btn.id}
                              onClick={() => setReviewMode(btn.id)}
                              className={cn(
                                "flex items-center gap-4 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                reviewMode === btn.id ? "bg-white text-primary shadow-xl border border-primary/5" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              <btn.icon className="h-4 w-4" />
                              {btn.label}
                            </button>
                          ))}
                      </div>

                      <div className="h-10 w-px bg-slate-100" />

                      <button onClick={() => setPreviewImportId(null)} className="h-14 w-14 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all active:scale-90 shadow-sm hover:shadow-xl">
                          <X className="h-6 w-6" />
                      </button>
                  </div>
              </div>

              {/* Review Content */}
              <div className="flex-1 overflow-hidden flex">
                  {/* Previsualización (Split mode) */}
                  <AnimatePresence>
                    {reviewMode === 'split' && (
                      <motion.div 
                        initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }}
                        className="flex-1 flex flex-col items-center p-12 overflow-y-auto bg-slate-200"
                      >
                         <div className="transform scale-110 shadow-2xl">
                            <TRDExportPreview rows={exportRows} currentUser={currentUser} currentEntity={currentEntity} logoBase64={logoBase64} />
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Main Editor Table */}
                  <div className="flex-1 overflow-y-auto bg-slate-50 relative">
                     <div className={cn("p-8 transition-all h-full", editingIndex !== null ? "blur-sm grayscale bg-white/50" : "")}>
                        <div className="w-full flex flex-col h-full">
                           <div className="flex items-center justify-between mb-10">
                               <div className="space-y-1">
                                  <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] flex items-center gap-3">
                                     <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                                     Motor Vision Output
                                  </h3>
                                  <div className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Validación de Registros Estructurados</div>
                               </div>
                               
                               <div className="flex items-center gap-4">
                                  <div className="px-8 py-4 bg-white rounded-[1.5rem] border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-2xl shadow-primary/[0.02]">
                                     Indexados: <span className="text-primary font-black ml-2">{localActions.length}</span>
                                  </div>
                               </div>
                           </div>

                           <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden flex-1 flex flex-col">
                              <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse min-w-[1200px]">
                                   <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                                      <tr className="border-b border-slate-100">
                                         <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobar</th>
                                         <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Oficina / Dependencia</th>
                                         <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                                         <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serie / Subserie</th>
                                         <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">AG / AC</th>
                                         <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Disposición</th>
                                         <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100">
                                      {localActions.map((action, idx) => {
                                        const isSelected = selectedIndices.has(idx);
                                        const p = action.payload;
                                        return (
                                          <tr key={idx} className={cn("group transition-all", isSelected ? "bg-primary/5" : "hover:bg-slate-50")}>
                                              <td className="px-6 py-4">
                                                 <button 
                                                   onClick={() => toggleSelection(idx)}
                                                   className={cn("h-7 w-7 rounded-xl border-2 transition-all flex items-center justify-center shadow-sm", isSelected ? "bg-primary border-primary scale-110 rotate-3" : "bg-white border-slate-200 hover:border-primary/40")}
                                                 >
                                                    {isSelected && <CheckCircle2 className="h-5 w-5 text-white" />}
                                                 </button>
                                              </td>
                                              <td className="px-6 py-4">
                                                 <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-900 uppercase truncate max-w-[250px]">{p.dependenciaNombre}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 tracking-widest">DEPENDENCIA</span>
                                                 </div>
                                              </td>
                                              <td className="px-6 py-4">
                                                 <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{p.codigo || 'S/N'}</span>
                                              </td>
                                              <td className="px-6 py-4">
                                                 <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-700 uppercase line-clamp-1">{p.serieNombre}</span>
                                                    {p.subserieNombre && (
                                                      <span className="text-[10px] font-bold text-primary italic"> \ {p.subserieNombre}</span>
                                                    )}
                                                 </div>
                                              </td>
                                              <td className="px-6 py-4">
                                                 <div className="flex items-center justify-center gap-3">
                                                    <div className="flex flex-col items-center">
                                                       <span className="text-[11px] font-black">{p.retencionGestion}</span>
                                                       <span className="text-[8px] font-bold text-slate-300 uppercase">AG</span>
                                                    </div>
                                                    <div className="w-[1px] h-4 bg-slate-100" />
                                                    <div className="flex flex-col items-center">
                                                       <span className="text-[11px] font-black">{p.retencionCentral}</span>
                                                       <span className="text-[8px] font-bold text-slate-300 uppercase">AC</span>
                                                    </div>
                                                 </div>
                                              </td>
                                              <td className="px-6 py-4 text-center">
                                                 <span className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border", 
                                                    p.disposicion === 'CT' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                    p.disposicion === 'E' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                                    "bg-amber-50 text-amber-700 border-amber-100"
                                                 )}>
                                                    {p.disposicion}
                                                 </span>
                                              </td>
                                              <td className="px-6 py-4">
                                                 <button 
                                                   onClick={() => setEditingIndex(idx)}
                                                   className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm group-hover:scale-105"
                                                 >
                                                    <Pencil className="h-3 w-3" />
                                                    Corregir
                                                 </button>
                                              </td>
                                          </tr>
                                        );
                                      })}
                                   </tbody>
                                </table>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Inline Sidebar Editor Panel */}
                     <AnimatePresence>
                        {editingIndex !== null && (
                          <>
                            <motion.div 
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              onClick={() => setEditingIndex(null)}
                              className="absolute inset-0 bg-slate-900/10 z-[60]"
                            />
                            <motion.div 
                              initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
                              className="absolute top-0 right-0 bottom-0 w-[450px] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[70] p-10 flex flex-col gap-8"
                            >
                                <div className="flex items-center justify-between">
                                   <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                       <Pencil className="h-6 w-6" />
                                   </div>
                                   <button onClick={() => setEditingIndex(null)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-slate-900 transition-colors">
                                      <X className="h-6 w-6" />
                                   </button>
                                </div>

                                <div className="space-y-1">
                                   <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Corregir Registro</h4>
                                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Modifica los detalles manuales extraídos por el OCR</p>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-4 space-y-6">
                                   <div className="space-y-4">
                                      <div className="grid grid-cols-1 gap-4">
                                          <div className="space-y-2">
                                              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Dependencia</label>
                                              <input 
                                                value={localActions[editingIndex].payload.dependenciaNombre}
                                                onChange={(e) => handleEditAction(editingIndex, 'dependenciaNombre', e.target.value)}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all uppercase"
                                              />
                                          </div>
                                          <div className="space-y-2">
                                              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Código de la Serie</label>
                                              <input 
                                                value={localActions[editingIndex].payload.codigo}
                                                onChange={(e) => handleEditAction(editingIndex, 'codigo', e.target.value)}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                              />
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                              <div className="space-y-2">
                                                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Retención Gestión (AG)</label>
                                                  <input 
                                                    type="number"
                                                    value={localActions[editingIndex].payload.retencionGestion}
                                                    onChange={(e) => handleEditAction(editingIndex, 'retencionGestion', parseInt(e.target.value))}
                                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none transition-all"
                                                  />
                                              </div>
                                              <div className="space-y-2">
                                                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Retención Central (AC)</label>
                                                  <input 
                                                    type="number"
                                                    value={localActions[editingIndex].payload.retencionCentral}
                                                    onChange={(e) => handleEditAction(editingIndex, 'retencionCentral', parseInt(e.target.value))}
                                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none transition-all"
                                                  />
                                              </div>
                                          </div>
                                          <div className="space-y-2">
                                              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Disposicion Final</label>
                                              <select 
                                                value={localActions[editingIndex].payload.disposicion}
                                                onChange={(e) => handleEditAction(editingIndex, 'disposicion', e.target.value)}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none transition-all"
                                              >
                                                <option value="CT">Conservación Total (CT)</option>
                                                <option value="E">Eliminación (E)</option>
                                                <option value="S">Selección (S)</option>
                                                <option value="MT">Medio Técnico (MT)</option>
                                              </select>
                                          </div>
                                          <div className="space-y-2">
                                              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Procedimiento Archivístico</label>
                                              <textarea 
                                                rows="4" 
                                                value={localActions[editingIndex].payload.procedimiento}
                                                onChange={(e) => handleEditAction(editingIndex, 'procedimiento', e.target.value)}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none transition-all leading-relaxed"
                                              />
                                          </div>
                                      </div>
                                   </div>
                                </div>

                                <button 
                                  onClick={() => setEditingIndex(null)}
                                  className="w-full py-5 bg-primary text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                                >
                                   <Save className="h-4 w-4" />
                                   Guardar Cambios
                                </button>
                            </motion.div>
                          </>
                        )}
                     </AnimatePresence>
                  </div>
              </div>

              {/* Review Footer */}
              <div className="h-24 bg-white border-t border-slate-200 px-12 flex items-center justify-between shrink-0 shadow-xl relative z-[100]">
                  <div className="flex gap-10">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Aprobados para Integrar</span>
                        <span className="text-2xl font-black text-slate-900 leading-none">{selectedIndices.size} <span className="text-xs text-slate-300 font-bold">/ {localActions.length}</span></span>
                     </div>
                     <div className="w-[1px] h-8 bg-slate-100 my-auto" />
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-1.5">Entidad Destino</span>
                        <span className="text-sm font-black text-slate-900 leading-none">{currentEntity?.razonSocial || 'Oficina OSE'}</span>
                     </div>
                  </div>

                  <div className="flex items-center gap-4">
                      {reviewMode === 'split' && (
                         <button onClick={handleExportPDF} className="flex items-center gap-2 px-8 py-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                            <Download className="h-4 w-4" />
                            Vista DANE
                         </button>
                      )}
                      <button 
                        disabled={isProcessingNew}
                        onClick={handleCommit}
                        className={cn(
                          "flex items-center gap-5 px-14 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-primary/20",
                          isProcessingNew ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-primary text-white hover:bg-slate-900 hover:shadow-primary/30 active:scale-95"
                        )}
                      >
                         {isProcessingNew ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                         Integrar a Datos Oficiales
                      </button>
                  </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TRDImportView;
