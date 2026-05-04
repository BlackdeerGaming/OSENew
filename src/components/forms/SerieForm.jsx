import React from "react";
import { FormGroup } from "./DependenciaForm";
import SearchableSelect from "../ui/SearchableSelect";

export const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:bg-secondary/50";
export const textareaClass = "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors";

export default function SerieForm({ data, onChange, activeField, dependencias = [], entities = [], currentUser = null, errors = {} }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-card rounded-xl border border-border shadow-sm max-w-4xl w-full mx-auto">
      <div className="border-b border-border pb-4 mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {data?.id ? "Editar Serie Documental" : "Nueva Serie Documental"}
          </h2>
          <p className="text-sm text-muted-foreground">Conjunto de unidades documentales de estructura y contenido homogéneos.</p>
        </div>
        {data?.id && (
          <button 
            onClick={() => onChange({})} 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            + Nueva Serie
          </button>
        )}
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

        <div className="md:col-span-2">
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
        </div>

        <div className="md:col-span-2">
          <FormGroup label="Nombre de la Serie" required isActive={activeField === 'nombre'} error={errors.nombre}>
            <input 
              name="nombre" 
              value={data.nombre || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.nombre && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. Actas" 
            />
          </FormGroup>
        </div>

        <FormGroup label="Código" required isActive={activeField === 'codigo'} error={errors.codigo}>
          <input 
            name="codigo" 
            value={data.codigo || ""} 
            onChange={handleChange} 
            className={cn(inputClass, errors.codigo && "border-destructive focus-visible:ring-destructive")} 
            placeholder="Ej. 100-01" 
          />
        </FormGroup>

        <div className="md:col-span-2">
          <FormGroup label="Tipos Documentales" required isActive={activeField === 'tipoDocumental'} error={errors.tipoDocumental}>
            <textarea 
              name="tipoDocumental" 
              value={data.tipoDocumental || ""} 
              onChange={handleChange} 
              className={cn(textareaClass, errors.tipoDocumental && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Escriba los tipos documentales separados por coma..." 
            />
          </FormGroup>
        </div>

        <div className="md:col-span-2">
          <FormGroup label="Descripción" isActive={activeField === 'descripcion'}>
            <textarea name="descripcion" value={data.descripcion || ""} onChange={handleChange} className={textareaClass} placeholder="Breve descripción del propósito de la serie..." />
          </FormGroup>
        </div>
      </div>
    </div>
  );
}
