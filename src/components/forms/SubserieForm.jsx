import React from "react";
import { cn } from "@/lib/utils";
import { FormGroup } from "./DependenciaForm";
import { inputClass } from "./SerieForm";
import SearchableSelect from "../ui/SearchableSelect";
import { LayoutGrid, PlusCircle, Search, X, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import ConfirmDeleteModal from "../ui/ConfirmDeleteModal";

export default function SubserieForm({ 
  data, 
  onChange, 
  activeField, 
  dependencias = [], 
  series = [], 
  subseries = [],
  entities = [], 
  currentUser = null, 
  selectedEntityId = null,
  errors = {},
  onDeleteSubserie
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  const handleSelectSubserieForEdit = (e) => {
    const subId = e.target.value;
    if (!subId) {
      onChange({ entidadId: selectedEntityId });
      return;
    }
    const sub = subseries.find(s => String(s.id) === String(subId));
    if (sub) {
      onChange({ ...sub });
    }
  };

  // --- LOCAL LISTING AND FILTERING STATES ---
  const [isListExpanded, setIsListExpanded] = React.useState(true);
  const [filterSearch, setFilterSearch] = React.useState('');
  const [filterDep, setFilterDep] = React.useState('');
  const [filterSer, setFilterSer] = React.useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [recordToDelete, setRecordToDelete] = React.useState(null);
  const [deleteStatus, setDeleteStatus] = React.useState('idle');
  const [deleteErrorMsg, setDeleteErrorMsg] = React.useState('');

  // Active Entity Scoped Data
  const activeDeps = React.useMemo(() => {
    return dependencias.filter(d => !d.entidadId || String(d.entidadId) === String(selectedEntityId));
  }, [dependencias, selectedEntityId]);

  const activeSeries = React.useMemo(() => {
    return series.filter(s => !s.entidadId || String(s.entidadId) === String(selectedEntityId));
  }, [series, selectedEntityId]);

  const activeSubseries = React.useMemo(() => {
    return subseries.filter(sub => !sub.entidadId || String(sub.entidadId) === String(selectedEntityId));
  }, [subseries, selectedEntityId]);

  // Filtering and Hierarchical Sorting Logic
  const filteredSubseries = React.useMemo(() => {
    const list = activeSubseries.filter(sub => {
      const matchesSearch = !filterSearch.trim() || 
        String(sub.nombre).toLowerCase().includes(filterSearch.toLowerCase()) ||
        String(sub.codigo).toLowerCase().includes(filterSearch.toLowerCase());

      const matchesDep = !filterDep || String(sub.dependenciaId) === String(filterDep);
      const matchesSer = !filterSer || String(sub.serieId) === String(filterSer);

      return matchesSearch && matchesDep && matchesSer;
    });

    const compareCodes = (a, b) => {
      const codeA = String(a || "").replace(/\s+/g, "");
      const codeB = String(b || "").replace(/\s+/g, "");
      const numA = parseFloat(codeA);
      const numB = parseFloat(codeB);
      const isNumA = !isNaN(numA) && isFinite(numA);
      const isNumB = !isNaN(numB) && isFinite(numB);
      if (isNumA && isNumB) {
        if (numA !== numB) return numA - numB;
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      }
      if (isNumA) return -1;
      if (isNumB) return 1;
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    };

    // Sort hierarchically: Dependencia -> Serie -> Subserie
    return [...list].sort((a, b) => {
      const depA = activeDeps.find(d => String(d.id) === String(a.dependenciaId));
      const depB = activeDeps.find(d => String(d.id) === String(b.dependenciaId));
      if (depA && depB && depA.id !== depB.id) {
        return compareCodes(depA.codigo, depB.codigo);
      }

      const serA = activeSeries.find(s => String(s.id) === String(a.serieId));
      const serB = activeSeries.find(s => String(s.id) === String(b.serieId));
      if (serA && serB && serA.id !== serB.id) {
        return compareCodes(serA.codigo, serB.codigo);
      }

      return compareCodes(a.codigo, b.codigo);
    });
  }, [activeSubseries, activeDeps, activeSeries, filterSearch, filterDep, filterSer]);

  // Cascade filter series based on selected filter dependency
  const filteredFilterSeries = React.useMemo(() => {
    if (!filterDep) return activeSeries;
    return activeSeries.filter(s => String(s.dependenciaId) === String(filterDep));
  }, [activeSeries, filterDep]);

  // Reset filter series when filter dependency changes to avoid invalid combinations
  React.useEffect(() => {
    setFilterSer('');
  }, [filterDep]);

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
      if (onDeleteSubserie) {
        await onDeleteSubserie(recordToDelete.id);
      }
      setDeleteStatus('success');
      setTimeout(() => {
        setDeleteModalOpen(false);
        setRecordToDelete(null);
      }, 1000);
    } catch (err) {
      setDeleteStatus('error');
      setDeleteErrorMsg(err.message || 'Error al eliminar la subserie.');
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
              onChange={handleSelectSubserieForEdit}
              placeholder="Buscar subserie..."
              className="bg-white text-xs"
              options={[
                { value: "", label: "--- Crear Nueva Subserie ---" },
                ...activeSubseries.map(s => ({ 
                  value: s.id, 
                  label: `${s.codigo} - ${s.nombre}` 
                }))
              ]}
            />
          </div>
          {data?.id && (
            <button 
              type="button"
              onClick={() => onChange({ entidadId: selectedEntityId })} 
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
              ) : "Nueva Subserie Documental"}
            </h2>
            <p className="text-sm text-muted-foreground">Conjunto de unidades documentales que forman parte de una serie.</p>
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

          <FormGroup label="Dependencia" required isActive={activeField === 'dependenciaId'} error={errors.dependenciaId}>
            <select
              name="dependenciaId"
              value={data.dependenciaId || ""}
              onChange={handleChange}
              className={cn(inputClass, errors.dependenciaId && "border-destructive focus-visible:ring-destructive")}
            >
              <option value="">Seleccione...</option>
              {activeDeps.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.codigo} - {dep.nombre}</option>
              ))}
            </select>
          </FormGroup>

          <FormGroup label="Serie Vinculada" required isActive={activeField === 'serieId'} error={errors.serieId}>
            <select
              name="serieId"
              value={data.serieId || ""}
              onChange={handleChange}
              className={cn(inputClass, errors.serieId && "border-destructive focus-visible:ring-destructive")}
            >
              <option value="">Seleccione la serie...</option>
              {activeSeries.filter(s => String(s.dependenciaId) === String(data.dependenciaId)).map(ser => (
                <option key={ser.id} value={ser.id}>{ser.codigo} - {ser.nombre}</option>
              ))}
            </select>
          </FormGroup>

          <FormGroup label="Nombre de la Subserie" required isActive={activeField === 'nombre'} error={errors.nombre}>
            <input 
              name="nombre" 
              value={data.nombre || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.nombre && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. Licitaciones Públicas" 
            />
          </FormGroup>

          <FormGroup label="Código" required isActive={activeField === 'codigo'} error={errors.codigo}>
            <input 
              name="codigo" 
              value={data.codigo || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.codigo && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. 100-01" 
            />
          </FormGroup>
        </div>
      </div>

      {/* Columna Derecha / Drawer: Subseries Creadas */}
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
            Ver Subseries
          </span>
          <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
            {activeSubseries.length}
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
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Ver Subseries Creadas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full">{activeSubseries.length}</span>
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
                  <h3 className="text-lg font-bold tracking-tight text-foreground">Subseries Creadas</h3>
                  <p className="text-xs text-muted-foreground">Listado de subseries documentales registradas bajo esta entidad activa.</p>
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
              {activeSubseries.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-xs font-medium">No se han registrado subseries documentales para esta entidad.</p>
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
                        placeholder="Buscar por código, nombre..."
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
                          value={filterDep}
                          onChange={(e) => setFilterDep(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                        >
                          <option value="">Dependencia...</option>
                          {activeDeps.map(d => (
                            <option key={d.id} value={d.id}>{d.codigo} - {d.nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <select
                          value={filterSer}
                          onChange={(e) => setFilterSer(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                        >
                          <option value="">Serie Vinculada...</option>
                          {filteredFilterSeries.map(s => (
                            <option key={s.id} value={s.id}>{s.codigo} - {s.nombre}</option>
                          ))}
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
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Nombre Subserie</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Serie Vinculada</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Dependencia</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {filteredSubseries.map(sub => {
                          const depName = activeDeps.find(d => String(d.id) === String(sub.dependenciaId))?.nombre || '—';
                          const serName = activeSeries.find(s => String(s.id) === String(sub.serieId))?.nombre || '—';
                          return (
                            <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-primary">{sub.codigo}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{sub.nombre}</td>
                              <td className="py-3 px-4 text-slate-500 font-medium truncate max-w-[120px]" title={serName}>{serName}</td>
                              <td className="py-3 px-4 text-slate-500 font-medium truncate max-w-[120px]" title={depName}>{depName}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditClick(sub)}
                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClick(sub)}
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

                        {filteredSubseries.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-400 italic">No se encontraron subseries documentales con los filtros aplicados.</td>
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
                    <h3 className="text-lg font-bold tracking-tight text-foreground">Subseries Creadas</h3>
                    <p className="text-xs text-muted-foreground">Listado de subseries documentales.</p>
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
                {activeSubseries.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 text-xs font-medium">No se han registrado subseries documentales para esta entidad.</p>
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
                          placeholder="Buscar por código, nombre..."
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
                            value={filterDep}
                            onChange={(e) => setFilterDep(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                          >
                            <option value="">Dependencia...</option>
                            {activeDeps.map(d => (
                              <option key={d.id} value={d.id}>{d.codigo} - {d.nombre}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <select
                            value={filterSer}
                            onChange={(e) => setFilterSer(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                          >
                            <option value="">Serie Vinculada...</option>
                            {filteredFilterSeries.map(s => (
                              <option key={s.id} value={s.id}>{s.codigo} - {s.nombre}</option>
                            ))}
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
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Nombre Subserie</th>
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {filteredSubseries.map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-primary">{sub.codigo}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{sub.nombre}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsListExpanded(false);
                                      handleEditClick(sub);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteClick(sub);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {filteredSubseries.length === 0 && (
                            <tr>
                              <td colSpan="3" className="py-8 text-center text-slate-400 italic">No se encontraron subseries.</td>
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
        title="¿Eliminar Subserie?"
        message="¿Seguro que deseas eliminar este registro? Esta acción puede afectar información relacionada."
        confirmText="Eliminar Subserie"
        status={deleteStatus}
        errorMsg={deleteErrorMsg}
        details={recordToDelete ? {
          dependencia: `Código Subserie: ${recordToDelete.codigo}`,
          serie: recordToDelete.nombre,
          subserie: activeSeries.find(s => String(s.id) === String(recordToDelete.serieId))?.nombre || "Serie asociada"
        } : null}
      />
    </div>
  );
}
