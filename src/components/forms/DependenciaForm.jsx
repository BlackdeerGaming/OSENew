import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import SearchableSelect from "../ui/SearchableSelect";
import { COLOMBIA_DEPARTAMENTOS, COLOMBIA_MUNICIPIOS } from "../../data/colombiaData";
import { Checkbox } from "../ui/Checkbox";
import { Info } from "lucide-react";

export function FormGroup({ label, required, children, isActive, error }) {
  return (
    <div className="flex flex-col gap-1.5 relative focus-within:z-50">
      <label className={cn(
        "text-sm font-semibold flex items-center gap-1",
        error ? "text-destructive" : "text-foreground/80"
      )}>
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
            isActive ? "ring-2 ring-primary/40 ring-offset-1 block relative z-0" : "relative z-0",
            error ? "ring-2 ring-destructive/40" : ""
          )}
        >
          {children}
        </motion.div>
        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-bold text-destructive mt-1 flex items-center gap-1"
          >
            <span className="h-1 w-1 rounded-full bg-destructive" /> {error}
          </motion.p>
        )}
      </div>
    </div>
  );
}

export default function DependenciaForm({ 
  data, 
  onChange, 
  activeField, 
  dependencias = [], 
  entities = [], 
  currentUser = null,
  selectedEntityId = null,
  errors = {}
}) {
  const [heredar, setHeredar] = React.useState(false);

  const currentEntity = React.useMemo(() => {
    return entities.find(e => String(e.id) === String(selectedEntityId));
  }, [entities, selectedEntityId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    onChange({ ...data, [name]: val });
  };

  const handleHeredarChange = (checked) => {
    setHeredar(checked);
    if (checked && currentEntity) {
      onChange({
        ...data,
        pais: currentEntity.pais || "Colombia",
        departamento: currentEntity.departamento || "",
        ciudad: currentEntity.ciudad || "",
        direccion: currentEntity.direccion || "",
        telefono: currentEntity.telefono || currentEntity.celular || ""
      });
    }
  };

  // Determinar si mostrar dropdowns de Colombia
  const isColombia = data.pais === "Colombia";
  const departamentosOptions = COLOMBIA_DEPARTAMENTOS.map(d => ({ value: d, label: d }));
  const ciudadesOptions = (data.departamento && COLOMBIA_MUNICIPIOS[data.departamento]) 
    ? COLOMBIA_MUNICIPIOS[data.departamento].map(m => ({ value: m, label: m }))
    : [];

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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            + Nueva Dependencia
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
          <FormGroup label="Nombre Dependencia" required isActive={activeField === 'nombre'} error={errors.nombre}>
            <input 
              name="nombre" 
              value={data.nombre || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.nombre && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. Archivo Central" 
            />
          </FormGroup>
        </div>

        <FormGroup label="Sigla" isActive={activeField === 'sigla'} error={errors.sigla}>
          <input name="sigla" value={data.sigla || ""} onChange={handleChange} className={inputClass} placeholder="Ej. AC" />
        </FormGroup>

        <FormGroup label="Código" required isActive={activeField === 'codigo'} error={errors.codigo}>
          <input 
            name="codigo" 
            value={data.codigo || ""} 
            onChange={handleChange} 
            className={cn(inputClass, errors.codigo && "border-destructive focus-visible:ring-destructive")} 
            placeholder="Ej. 100" 
          />
        </FormGroup>

        <div className="md:col-span-2 bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Ubicación y Contacto</h4>
              <p className="text-[11px] text-slate-500 font-medium">Define dónde se encuentra físicamente esta dependencia.</p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer group bg-white px-4 py-2 rounded-lg border border-primary/20 shadow-sm hover:border-primary transition-all">
            <input 
              type="checkbox" 
              checked={heredar} 
              onChange={(e) => handleHeredarChange(e.target.checked)} 
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Heredar datos de Entidad</span>
          </label>
        </div>

        <FormGroup label="País" required isActive={activeField === 'pais'} error={errors.pais}>
          <SearchableSelect 
            name="pais" 
            value={data.pais || "Colombia"} 
            onChange={(e) => {
              const newPais = e.target.value;
              onChange({ ...data, pais: newPais, departamento: "", ciudad: "" });
            }} 
            className={cn(inputClass, errors.pais && "border-destructive")}
            placeholder="Seleccione un país..."
            options={[
              { value: "Colombia", label: "Colombia" },
              { value: "Argentina", label: "Argentina" },
              { value: "Bolivia", label: "Bolivia" },
              { value: "Brasil", label: "Brasil" },
              { value: "Chile", label: "Chile" },
              { value: "Costa Rica", label: "Costa Rica" },
              { value: "Ecuador", label: "Ecuador" },
              { value: "El Salvador", label: "El Salvador" },
              { value: "España", label: "España" },
              { value: "Estados Unidos", label: "Estados Unidos" },
              { value: "Guatemala", label: "Guatemala" },
              { value: "Honduras", label: "Honduras" },
              { value: "México", label: "México" },
              { value: "Nicaragua", label: "Nicaragua" },
              { value: "Panamá", label: "Panamá" },
              { value: "Paraguay", label: "Paraguay" },
              { value: "Perú", label: "Perú" },
              { value: "Puerto Rico", label: "Puerto Rico" },
              { value: "República Dominicana", label: "República Dominicana" },
              { value: "Uruguay", label: "Uruguay" },
              { value: "Venezuela", label: "Venezuela" },
              { value: "Otro", label: "Otro" }
            ]}
          />
        </FormGroup>

        <FormGroup label="Departamento" required={isColombia} isActive={activeField === 'departamento'} error={errors.departamento}>
          {isColombia ? (
            <SearchableSelect
              name="departamento"
              value={data.departamento || ""}
              onChange={(e) => onChange({ ...data, departamento: e.target.value, ciudad: "" })}
              className={cn(inputClass, errors.departamento && "border-destructive")}
              options={departamentosOptions}
              placeholder="Seleccione departamento..."
            />
          ) : (
            <input 
              name="departamento" 
              value={data.departamento || ""} 
              onChange={handleChange} 
              className={inputClass} 
              placeholder="Provincia / Estado / Región" 
            />
          )}
        </FormGroup>

        <FormGroup label="Ciudad" required={isColombia} isActive={activeField === 'ciudad'} error={errors.ciudad}>
          {isColombia ? (
            <SearchableSelect
              name="ciudad"
              value={data.ciudad || ""}
              onChange={handleChange}
              className={cn(inputClass, errors.ciudad && "border-destructive")}
              options={ciudadesOptions}
              placeholder={data.departamento ? "Seleccione ciudad..." : "Primero elija departamento"}
              disabled={!data.departamento}
            />
          ) : (
            <input 
              name="ciudad" 
              value={data.ciudad || ""} 
              onChange={handleChange} 
              className={inputClass} 
              placeholder="Ciudad / Municipio" 
            />
          )}
        </FormGroup>

        <FormGroup label="Dirección" required isActive={activeField === 'direccion'} error={errors.direccion}>
          <input 
            name="direccion" 
            value={data.direccion || ""} 
            onChange={handleChange} 
            className={cn(inputClass, errors.direccion && "border-destructive focus-visible:ring-destructive")} 
          />
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
    </div>
  );
}
