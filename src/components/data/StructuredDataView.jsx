import React, { useState, useMemo } from "react";
import { Building2, FolderOpen, FileText, Pencil, Trash2, Search, X, Filter, RotateCcw, Database, LayoutGrid, Table2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── View Toggle ────────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-white/50 border border-slate-200 rounded-lg shadow-sm">
      <button
        onClick={() => onChange('hierarchy')}
        title="Vista jerárquica"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200",
          view === 'hierarchy'
            ? "bg-white text-primary shadow-sm border border-slate-200"
            : "text-slate-400 hover:text-slate-600 border border-transparent"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Jerárquica
      </button>
      <button
        onClick={() => onChange('table')}
        title="Vista tipo listado"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200",
          view === 'table'
            ? "bg-white text-primary shadow-sm border border-slate-200"
            : "text-slate-400 hover:text-slate-600 border border-transparent"
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
        Listado
      </button>
    </div>
  );
}

// ─── Windows Explorer Style List View (TableView) ──────────────────────────────────────────────────────────────────
function TableView({ filteredData, onEdit, onDelete, canModify }) {
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (id) => setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));

  // Transform filtered data into groups
  const groups = useMemo(() => {
    let result = [];

    for (const dep of filteredData) {
      let items = [];

      for (const serie of dep.matchedSeries || []) {
        items.push({ type: 'serie', id: serie.id, data: serie, dep });
        for (const sub of serie.subseries || []) {
          items.push({ type: 'subserie', id: sub.id, data: sub, parent: serie, dep });
        }
      }

      result.push({ dep, items });
    }

    return result;
  }, [filteredData]);

  if (groups.length === 0) {
    return null; // Handled by parent wrapper
  }

  return (
    <div className="w-full bg-white h-full overflow-auto rounded-xl border border-slate-200 shadow-sm">
      {/* Table Headers (Windows Explorer style) */}
      <div className="sticky top-0 z-10 flex text-[11px] text-slate-500 bg-white border-b border-transparent hover:border-slate-200 py-1.5 px-4 select-none shadow-sm">
        <div className="flex-1 min-w-[250px] pl-6 hover:bg-slate-100 hover:text-slate-800 cursor-pointer rounded px-1 transition-colors font-bold">Nombre</div>
        <div className="w-[120px] hover:bg-slate-100 hover:text-slate-800 cursor-pointer rounded px-1 transition-colors font-bold">Código</div>
        <div className="w-[200px] hover:bg-slate-100 hover:text-slate-800 cursor-pointer rounded px-1 transition-colors font-bold hidden md:block">Tipo Documental</div>
        {canModify && <div className="w-[80px]"></div>}
      </div>

      <div className="pb-8">
        {groups.map(group => {
          const isCollapsed = collapsedGroups[group.dep.id];
          return (
            <div key={group.dep.id} className="mb-1">
              {/* Group Header */}
              <div 
                onClick={() => toggleGroup(group.dep.id)}
                className="flex items-center gap-1 py-1.5 px-2 hover:bg-slate-50 cursor-pointer group/header transition-colors select-none"
              >
                <div className="text-[#005a9e] opacity-70 group-hover/header:opacity-100 transition-opacity">
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </div>
                <div className="text-[12px] text-[#005a9e] cursor-pointer border-b border-transparent group-hover/header:border-[#005a9e]/30 flex gap-2">
                  <span className="font-bold">{group.dep.nombre}</span>
                  <span className="text-slate-400 font-mono text-[10px] mt-0.5">{group.dep.codigo}</span>
                </div>
              </div>

              {/* Items in the group */}
              {!isCollapsed && (
                <div className="flex flex-col text-[12px] text-slate-800">
                  {group.items.length === 0 ? (
                    <div className="px-8 py-1.5 text-slate-400 italic text-[11px]">Carpeta vacía</div>
                  ) : (
                    group.items.map((item, idx) => (
                      <div 
                        key={`${item.type}-${item.id}-${idx}`}
                        className="flex items-center hover:bg-[#e5f3ff] hover:outline hover:outline-1 hover:outline-[#d9ebf9] transition-all cursor-default px-4 py-[3px] group/row"
                      >
                        {/* Name & Icon */}
                        <div className="flex-1 min-w-[250px] flex items-center gap-2 pl-2">
                          <div className="shrink-0 flex items-center justify-center w-5">
                            {item.type === 'serie' ? (
                               // A slightly golden folder icon
                              <svg className="w-4 h-4 text-[#f5cc84]" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                            ) : (
                               // A PDF-like document icon
                              <svg className="w-4 h-4 text-[#d13438]" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                            )}
                          </div>
                          <span className="truncate pr-4 select-none">
                            {item.type === 'subserie' ? (
                              <span className="text-slate-500 font-medium mr-1.5 text-[10px] uppercase truncate max-w-[80px] inline-block align-bottom">{item.parent.nombre} \</span>
                            ) : null}
                            {item.data.nombre}
                          </span>
                        </div>

                        {/* Code */}
                        <div className="w-[120px] text-slate-500 text-[11px] truncate pr-2 select-none">
                          {item.data.codigo}
                        </div>

                        {/* Type */}
                        <div className="w-[200px] text-slate-500 text-[11px] truncate pr-2 hidden md:block select-none font-medium">
                          {item.data.tipoDocumental || (item.type === 'serie' ? 'Carpeta de Serie' : 'Documento')}
                        </div>

                        {/* Actions */}
                        {canModify && (
                          <div className="w-[80px] flex justify-end gap-1 px-2 opacity-0 group-hover/row:opacity-100">
                             <button 
                               onClick={(e) => { e.stopPropagation(); onEdit(item.type === 'serie' ? 'series' : 'subseries', item.data); }} 
                               className="p-1 hover:bg-[#cce8ff] rounded text-[#005a9e] transition-colors" 
                               title="Editar"
                             >
                               <Pencil className="h-3 w-3" />
                             </button>
                             {onDelete && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); onDelete(item.type === 'serie' ? 'series' : 'subseries', item.data.id); }} 
                                 className="p-1 hover:bg-rose-100 rounded text-rose-600 transition-colors" 
                                 title="Eliminar"
                               >
                                 <Trash2 className="h-3 w-3" />
                               </button>
                             )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────
export default function StructuredDataView({ dependencias, series, subseries, onEdit, onDelete, currentUser }) {
  const [view, setView] = useState('hierarchy');
  const [searchQuery, setSearchQuery] = useState("");
  const [depFilter, setDepFilter] = useState("all");
  const [serieFilter, setSerieFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");

  const role = currentUser?.role || 'user';
  const canModify = role === 'superadmin' || role === 'admin';

  // Opciones para los filtros
  const depOptions = useMemo(() => [...new Set(dependencias.map(d => d.nombre))].sort(), [dependencias]);
  const serieOptions = useMemo(() => [...new Set(series.map(s => s.nombre))].sort(), [series]);
  const subserieOptions = useMemo(() => [...new Set(subseries.map(s => s.nombre))].sort(), [subseries]);

  const resetFilters = () => {
    setSearchQuery("");
    setDepFilter("all");
    setSerieFilter("all");
    setSubFilter("all");
  };

  // Lógica de Filtrado Jerárquico
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();

    const matchesSearch = (item, fields) => {
      if (!q) return true;
      return fields.some(f => item[f]?.toString().toLowerCase().includes(q));
    };

    return dependencias
      .map(dep => {
        // Filtrar Series dentro de la Dependencia
        const matchedSeries = series
          .filter(s => s.dependenciaId === dep.id)
          .map(serie => {
            // Filtrar Subseries dentro de la Serie
            const matchedSubseries = subseries.filter(sub => {
              const belongs = sub.serieId === serie.id;
              if (!belongs) return false;
              
              const matchesSubFilter = subFilter === "all" || sub.nombre === subFilter;
              const matchesText = matchesSearch(sub, ['nombre', 'codigo', 'tipoDocumental']);
              
              return matchesSubFilter && matchesText;
            });

            const hasMatchedSubseries = matchedSubseries.length > 0;
            const matchesSerieFilter = serieFilter === "all" || serie.nombre === serieFilter;
            const matchesText = matchesSearch(serie, ['nombre', 'codigo', 'tipoDocumental']);
            
            // Una serie es visible si ella misma coincide con filtros O si alguna de sus subseries coincide
            const isVisible = (matchesSerieFilter && matchesText) || hasMatchedSubseries;

            return isVisible ? { ...serie, subseries: matchedSubseries } : null;
          })
          .filter(Boolean);

        const hasMatchedSeries = matchedSeries.length > 0;
        const matchesDepFilter = depFilter === "all" || dep.nombre === depFilter;
        const matchesText = matchesSearch(dep, ['nombre', 'codigo', 'sigla', 'ciudad', 'departamento']);

        // Una dependencia es visible si ella misma coincide con filtros O si alguna de sus series/subseries coincide
        const isVisible = (matchesDepFilter && matchesText) || hasMatchedSeries;

        return isVisible ? { ...dep, matchedSeries } : null;
      })
      .filter(Boolean);
  }, [dependencias, series, subseries, searchQuery, depFilter, serieFilter, subFilter]);

  if (dependencias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-xl border border-border h-full space-y-4">
        <Building2 className="h-12 w-12 opacity-20" />
        <p className="font-bold">Aún no hay datos estructurados creados.</p>
        <p className="text-sm opacity-80">Comienza creando una Dependencia en el área principal de Agentes OSE.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Search & Filters Toolbar */}
      <div className="p-6 border-b border-border bg-secondary/[0.03] space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Datos Estructurados
            </h2>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">Gestión Jerárquica y Filtrado en Tiempo Real</p>
          </div>
          
          <div className="flex items-center gap-3">
             <ViewToggle view={view} onChange={setView} />
             <button 
               onClick={resetFilters}
               className="text-[10px] font-black uppercase text-slate-400 hover:text-primary flex items-center gap-1.5 transition-colors px-3 py-1.5 hover:bg-primary/5 rounded-lg border border-transparent hover:border-primary/10"
             >
               <RotateCcw className="h-3.5 w-3.5" />
               Restablecer Vistas
             </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group w-full">
          <div className="absolute inset-0 bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-all rounded-2xl" />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Buscar por nombre de dependencia, serie, subserie o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-12 py-4 bg-white border-2 border-slate-200 rounded-2xl text-base font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-lg placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">
            <Filter className="h-3 w-3" />
            Filtrar por:
          </div>
          
          <select 
            value={depFilter}
            onChange={(e) => setDepFilter(e.target.value)}
            className="text-[9px] font-bold uppercase bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:bg-white hover:border-slate-300 transition-all text-slate-600"
          >
            <option value="all">Todas las Dependencias</option>
            {depOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <select 
            value={serieFilter}
            onChange={(e) => setSerieFilter(e.target.value)}
            className="text-[9px] font-bold uppercase bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:bg-white hover:border-slate-300 transition-all text-slate-600"
          >
            <option value="all">Todas las Series</option>
            {serieOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <select 
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="text-[9px] font-bold uppercase bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:bg-white hover:border-slate-300 transition-all text-slate-600"
          >
            <option value="all">Todas las Subseries</option>
            {subserieOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 bg-background/50">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
            <div className="p-4 bg-slate-50 rounded-full mb-4">
              <Search className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-base font-black text-slate-900 uppercase">Sin resultados coincidentes</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-xs font-medium leading-relaxed">
              No encontramos registros que coincidan con tu búsqueda o filtros actuales. Prueba limpiando los criterios.
            </p>
            <button 
              onClick={resetFilters}
              className="mt-6 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-slate-200"
            >
              Restablecer Vistas
            </button>
          </div>
        ) : view === 'table' ? (
          <TableView filteredData={filteredData} onEdit={onEdit} onDelete={onDelete} canModify={canModify} />
        ) : (
          filteredData.map(dep => (
            <div key={dep.id} className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow group/card">
              {/* Dependencia Header */}
              <div className="p-4 bg-white border-b border-border/50 flex items-start gap-4 group-hover/card:bg-primary/[0.01] transition-colors">
                <div className="p-2.5 bg-primary/10 rounded-xl shrink-0 border border-primary/20">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600 tracking-tighter">{dep.codigo}</span>
                    <h3 className="font-black text-slate-900 text-base tracking-tight uppercase leading-none">{dep.nombre}</h3>
                    {canModify && onEdit && (
                       <button onClick={() => onEdit('dependencias', dep)} className="ml-2 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors" title="Editar Dependencia">
                         <Pencil className="h-4 w-4" />
                       </button>
                    )}
                    {canModify && onDelete && (
                       <button onClick={() => onDelete('dependencias', dep.id)} className="ml-1 p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors" title="Eliminar Dependencia">
                         <Trash2 className="h-4 w-4" />
                       </button>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>{dep.ciudad}, {dep.departamento}</span>
                    <span className="flex items-center gap-1.5 before:content-['•'] before:mr-0.5">Sigla: {dep.sigla || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Series List */}
              <div className="divide-y divide-slate-100 bg-slate-50/30">
                {dep.matchedSeries.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400 italic pl-16 font-medium bg-white">No hay series o subseries que coincidan con los filtros en esta oficina.</p>
                ) : (
                  dep.matchedSeries.map(serie => (
                    <div key={serie.id} className="p-4 pl-14 hover:bg-white transition-colors">
                      <div className="flex items-start gap-4">
                        <FolderOpen className="h-5 w-5 text-slate-400 mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded text-slate-500 border border-slate-200">{serie.codigo}</span>
                              <h4 className="font-bold text-slate-900 uppercase text-sm tracking-tight">{serie.nombre}</h4>
                              {canModify && onEdit && (
                                 <button onClick={() => onEdit('series', serie)} className="ml-2 p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-primary transition-colors" title="Editar Serie">
                                   <Pencil className="h-3.5 w-3.5" />
                                 </button>
                              )}
                              {canModify && onDelete && (
                                 <button onClick={() => onDelete('series', serie.id)} className="ml-1 p-1 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-500 transition-colors" title="Eliminar Serie">
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-widest line-clamp-1">{serie.tipoDocumental}</p>
                          
                          {/* Subseries List */}
                          {serie.subseries && serie.subseries.length > 0 && (
                            <div className="mt-4 space-y-4 relative before:absolute before:inset-y-0 before:left-[-21px] before:w-px before:bg-slate-200">
                              {serie.subseries.map(sub => (
                                <div key={sub.id} className="relative flex items-start gap-4 before:absolute before:top-2 before:left-[-21px] before:w-4 before:h-px before:bg-slate-200">
                                  <div className="p-1 bg-white border border-slate-100 rounded shadow-sm text-slate-400 shrink-0">
                                    <FileText className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-1 rounded">{sub.codigo}</span>
                                        <h5 className="font-bold text-xs text-slate-800 uppercase tracking-tight">{sub.nombre}</h5>
                                        {canModify && onEdit && (
                                          <button onClick={() => onEdit('subseries', sub)} className="ml-2 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-colors" title="Editar Subserie">
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                        )}
                                        {canModify && onDelete && (
                                          <button onClick={() => onDelete('subseries', sub.id)} className="ml-1 p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-500 transition-colors" title="Eliminar Subserie">
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5 tracking-tighter">{sub.tipoDocumental}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
