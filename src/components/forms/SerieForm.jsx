import React from "react";
import { cn } from "@/lib/utils";
import { FormGroup } from "./DependenciaForm";
import SearchableSelect from "../ui/SearchableSelect";
import { LayoutGrid, PlusCircle } from "lucide-react";

export const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:bg-secondary/50";
export const textareaClass = "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors";

export default function SerieForm({ 
  data, 
  onChange, 
  activeField, 
  dependencias = [], 
  series = [],
  entities = [], 
  currentUser = null, 
  errors = {} 
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  const handleSelectSerieForEdit = (e) => {
    const serId = e.target.value;
    if (!serId) {
      onChange({ entidadId: data.entidadId });
      return;
    }
    const ser = series.find(s => String(s.id) === String(serId));
    if (ser) {
      onChange({ ...ser });
    }
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
            onChange={handleSelectSerieForEdit}
            placeholder="Buscar serie para editar..."
            className="bg-white"
            options={[
              { value: "", label: "--- Crear Nueva Serie ---" },
              ...series.map(s => {
                return { 
                  value: s.id, 
                  label: `${s.codigo} - ${s.nombre}` 
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
            ) : "Nueva Serie Documental"}
          </h2>
          <p className="text-sm text-muted-foreground">Conjunto de unidades documentales de estructura y contenido homogéneos.</p>
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
            placeholder="Ej. 100" 
          />
        </FormGroup>
      </div>
    </div>
  );
}
