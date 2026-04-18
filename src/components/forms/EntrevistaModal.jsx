import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Loader2 } from "lucide-react";
import SearchableSelect from "../ui/SearchableSelect";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";

const inputClass = "w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-all placeholder:text-muted-foreground shadow-sm h-10";

const FormGroup = ({ label, required, children, error }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-foreground flex items-center gap-1">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {error && <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</span>}
  </div>
);

export default function EntrevistaModal({ 
  isOpen, 
  onClose, 
  onSave, 
  dependencias = [], 
  entities = [],
  currentUser,
  editData = null 
}) {
  const activeEntityId = entities?.[0]?.id || currentUser?.entity_id;

  const [formData, setFormData] = useState({
    dependencia_id: "",
    sigla: "",
    codigo: "",
    fecha_entrevista: "",
    // Entrevistado Datos
    entrevistado_id: "",
    entrevistado_nombres: "",
    entrevistado_apellidos: "",
    entrevistado_cargo: ""
  });

  const [entrevistadosList, setEntrevistadosList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && activeEntityId) {
      loadEntrevistados();
    }
  }, [isOpen, activeEntityId]);

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // Find existing dependency data
        const dep = dependencias.find(d => d.id === editData.dependencia_id);
        setFormData({
          dependencia_id: editData.dependencia_id || "",
          sigla: dep ? dep.sigla : "",
          codigo: dep ? dep.codigo : "",
          fecha_entrevista: editData.fecha_entrevista || "",
          entrevistado_id: editData.entrevistado_id || "",
          entrevistado_nombres: editData.entrevistado?.nombres || "",
          entrevistado_apellidos: editData.entrevistado?.apellidos || "",
          entrevistado_cargo: editData.entrevistado?.cargo || ""
        });
      } else {
        const today = new Date().toISOString().split('T')[0];
        setFormData({
          dependencia_id: "",
          sigla: "", 
          codigo: "", 
          fecha_entrevista: today,
          entrevistado_id: "",
          entrevistado_nombres: "",
          entrevistado_apellidos: "",
          entrevistado_cargo: ""
        });
      }
      setErrors({});
    }
  }, [isOpen, editData, dependencias]);

  const loadEntrevistados = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/entrevistados`, {
        headers: { "Authorization": `Bearer ${currentUser?.token || ''}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setEntrevistadosList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const currentEntity = entities.find(e => e.id === activeEntityId);
  const entityName = currentEntity ? currentEntity.razonSocial : "Sin Entidad";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleDependenciaChange = (e) => {
    const depId = e.target.value;
    const dep = dependencias.find(d => d.id === depId);
    setFormData(prev => ({ 
      ...prev, 
      dependencia_id: depId,
      sigla: dep ? dep.sigla : prev.sigla,
      codigo: dep ? dep.codigo : prev.codigo
    }));
    if (errors.dependencia_id) setErrors(prev => ({ ...prev, dependencia_id: null }));
  };

  const handleEntrevistadoChange = (e) => {
    const pId = e.target.value;
    if (!pId) {
       setFormData(prev => ({ 
         ...prev, 
         entrevistado_id: "",
         entrevistado_nombres: "",
         entrevistado_apellidos: "",
         entrevistado_cargo: ""
       }));
       return;
    }
    const found = entrevistadosList.find(x => x.id === pId);
    setFormData(prev => ({ 
      ...prev, 
      entrevistado_id: pId,
      entrevistado_nombres: found ? found.nombres : prev.entrevistado_nombres,
      entrevistado_apellidos: found ? found.apellidos : prev.entrevistado_apellidos,
      entrevistado_cargo: found ? found.cargo : prev.entrevistado_cargo
    }));
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!formData.dependencia_id) newErrors.dependencia_id = "Seleccione una dependencia";
    if (!formData.fecha_entrevista) newErrors.fecha_entrevista = "La fecha es obligatoria";
    if (!formData.entrevistado_nombres.trim()) newErrors.entrevistado_nombres = "Escriba los nombres";
    if (!formData.entrevistado_apellidos.trim()) newErrors.entrevistado_apellidos = "Escriba los apellidos";
    if (!formData.entrevistado_cargo.trim()) newErrors.entrevistado_cargo = "El cargo es obligatorio";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (!activeEntityId) throw new Error("Entidad no seleccionada");

      // Payload building based on Pydantic route expectations
      const payload = {
        dependencia_id: formData.dependencia_id,
        fecha_entrevista: formData.fecha_entrevista,
        entrevistado: {
            id: formData.entrevistado_id || null, // null if it's a new or manual text entry
            nombres: formData.entrevistado_nombres,
            apellidos: formData.entrevistado_apellidos,
            cargo: formData.entrevistado_cargo
        }
      };

      const url = `${API_BASE_URL}/trd/entity/${activeEntityId}/entrevistas`;
      const method = editData ? "PUT" : "POST";
      const finalUrl = editData ? `${url}/${editData.id}` : url;

      const response = await fetch(finalUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Error al guardar la entrevista");
      }

      const result = await response.json();
      onSave(result);
      onClose();
    } catch (err) {
      console.error(err);
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm shadow-2xl">
      <div className="bg-card border border-border w-full max-w-3xl rounded-xl shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{editData ? "Editar Entrevista" : "Nueva Entrevista"}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Gestión de entrevistas del proceso TRD.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {errors.form && (
            <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-3 border border-destructive/20 font-medium">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{errors.form}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-8">
            {/* Row 1 */}
            <div className="md:col-span-2">
              <FormGroup label="Nombre Entidad">
                <input 
                  type="text" 
                  value={entityName} 
                  readOnly 
                  className={cn(inputClass, "bg-secondary text-muted-foreground cursor-not-allowed border-dashed")} 
                />
              </FormGroup>
            </div>

            {/* Row 2 */}
            <div className="md:col-span-2">
              <FormGroup label="Nombre Dependencia" required error={errors.dependencia_id}>
                <SearchableSelect 
                  name="dependencia_id" 
                  value={formData.dependencia_id || ""} 
                  onChange={handleDependenciaChange} 
                  className={inputClass}
                  placeholder="Seleccione la dependencia productora..."
                  options={dependencias.map(dep => ({ value: dep.id, label: `${dep.codigo} - ${dep.nombre}` }))}
                />
              </FormGroup>
            </div>

            {/* Row 3 */}
            <FormGroup label="Sigla">
              <input 
                type="text" 
                value={formData.sigla || ""} 
                readOnly 
                className={cn(inputClass, "bg-secondary text-muted-foreground cursor-not-allowed border-dashed")} 
                placeholder="Auto"
              />
            </FormGroup>

            <FormGroup label="Código">
              <input 
                type="text" 
                value={formData.codigo || ""} 
                readOnly 
                className={cn(inputClass, "bg-secondary text-muted-foreground cursor-not-allowed border-dashed")} 
                placeholder="Auto"
              />
            </FormGroup>

            {/* Row 4 */}
            <div className="md:col-span-2">
               <FormGroup label="Fecha entrevista" required error={errors.fecha_entrevista}>
                 <input 
                   type="date"
                   name="fecha_entrevista" 
                   value={formData.fecha_entrevista} 
                   onChange={handleChange} 
                   className={inputClass} 
                 />
               </FormGroup>
            </div>
          </div>

          <h3 className="text-xl font-bold tracking-tight text-foreground mb-4">Datos Entrevistado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
             <div className="md:col-span-2">
                <FormGroup label="Buscar Entrevistado">
                  <SearchableSelect 
                    name="entrevistado_id" 
                    value={formData.entrevistado_id || ""} 
                    onChange={handleEntrevistadoChange} 
                    className={inputClass}
                    placeholder="Escriba para buscar o deje en blanco para uno nuevo..."
                    options={entrevistadosList.map(e => ({ value: e.id, label: `${e.nombres} ${e.apellidos} - ${e.cargo}` }))}
                  />
                </FormGroup>
             </div>

             <FormGroup label="Nombres Entrevistado" required error={errors.entrevistado_nombres}>
               <input 
                 name="entrevistado_nombres" 
                 value={formData.entrevistado_nombres} 
                 onChange={handleChange} 
                 className={inputClass} 
                 placeholder="Nombres"
               />
             </FormGroup>

             <FormGroup label="Apellidos Entrevistado" required error={errors.entrevistado_apellidos}>
               <input 
                 name="entrevistado_apellidos" 
                 value={formData.entrevistado_apellidos} 
                 onChange={handleChange} 
                 className={inputClass} 
                 placeholder="Apellidos"
               />
             </FormGroup>

             <div className="md:col-span-2">
               <FormGroup label="Cargo Entrevistado" required error={errors.entrevistado_cargo}>
                 <input 
                   name="entrevistado_cargo" 
                   value={formData.entrevistado_cargo} 
                   onChange={handleChange} 
                   className={inputClass} 
                   placeholder="Ej. Director Archivo"
                 />
               </FormGroup>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-secondary/30 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary border border-transparent hover:border-border transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>

      </div>
    </div>
  );
}
