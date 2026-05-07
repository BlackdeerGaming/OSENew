import React from "react";
import { cn } from "@/lib/utils";
import { FormGroup } from "./DependenciaForm";
import { inputClass, textareaClass } from "./SerieForm";
import SearchableSelect from "../ui/SearchableSelect";
import { LayoutGrid, PlusCircle } from "lucide-react";

export default function SubserieForm({ 
  data, 
  onChange, 
  activeField, 
  dependencias = [], 
  series = [], 
  subseries = [],
  entities = [], 
  currentUser = null, 
  errors = {} 
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  const handleSelectSubserieForEdit = (e) => {
    const subId = e.target.value;
    if (!subId) {
      onChange({ entidadId: data.entidadId });
      return;
    }
    const sub = subseries.find(s => String(s.id) === String(subId));
    if (sub) {
      onChange({ ...sub });
    }
  };

  // Filter series based on selected dependencia (if any)
  const filteredSeries = data.dependenciaId 
    ? series.filter(s => s.dependenciaId === data.dependenciaId)
    : series;

  // Auto-set dependencia if a serie is selected
  const handleSerieChange = (e) => {
    const serieId = e.target.value;
    const serie = series.find(s => s.id === serieId);
    onChange({ 
      ...data, 
      serieId: serieId,
      dependenciaId: serie ? serie.dependenciaId : data.dependenciaId 
    });
  };

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
            onChange={handleSelectSubserieForEdit}
            placeholder="Buscar subserie para editar..."
            className="bg-white"
            options={[
              { value: "", label: "--- Crear Nueva Subserie ---" },
              ...subseries.map(s => {
                const dep = dependencias.find(d => String(d.id) === String(s.dependenciaId));
                const ser = series.find(ser => String(ser.id) === String(s.serieId));
                return { 
                  value: s.id, 
                  label: `${s.codigo} - ${s.nombre} ${ser ? `[${ser.nombre}]` : ""} ${dep ? `(${dep.sigla || dep.nombre})` : ""}` 
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
                <span className="text-primary italic">Editar:</span> {data.nombre}
              </>
            ) : "Nueva Subserie Documental"}
          </h2>
          <p className="text-sm text-muted-foreground">Conjunto de unidades documentales que forman parte de una serie.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
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

        <FormGroup label="Dependencia Productora" required isActive={activeField === 'dependenciaId'} error={errors.dependenciaId}>
          <SearchableSelect 
            name="dependenciaId" 
            value={data.dependenciaId || ""} 
            onChange={handleChange} 
            className={cn(inputClass, errors.dependenciaId && "border-destructive")}
            placeholder="Seleccione una dependencia..."
            options={dependencias.map(dep => ({ value: dep.id, label: `${dep.codigo} - ${dep.nombre}` }))}
          />
        </FormGroup>

        <FormGroup label="Serie Asociada" required isActive={activeField === 'serieId'} error={errors.serieId}>
          <SearchableSelect 
            name="serieId" 
            value={data.serieId || ""} 
            onChange={handleSerieChange} 
            className={cn(inputClass, errors.serieId && "border-destructive")}
            disabled={filteredSeries.length === 0}
            placeholder="Seleccione una serie..."
            options={filteredSeries.map(s => ({ value: s.id, label: `${s.codigo} - ${s.nombre}` }))}
          />
        </FormGroup>

        <div className="md:col-span-2">
          <FormGroup label="Nombre de la Subserie" required isActive={activeField === 'nombre'} error={errors.nombre}>
            <input 
              name="nombre" 
              value={data.nombre || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.nombre && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. Licitaciones Públicas" 
            />
          </FormGroup>
        </div>

        <FormGroup label="Código" required isActive={activeField === 'codigo'} error={errors.codigo}>
          <input 
            name="codigo" 
            value={data.codigo || ""} 
            onChange={handleChange} 
            className={cn(inputClass, errors.codigo && "border-destructive focus-visible:ring-destructive")} 
            placeholder="Ej. 100-01-01" 
          />
        </FormGroup>

        <div className="md:col-span-2">
          <FormGroup label="Tipos Documentales" required isActive={activeField === 'tipoDocumental'} error={errors.tipoDocumental}>
            <textarea 
              name="tipoDocumental" 
              value={data.tipoDocumental || ""} 
              onChange={handleChange} 
              className={cn(textareaClass, errors.tipoDocumental && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Escriba los tipos documentales..." 
            />
          </FormGroup>
        </div>

        <div className="md:col-span-2">
          <FormGroup label="Descripción" isActive={activeField === 'descripcion'}>
            <textarea name="descripcion" value={data.descripcion || ""} onChange={handleChange} className={textareaClass} placeholder="Breve descripción de la subserie..." />
          </FormGroup>
        </div>
      </div>
    </div>
  );
}
