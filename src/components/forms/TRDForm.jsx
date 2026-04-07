import React from "react";
import { FormGroup } from "./DependenciaForm";
import { inputClass, textareaClass } from "./SerieForm";
import { cn } from "@/lib/utils";
import SearchableSelect from "../ui/SearchableSelect";

export default function TRDForm({ data, onChange, activeField, dependencias = [], series = [], subseries = [], entities = [], currentUser = null }) {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      onChange({ ...data, [name]: checked });
    } else {
      onChange({ ...data, [name]: value });
    }
  };

  // Extract selected entities for code population
  const activeDependencia = dependencias.find(d => d.id === data.dependenciaId);
  const activeSerie = series.find(s => s.id === data.serieId);
  const activeSubserie = subseries.find(s => s.id === data.subserieId);

  // Filter series/subseries explicitly based on dependencies
  const filteredSeries = data.dependenciaId ? series.filter(s => s.dependenciaId === data.dependenciaId) : series;
  const filteredSubseries = data.serieId ? subseries.filter(s => s.serieId === data.serieId) : subseries;

  const checkboxClass = "h-4 w-4 rounded border-border text-primary focus:ring-primary text-primary transition-colors cursor-pointer bg-background";
  const groupHeaderClass = "text-sm text-foreground mb-3";

  return (
    <div className="flex flex-col gap-6 p-6 bg-card rounded-xl border border-border shadow-sm max-w-4xl w-full mx-auto">
      <div className="border-b border-border pb-4 mb-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Valoración TRD</h2>
        <p className="text-sm text-muted-foreground">Formulario de registro de Tiempos de Retención y Disposición Documental.</p>
      </div>

      {/* Top Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-end mb-4 border-b border-border/50 pb-8">
        <div className="md:col-span-2">
          <FormGroup label="Nombre Entidad" required isActive={activeField === 'entidadId'}>
            <select
              name="entidadId"
              value={data.entidadId || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Seleccione una entidad...</option>
              {entities.map(ent => (
                <option key={ent.id} value={ent.id}>{ent.razonSocial}</option>
              ))}
            </select>
          </FormGroup>
        </div>

        <FormGroup label="Dependencia" required isActive={activeField === 'dependenciaId'}>
          <SearchableSelect 
            name="dependenciaId" 
            value={data.dependenciaId || ""} 
            onChange={handleChange} 
            className={inputClass}
            placeholder="Seleccione..."
            options={dependencias.map(dep => ({ value: dep.id, label: dep.nombre }))}
          />
        </FormGroup>

        <FormGroup label="Código Dependencia">
          <input disabled value={activeDependencia ? activeDependencia.codigo : ""} className={cn(inputClass, "bg-secondary text-muted-foreground")} />
        </FormGroup>

        <FormGroup label="Serie" isActive={activeField === 'serieId'}>
          <SearchableSelect 
            name="serieId" 
            value={data.serieId || ""} 
            onChange={handleChange} 
            className={inputClass}
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
        <FormGroup label="Estado Conservación *" isActive={activeField === 'estadoConservacion'}>
          <select name="estadoConservacion" value={data.estadoConservacion || ""} onChange={handleChange} className={inputClass}>
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
          <FormGroup label="Archivo de Gestión (Años) *" isActive={activeField === 'retencionGestion'}>
            <input type="number" name="retencionGestion" value={data.retencionGestion || ""} onChange={handleChange} className={inputClass} />
          </FormGroup>

          <FormGroup label="Archivo Central *" isActive={activeField === 'retencionCentral'}>
            <input type="number" name="retencionCentral" value={data.retencionCentral || ""} onChange={handleChange} className={inputClass} />
          </FormGroup>

          <FormGroup label="Serie de DDHH/DIH *" isActive={activeField === 'ddhh'}>
            <select name="ddhh" value={data.ddhh || ""} onChange={handleChange} className={inputClass}>
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
          <div></div>
        </div>

        <FormGroup label="Procedimiento *" isActive={activeField === 'procedimiento'}>
            <textarea name="procedimiento" value={data.procedimiento || ""} onChange={handleChange} className={textareaClass} />
        </FormGroup>
        
        <FormGroup label="Acto Administrativo *" isActive={activeField === 'actoAdmo'}>
            <textarea name="actoAdmo" value={data.actoAdmo || ""} onChange={handleChange} className={textareaClass} />
        </FormGroup>

      </div>
    </div>
  );
}
