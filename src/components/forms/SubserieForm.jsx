import React from "react";
import { FormGroup } from "./DependenciaForm";
import { inputClass, textareaClass } from "./SerieForm";
import SearchableSelect from "../ui/SearchableSelect";

export default function SubserieForm({ data, onChange, activeField, dependencias = [], series = [], entities = [], currentUser = null }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
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
      <div className="border-b border-border pb-4 mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {data?.id ? "Editar Subserie Documental" : "Nueva Subserie Documental"}
          </h2>
          <p className="text-sm text-muted-foreground">Conjunto de unidades documentales que forman parte de una serie.</p>
        </div>
        {data?.id && (
          <button 
            onClick={() => onChange({})} 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            + Nueva Subserie
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
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

        <FormGroup label="Dependencia Productora" required isActive={activeField === 'dependenciaId'}>
          <SearchableSelect 
            name="dependenciaId" 
            value={data.dependenciaId || ""} 
            onChange={handleChange} 
            className={inputClass}
            placeholder="Seleccione una dependencia..."
            options={dependencias.map(dep => ({ value: dep.id, label: `${dep.codigo} - ${dep.nombre}` }))}
          />
        </FormGroup>

        <FormGroup label="Serie Asociada" required isActive={activeField === 'serieId'}>
          <SearchableSelect 
            name="serieId" 
            value={data.serieId || ""} 
            onChange={handleSerieChange} 
            className={inputClass}
            disabled={filteredSeries.length === 0}
            placeholder="Seleccione una serie..."
            options={filteredSeries.map(s => ({ value: s.id, label: `${s.codigo} - ${s.nombre}` }))}
          />
        </FormGroup>

        <div className="md:col-span-2">
          <FormGroup label="Nombre de la Subserie" required isActive={activeField === 'nombre'}>
            <input name="nombre" value={data.nombre || ""} onChange={handleChange} className={inputClass} placeholder="Ej. Licitaciones Públicas" />
          </FormGroup>
        </div>

        <FormGroup label="Código" required isActive={activeField === 'codigo'}>
          <input name="codigo" value={data.codigo || ""} onChange={handleChange} className={inputClass} placeholder="Ej. 100-01-01" />
        </FormGroup>

        <div className="md:col-span-2">
          <FormGroup label="Tipos Documentales" required isActive={activeField === 'tipoDocumental'}>
            <textarea name="tipoDocumental" value={data.tipoDocumental || ""} onChange={handleChange} className={textareaClass} placeholder="Escriba los tipos documentales..." />
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
