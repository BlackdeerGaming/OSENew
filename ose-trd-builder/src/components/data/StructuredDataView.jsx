import React, { useState, useMemo } from "react";
import {
  Building2, FolderOpen, FileText, Pencil, Trash2,
  LayoutGrid, Table2, Search, X, ChevronDown, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── View Toggle ────────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border">
      <button
        onClick={() => onChange('hierarchy')}
        title="Vista jerárquica"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200",
          view === 'hierarchy'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Jerárquica
      </button>
      <button
        onClick={() => onChange('table')}
        title="Vista tipo listado"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200",
          view === 'table'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
        Listado
      </button>
    </div>
  );
}

// ─── Hierarchy View ──────────────────────────────────────────────────────────────
function HierarchyView({ dependencias, series, subseries, onEdit, onDelete, canModify, searchQuery }) {
  const [collapsed, setCollapsed] = useState({});

  const filtered = useMemo(() => {
    if (!searchQuery) return dependencias;
    const q = searchQuery.toLowerCase();
    return dependencias.filter(d =>
      d.nombre?.toLowerCase().includes(q) ||
      d.codigo?.toLowerCase().includes(q) ||
      d.sigla?.toLowerCase().includes(q)
    );
  }, [dependencias, searchQuery]);

  const toggleCollapse = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Search className="h-8 w-8 opacity-20 mb-3" />
        <p className="text-sm">No se encontraron dependencias con ese criterio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filtered.map(dep => {
        const depSeries = series.filter(s => s.dependenciaId === dep.id);
        const isCollapsed = collapsed[dep.id];

        return (
          <div key={dep.id} className="border border-border rounded-lg bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Dependencia Header */}
            <div className="p-4 bg-primary/5 flex items-start gap-4">
              <button
                onClick={() => toggleCollapse(dep.id)}
                className="mt-0.5 p-1 rounded hover:bg-primary/10 transition-colors shrink-0 text-muted-foreground"
              >
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />}
              </button>
              <div className="p-2 bg-primary/10 rounded-md shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border border-border text-muted-foreground">{dep.codigo}</span>
                  <h3 className="font-semibold text-foreground text-base tracking-tight">{dep.nombre}</h3>
                  {canModify && onEdit && (
                    <button onClick={() => onEdit('dependencias', dep)} className="ml-2 p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canModify && onDelete && (
                    <button onClick={() => onDelete('dependencias', dep.id)} className="ml-1 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  {dep.ciudad && <span>{dep.ciudad}, {dep.departamento}</span>}
                  {dep.sigla && <span>Sigla: {dep.sigla}</span>}
                  <span className="text-primary/70 font-medium">{depSeries.length} serie{depSeries.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Series (collapsible) */}
            {!isCollapsed && (
              <div className="divide-y divide-border/50 border-t border-border/50">
                {depSeries.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground italic pl-14">No hay series asociadas a esta dependencia.</p>
                ) : (
                  depSeries.map(serie => {
                    const serieSubseries = subseries.filter(sub => sub.serieId === serie.id);
                    return (
                      <div key={serie.id} className="p-4 pl-14 bg-card/50">
                        <div className="flex items-start gap-4">
                          <FolderOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground border border-border/50">{serie.codigo}</span>
                              <h4 className="font-semibold text-foreground">{serie.nombre}</h4>
                              {canModify && onEdit && (
                                <button onClick={() => onEdit('series', serie)} className="ml-2 p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canModify && onDelete && (
                                <button onClick={() => onDelete('series', serie.id)} className="ml-1 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {serie.tipoDocumental && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{serie.tipoDocumental}</p>
                            )}
                            {serieSubseries.length > 0 && (
                              <div className="mt-4 space-y-3 relative before:absolute before:inset-y-0 before:left-[-21px] before:w-px before:bg-border">
                                {serieSubseries.map(sub => (
                                  <div key={sub.id} className="relative flex items-start gap-3 before:absolute before:top-2.5 before:left-[-21px] before:w-4 before:h-px before:bg-border">
                                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-mono text-muted-foreground">{sub.codigo}</span>
                                        <h5 className="font-medium text-sm text-foreground/90">{sub.nombre}</h5>
                                        {canModify && onEdit && (
                                          <button onClick={() => onEdit('subseries', sub)} className="ml-2 p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors">
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                        )}
                                        {canModify && onDelete && (
                                          <button onClick={() => onDelete('subseries', sub.id)} className="ml-1 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors">
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                      {sub.tipoDocumental && (
                                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{sub.tipoDocumental}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Windows Explorer Style List View (TableView) ──────────────────────────────────────────────────────────────────
function TableView({ dependencias, series, subseries, onEdit, onDelete, canModify, searchQuery }) {
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (id) => setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const groups = useMemo(() => {
    let result = [];

    for (const dep of dependencias) {
      const depSeries = series.filter(s => s.dependenciaId === dep.id);
      let items = [];

      for (const serie of depSeries) {
        items.push({ type: 'serie', id: serie.id, data: serie, dep });
        const serieSubseries = subseries.filter(s => s.serieId === serie.id);
        for (const sub of serieSubseries) {
          items.push({ type: 'subserie', id: sub.id, data: sub, parent: serie, dep });
        }
      }

      // Filtrado por buscador
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(item => 
          item.data.nombre?.toLowerCase().includes(q) ||
          item.data.codigo?.toLowerCase().includes(q) ||
          item.data.tipoDocumental?.toLowerCase().includes(q)
        );

        // Si la dependencia coincide con la búsqueda, mostramos todos sus items
        if (
          dep.nombre?.toLowerCase().includes(q) ||
          dep.codigo?.toLowerCase().includes(q) ||
          dep.sigla?.toLowerCase().includes(q)
        ) {
          // Revertimos y mostramos todos
          items = [];
          for (const serie of depSeries) {
            items.push({ type: 'serie', id: serie.id, data: serie, dep });
            const serieSubseries = subseries.filter(s => s.serieId === serie.id);
            for (const sub of serieSubseries) {
              items.push({ type: 'subserie', id: sub.id, data: sub, parent: serie, dep });
            }
          }
        }
      }

      if (items.length > 0 || (searchQuery && (dep.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) || dep.codigo?.toLowerCase().includes(searchQuery.toLowerCase())))) {
        result.push({ dep, items });
      }
    }

    return result;
  }, [dependencias, series, subseries, searchQuery]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Search className="h-8 w-8 opacity-20 mb-3" />
        <p className="text-sm">No se encontraron registros en esta vista.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white h-full overflow-auto">
      {/* Table Headers (Windows Explorer style) */}
      <div className="sticky top-0 z-10 flex text-[11px] text-slate-500 bg-white border-b border-transparent hover:border-slate-200 py-1.5 px-4 select-none">
        <div className="flex-1 min-w-[250px] pl-6 hover:bg-slate-100 hover:text-slate-800 cursor-pointer rounded px-1 transition-colors">Nombre</div>
        <div className="w-[120px] hover:bg-slate-100 hover:text-slate-800 cursor-pointer rounded px-1 transition-colors">Código</div>
        <div className="w-[200px] hover:bg-slate-100 hover:text-slate-800 cursor-pointer rounded px-1 transition-colors hidden md:block">Tipo Documental</div>
        {canModify && <div className="w-[80px]"></div>}
      </div>

      <div className="pb-8">
        {groups.map(group => {
          const isCollapsed = collapsedGroups[group.dep.id];
          return (
            <div key={group.dep.id} className="mb-1">
              {/* Group Header (like 'Ayer', 'Al principio de la semana') */}
              <div 
                onClick={() => toggleGroup(group.dep.id)}
                className="flex items-center gap-1 py-1.5 px-2 hover:bg-slate-50 cursor-default group/header"
              >
                <div className="text-[#005a9e] opacity-70 group-hover/header:opacity-100 transition-opacity">
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </div>
                <div className="text-[12px] text-[#005a9e] cursor-default select-none border-b border-transparent group-hover/header:border-[#005a9e]/30 flex gap-2">
                  <span>{group.dep.nombre}</span>
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
                        <div className="w-[200px] text-slate-500 text-[11px] truncate pr-2 hidden md:block select-none">
                          {item.data.tipoDocumental || (item.type === 'serie' ? 'Carpeta de Serie' : 'Documento')}
                        </div>

                        {/* Actions */}
                        {canModify && (
                          <div className="w-[80px] flex justify-end gap-1 px-2 opacity-0 group-hover/row:opacity-100">
                             <button 
                               onClick={(e) => { e.stopPropagation(); onEdit(item.type === 'serie' ? 'series' : 'subseries', item.data); }} 
                               className="p-1 hover:bg-[#cce8ff] rounded text-[#005a9e]" 
                               title="Editar"
                             >
                               <Pencil className="h-3 w-3" />
                             </button>
                             {onDelete && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); onDelete(item.type === 'serie' ? 'series' : 'subseries', item.data.id); }} 
                                 className="p-1 hover:bg-rose-100 rounded text-rose-600" 
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
  const [searchQuery, setSearchQuery] = useState('');
  const role = currentUser?.role || 'user';
  const canModify = role === 'superadmin' || role === 'admin';

  const totalRecords = dependencias.length + series.length + subseries.length;

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
      {/* Header */}
      <div className="p-4 border-b border-border bg-secondary/30 flex items-center gap-3 flex-wrap justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h2 className="text-lg font-bold text-foreground leading-tight">Estructura Organizacional</h2>
            <p className="text-xs text-muted-foreground">{dependencias.length} dep. · {series.length} series · {subseries.length} subseries</p>
          </div>
          {!canModify && (
            <div className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0">
              Modo Lectura
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-8 pr-8 text-xs rounded-lg border border-border bg-background text-foreground w-44 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6 bg-background/50">
        {view === 'hierarchy' ? (
          <HierarchyView
            dependencias={dependencias}
            series={series}
            subseries={subseries}
            onEdit={onEdit}
            onDelete={onDelete}
            canModify={canModify}
            searchQuery={searchQuery}
          />
        ) : (
          <TableView
            dependencias={dependencias}
            series={series}
            subseries={subseries}
            onEdit={onEdit}
            onDelete={onDelete}
            canModify={canModify}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
}
