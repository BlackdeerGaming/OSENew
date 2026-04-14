import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, Scan, Database, CheckCircle2, AlertCircle, Loader2, Trash2, ArrowRight, Eye, X, FileText, Image as ImageIcon, Download, BrainCircuit, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_BASE_URL from '../../config/api';
import TRDExportPreview from '../trd/TRDGenerator';
import { handleExportPDFGeneral } from '../../utils/exportUtils';

const TRDImportView = ({ onImportComplete, currentUser, currentEntity, logoBase64, imports = [], setImports, addActivityLog }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Para la previsualización modal
  const [previewImportId, setPreviewImportId] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState(new Set()); // Para el import actual revisado

  useEffect(() => {
    if (currentUser?.token) fetchImports();
    else setIsLoading(false);
  }, [currentUser?.token, currentEntity?.id]);

  // Polling for analyzing tasks
  useEffect(() => {
    const hasAnalyzing = imports.some(imp => imp.status === 'analyzing');
    if (!hasAnalyzing) return;
    
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
      const res = await fetch(`${API_BASE_URL}/imports${entId ? `?entidad_id=${entId}` : ''}`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setImports(prev => {
          // Mantener en frontend solo aquellos que aún se están subiendo localmente 
          // (no tienen reflejo backend todavía)
          const uploading = prev.filter(p => p.isUploading);
          
          // Agregamos los que vienen del backend o actualizamos
          const merged = [...uploading];
          for (const d of data) {
            const idx = merged.findIndex(m => m.id === d.id);
            if (idx >= 0) {
               merged[idx] = d;
            } else {
               merged.push(d);
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

  const [duplicateFile, setDuplicateFile] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const processFile = async (file) => {
    const tempId = "temp_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const newImp = {
       id: tempId,
       filename: file.name,
       status: 'analyzing',
       file_url: null,
       actions: [],
       error: null,
       ocr_engaged: false,
       isUploading: true,
       rawFile: file
    };
    
    setImports(prev => [newImp, ...prev]);

    const formData = new FormData();
    formData.append('file', file);
    if (currentEntity?.id) {
       formData.append('entidad_id', currentEntity.id);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-trd`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${currentUser?.token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Error de lectura/procesamiento');
      const data = await response.json();
      
      setImports(prev => prev.map(imp => {
         if (imp.id === tempId) {
            return {
               ...imp,
               id: data.import_id || imp.id,
               status: data.status || 'analyzing',
               isUploading: false
            };
         }
         return imp;
      }));
      fetchImports();
    } catch (err) {
      setImports(prev => prev.map(imp => imp.id === tempId ? { ...imp, status: 'error', error: err.message, isUploading: false } : imp));
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const isDuplicate = imports.find(imp => imp.filename === file.name);
      if (isDuplicate) {
        setDuplicateFile(file);
        setShowDuplicateModal(true);
        // We pause processing here for THIS file. 
        // In a real app we might want to continue with others, 
        // but the prompt implies a single blocking question.
        continue; 
      }
      await processFile(file);
    }
  }, [imports]);

  const handleReplaceDuplicate = async () => {
    if (!duplicateFile) return;
    
    // Find previous import and delete it
    const existing = imports.find(imp => imp.filename === duplicateFile.name);
    if (existing) {
      // Logic to delete existing:
      setImports(prev => prev.filter(imp => imp.filename !== duplicateFile.name));
      try {
        await fetch(`${API_BASE_URL}/imports/${existing.id}`, { 
          method: 'DELETE',
          headers: { "Authorization": `Bearer ${currentUser?.token}` }
        });
      } catch (e) {
        console.error("Error deleting old import:", e);
      }
    }

    const fileToProcess = duplicateFile;
    setDuplicateFile(null);
    setShowDuplicateModal(false);
    await processFile(fileToProcess);
  };

  const handleCancelDuplicate = () => {
    setDuplicateFile(null);
    setShowDuplicateModal(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: true
  });

  const handleDeleteImport = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de descartar y eliminar esta importación?")) return;
    
    setImports(prev => prev.filter(imp => imp.id !== id));
    // If it's a temp ID it won't exist in backend, otherwise delete explicitly
    try {
      await fetch(`${API_BASE_URL}/imports/${id}`, { 
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${currentUser?.token}` }
      });
    } catch {}
  };

  const openPreview = (imp) => {
    setPreviewImportId(imp.id);
    setSelectedIndices(new Set(imp.actions.map((_, i) => i))); // Default select all
  };

  const currentPreviewImport = useMemo(() => imports.find(i => i.id === previewImportId), [imports, previewImportId]);

  const toggleSelection = (index) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = (checked, total) => {
    if (checked) setSelectedIndices(new Set(Array.from({length: total}, (_, i) => i)));
    else setSelectedIndices(new Set());
  };

  const handleCommit = async () => {
    if (!currentPreviewImport) return;
    const actionsToRun = currentPreviewImport.actions.filter((_, i) => selectedIndices.has(i));
    if (actionsToRun.length === 0) return alert("Selecciona al menos un registro para importar.");

    try {
      // Modificar status temporalmente en UI
      setImports(prev => prev.map(imp => imp.id === currentPreviewImport.id ? { ...imp, status: 'success' } : imp));
      setPreviewImportId(null);
      
      // Llamar al action de TRDImportView (propuesta de App.jsx)
      if (onImportComplete) {
        await onImportComplete(actionsToRun);
      }

      // REGISTRO DE ACTIVIDAD: Importación Exitosa
      if (addActivityLog) {
        addActivityLog(`Importación TRD - ${currentPreviewImport.filename}`);
      }
      
      // Update en backend a que la sesión está finalizada
      await fetch(`${API_BASE_URL}/imports/${currentPreviewImport.id}`, {
         method: 'PUT',
         headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${currentUser?.token}`
         },
         body: JSON.stringify({ status: 'success' })
      });
      
      alert("¡Registros sincronizados con éxito a las tablas definitivas!");
    } catch (err) {
      alert("Hubo un problema sincronizando: " + err.message);
      setImports(prev => prev.map(imp => imp.id === currentPreviewImport.id ? { ...imp, status: 'reviewing' } : imp));
    }
  };

  // Convertimos las acciones seleccionadas al formato DANE
  const previewRows = useMemo(() => {
    if (!currentPreviewImport) return [];
    return currentPreviewImport.actions
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
  }, [currentPreviewImport, selectedIndices]);

  const handleExportPDF = () => {
    handleExportPDFGeneral('trd-final-report-area', `Reporte_TRD_${currentPreviewImport?.filename || 'Generado'}`);
  };

  const iaAvailable = currentUser?.iaDisponible ?? true;

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 pb-32 relative">
      {/* IA Restriction Overlay */}
      {!iaAvailable && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 text-center">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md rounded-3xl" />
           <div className="relative bg-white p-8 rounded-3xl shadow-2xl max-w-sm flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
             <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                <BrainCircuit className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-black text-slate-900 leading-tight">Módulo de Importación IA Restringido</h3>
             <p className="text-slate-500 text-sm font-medium">Si quieres este servicio, mejora tu plan o habla con tu administrador.</p>
           </div>
        </div>
      )}

      {/* MODAL DE DUPLICADOS */}
      <AnimatePresence>
        {showDuplicateModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-lg">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }} 
               animate={{ opacity: 1, scale: 1 }} 
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-8 text-center space-y-6"
            >
               <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <AlertCircle className="h-8 w-8" />
               </div>
               <div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">¿Deseas reemplazar este archivo?</h3>
                  <p className="text-sm text-slate-500 mt-2 font-medium">
                    El archivo <span className="font-bold text-slate-800">"{duplicateFile?.name}"</span> ya fue procesado o está en cola. 
                    Si aceptas, se eliminará la versión previa y se iniciará un nuevo análisis.
                  </p>
               </div>
               <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={handleReplaceDuplicate}
                    className="w-full bg-[#00bfa5] text-white py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-[#00bfa5]/20 hover:bg-[#00a693] transition-all active:scale-95 uppercase tracking-widest"
                  >
                    ACEPTAR Y REEMPLAZAR
                  </button>
                  <button 
                    onClick={handleCancelDuplicate}
                    className="w-full bg-slate-100 text-slate-400 py-3 rounded-2xl font-bold text-xs hover:bg-slate-200 hover:text-slate-600 transition-all"
                  >
                    CANCELAR
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header section */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Importación Inteligente Masiva</h1>
          <p className="text-slate-500 max-w-2xl">
            Sube múltiples archivos escaneados o digitales. Orianna IA extraerá la estructura de cada uno, 
            preservando tu progreso automáticamente y almacenándolos en la <span className="font-bold text-primary ml-1 underline decoration-primary/20">Biblioteca RAG</span>.
          </p>
        </div>
      </section>

      {/* Main Container - Dos Columnas (Dropzone y Lista) */}
      <div className="flex flex-col gap-8 px-2">
         {/* Zona de Carga Múltiple */}
         <div 
           {...getRootProps()} 
           className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-sm
             ${isDragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-slate-200 bg-white hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5'}`}
         >
           <input {...getInputProps()} />
           <div className="p-4 bg-primary/10 rounded-2xl mb-4 text-primary">
             <FileUp className="h-10 w-10" />
           </div>
           
           <h3 className="text-lg font-black text-slate-900 mb-1">
             Arrastra y suelta tus TRDs aquí
           </h3>
           <p className="text-slate-400 font-medium mb-4 text-sm">Escaneos, PDFs o Imágenes. Sube varias simultáneamente.</p>
           
           <button className="px-6 py-2.5 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg">
             Explorar Archivos
           </button>
         </div>

         {/* Lista de Importaciones */}
         <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest pl-2">Cola de Procesamiento & Sesiones</h3>
            
            {isLoading ? (
               <div className="p-10 flex justify-center items-center"><Loader2 className="animate-spin text-slate-300 w-10 h-10" /></div>
            ) : imports.length === 0 ? (
               <div className="text-center py-10 text-slate-400 text-sm italic border rounded-3xl border-dashed">No hay importaciones activas o completadas en este momento.</div>
            ) : (
               <AnimatePresence>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {imports.map((imp) => (
                     <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                        key={imp.id} 
                        onClick={() => imp.status === 'reviewing' && openPreview(imp)}
                        className={`p-5 rounded-3xl border transition-all ${
                           imp.status === 'analyzing' ? 'border-blue-200 bg-blue-50/50 cursor-wait' :
                           imp.status === 'reviewing' ? 'border-amber-200 bg-amber-50/20 shadow-lg hover:shadow-amber-200/50 cursor-pointer hover:-translate-y-1' :
                           imp.status === 'success' ? 'border-emerald-200 bg-emerald-50/30' :
                           'border-rose-200 bg-rose-50'
                        }`}
                     >
                        <div className="flex justify-between items-start mb-4">
                           <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100">
                              {imp.status === 'analyzing' ? <Loader2 className="animate-spin h-5 w-5 text-blue-500"/> :
                               imp.status === 'reviewing' ? <Eye className="h-5 w-5 text-amber-500" /> :
                               imp.status === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> :
                               <AlertCircle className="h-5 w-5 text-rose-500" />
                              }
                           </div>
                           <button onClick={(e) => handleDeleteImport(imp.id, e)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-colors">
                              <Trash2 className="h-4 w-4" />
                           </button>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm truncate" title={imp.filename}>{imp.filename}</h4>
                        
                        {/* Status Label */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                           <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md ${
                              imp.status === 'analyzing' ? 'bg-blue-100 text-blue-700' :
                              imp.status === 'reviewing' ? 'bg-amber-100/50 text-amber-700' :
                              imp.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-rose-100 text-rose-700'
                           }`}>
                              {imp.status === 'analyzing' ? 'Deduciendo Arquitectura' :
                               imp.status === 'reviewing' ? 'Esperando Aprobación' :
                               imp.status === 'success' ? 'Importación Finalizada' : 'Error en lectura'}
                           </span>
                           {imp.ocr_engaged && (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100">
                                 <ImageIcon className="h-3 w-3" /> OCR IA
                              </span>
                           )}
                           {currentUser?.role === 'superadmin' && imp.entidad_nombre && (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-black bg-slate-900 text-white px-2 py-1 rounded-md">
                                 <Building2 className="h-3 w-3" /> {imp.entidad_nombre}
                              </span>
                           )}
                        </div>

                        {imp.error ? (
                           <div className="mt-3 flex flex-col gap-2">
                              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                 <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                                 <p className="text-[11px] text-rose-700 font-bold leading-tight">
                                    {imp.error.includes("OCR") ? "Fallo en el OCR - No se pudo leer el contenido" : 
                                     imp.error.includes("procesar") ? "Error al procesar el archivo" : 
                                     "Documento no legible o formato inválido"}
                                 </p>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); processFile(imp.rawFile); }}
                                   className="flex-1 py-2 bg-rose-600 text-white text-[10px] font-black rounded-lg hover:bg-rose-500 transition-all uppercase"
                                 >
                                    Reintentar
                                 </button>
                                 <button 
                                   onClick={(e) => handleDeleteImport(imp.id, e)}
                                   className="px-3 py-2 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-all uppercase"
                                 >
                                    Cancelar
                                 </button>
                              </div>
                           </div>
                        ) : (
                           imp.status === 'reviewing' && (
                              <div className="mt-4 text-xs font-medium text-slate-500 flex items-center gap-2">
                                 Extraídos: <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded shadow-sm border">{imp.actions?.length || 0}</span>
                                 <span className="ml-auto text-[10px] text-primary group-hover:underline">Click para Revisar</span>
                              </div>
                           )
                        )}
                     </motion.div>
                  ))}
                 </div>
               </AnimatePresence>
            )}
         </div>
      </div>

      {/* DANE PREVIEW MODAL */}
      <AnimatePresence>
        {currentPreviewImport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setPreviewImportId(null)}
               className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 30 }}
               className="relative w-full max-w-7xl h-full bg-slate-100 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
               {/* Modal Header */}
               <div className="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-rose-50 rounded-lg"><FileText className="h-6 w-6 text-rose-600" /></div>
                   <div>
                     <h2 className="font-black text-slate-900 uppercase text-xs tracking-tighter">
                        Revisión: <span className="font-medium bg-slate-100 px-2 py-0.5 rounded ml-1 text-slate-600 lowercase">{currentPreviewImport.filename}</span>
                     </h2>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {selectedIndices.size} registros aprobados de {currentPreviewImport.actions?.length}
                     </p>
                   </div>
                 </div>

                 {/* Selector Masivo y Acciones */}
                 <div className="flex items-center gap-2 ml-auto w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                   <label className="flex items-center gap-2 text-xs font-bold text-slate-600 mr-2 shrink-0 cursor-pointer">
                     <input type="checkbox" checked={selectedIndices.size === currentPreviewImport.actions.length && currentPreviewImport.actions.length > 0} 
                            onChange={(e) => toggleAll(e.target.checked, currentPreviewImport.actions.length)} className="h-4 w-4 rounded" />
                     Incluir Todos
                   </label>
                   
                   <button 
                     id="pdf-download-btn"
                     onClick={handleExportPDF}
                     className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-500 transition-all shadow-emerald-600/20 shadow-lg active:scale-95 shrink-0 uppercase"
                   >
                     <Download className="h-4 w-4" />
                     DESCARGAR PDF
                   </button>
                   <button 
                     onClick={handleCommit}
                     className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-500 transition-all shadow-emerald-600/20 shadow-lg active:scale-95 shrink-0"
                   >
                     CREAR TABLA FINAL EN NUBE
                     <Database className="h-4 w-4" />
                   </button>

                   <div className="h-8 w-px bg-slate-200 mx-2 shrink-0" />
                   <button onClick={() => setPreviewImportId(null)} className="p-2 text-slate-400 bg-slate-100 rounded-lg hover:text-slate-600 transition-colors shrink-0">
                     <X className="h-6 w-6" />
                   </button>
                 </div>
               </div>

               {/* Grid Dividido: Izquierda Panel de Selección, Derecha Tablero DANE */}
               <div className="flex-1 flex overflow-hidden">
                  
                  {/* Panel Izquierdo: Lista de Registros */}
                  <div className="w-[300px] md:w-[400px] border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto print:hidden">
                     <div className="p-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                        <p className="text-xs font-black text-slate-500 uppercase">1. Afina la Estructura</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Desmarca los registros que la IA haya alucinado por error antes de volcar la estructura al gestor.</p>
                     </div>
                     <div className="divide-y divide-slate-100">
                        {currentPreviewImport.actions.map((act, i) => {
                           const isSelected = selectedIndices.has(i);
                           return (
                              <label key={i} className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-50'}`}>
                                 <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(i)} className="mt-1 h-4 w-4 rounded border-slate-300 text-primary" />
                                 <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                       <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded ${act.entity.includes('dependenc') ? 'bg-blue-100 text-blue-700' : act.entity.includes('serie') ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                          {act.entity.substring(0, 3)}
                                       </span>
                                       <span className="text-xs font-bold text-slate-900 truncate">
                                          {act.payload.codigo}
                                       </span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-tight">
                                       {act.payload.nombre || act.payload.serieNombre || "Registro de TRD"}
                                    </p>
                                 </div>
                              </label>
                           );
                        })}
                     </div>
                  </div>

                  {/* Panel Derecho: Previsualización Oficial DANE */}
                  <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-8 flex flex-col items-center">
                     <div className="mb-4 text-center print:hidden">
                        <p className="text-xs font-black text-slate-500 uppercase">2. Revisa el Tablero Automático</p>
                     </div>

                     <div id="trd-report-print-area" className="mx-auto w-full bg-white shadow-sm ring-1 ring-slate-200">
                        <TRDExportPreview rows={previewRows} currentUser={currentUser} currentEntity={currentEntity} logoBase64={logoBase64} />
                     </div>
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
