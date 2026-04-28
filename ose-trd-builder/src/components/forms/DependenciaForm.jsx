import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import SearchableSelect from "../ui/SearchableSelect";

export function FormGroup({ label, required, children, isActive }) {
  return (
    <div className="flex flex-col gap-1.5 relative focus-within:z-50">
      <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="relative">
        <motion.div
          animate={isActive ? {
            boxShadow: ["0px 0px 0px 0px rgba(var(--color-primary), 0)", "0px 0px 0px 2px rgba(var(--color-primary), 0.5)", "0px 0px 0px 0px rgba(var(--color-primary), 0)"],
          } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className={cn(
            "rounded-md transition-all",
            isActive ? "ring-2 ring-primary/40 ring-offset-1 block relative z-0" : "relative z-0"
          )}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export default function DependenciaForm({ data, onChange, activeField, dependencias = [] }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors";

  return (
    <div className="flex flex-col gap-6 p-6 bg-card rounded-xl border border-border shadow-sm max-w-4xl w-full mx-auto">
      <div className="border-b border-border pb-4 mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {data?.id ? "Editar Dependencia" : "Nueva Dependencia"}
          </h2>
          <p className="text-sm text-muted-foreground">Estructura administrativa nivel superior.</p>
        </div>
        {data?.id && (
          <button 
            onClick={() => onChange({})} 
            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-all"
          >
            NUEVA DEPENDENCIA
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div className="md:col-span-2">
          <FormGroup label="Nombre Dependencia" required isActive={activeField === 'nombre'}>
            <input name="nombre" value={data.nombre || ""} onChange={handleChange} className={inputClass} placeholder="Ej. Archivo Central" />
          </FormGroup>
        </div>

        <FormGroup label="Sigla" isActive={activeField === 'sigla'}>
          <input name="sigla" value={data.sigla || ""} onChange={handleChange} className={inputClass} placeholder="Ej. AC" />
        </FormGroup>

        <FormGroup label="Código" required isActive={activeField === 'codigo'}>
          <input name="codigo" value={data.codigo || ""} onChange={handleChange} className={inputClass} placeholder="Ej. 100" />
        </FormGroup>

        <FormGroup label="País" required isActive={activeField === 'pais'}>
          <select name="pais" value={data.pais || "Colombia"} onChange={handleChange} className={inputClass}>
            <option value="Colombia">Colombia</option>
            <option value="Otra">Otra</option>
          </select>
        </FormGroup>

        <FormGroup label="Departamento" required isActive={activeField === 'departamento'}>
          <input name="departamento" value={data.departamento || ""} onChange={handleChange} className={inputClass} placeholder="Ej. Cundinamarca" />
        </FormGroup>

        <FormGroup label="Ciudad" required isActive={activeField === 'ciudad'}>
          <input name="ciudad" value={data.ciudad || ""} onChange={handleChange} className={inputClass} placeholder="Ej. Bogotá" />
        </FormGroup>

        <FormGroup label="Dirección" required isActive={activeField === 'direccion'}>
          <input name="direccion" value={data.direccion || ""} onChange={handleChange} className={inputClass} />
        </FormGroup>

        <FormGroup label="Teléfono" isActive={activeField === 'telefono'}>
          <input name="telefono" value={data.telefono || ""} onChange={handleChange} className={inputClass} />
        </FormGroup>

        <FormGroup label="Depende de" isActive={activeField === 'dependeDe'}>
          <SearchableSelect 
            name="dependeDe" 
            value={data.dependeDe || ""} 
            onChange={handleChange} 
            className={inputClass}
            placeholder="Seleccione una dependencia base (opcional)..."
            options={[
              { value: "ninguna", label: "Ninguna / Es Principal" },
              ...dependencias.map(dep => ({ value: dep.id, label: dep.nombre }))
            ]}
          />
        </FormGroup>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6 border-t border-border mt-4">
        <button 
          onClick={() => onChange({})} 
          className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
        >
          Limpiar
        </button>
        <button 
          onClick={() => onChange({ ...data, _save: true })} 
          className="px-10 py-2.5 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95"
        >
          {data?.id ? "Actualizar Dependencia" : "Guardar Dependencia"}
        </button>
      </div>
    </div>
  );
}
