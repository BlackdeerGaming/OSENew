import React, { useState, useMemo } from "react";
import { Building2, FolderOpen, FileText, Pencil, Trash2, Search, X, Filter, RotateCcw, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StructuredDataView({ dependencias, series, subseries, onEdit, onDelete, currentUser }) {
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
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-xl border border-border h-full">
        <Building2 className="h-12 w-12 opacity-20 mb-4" />
        <p>Aún no hay datos estructurados creados.</p>
        <p className="text-sm opacity-80 mt-1">Comienza creando una Dependencia en el menú lateral.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Search & Filters Toolbar */}
      <div className="p-4 border-b border-border bg-secondary/10 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Datos Estructurados
            </h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Gestión Jerárquica y Filtrado en Vivo</p>
          </div>
          
          <div className="relative group max-w-md w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Buscar por nombre, código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Filter className="h-3.5 w-3.5" />
            Filtros:
          </div>
          
          {/* Select Dependencia */}
          <select 
            value={depFilter}
            onChange={(e) => setDepFilter(e.target.value)}
            className="text-[10px] font-bold uppercase bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="all">Dependencias (Todas)</option>
            {depOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          {/* Select Serie */}
          <select 
            value={serieFilter}
            onChange={(e) => setSerieFilter(e.target.value)}
            className="text-[10px] font-bold uppercase bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="all">Series (Todas)</option>
            {serieOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          {/* Select Subserie */}
          <select 
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="text-[10px] font-bold uppercase bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="all">Subseries (Todas)</option>
            {subserieOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <button 
            onClick={resetFilters}
            className="ml-auto text-[10px] font-black uppercase text-slate-400 hover:text-primary flex items-center gap-1.5 transition-colors px-2 py-1 hover:bg-primary/5 rounded-md"
          >
            <RotateCcw className="h-3 w-3" />
            Limpiar Filtros
          </button>
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

