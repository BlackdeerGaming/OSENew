import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import SearchableSelect from "../ui/SearchableSelect";
import { COLOMBIA_DEPARTAMENTOS, COLOMBIA_MUNICIPIOS } from "../../data/colombiaData";
import { Switch } from "../ui/Switch";
import { Info, PlusCircle, LayoutGrid, Search, X, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import ConfirmDeleteModal from "../ui/ConfirmDeleteModal";

export function FormGroup({ label, required, children, isActive, error }) {
  return (
    <div className="flex flex-col gap-1.5 relative focus-within:z-50 font-sans">
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
  errors = {},
  onDeleteDependencia
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

  const handleSelectDependencyForEdit = (e) => {
    const depId = e.target.value;
    if (!depId) {
      onChange({ pais: "Colombia", entidadId: selectedEntityId });
      return;
    }
    const dep = dependencias.find(d => String(d.id) === String(depId));
    if (dep) {
      onChange({ ...dep });
    }
  };

  // Determinar si mostrar dropdowns de Colombia
  const isColombia = data.pais === "Colombia";
  const departamentosOptions = COLOMBIA_DEPARTAMENTOS.map(d => ({ value: d, label: d }));
  
  const currentDeptCities = (data.departamento && COLOMBIA_MUNICIPIOS[data.departamento]) || [];
  
  // Determinar si la ciudad actual es "especial" (no está en el listado oficial)
  const isCityInList = React.useMemo(() => {
    if (!isColombia || !data.departamento || !data.ciudad) return true;
    return currentDeptCities.includes(data.ciudad);
  }, [isColombia, data.departamento, data.ciudad, currentDeptCities]);

  // Estado local para manejar la opción "Otro"
  const [showOtraCiudad, setShowOtraCiudad] = React.useState(false);
  const [manualCity, setManualCity] = React.useState("");

  // Sincronizar estado de "Otro" basado en la data entrante (útil para edición y herencia)
  React.useEffect(() => {
    if (isColombia && data.ciudad && !isCityInList) {
      if (!showOtraCiudad) {
        setShowOtraCiudad(true);
        setManualCity(data.ciudad);
      }
    } else if (isColombia && isCityInList && data.ciudad && data.ciudad !== "Otro") {
      if (showOtraCiudad) {
        setShowOtraCiudad(false);
      }
    }
  }, [data.ciudad, isCityInList, isColombia]);

  const handleCityChange = (e) => {
    const val = e.target.value;
    if (val === "Otro") {
      setShowOtraCiudad(true);
      setManualCity("");
      onChange({ ...data, ciudad: "" });
    } else {
      setShowOtraCiudad(false);
      onChange({ ...data, ciudad: val });
    }
  };

  const handleManualCityChange = (e) => {
    const val = e.target.value;
    setManualCity(val);
    onChange({ ...data, ciudad: val });
  };

  const ciudadesOptions = React.useMemo(() => {
    const opts = currentDeptCities.map(m => ({ value: m, label: m }));
    opts.push({ value: "Otro", label: "Otro (Especificar)" });
    return opts;
  }, [currentDeptCities]);

  const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors bg-white";

  // --- LOCAL LISTING AND FILTERING STATES ---
  const [isListExpanded, setIsListExpanded] = React.useState(true);
  const [filterSearch, setFilterSearch] = React.useState('');
  const [filterParent, setFilterParent] = React.useState('');
  const [filterLevel, setFilterLevel] = React.useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [recordToDelete, setRecordToDelete] = React.useState(null);
  const [deleteStatus, setDeleteStatus] = React.useState('idle');
  const [deleteErrorMsg, setDeleteErrorMsg] = React.useState('');

  // Active Entity Scoped Dependencias
  const activeDeps = React.useMemo(() => {
    return dependencias.filter(d => !d.entidadId || String(d.entidadId) === String(selectedEntityId));
  }, [dependencias, selectedEntityId]);

  // Filtering Logic
  const filteredDeps = React.useMemo(() => {
    return activeDeps.filter(d => {
      const matchesSearch = !filterSearch.trim() || 
        String(d.nombre).toLowerCase().includes(filterSearch.toLowerCase()) ||
        String(d.codigo).toLowerCase().includes(filterSearch.toLowerCase()) ||
        (d.sigla && String(d.sigla).toLowerCase().includes(filterSearch.toLowerCase()));

      const matchesParent = !filterParent || String(d.dependeDe) === String(filterParent);
      
      let matchesLevel = true;
      if (filterLevel === 'Principal') {
        matchesLevel = !d.dependeDe || d.dependeDe === 'ninguna';
      } else if (filterLevel === 'Subdependencia') {
        matchesLevel = d.dependeDe && d.dependeDe !== 'ninguna';
      }

      return matchesSearch && matchesParent && matchesLevel;
    });
  }, [activeDeps, filterSearch, filterParent, filterLevel]);

  // Handle Edit Action
  const handleEditClick = (record) => {
    onChange({ ...record });
  };

  // Handle Delete Confirmation
  const handleDeleteClick = (record) => {
    setRecordToDelete(record);
    setDeleteStatus('idle');
    setDeleteErrorMsg('');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleteStatus('loading');
    try {
      if (onDeleteDependencia) {
        await onDeleteDependencia(recordToDelete.id);
      }
      setDeleteStatus('success');
      setTimeout(() => {
        setDeleteModalOpen(false);
        setRecordToDelete(null);
      }, 1000);
    } catch (err) {
      setDeleteStatus('error');
      setDeleteErrorMsg(err.message || 'Error al eliminar la dependencia.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full relative max-w-7xl mx-auto font-sans">
      {/* Columna Izquierda: Formulario (40% en Desktop) */}
      <div className={cn(
        "w-full bg-card rounded-xl border border-border shadow-sm p-5 md:p-6 flex flex-col gap-5 bg-white transition-all duration-300",
        isListExpanded ? "lg:w-[480px] shrink-0" : "lg:flex-1"
      )}>
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
              onChange={handleSelectDependencyForEdit}
              placeholder="Buscar dependencia..."
              className="bg-white text-xs"
              options={[
                { value: "", label: "--- Crear Nueva Dependencia ---" },
                ...activeDeps.map(d => ({ 
                  value: d.id, 
                  label: `${d.codigo} - ${d.nombre} ${d.sigla ? `(${d.sigla})` : ""}` 
                }))
              ]}
            />
          </div>
          {data?.id && (
            <button 
              type="button"
              onClick={() => onChange({ pais: "Colombia", entidadId: selectedEntityId })} 
              className="flex items-center gap-2 px-4 py-2 bg-slate-250 hover:bg-slate-350 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Nuevo
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
              ) : "Nueva Dependencia"}
            </h2>
            <p className="text-sm text-muted-foreground">Estructura administrativa nivel superior.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
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

          <FormGroup label="Nombre Dependencia" required isActive={activeField === 'nombre'} error={errors.nombre}>
            <input 
              name="nombre" 
              value={data.nombre || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.nombre && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. Archivo Central" 
            />
          </FormGroup>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Ubicación y Contacto</h4>
                <p className="text-[11px] text-slate-500 font-medium">Define dónde se encuentra físicamente.</p>
              </div>
            </div>
            <Switch 
              checked={heredar} 
              onChange={handleHeredarChange} 
              label="Heredar"
            />
          </div>

          <FormGroup label="País" required isActive={activeField === 'pais'} error={errors.pais}>
            <SearchableSelect 
              name="pais" 
              value={data.pais || "Colombia"} 
              onChange={(e) => {
                const newPais = e.target.value;
                onChange({ ...data, pais: newPais, departamento: "", ciudad: "" });
                setShowOtraCiudad(false);
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
                placeholder="Provincia / Estado" 
              />
            )}
          </FormGroup>

          <div className="flex flex-col gap-4">
            <FormGroup label="Ciudad" required={isColombia} isActive={activeField === 'ciudad'} error={errors.ciudad}>
              {isColombia ? (
                <SearchableSelect
                  name="ciudad"
                  value={showOtraCiudad ? "Otro" : (data.ciudad || "")}
                  onChange={handleCityChange}
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
                  placeholder="Ciudad" 
                />
              )}
            </FormGroup>

            {isColombia && showOtraCiudad && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-1"
              >
                <FormGroup label="Escribe la ciudad" required error={errors.otraCiudad}>
                  <input 
                    type="text"
                    value={manualCity}
                    onChange={handleManualCityChange}
                    className={cn(inputClass, errors.otraCiudad && "border-destructive")}
                    placeholder="Ej. La Calera Rural"
                  />
                </FormGroup>
              </motion.div>
            )}
          </div>

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
              placeholder="Seleccione dependencia superior (opcional)..."
              options={[
                { value: "ninguna", label: "Ninguna / Es Principal" },
                ...activeDeps.filter(dep => String(dep.id) !== String(data.id)).map(dep => ({ value: dep.id, label: dep.nombre }))
              ]}
            />
          </FormGroup>
        </div>
      </div>

      {/* Columna Derecha / Drawer: Dependencias Creadas */}
      {/* 1. Cuando está CERRADO: Pestaña vertical en Desktop */}
      {!isListExpanded && (
        <div 
          onClick={() => setIsListExpanded(true)}
          className="hidden lg:flex lg:w-16 lg:h-[700px] shrink-0 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-sm select-none gap-4 group"
        >
          <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:-translate-x-1 transition-transform" />
          <span 
            className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Ver Dependencias
          </span>
          <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
            {activeDeps.length}
          </span>
        </div>
      )}

      {/* 2. Cuando está CERRADO: Botón simple en Móvil */}
      {!isListExpanded && (
        <button
          type="button"
          onClick={() => setIsListExpanded(true)}
          className="flex lg:hidden w-full items-center justify-between p-4 bg-slate-50 border border-slate-250 rounded-xl hover:bg-slate-100 cursor-pointer shadow-xs transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Ver Dependencias Creadas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full">{activeDeps.length}</span>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </div>
        </button>
      )}

      {/* 3. Cuando está ABIERTO: Desktop Panel lateral */}
      {isListExpanded && (
        <div className="hidden lg:flex lg:flex-1 lg:h-[700px] w-full bg-white border border-border rounded-xl shadow-sm p-5 md:p-6 flex flex-col transition-all duration-300 ease-in-out relative overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <LayoutGrid className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-foreground">Dependencias Creadas</h3>
                  <p className="text-xs text-muted-foreground">Listado de unidades de gestión bajo esta entidad activa.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsListExpanded(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <span>Contraer</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* List Body with Scroll */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 mt-4">
              {activeDeps.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-xs font-medium">No se han registrado dependencias para esta entidad.</p>
                  <p className="text-slate-300 text-[9px] font-bold uppercase tracking-widest mt-1">Usa el formulario para crear la primera</p>
                </div>
              ) : (
                <>
                  {/* Panel de Búsqueda y Filtros */}
                  <div className="flex flex-col gap-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/60 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por código, nombre, sigla..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-all shadow-sm"
                      />
                      {filterSearch && (
                        <button
                          type="button"
                          onClick={() => setFilterSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-650 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <select
                          value={filterParent}
                          onChange={(e) => setFilterParent(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                        >
                          <option value="">Dependencia Padre...</option>
                          {activeDeps.map(d => (
                            <option key={d.id} value={d.id}>{d.nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <select
                          value={filterLevel}
                          onChange={(e) => setFilterLevel(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                        >
                          <option value="">Nivel...</option>
                          <option value="Principal">Principal (Nivel Superior)</option>
                          <option value="Subdependencia">Subdependencia</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Listado en Tabla */}
                  <div className="border border-border/85 rounded-2xl overflow-hidden shadow-sm bg-white overflow-y-auto max-h-[420px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10 border-b border-border">
                        <tr>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Cód.</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Nombre</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Sigla</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Padre</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {filteredDeps.map(dep => {
                          const parentName = dep.dependeDe && dep.dependeDe !== 'ninguna'
                            ? activeDeps.find(d => String(d.id) === String(dep.dependeDe))?.nombre || dep.dependeDe
                            : '—';
                          return (
                            <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-primary">{dep.codigo}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{dep.nombre}</td>
                              <td className="py-3 px-4 font-medium text-slate-500 uppercase">{dep.sigla || '—'}</td>
                              <td className="py-3 px-4 text-slate-500 italic font-medium truncate max-w-[120px]">{parentName}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditClick(dep)}
                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClick(dep)}
                                    className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {filteredDeps.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-400 italic">No se encontraron dependencias con los filtros aplicados.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Cuando está ABIERTO: Mobile full drawer lateral overlay */}
      {isListExpanded && (
        <>
          <div 
            onClick={() => setIsListExpanded(false)}
            className="fixed inset-0 z-45 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity" 
          />
          <div className="fixed inset-y-0 right-0 z-50 w-[92%] md:w-[60%] lg:hidden bg-white shadow-2xl p-5 flex flex-col h-full border-l border-border transition-transform transform translate-x-0 duration-300 ease-out">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <LayoutGrid className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground">Dependencias Creadas</h3>
                    <p className="text-xs text-muted-foreground">Listado de dependencias.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsListExpanded(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <span>Cerrar</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* List Body with Scroll */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 mt-4">
                {activeDeps.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 text-xs font-medium">No se han registrado dependencias para esta entidad.</p>
                    <p className="text-slate-300 text-[9px] font-bold uppercase tracking-widest mt-1">Usa el formulario para crear la primera</p>
                  </div>
                ) : (
                  <>
                    {/* Panel de Búsqueda y Filtros */}
                    <div className="flex flex-col gap-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/60 shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por código, nombre, sigla..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="w-full bg-white border border-slate-250 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-all shadow-sm"
                        />
                        {filterSearch && (
                          <button
                            type="button"
                            onClick={() => setFilterSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-650 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <select
                            value={filterParent}
                            onChange={(e) => setFilterParent(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                          >
                            <option value="">Dependencia Padre...</option>
                            {activeDeps.map(d => (
                              <option key={d.id} value={d.id}>{d.nombre}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <select
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                          >
                            <option value="">Nivel...</option>
                            <option value="Principal">Principal (Nivel Superior)</option>
                            <option value="Subdependencia">Subdependencia</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Listado en Tabla */}
                    <div className="border border-border/85 rounded-2xl overflow-hidden shadow-sm bg-white overflow-y-auto max-h-[350px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10 border-b border-border">
                          <tr>
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Cód.</th>
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Nombre</th>
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {filteredDeps.map(dep => (
                            <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-primary">{dep.codigo}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{dep.nombre}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsListExpanded(false);
                                      handleEditClick(dep);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteClick(dep);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {filteredDeps.length === 0 && (
                            <tr>
                              <td colSpan="3" className="py-8 text-center text-slate-400 italic">No se encontraron dependencias.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar Dependencia?"
        message="¿Seguro que deseas eliminar este registro? Esta acción puede afectar información relacionada."
        confirmText="Eliminar Dependencia"
        status={deleteStatus}
        errorMsg={deleteErrorMsg}
        details={recordToDelete ? {
          dependencia: `${recordToDelete.codigo} - ${recordToDelete.nombre}`,
          serie: recordToDelete.sigla ? `Sigla: ${recordToDelete.sigla}` : "Sin sigla",
          subserie: recordToDelete.dependeDe && recordToDelete.dependeDe !== 'ninguna' ? "Subdependencia" : "Dependencia Superior"
        } : null}
      />
    </div>
  );
}
