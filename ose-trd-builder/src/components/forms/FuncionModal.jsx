import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Loader2 } from "lucide-react";
import SearchableSelect from "../ui/SearchableSelect";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";

const inputClass = "w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-all placeholder:text-muted-foreground shadow-sm h-10";
const textareaClass = "w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-all placeholder:text-muted-foreground shadow-sm min-h-[100px] resize-y";

const FormGroup = ({ label, required, children, error }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-foreground flex items-center gap-1">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {error && <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</span>}
  </div>
);

export default function FuncionModal({ 
  isOpen, 
  onClose, 
  onSave, 
  dependencias = [], 
  entities = [],
  currentUser,
  editData = null 
}) {
  const [formData, setFormData] = useState({
    proyecto_nombre: "",
    proyecto_sigla: "",
    dependencia_id: "",
    sigla: "",
    codigo: "",
    titulo: "",
    codigo_funcion: "",
    descripcion: ""
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData(editData);
      } else {
        setFormData({
          proyecto_nombre: "",
          proyecto_sigla: "",
          dependencia_id: "",
          sigla: "", // Will be filled
          codigo: "", // Will be filled
          titulo: "",
          codigo_funcion: "",
          descripcion: ""
        });
      }
      setErrors({});
    }
  }, [isOpen, editData]);

  if (!isOpen) return null;

  // Encontrar nombre de la entidad del usuario actual
  const currentEntity = entities.find(e => e.id === currentUser?.entity_id);
  const entityName = currentEntity ? currentEntity.razonSocial : "Sin Entidad";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
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
    if (errors.dependencia_id) {
      setErrors(prev => ({ ...prev, dependencia_id: null }));
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!formData.titulo.trim()) newErrors.titulo = "El título de la función es obligatorio";
    if (!formData.dependencia_id) newErrors.dependencia_id = "Debe seleccionar una dependencia";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        titulo: formData.titulo,
        codigo_funcion: formData.codigo_funcion,
        descripcion: formData.descripcion,
        dependencia_id: formData.dependencia_id,
        proyecto_nombre: formData.proyecto_nombre,
        proyecto_sigla: formData.proyecto_sigla
      };

      const url = `${API_BASE_URL}/trd/entity/${currentUser.entity_id}/funciones`;
      const method = editData ? "PUT" : "POST";
      const finalUrl = editData ? `${url}/${editData.id}` : url;

      const response = await fetch(finalUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Error al guardar la función");
      }

      const result = await response.json();
      // Refetch or notify parent
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
            <h2 className="text-xl font-bold tracking-tight text-foreground">{editData ? "Editar Función" : "Crear Función"}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Complete los detalles de la función administrativa.</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
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
            <FormGroup label="Nombre Proyecto">
              <input 
                name="proyecto_nombre" 
                value={formData.proyecto_nombre} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="Opcional" 
              />
            </FormGroup>

            <FormGroup label="Sigla Proyecto">
              <input 
                name="proyecto_sigla" 
                value={formData.proyecto_sigla} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="Ej. PROY-01" 
              />
            </FormGroup>

            {/* Row 3 */}
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

            {/* Row 4 */}
            <FormGroup label="Sigla (Dependencia)">
              <input 
                type="text" 
                value={formData.sigla || ""} 
                readOnly 
                className={cn(inputClass, "bg-secondary text-muted-foreground cursor-not-allowed border-dashed")} 
                placeholder="Auto"
              />
            </FormGroup>

            <FormGroup label="Código (Dependencia)">
              <input 
                type="text" 
                value={formData.codigo || ""} 
                readOnly 
                className={cn(inputClass, "bg-secondary text-muted-foreground cursor-not-allowed border-dashed")} 
                placeholder="Auto"
              />
            </FormGroup>

            {/* Row 5 */}
            <div className="md:col-span-2">
              <FormGroup label="Título de la Función" required error={errors.titulo}>
                <input 
                  name="titulo" 
                  value={formData.titulo} 
                  onChange={handleChange} 
                  className={inputClass} 
                  placeholder="Ej. Dirigir, coordinar y controlar las políticas..." 
                />
              </FormGroup>
            </div>

            {/* Row 6 */}
            <div className="md:col-span-2">
              <FormGroup label="Código de la Función">
                <input 
                  name="codigo_funcion" 
                  value={formData.codigo_funcion || ""} 
                  onChange={handleChange} 
                  className={inputClass} 
                  placeholder="Ej. F-001 (Opcional)" 
                />
              </FormGroup>
            </div>

            {/* Row 7 */}
            <div className="md:col-span-2">
              <FormGroup label="Descripción">
                <textarea 
                  name="descripcion" 
                  value={formData.descripcion || ""} 
                  onChange={handleChange} 
                  className={textareaClass} 
                  placeholder="Detalles adicionales sobre la función administrativa..." 
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
            {loading ? "Guardando..." : "Guardar Función"}
          </button>
        </div>

      </div>
    </div>
  );
}
