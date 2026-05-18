import React from "react";
import { FormGroup } from "./DependenciaForm";
import { inputClass, textareaClass } from "./SerieForm";
import { cn } from "@/lib/utils";
import SearchableSelect from "../ui/SearchableSelect";
import FuncionesMultiSelect from "../ui/FuncionesMultiSelect";
import ConfirmDeleteModal from "../ui/ConfirmDeleteModal";
import { LayoutGrid, PlusCircle, FileText, Edit2, Trash2, Eye, Search, X } from "lucide-react";

export default function TRDForm({ 
  data, 
  onChange, 
  activeField, 
  dependencias = [], 
  series = [], 
  subseries = [], 
  trdRecords = [],
  entities = [], 
  funciones = [], 
  currentUser = null, 
  errors = {},
  onDeleteTrd
}) {
  // Local UI States for Deletion and Details View
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [recordToDelete, setRecordToDelete] = React.useState(null);
  const [deleteStatus, setDeleteStatus] = React.useState('idle');
  const [deleteErrorMsg, setDeleteErrorMsg] = React.useState('');
  const [expandedDetails, setExpandedDetails] = React.useState({});

  // Local state for search & filtering
  const [filterSearch, setFilterSearch] = React.useState('');
  const [filterDep, setFilterDep] = React.useState('');
  const [filterSer, setFilterSer] = React.useState('');
  const [filterSub, setFilterSub] = React.useState('');
  const [filterDisp, setFilterDisp] = React.useState('');
  const [filterSop, setFilterSop] = React.useState('');
  const [filterEst, setFilterEst] = React.useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      onChange({ ...data, [name]: checked });
    } else {
      onChange({ ...data, [name]: value });
    }
  };

  const handleSelectTRDForEdit = (e) => {
    const trdId = e.target.value;
    if (!trdId) {
      onChange({ entidadId: data.entidadId });
      return;
    }
    const trd = trdRecords.find(t => String(t.id) === String(trdId));
    if (trd) {
      onChange({ ...trd });
    }
  };

  const handleFuncionesChange = (selectedIds) => {
    onChange({ ...data, funcionesIds: selectedIds });
  };

  const handleDeleteClick = (record) => {
    setRecordToDelete(record);
    setDeleteStatus('idle');
    setDeleteErrorMsg('');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleteStatus('loading');
    try {
      if (onDeleteTrd) {
        await onDeleteTrd(recordToDelete.id);
      }
      setDeleteStatus('success');
    } catch (err) {
      console.error(err);
      setDeleteStatus('error');
      setDeleteErrorMsg(err?.message || "Ocurrió un error al intentar eliminar la valoración.");
    }
  };

  const toggleDetails = (id) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Real-time client-side filter computation using AND logic (combinable)
  const filteredTRDRecords = React.useMemo(() => {
    return trdRecords.filter(t => {
      // 1. Text Search matching
      if (filterSearch.trim() !== '') {
        const query = filterSearch.toLowerCase();
        
        const dep = dependencias.find(d => String(d.id) === String(t.dependenciaId));
        const ser = series.find(s => String(s.id) === String(t.serieId));
        const sub = t.subserieId ? subseries.find(s => String(s.id) === String(t.subserieId)) : null;
        
        const codeStr = `${dep?.codigo || ''}-${ser?.codigo || ''}${sub ? `-${sub.codigo}` : ''}`.toLowerCase();
        const codePartStr = `${dep?.sigla || ''} | ${ser?.codigo || ''}${sub ? `-${sub.codigo}` : ''}`.toLowerCase();
        
        const depName = (dep?.nombre || '').toLowerCase();
        const serName = (ser?.nombre || '').toLowerCase();
        const subName = (sub?.nombre || '').toLowerCase();
        
        const procedure = (t.procedimiento || '').toLowerCase();
        
        // formats/supports
        const supportStr = (t.rep_digitalizacion && t.rep_microfilmacion ? "híbrido" : t.rep_digitalizacion ? "electrónico" : t.rep_microfilmacion ? "microfilm" : "físico").toLowerCase();
        
        // disposition final
        const dispList = [];
        if (t['disp_Conservación total']) dispList.push('ct', 'conservación total');
        if (t['disp_Eliminación']) dispList.push('e', 'eliminación');
        if (t['disp_Selección']) dispList.push('s', 'selección');
        const dispStr = dispList.join(' ');
        
        // document types search
        const docTypesStr = (t.tiposDocumentales || [])
          .map(td => `${td.titulo_documento || ''} ${td.extension || ''} ${td.cual || ''}`)
          .join(' ')
          .toLowerCase();
        
        const matchesSearch = 
          codeStr.includes(query) ||
          codePartStr.includes(query) ||
          depName.includes(query) ||
          serName.includes(query) ||
          subName.includes(query) ||
          procedure.includes(query) ||
          supportStr.includes(query) ||
          dispStr.includes(query) ||
          docTypesStr.includes(query) ||
          (t.nombre || '').toLowerCase().includes(query) ||
          (t.estadoConservacion || '').toLowerCase().includes(query);
          
        if (!matchesSearch) return false;
      }
      
      // 2. Dropdown Filters
      if (filterDep !== '' && String(t.dependenciaId) !== String(filterDep)) return false;
      if (filterSer !== '' && String(t.serieId) !== String(filterSer)) return false;
      if (filterSub !== '' && String(t.subserieId) !== String(filterSub)) return false;
      
      if (filterDisp !== '') {
        const hasCT = t['disp_Conservación total'];
        const hasE = t['disp_Eliminación'];
        const hasS = t['disp_Selección'];
        if (filterDisp === 'CT' && !hasCT) return false;
        if (filterDisp === 'E' && !hasE) return false;
        if (filterDisp === 'S' && !hasS) return false;
      }
      
      if (filterSop !== '') {
        const isHybrid = t.rep_digitalizacion && t.rep_microfilmacion;
        const isElec = t.rep_digitalizacion && !t.rep_microfilmacion;
        const isMicro = !t.rep_digitalizacion && t.rep_microfilmacion;
        const isPhys = !t.rep_digitalizacion && !t.rep_microfilmacion;
        
        if (filterSop === 'Hibrido' && !isHybrid) return false;
        if (filterSop === 'Electronico' && !isElec) return false;
        if (filterSop === 'Microfilm' && !isMicro) return false;
        if (filterSop === 'Fisico' && !isPhys) return false;
      }
      
      if (filterEst !== '' && String(t.estadoConservacion) !== String(filterEst)) return false;
      
      return true;
    });
  }, [trdRecords, filterSearch, filterDep, filterSer, filterSub, filterDisp, filterSop, filterEst, dependencias, series, subseries]);

  // Extract selected entities for code population
  const activeDependencia = dependencias.find(d => d.id === data.dependenciaId);
  const activeSerie = series.find(s => s.id === data.serieId);
  const activeSubserie = subseries.find(s => s.id === data.subserieId);

  // Series and Subseries are now global
  const filteredSeries = series;
  const filteredSubseries = subseries;

  const checkboxClass = "h-4 w-4 rounded border-border text-primary focus:ring-primary text-primary transition-colors cursor-pointer bg-background";
  const groupHeaderClass = "text-sm text-foreground mb-3";

  return (
    <div className="flex flex-col gap-6 max-w-[95rem] w-full mx-auto px-2 md:px-4">
      {/* Selector de Edición Rápida (Full Width Top Spanning) */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 bg-primary/10 rounded-xl">
            <LayoutGrid className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Editar Existente:</span>
        </div>
        <div className="flex-1 w-full">
          <SearchableSelect
            name="edit_selector"
            value={data?.id || ""}
            onChange={handleSelectTRDForEdit}
            placeholder="Buscar valoración para editar..."
            className="bg-white"
            options={[
              { value: "", label: "--- Crear Nueva Valoración ---" },
              ...trdRecords.map(t => {
                const dep = dependencias.find(d => String(d.id) === String(t.dependenciaId));
                const ser = series.find(ser => String(ser.id) === String(t.serieId));
                const sub = t.subserieId ? subseries.find(sub => String(sub.id) === String(t.subserieId)) : null;
                return { 
                  value: t.id, 
                  label: `${dep?.sigla || "DEP"} | ${ser?.codigo || "SER"}${sub ? `-${sub.codigo}` : ""} - ${t.nombre || "Valoración"}` 
                };
              })
            ]}
          />
        </div>
        {data?.id && (
          <button 
            onClick={() => onChange({ entidadId: data.entidadId })} 
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Nuevo Registro
          </button>
        )}
      </div>

      {/* Main Responsive Parallel Columns Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        
        {/* Columna Izquierda: Formulario (40% de ancho en Desktop) */}
        <div className="w-full lg:w-[40%] shrink-0 bg-card rounded-xl border border-border shadow-sm p-5 md:p-6 flex flex-col gap-6 bg-white">
          <div className="border-b border-border pb-4 mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                {data?.id ? (
                  <>
                    <span className="text-primary italic">Editar:</span> {data.nombre || "Valoración"}
                  </>
                ) : "Nueva Valoración TRD"}
              </h2>
              <p className="text-xs text-muted-foreground">Formulario de registro de Tiempos de Retención y Disposición Documental.</p>
            </div>
          </div>

          {/* Top Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 items-end mb-2 border-b border-border/50 pb-6">
            <div className="md:col-span-2">
              <FormGroup label="Nombre Entidad" required isActive={activeField === 'entidadId'} error={errors.entidadId}>
                <select
                  name="entidadId"
                  value={data.entidadId || ""}
                  onChange={handleChange}
                  className={cn(inputClass, errors.entidadId && "border-destructive focus-visible:ring-destructive")}
                >
                  <option value="">Seleccione una entidad...</option>
                  {entities.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.razonSocial}</option>
                  ))}
                </select>
              </FormGroup>
            </div>

            <FormGroup label="Dependencia" required isActive={activeField === 'dependenciaId'} error={errors.dependenciaId}>
              <SearchableSelect 
                name="dependenciaId" 
                value={data.dependenciaId || ""} 
                onChange={handleChange} 
                className={cn(inputClass, errors.dependenciaId && "border-destructive")}
                placeholder="Seleccione..."
                options={dependencias.map(dep => ({ value: dep.id, label: dep.nombre }))}
              />
            </FormGroup>

            <FormGroup label="Código Dependencia">
              <input disabled value={activeDependencia ? activeDependencia.codigo : ""} className={cn(inputClass, "bg-secondary text-muted-foreground")} />
            </FormGroup>

            <FormGroup label="Serie" required isActive={activeField === 'serieId'} error={errors.serieId}>
              <SearchableSelect 
                name="serieId" 
                value={data.serieId || ""} 
                onChange={handleChange} 
                className={cn(inputClass, errors.serieId && "border-destructive")}
                placeholder="Seleccione..."
                options={filteredSeries.map(s => ({ value: s.id, label: s.nombre }))}
              />
            </FormGroup>

            <FormGroup label="Código Serie">
              <input disabled value={activeSerie ? activeSerie.codigo : ""} className={cn(inputClass, "bg-secondary text-muted-foreground")} />
            </FormGroup>

            <FormGroup label="Subserie" isActive={activeField === 'subserieId'}>
              <SearchableSelect 
                name="subserieId" 
                value={data.subserieId || ""} 
                onChange={handleChange} 
                className={inputClass}
                placeholder="Seleccione... (Opcional si es plana)"
                options={filteredSubseries.map(s => ({ value: s.id, label: s.nombre }))}
              />
            </FormGroup>

            <FormGroup label="Código Subserie">
              <input disabled value={activeSubserie ? activeSubserie.codigo : ""} className={cn(inputClass, "bg-secondary text-muted-foreground")} />
            </FormGroup>
          </div>

          <h3 className="text-base font-bold tracking-tight text-primary">Valoración documental</h3>

          {/* Valuation Section */}
          <div className="grid grid-cols-1 gap-y-5">
            <FormGroup label="Estado Conservación *" isActive={activeField === 'estadoConservacion'} error={errors.estadoConservacion}>
              <select 
                name="estadoConservacion" 
                value={data.estadoConservacion || ""} 
                onChange={handleChange} 
                className={cn(inputClass, errors.estadoConservacion && "border-destructive focus-visible:ring-destructive")}
              >
                <option value="" disabled>Seleccione</option>
                <option value="Bueno">Bueno</option>
                <option value="Regular">Regular</option>
                <option value="Malo">Malo</option>
              </select>
            </FormGroup>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ordenación */}
              <div className="border border-border/70 rounded-md p-3 bg-background">
                <h4 className={groupHeaderClass}>Ordenación *</h4>
                <div className="space-y-2">
                  {['Alfabética', 'Cronológica', 'Numérica', 'Otra'].map(opt => (
                     <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                       <input type="checkbox" name={`ord_${opt}`} checked={data[`ord_${opt}`] || false} onChange={handleChange} className={checkboxClass} />
                       {opt}
                     </label>
                  ))}
                </div>
              </div>

              {/* Disposición Final */}
              <div className="border border-border/70 rounded-md p-3 bg-background">
                <h4 className={groupHeaderClass}>Disposición Final *</h4>
                <div className="space-y-2">
                  {['Conservación total', 'Eliminación', 'Selección'].map(opt => (
                     <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                       <input type="checkbox" name={`disp_${opt}`} checked={data[`disp_${opt}`] || false} onChange={handleChange} className={checkboxClass} />
                       {opt}
                     </label>
                  ))}
                </div>
              </div>

              {/* Valor Documental */}
              <div className="border border-border/70 rounded-md p-3 bg-background">
                <h4 className={groupHeaderClass}>Valor Documental *</h4>
                <div className="space-y-2">
                  {['Administrativo', 'Técnico', 'Contable', 'Fiscal', 'Legal', 'Histórico', 'Sin Valor', 'Otro'].map(opt => (
                     <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                       <input type="checkbox" name={`val_${opt}`} checked={data[`val_${opt}`] || false} onChange={handleChange} className={checkboxClass} />
                       {opt}
                     </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormGroup label="Archivo de Gestión (Años) *" isActive={activeField === 'retencionGestion'} error={errors.retencionGestion}>
                <input 
                  type="number" 
                  name="retencionGestion" 
                  value={data.retencionGestion || ""} 
                  onChange={handleChange} 
                  className={cn(inputClass, errors.retencionGestion && "border-destructive focus-visible:ring-destructive")} 
                />
              </FormGroup>

              <FormGroup label="Archivo Central *" isActive={activeField === 'retencionCentral'} error={errors.retencionCentral}>
                <input 
                  type="number" 
                  name="retencionCentral" 
                  value={data.retencionCentral || ""} 
                  onChange={handleChange} 
                  className={cn(inputClass, errors.retencionCentral && "border-destructive focus-visible:ring-destructive")} 
                />
              </FormGroup>

              <FormGroup label="Serie de DDHH/DIH *" isActive={activeField === 'ddhh'} error={errors.ddhh}>
                <select 
                  name="ddhh" 
                  value={data.ddhh || ""} 
                  onChange={handleChange} 
                  className={cn(inputClass, errors.ddhh && "border-destructive focus-visible:ring-destructive")}
                >
                  <option value="" disabled>Seleccione...</option>
                  <option value="Si">Si</option>
                  <option value="No">No</option>
                </select>
              </FormGroup>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="border border-border/70 rounded-md p-3 bg-background">
                <h4 className={groupHeaderClass}>Reproducción Técnica</h4>
                <div className="flex gap-4">
                   <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                     <input type="checkbox" name="rep_microfilmacion" checked={data.rep_microfilmacion || false} onChange={handleChange} className={checkboxClass} />
                     M-Microfilmación
                   </label>
                   <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                     <input type="checkbox" name="rep_digitalizacion" checked={data.rep_digitalizacion || false} onChange={handleChange} className={checkboxClass} />
                     D-Digitalización
                   </label>
                </div>
              </div>
              
              <div className="border border-border/70 rounded-md p-3 bg-background flex flex-col gap-2">
                <h4 className={groupHeaderClass}>Funciones de la Dependencia</h4>
                <FuncionesMultiSelect
                  funciones={funciones}
                  selectedIds={data.funcionesIds || []}
                  onChange={handleFuncionesChange}
                  filteredDependenciaId={data.dependenciaId || null}
                />
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {data.dependenciaId
                    ? "Mostrando funciones asociadas a la dependencia seleccionada."
                    : "Selecciona una dependencia arriba para filtrar sus funciones."}
                </p>
              </div>
            </div>

            <FormGroup label="Procedimiento *" isActive={activeField === 'procedimiento'} error={errors.procedimiento}>
                <textarea 
                  name="procedimiento" 
                  value={data.procedimiento || ""} 
                  onChange={handleChange} 
                  className={cn(textareaClass, errors.procedimiento && "border-destructive focus-visible:ring-destructive")} 
                />
            </FormGroup>
            
            <FormGroup label="Acto Administrativo *" isActive={activeField === 'actoAdmo'} error={errors.actoAdmo}>
                <textarea 
                  name="actoAdmo" 
                  value={data.actoAdmo || ""} 
                  onChange={handleChange} 
                  className={cn(textareaClass, errors.actoAdmo && "border-destructive focus-visible:ring-destructive")} 
                />
            </FormGroup>

            {/* --- Sección de Tipos Documentales --- */}
            <div className="border-t border-border pt-5 mt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold tracking-tight text-primary flex items-center gap-2">
                  Tipos Documentales
                  <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">Dinámico</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const newList = [...(data.tiposDocumentales || []), { 
                      titulo_documento: "", 
                      formato: { papel: false, electronico: false }, 
                      extension: "", 
                      cual: "",
                      isEditing: true
                    }];
                    onChange({ ...data, tiposDocumentales: newList });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Nuevo Tipo
                </button>
              </div>

              <div className="space-y-3">
                {(data.tiposDocumentales || []).map((tipo, idx) => (
                  <div key={idx} className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 relative group transition-all hover:border-primary/30">
                    {tipo.isEditing ? (
                      <>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Título Documento</label>
                            <input
                              type="text"
                              value={tipo.titulo_documento}
                              onChange={(e) => {
                                const newList = [...data.tiposDocumentales];
                                newList[idx].titulo_documento = e.target.value;
                                onChange({ ...data, tiposDocumentales: newList });
                              }}
                              className={cn(inputClass, "bg-white shadow-sm h-8 py-1 px-3 text-xs")}
                              placeholder="Ej. Acta de Inicio"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Formato</label>
                              <div className="flex gap-3 h-8 items-center bg-white border border-input rounded-xl px-2 shadow-sm">
                                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={tipo.formato?.papel}
                                    onChange={(e) => {
                                      const newList = [...data.tiposDocumentales];
                                      newList[idx].formato = { ...newList[idx].formato, papel: e.target.checked };
                                      onChange({ ...data, tiposDocumentales: newList });
                                    }}
                                    className={checkboxClass}
                                  />
                                  P
                                </label>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={tipo.formato?.electronico}
                                    onChange={(e) => {
                                      const newList = [...data.tiposDocumentales];
                                      newList[idx].formato = { ...newList[idx].formato, electronico: e.target.checked };
                                      onChange({ ...data, tiposDocumentales: newList });
                                    }}
                                    className={checkboxClass}
                                  />
                                  E
                                </label>
                              </div>
                            </div>

                            <div className="col-span-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Extensión</label>
                              <select
                                value={tipo.extension}
                                onChange={(e) => {
                                  const newList = [...data.tiposDocumentales];
                                  newList[idx].extension = e.target.value;
                                  onChange({ ...data, tiposDocumentales: newList });
                                }}
                                className={cn(inputClass, "bg-white shadow-sm h-8 py-1 px-2 text-xs")}
                              >
                                <option value="">Seleccione</option>
                                <option value="PDF">PDF</option>
                                <option value="DOCX">DOCX</option>
                                <option value="XLSX">XLSX</option>
                                <option value="JPG/PNG">JPG/PNG</option>
                                <option value="MP4">MP4</option>
                                <option value="ZIP/RAR">ZIP/RAR</option>
                                <option value="OTRO">OTRO</option>
                              </select>
                            </div>

                            <div className="col-span-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">¿Cuál?</label>
                              <input
                                type="text"
                                value={tipo.cual}
                                onChange={(e) => {
                                  const newList = [...data.tiposDocumentales];
                                  newList[idx].cual = e.target.value;
                                  onChange({ ...data, tiposDocumentales: newList });
                                }}
                                className={cn(inputClass, "bg-white shadow-sm h-8 py-1 px-2 text-xs")}
                                placeholder="..."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              if (!tipo.titulo_documento?.trim()) {
                                alert("El título del documento es obligatorio.");
                                return;
                              }
                              const newList = [...data.tiposDocumentales];
                              newList[idx].isEditing = false;
                              onChange({ ...data, tiposDocumentales: newList });
                            }}
                            className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newList = data.tiposDocumentales.filter((_, i) => i !== idx);
                              onChange({ ...data, tiposDocumentales: newList });
                            }}
                            className="px-3 py-1 bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate" title={tipo.titulo_documento}>{tipo.titulo_documento}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded whitespace-nowrap">
                                {tipo.formato?.papel ? "Papel" : ""} {tipo.formato?.electronico ? "Electrónico" : ""}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/5 px-1.5 py-0.2 rounded border border-primary/10 whitespace-nowrap">
                                {tipo.extension} {tipo.cual ? `(${tipo.cual})` : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const newList = [...data.tiposDocumentales];
                              newList[idx].isEditing = true;
                              onChange({ ...data, tiposDocumentales: newList });
                            }}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                          >
                            <Edit2 className="h-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newList = data.tiposDocumentales.filter((_, i) => i !== idx);
                              onChange({ ...data, tiposDocumentales: newList });
                            }}
                            className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {(data.tiposDocumentales || []).length === 0 && (
                  <div className="text-center py-8 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 text-xs font-medium">No se han agregado tipos documentales todavía.</p>
                    <p className="text-slate-300 text-[9px] font-bold uppercase tracking-widest mt-1">Usa el botón superior para empezar</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Columna Derecha: Valoraciones Creadas (60% de ancho en Desktop y Sticky) */}
        <div className="w-full lg:flex-1 bg-card rounded-xl border border-border shadow-sm p-5 md:p-6 flex flex-col gap-5 bg-white lg:sticky lg:top-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="p-2 bg-primary/10 rounded-xl">
              <LayoutGrid className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Valoraciones Creadas</h3>
              <p className="text-xs text-muted-foreground">Listado general de retenciones y disposiciones documentales registradas en esta entidad.</p>
            </div>
          </div>

          {/* Panel de Búsqueda y Filtros Combinables */}
          {trdRecords.length > 0 && (
            <div className="flex flex-col gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/60">
              {/* Barra de Búsqueda Principal (Text Search) */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por código, dependencia, serie, tipo documental, procedimiento..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-all shadow-sm"
                />
                {filterSearch && (
                  <button
                    onClick={() => setFilterSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-650 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Grid de Filtros Compactos */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                {/* Dependencia */}
                <div>
                  <select
                    value={filterDep}
                    onChange={(e) => setFilterDep(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                  >
                    <option value="">Dependencia...</option>
                    {dependencias.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Serie */}
                <div>
                  <select
                    value={filterSer}
                    onChange={(e) => setFilterSer(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                  >
                    <option value="">Serie...</option>
                    {series.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Subserie */}
                <div>
                  <select
                    value={filterSub}
                    onChange={(e) => setFilterSub(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                  >
                    <option value="">Subserie...</option>
                    {subseries.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Disposición */}
                <div>
                  <select
                    value={filterDisp}
                    onChange={(e) => setFilterDisp(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                  >
                    <option value="">Disposición...</option>
                    <option value="CT">CT (Cons. Total)</option>
                    <option value="E">E (Eliminación)</option>
                    <option value="S">S (Selección)</option>
                  </select>
                </div>

                {/* Soporte */}
                <div>
                  <select
                    value={filterSop}
                    onChange={(e) => setFilterSop(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                  >
                    <option value="">Soporte...</option>
                    <option value="Fisico">Físico</option>
                    <option value="Electronico">Electrónico</option>
                    <option value="Microfilm">Microfilm</option>
                    <option value="Hibrido">Híbrido</option>
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <select
                    value={filterEst}
                    onChange={(e) => setFilterEst(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                  >
                    <option value="">Estado...</option>
                    <option value="Bueno">Bueno</option>
                    <option value="Regular">Regular</option>
                    <option value="Malo">Malo</option>
                  </select>
                </div>
              </div>

              {/* Botón de Limpieza (Visible solo cuando hay filtros activos) */}
              {(filterSearch || filterDep || filterSer || filterSub || filterDisp || filterSop || filterEst) && (
                <div className="flex justify-end pt-1.5 border-t border-slate-200/40">
                  <button
                    onClick={() => {
                      setFilterSearch('');
                      setFilterDep('');
                      setFilterSer('');
                      setFilterSub('');
                      setFilterDisp('');
                      setFilterSop('');
                      setFilterEst('');
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpiar Filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {trdRecords.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 border border-slate-200 rounded-2xl w-full">
              <p className="text-slate-400 text-sm font-medium">No se han registrado valoraciones todavía para esta entidad.</p>
              <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-1">Completa el formulario izquierdo para crear la primera</p>
            </div>
          ) : filteredTRDRecords.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 border border-slate-200 rounded-2xl w-full">
              <p className="text-slate-400 text-sm font-medium">No se encontraron valoraciones con esos criterios.</p>
              <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-1">Intenta restablecer o modificar los términos de búsqueda</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm w-full">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-3">Código TRD</th>
                      <th className="py-3.5 px-3">Estructura Archivística</th>
                      <th className="py-3.5 px-3">Retención</th>
                      <th className="py-3.5 px-3">Disposición</th>
                      <th className="py-3.5 px-3 text-center">Soporte</th>
                      <th className="py-3.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTRDRecords.map((t) => {
                      const dep = dependencias.find(d => String(d.id) === String(t.dependenciaId));
                      const ser = series.find(s => String(s.id) === String(t.serieId));
                      const sub = t.subserieId ? subseries.find(s => String(s.id) === String(t.subserieId)) : null;
                      
                      const isExpanded = !!expandedDetails[t.id];
                      
                      // Disposicion representation
                      const dispList = [];
                      if (t['disp_Conservación total']) dispList.push('CT');
                      if (t['disp_Eliminación']) dispList.push('E');
                      if (t['disp_Selección']) dispList.push('S');
                      
                      // Format count of doc types
                      const docTypesCount = t.tiposDocumentales?.length || 0;
                      
                      return (
                        <React.Fragment key={t.id}>
                          <tr className={cn(
                            "hover:bg-slate-50/50 transition-colors group",
                            isExpanded && "bg-slate-50/30"
                          )}>
                            {/* Código TRD */}
                            <td className="py-4 px-3 font-mono font-bold text-slate-600 whitespace-nowrap">
                              {dep?.codigo || "DEP"}-{ser?.codigo || "SER"}{sub ? `-${sub.codigo}` : ""}
                            </td>
                            
                            {/* Estructura Archivística */}
                            <td className="py-4 px-3 max-w-[200px]">
                              <div className="font-semibold text-slate-800 truncate" title={dep?.nombre}>{dep?.nombre || "Dependencia"}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5 flex flex-wrap gap-1">
                                <span className="bg-slate-100 px-1 rounded font-bold uppercase tracking-tight truncate max-w-[120px]" title={ser?.nombre}>{ser?.nombre || "Serie"}</span>
                                {sub && <span className="bg-primary/5 text-primary border border-primary/10 px-1 rounded font-bold uppercase tracking-tight truncate max-w-[120px]" title={sub.nombre}>{sub.nombre}</span>}
                              </div>
                            </td>
                            
                            {/* Retención */}
                            <td className="py-4 px-3 whitespace-nowrap">
                              <div className="font-medium text-slate-700">Gestión: <span className="font-bold text-slate-900">{t.retencionGestion || 0}</span> {t.retencionGestion === 1 ? 'a' : 'a'}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">Central: <span className="font-bold text-slate-900">{t.retencionCentral || 0}</span> {t.retencionCentral === 1 ? 'a' : 'a'}</div>
                            </td>
                            
                            {/* Disposición */}
                            <td className="py-4 px-3 whitespace-nowrap">
                              <div className="flex gap-0.5">
                                {dispList.map(disp => (
                                  <span 
                                    key={disp} 
                                    className={cn(
                                      "px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                      disp === 'CT' ? "bg-emerald-100 text-emerald-800" :
                                      disp === 'E' ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                                    )}
                                  >
                                    {disp}
                                  </span>
                                ))}
                                {dispList.length === 0 && <span className="text-slate-400 font-bold">N/A</span>}
                              </div>
                            </td>
                            
                            {/* Soporte */}
                            <td className="py-4 px-3 text-center whitespace-nowrap">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                                t.rep_digitalizacion && t.rep_microfilmacion
                                  ? "bg-purple-100 text-purple-800"
                                  : t.rep_digitalizacion
                                  ? "bg-blue-100 text-blue-800"
                                  : t.rep_microfilmacion
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-slate-100 text-slate-800"
                              )}>
                                {t.rep_digitalizacion && t.rep_microfilmacion ? "Híbrido" : t.rep_digitalizacion ? "Electrónico" : t.rep_microfilmacion ? "Microfilm" : "Físico"}
                              </span>
                            </td>
                            
                            {/* Acciones */}
                            <td className="py-4 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => toggleDetails(t.id)}
                                  className={cn(
                                    "p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer",
                                    isExpanded && "text-slate-700 bg-slate-100"
                                  )}
                                  title={isExpanded ? "Ocultar Detalle" : "Ver Detalle"}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChange({ ...t })}
                                  className="p-1 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                                  title="Editar Valoración"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick({
                                    id: t.id,
                                    dependencia: dep?.nombre || "DEP",
                                    serie: ser?.nombre || "SER",
                                    subserie: sub?.nombre || ""
                                  })}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                  title="Eliminar Valoración"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Expanded details panel */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="6" className="bg-slate-50/50 p-4 border-t border-slate-100">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-xs text-slate-600 animate-in fade-in duration-200">
                                  <div>
                                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Procedimiento Archivístico</h4>
                                    <p className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700 leading-relaxed min-h-[50px] whitespace-pre-wrap text-[11px]">
                                      {t.procedimiento || "No se ha registrado procedimiento descriptivo."}
                                    </p>
                                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10.5px]">
                                      <div>
                                        <span className="font-semibold text-slate-500">¿DDHH / DIH?:</span>
                                        <span className={cn(
                                          "ml-1.5 font-bold px-1 py-0.2 rounded text-[9px] uppercase",
                                          t.ddhh === 'Si' ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                                        )}>{t.ddhh || 'No'}</span>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-slate-500">Acto Administrativo:</span>
                                        <div className="mt-0.5 font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 truncate" title={t.actoAdmo}>{t.actoAdmo || 'N/A'}</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipos Documentales Vinculados ({docTypesCount})</h4>
                                    </div>
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-[140px] overflow-y-auto shadow-inner">
                                      {t.tiposDocumentales && t.tiposDocumentales.length > 0 ? (
                                        t.tiposDocumentales.map((td, i) => (
                                          <div key={i} className="p-1.5 flex items-center justify-between gap-2 text-[10px]">
                                            <span className="font-bold text-slate-800 truncate" title={td.titulo_documento}>{td.titulo_documento}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className="bg-slate-100 text-slate-500 font-bold px-1 rounded uppercase text-[8.5px]">
                                                {td.formato?.papel ? 'P' : ''}{td.formato?.electronico ? 'E' : ''}
                                              </span>
                                              <span className="bg-primary/5 text-primary border border-primary/10 font-black px-1 rounded uppercase text-[8.5px]">
                                                {td.extension}
                                              </span>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="p-3 text-center text-slate-400 italic text-[10px]">No hay tipos documentales vinculados.</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal Overlay */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        status={deleteStatus}
        errorMsg={deleteErrorMsg}
        details={recordToDelete}
      />
    </div>
  );
}
