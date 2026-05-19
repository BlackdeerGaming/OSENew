import React from "react";
import { cn } from "@/lib/utils";
import { FormGroup } from "./DependenciaForm";
import SearchableSelect from "../ui/SearchableSelect";
import { LayoutGrid, PlusCircle, Search, X, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import ConfirmDeleteModal from "../ui/ConfirmDeleteModal";

export const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:bg-secondary/50 bg-white";
export const textareaClass = "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors";

export default function SerieForm({ 
  data, 
  onChange, 
  activeField, 
  dependencias = [], 
  series = [],
  entities = [], 
  currentUser = null, 
  selectedEntityId = null,
  errors = {},
  onDeleteSerie
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  const handleSelectSerieForEdit = (e) => {
    const serId = e.target.value;
    if (!serId) {
      onChange({ entidadId: selectedEntityId });
      return;
    }
    const ser = series.find(s => String(s.id) === String(serId));
    if (ser) {
      onChange({ ...ser });
    }
  };

  // --- LOCAL LISTING AND FILTERING STATES ---
  const [isListExpanded, setIsListExpanded] = React.useState(true);
  const [filterSearch, setFilterSearch] = React.useState('');
  const [filterDep, setFilterDep] = React.useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [recordToDelete, setRecordToDelete] = React.useState(null);
  const [deleteStatus, setDeleteStatus] = React.useState('idle');
  const [deleteErrorMsg, setDeleteErrorMsg] = React.useState('');

  // Active Entity Scoped Series and Dependencias
  const activeDeps = React.useMemo(() => {
    return dependencias.filter(d => !d.entidadId || String(d.entidadId) === String(selectedEntityId));
  }, [dependencias, selectedEntityId]);

  const activeSeries = React.useMemo(() => {
    return series.filter(s => !s.entidadId || String(s.entidadId) === String(selectedEntityId));
  }, [series, selectedEntityId]);

  // Filtering Logic
  const filteredSeries = React.useMemo(() => {
    return activeSeries.filter(s => {
      const matchesSearch = !filterSearch.trim() || 
        String(s.nombre).toLowerCase().includes(filterSearch.toLowerCase()) ||
        String(s.codigo).toLowerCase().includes(filterSearch.toLowerCase());

      const matchesDep = !filterDep || String(s.dependenciaId) === String(filterDep);

      return matchesSearch && matchesDep;
    });
  }, [activeSeries, filterSearch, filterDep]);

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
      if (onDeleteSerie) {
        await onDeleteSerie(recordToDelete.id);
      }
      setDeleteStatus('success');
      setTimeout(() => {
        setDeleteModalOpen(false);
        setRecordToDelete(null);
      }, 1000);
    } catch (err) {
      setDeleteStatus('error');
      setDeleteErrorMsg(err.message || 'Error al eliminar la serie.');
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
              onChange={handleSelectSerieForEdit}
              placeholder="Buscar serie..."
              className="bg-white text-xs"
              options={[
                { value: "", label: "--- Crear Nueva Serie ---" },
                ...activeSeries.map(s => ({ 
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
              ) : "Nueva Serie Documental"}
            </h2>
            <p className="text-sm text-muted-foreground">Conjunto de unidades documentales de contenido homogéneo.</p>
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

          <FormGroup label="Dependencia Productora" required isActive={activeField === 'dependenciaId'} error={errors.dependenciaId}>
            <select
              name="dependenciaId"
              value={data.dependenciaId || ""}
              onChange={handleChange}
              className={cn(inputClass, errors.dependenciaId && "border-destructive focus-visible:ring-destructive")}
            >
              <option value="">Seleccione la dependencia...</option>
              {activeDeps.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.codigo} - {dep.nombre}</option>
              ))}
            </select>
          </FormGroup>

          <FormGroup label="Nombre de la Serie" required isActive={activeField === 'nombre'} error={errors.nombre}>
            <input 
              name="nombre" 
              value={data.nombre || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.nombre && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. Actas" 
            />
          </FormGroup>

          <FormGroup label="Código" required isActive={activeField === 'codigo'} error={errors.codigo}>
            <input 
              name="codigo" 
              value={data.codigo || ""} 
              onChange={handleChange} 
              className={cn(inputClass, errors.codigo && "border-destructive focus-visible:ring-destructive")} 
              placeholder="Ej. 10" 
            />
          </FormGroup>
        </div>
      </div>

      {/* Columna Derecha / Drawer: Series Creadas */}
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
            Ver Series
          </span>
          <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
            {activeSeries.length}
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
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Ver Series Creadas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full">{activeSeries.length}</span>
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
                  <h3 className="text-lg font-bold tracking-tight text-foreground">Series Creadas</h3>
                  <p className="text-xs text-muted-foreground">Listado de series documentales registradas bajo esta entidad activa.</p>
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
              {activeSeries.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-xs font-medium">No se han registrado series documentales para esta entidad.</p>
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

                    <div>
                      <select
                        value={filterDep}
                        onChange={(e) => setFilterDep(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                      >
                        <option value="">Dependencia Productora...</option>
                        {activeDeps.map(d => (
                          <option key={d.id} value={d.id}>{d.codigo} - {d.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Listado en Tabla */}
                  <div className="border border-border/85 rounded-2xl overflow-hidden shadow-sm bg-white overflow-y-auto max-h-[420px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10 border-b border-border">
                        <tr>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Cód.</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Nombre de la Serie</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Dependencia Productora</th>
                          <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {filteredSeries.map(ser => {
                          const depName = activeDeps.find(d => String(d.id) === String(ser.dependenciaId))?.nombre || '—';
                          return (
                            <tr key={ser.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-primary">{ser.codigo}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{ser.nombre}</td>
                              <td className="py-3 px-4 text-slate-500 font-medium truncate max-w-[200px]">{depName}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditClick(ser)}
                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClick(ser)}
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

                        {filteredSeries.length === 0 && (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-slate-400 italic">No se encontraron series documentales con los filtros aplicados.</td>
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
                    <h3 className="text-lg font-bold tracking-tight text-foreground">Series Creadas</h3>
                    <p className="text-xs text-muted-foreground">Listado de series documentales.</p>
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
                {activeSeries.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 text-xs font-medium">No se han registrado series documentales para esta entidad.</p>
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

                      <div>
                        <select
                          value={filterDep}
                          onChange={(e) => setFilterDep(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-750 shadow-sm focus:outline-none focus:border-primary/30"
                        >
                          <option value="">Dependencia Productora...</option>
                          {activeDeps.map(d => (
                            <option key={d.id} value={d.id}>{d.codigo} - {d.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Listado en Tabla */}
                    <div className="border border-border/85 rounded-2xl overflow-hidden shadow-sm bg-white overflow-y-auto max-h-[350px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10 border-b border-border">
                          <tr>
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Cód.</th>
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Nombre de la Serie</th>
                            <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {filteredSeries.map(ser => (
                            <tr key={ser.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-primary">{ser.codigo}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{ser.nombre}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsListExpanded(false);
                                      handleEditClick(ser);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteClick(ser);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {filteredSeries.length === 0 && (
                            <tr>
                              <td colSpan="3" className="py-8 text-center text-slate-400 italic">No se encontraron series.</td>
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
        title="¿Eliminar Serie Documental?"
        message="¿Seguro que deseas eliminar este registro? Esta acción puede afectar información relacionada."
        confirmText="Eliminar Serie"
        status={deleteStatus}
        errorMsg={deleteErrorMsg}
        details={recordToDelete ? {
          dependencia: `Código Serie: ${recordToDelete.codigo}`,
          serie: recordToDelete.nombre,
          subserie: activeDeps.find(d => String(d.id) === String(recordToDelete.dependenciaId))?.nombre || "Dependencia productora"
        } : null}
      />
    </div>
  );
}
