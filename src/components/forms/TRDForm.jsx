import React from "react";
import { FormGroup } from "./DependenciaForm";
import { inputClass, textareaClass } from "./SerieForm";
import { cn } from "@/lib/utils";
import SearchableSelect from "../ui/SearchableSelect";
import FuncionesMultiSelect from "../ui/FuncionesMultiSelect";
import { LayoutGrid, PlusCircle, FileText, Edit2, Trash2 } from "lucide-react";

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
  errors = {} 
}) {
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
    <div className="flex flex-col gap-6 p-6 bg-card rounded-xl border border-border shadow-sm max-w-4xl w-full mx-auto">
      {/* Selector de Edición Rápida */}
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            Nuevo Registro
          </button>
        )}
      </div>

      <div className="border-b border-border pb-4 mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {data?.id ? (
              <>
                <span className="text-primary italic">Editar:</span> {data.nombre || "Valoración"}
              </>
            ) : "Nueva Valoración TRD"}
          </h2>
          <p className="text-sm text-muted-foreground">Formulario de registro de Tiempos de Retención y Disposición Documental.</p>
        </div>
      </div>

      {/* Top Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-end mb-4 border-b border-border/50 pb-8">
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

      <h3 className="text-lg font-bold tracking-tight text-primary">Valoración documental</h3>

      {/* Valuation Section */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-6">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ordenación */}
          <div className="border border-border/70 rounded-md p-4 bg-background">
            <h4 className={groupHeaderClass}>Ordenación *</h4>
            <div className="space-y-3">
              {['Alfabética', 'Cronológica', 'Numérica', 'Otra'].map(opt => (
                 <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                   <input type="checkbox" name={`ord_${opt}`} checked={data[`ord_${opt}`] || false} onChange={handleChange} className={checkboxClass} />
                   {opt}
                 </label>
              ))}
            </div>
          </div>

          {/* Disposición Final */}
          <div className="border border-border/70 rounded-md p-4 bg-background">
            <h4 className={groupHeaderClass}>Disposición Final *</h4>
            <div className="space-y-3">
              {['Conservación total', 'Eliminación', 'Selección'].map(opt => (
                 <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                   <input type="checkbox" name={`disp_${opt}`} checked={data[`disp_${opt}`] || false} onChange={handleChange} className={checkboxClass} />
                   {opt}
                 </label>
              ))}
            </div>
          </div>

          {/* Valor Documental */}
          <div className="border border-border/70 rounded-md p-4 bg-background">
            <h4 className={groupHeaderClass}>Valor Documental *</h4>
            <div className="space-y-3">
              {['Administrativo', 'Técnico', 'Contable', 'Fiscal', 'Legal', 'Histórico', 'Sin Valor', 'Otro'].map(opt => (
                 <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                   <input type="checkbox" name={`val_${opt}`} checked={data[`val_${opt}`] || false} onChange={handleChange} className={checkboxClass} />
                   {opt}
                 </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border/70 rounded-md p-4 bg-background">
            <h4 className={groupHeaderClass}>Reproducción Técnica</h4>
            <div className="space-y-3">
               <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                 <input type="checkbox" name="rep_microfilmacion" checked={data.rep_microfilmacion || false} onChange={handleChange} className={checkboxClass} />
                 M-Microfilmación
               </label>
               <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 p-1 rounded-sm">
                 <input type="checkbox" name="rep_digitalizacion" checked={data.rep_digitalizacion || false} onChange={handleChange} className={checkboxClass} />
                 D-Digitalización
               </label>
            </div>
          </div>
          <div className="border border-border/70 rounded-md p-4 bg-background flex flex-col gap-3">
            <h4 className={groupHeaderClass}>Funciones de la Dependencia</h4>
            <FuncionesMultiSelect
              funciones={funciones}
              selectedIds={data.funcionesIds || []}
              onChange={handleFuncionesChange}
              filteredDependenciaId={data.dependenciaId || null}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
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
        <div className="border-t border-border pt-6 mt-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold tracking-tight text-primary flex items-center gap-2">
              Tipos Documentales
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">Dinámico</span>
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
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Nuevo Tipo Documental
            </button>
          </div>

          <div className="space-y-4">
            {(data.tiposDocumentales || []).map((tipo, idx) => (
              <div key={idx} className="bg-slate-50/50 border border-slate-200 rounded-2xl p-5 relative group transition-all hover:border-primary/30">
                {tipo.isEditing ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                      <div className="lg:col-span-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Título Documento</label>
                        <input
                          type="text"
                          value={tipo.titulo_documento}
                          onChange={(e) => {
                            const newList = [...data.tiposDocumentales];
                            newList[idx].titulo_documento = e.target.value;
                            onChange({ ...data, tiposDocumentales: newList });
                          }}
                          className={cn(inputClass, "bg-white shadow-sm")}
                          placeholder="Ej. Acta de Inicio"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Formato</label>
                        <div className="flex gap-4 h-10 items-center bg-white border border-input rounded-xl px-4 shadow-sm">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
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
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
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

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Extensión</label>
                        <select
                          value={tipo.extension}
                          onChange={(e) => {
                            const newList = [...data.tiposDocumentales];
                            newList[idx].extension = e.target.value;
                            onChange({ ...data, tiposDocumentales: newList });
                          }}
                          className={cn(inputClass, "bg-white shadow-sm")}
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

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">¿Cuál?</label>
                        <input
                          type="text"
                          value={tipo.cual}
                          onChange={(e) => {
                            const newList = [...data.tiposDocumentales];
                            newList[idx].cual = e.target.value;
                            onChange({ ...data, tiposDocumentales: newList });
                          }}
                          className={cn(inputClass, "bg-white shadow-sm")}
                          placeholder="..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
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
                        className="px-4 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newList = data.tiposDocumentales.filter((_, i) => i !== idx);
                          onChange({ ...data, tiposDocumentales: newList });
                        }}
                        className="px-4 py-1.5 bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{tipo.titulo_documento}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            {tipo.formato?.papel ? "Papel" : ""} {tipo.formato?.electronico ? "Electrónico" : ""}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                            {tipo.extension} {tipo.cual ? `(${tipo.cual})` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newList = [...data.tiposDocumentales];
                          newList[idx].isEditing = true;
                          onChange({ ...data, tiposDocumentales: newList });
                        }}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newList = data.tiposDocumentales.filter((_, i) => i !== idx);
                          onChange({ ...data, tiposDocumentales: newList });
                        }}
                        className="p-2 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {(data.tiposDocumentales || []).length === 0 && (
              <div className="text-center py-12 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl">
                <p className="text-slate-400 text-sm font-medium">No se han agregado tipos documentales todavía.</p>
                <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-1">Usa el botón superior para empezar</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

