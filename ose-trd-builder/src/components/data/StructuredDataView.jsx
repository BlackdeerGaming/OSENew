import React from "react";
import { Building2, FolderOpen, FileText, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StructuredDataView({ dependencias, series, subseries, onEdit, onDelete, currentUser }) {
  const role = currentUser?.role || 'user';
  const canModify = role === 'superadmin' || role === 'admin';

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
      <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Estructura Organizacional</h2>
          <p className="text-sm text-muted-foreground">Vista jerárquica de todos los fondos documentales configurados.</p>
        </div>
        {!canModify && (
          <div className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Modo Lectura
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 bg-background/50">
        {dependencias.map(dep => {
          const depSeries = series.filter(s => s.dependenciaId === dep.id);
          
          return (
            <div key={dep.id} className="border border-border rounded-lg bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Dependencia Header */}
              <div className="p-4 bg-primary/5 flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-md shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border border-border text-muted-foreground">{dep.codigo}</span>
                    <h3 className="font-semibold text-foreground text-base tracking-tight">{dep.nombre}</h3>
                    {canModify && onEdit && (
                       <button onClick={() => onEdit('dependencias', dep)} className="ml-2 p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors" title="Editar Dependencia">
                         <Pencil className="h-4 w-4" />
                       </button>
                    )}
                    {canModify && onDelete && (
                       <button onClick={() => onDelete('dependencias', dep.id)} className="ml-1 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors" title="Eliminar Dependencia">
                         <Trash2 className="h-4 w-4" />
                       </button>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{dep.ciudad}, {dep.departamento}</span>
                    <span>Sigla: {dep.sigla || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Series List */}
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
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground border border-border/50">{serie.codigo}</span>
                                <h4 className="font-semibold text-foreground">{serie.nombre}</h4>
                                {canModify && onEdit && (
                                   <button onClick={() => onEdit('series', serie)} className="ml-2 p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors" title="Editar Serie">
                                     <Pencil className="h-3.5 w-3.5" />
                                   </button>
                                )}
                                {canModify && onDelete && (
                                   <button onClick={() => onDelete('series', serie.id)} className="ml-1 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors" title="Eliminar Serie">
                                     <Trash2 className="h-3.5 w-3.5" />
                                   </button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{serie.tipoDocumental}</p>
                            
                            {/* Subseries List */}
                            {serieSubseries.length > 0 && (
                              <div className="mt-4 space-y-3 relative before:absolute before:inset-y-0 before:left-[-21px] before:w-px before:bg-border">
                                {serieSubseries.map(sub => (
                                  <div key={sub.id} className="relative flex items-start gap-3 before:absolute before:top-2.5 before:left-[-21px] before:w-4 before:h-px before:bg-border">
                                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-mono text-muted-foreground">{sub.codigo}</span>
                                          <h5 className="font-medium text-sm text-foreground/90">{sub.nombre}</h5>
                                          {canModify && onEdit && (
                                            <button onClick={() => onEdit('subseries', sub)} className="ml-2 p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors" title="Editar Subserie">
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                          )}
                                          {canModify && onDelete && (
                                            <button onClick={() => onDelete('subseries', sub.id)} className="ml-1 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors" title="Eliminar Subserie">
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{sub.tipoDocumental}</p>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
