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
import TRDExportPreview from '../trd/TRDGenerator';
import { handleExportPDFGeneral } from '../../utils/exportUtils';

const STATUS_CONFIG = {
  uploading: { label: 'Subiendo...', color: 'bg-blue-500', icon: Loader2, animate: true },
  analyzing: { label: 'Extrayendo TRD y Enriqueciendo IA...', color: 'bg-indigo-500', icon: BrainCircuit, animate: true },
  reviewing: { label: 'Esperando Aprobación', color: 'bg-amber-500', icon: Scan, animate: false },
  success: { label: 'Completado', color: 'bg-emerald-500', icon: CheckCircle2, animate: false },
  error: { label: 'Error de Análisis', color: 'bg-rose-500', icon: AlertCircle, animate: false },
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
      fetchImports();
    }, 4000);
    
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: true
  });

  const handleDeleteImport = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Descartar importación?")) return;
    setImports(prev => prev.filter(imp => imp.id !== id));
    try {
      await fetch(`${API_BASE_URL}/rag-documents/${id}`, { 
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${currentUser?.token}` }
      });
    } catch {}
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
      
      // 1. Ejecutar acciones en App state / Database
      if (onImportComplete) {
        await onImportComplete(finalActionsToRun);
      }

      // 2. Marcar sesión como exitosa
      await fetch(`${API_BASE_URL}/rag-documents/${currentPreviewImport.id}`, {
         method: 'PUT',
         headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${currentUser?.token}`
         },
         body: JSON.stringify({ status: 'success' })
      });

      if (addActivityLog) addActivityLog(`Importación TRD Exitosa: ${currentPreviewImport.filename}`);
      
      setPreviewImportId(null);
      fetchImports();
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
    <div className="w-full h-full flex flex-col gap-8 p-2 md:p-4 pb-32">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-[0.2em] text-[10px]">
             <BrainCircuit className="h-4 w-4" />
             AI Vision Importer v2.0
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase italic">
            Importación <span className="text-indigo-600">Archivística</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Upload Zone */}
        <div className="lg:col-span-4 space-y-6">
            <div
                {...getRootProps()}
                className={cn(
                    "relative group cursor-pointer overflow-hidden rounded-[2.5rem] border-2 border-dashed transition-all duration-500 p-10 flex flex-col items-center justify-center gap-6 text-center bg-white shadow-sm",
                    isDragActive ? "border-indigo-500 bg-indigo-50/50 scale-[0.98]" : "border-slate-200 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10"
                )}
            >
                 <div className="h-20 w-20 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <FileUp className="h-10 w-10 text-white" />
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900">Subir Tablas TRD</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">PDF o Imagen Escaneada</p>
                 </div>
                 <button className="px-8 py-3 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-200 uppercase tracking-widest">
                    Seleccionar Archivo
                 </button>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden group">
                <Scan className="absolute -bottom-8 -right-8 h-40 w-40 text-white/5 opacity-20 pointer-events-none" />
                <h4 className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase mb-6 flex items-center gap-2">
                   <div className="h-1 w-1 rounded-full bg-indigo-400" />
                   Guía de Proceso
                </h4>
                <div className="space-y-6">
                    {[
                      { t: 'Visión IA', d: 'El motor detecta tablas sin importar si están escaneadas o digitalizadas.' },
                      { t: 'Revisión Humana', d: 'Tú eres el validador final. Corrige cualquier dato antes de aprobar.' },
                      { t: 'Integración', d: 'Los datos aprobados se convierten automáticamente en tu catálogo oficial.' }
                    ].map((step, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold border border-white/10">{i+1}</div>
                        <div className="space-y-0.5">
                           <div className="text-[11px] font-black uppercase text-white">{step.t}</div>
                           <div className="text-[10px] text-slate-400 leading-normal">{step.d}</div>
                        </div>
                      </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Right: History & List */}
        <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <History className="h-3.5 w-3.5" />
                   Sesiones de Importación
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                    {imports.length === 0 ? (
                        <motion.div className="col-span-full h-80 border-2 border-slate-100 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-slate-300 gap-3">
                            <Database className="h-12 w-12 opacity-30" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Sin actividad reciente</span>
                        </motion.div>
                    ) : (
                        imports.filter(i => i.status !== 'success').map((imp) => {
                            const config = STATUS_CONFIG[imp.status] || STATUS_CONFIG.analyzing;
                            return (
                                <motion.div
                                    key={imp.id}
                                    layout
                                    className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-6 hover:shadow-xl hover:shadow-slate-200/40 transition-all flex flex-col gap-5 relative group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg", config.color)}>
                                                <config.icon className={cn("h-6 w-6", config.animate && "animate-pulse")} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900 line-clamp-1">{imp.filename}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{config.label}</span>
                                            </div>
                                        </div>
                                        <button onClick={(e) => handleDeleteImport(imp.id, e)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {imp.status === 'reviewing' && (
                                        <button 
                                            onClick={() => openReview(imp)}
                                            className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black tracking-[0.2em] transition-all uppercase flex items-center justify-center gap-2"
                                        >
                                            Verificar Extracción
                                            <ArrowRight className="h-4 w-4" />
                                        </button>
                                    )}

                                    {imp.status === 'success' && (
                                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 py-2.5 px-4 rounded-xl border border-emerald-100">
                                            <ClipboardCheck className="h-4 w-4" />
                                            Importado con Éxito
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
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
              <div className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm relative z-50">
                  <div className="flex items-center gap-5">
                      <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                          <Scan className="h-6 w-6" />
                      </div>
                      <div className="flex flex-col">
                          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Verificación de Visión TRD</h2>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{currentPreviewImport.filename}</span>
                      </div>
                  </div>

                  <div className="flex items-center gap-4">
                      {/* Mode Toggles */}
                      <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                          {[
                            { id: 'data', label: 'Editor de Datos', icon: Database },
                            { id: 'split', label: 'Previsualizar PDF', icon: ImageIcon }
                          ].map(btn => (
                            <button 
                              key={btn.id}
                              onClick={() => setReviewMode(btn.id)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                reviewMode === btn.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              <btn.icon className="h-3.5 w-3.5" />
                              {btn.label}
                            </button>
                          ))}
                      </div>

                      <div className="h-8 w-[1px] bg-slate-200 mx-2" />

                      <button onClick={() => setPreviewImportId(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-slate-900 transition-colors">
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
                        <div className="max-w-7xl mx-auto flex flex-col h-full">
                           <div className="flex items-center justify-between mb-8">
                               <div className="space-y-1">
                                  <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                     <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                                     Resultados del Motor IA
                                  </h3>
                                  <div className="text-sm font-black text-slate-900 uppercase">Revisa y ajusta los campos detectados</div>
                               </div>
                               
                               <div className="flex items-center gap-3">
                                  <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                                     Total: {localActions.length} registros
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
                                          <tr key={idx} className={cn("group transition-all", isSelected ? "bg-indigo-50/20" : "hover:bg-slate-50")}>
                                              <td className="px-6 py-4">
                                                 <button 
                                                   onClick={() => toggleSelection(idx)}
                                                   className={cn("h-6 w-6 rounded-lg border-2 transition-all flex items-center justify-center", isSelected ? "bg-indigo-600 border-indigo-600 scale-110" : "bg-white border-slate-200 hover:border-indigo-400")}
                                                 >
                                                    {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
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
                                                      <span className="text-[10px] font-bold text-indigo-500 italic"> \ {p.subserieNombre}</span>
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
                                                   className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
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
                                   <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner">
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
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all uppercase"
                                              />
                                          </div>
                                          <div className="space-y-2">
                                              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Código de la Serie</label>
                                              <input 
                                                value={localActions[editingIndex].payload.codigo}
                                                onChange={(e) => handleEditAction(editingIndex, 'codigo', e.target.value)}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
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
                                  className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                                >
                                   <Save className="h-4 w-4" />
                                   Guardar Corrección
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
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Entidad Destino</span>
                        <span className="text-sm font-black text-indigo-900 leading-none">{currentEntity?.razonSocial || 'Oficina OSE'}</span>
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
                          "flex items-center gap-4 px-12 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-indigo-200",
                          isProcessingNew ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-slate-900 hover:shadow-indigo-500/20 active:scale-95"
                        )}
                      >
                         {isProcessingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
