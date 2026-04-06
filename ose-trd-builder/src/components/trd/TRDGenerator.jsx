import React from "react";
import { Table, Download, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { id: "dependencia", label: "Dependencia", width: "w-36" },
  { id: "codigo", label: "Código", width: "w-16" },
  { id: "serie", label: "Serie", width: "w-40" },
  { id: "subserie", label: "Subserie", width: "w-40" },
  { id: "tipoDocumental", label: "Tipo Documental", width: "w-48" },
  { id: "retencionGestion", label: "A. Gestión", width: "w-24", align: "text-center" },
  { id: "retencionCentral", label: "A. Central", width: "w-24", align: "text-center" },
  { id: "disposicion", label: "Disposición", width: "w-28" },
];

export default function TRDGenerator({ rows = [], selectedIds = new Set(), onToggleRow, onToggleAll }) {
  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
  const someSelected = rows.some(r => selectedIds.has(r.id));
  const exportCount = selectedIds.size === 0 ? rows.length : selectedIds.size;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-muted-foreground bg-card rounded-xl border border-border">
        <Table className="h-12 w-12 opacity-20 mb-4" />
        <p className="font-medium text-foreground">Tabla de Retención Vacía</p>
        <p className="text-sm mt-1 max-w-md text-center">Para generar la TRD automática, primero debes crear al menos una Valoración TRD desde el menú Módulos. Solo las series con valoración completa (aprobadas) aparecerán aquí.</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Table className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Tabla de Retención Documental Consolidada</h2>
            <span className="ml-2 rounded-full bg-success/10 text-success px-2.5 py-0.5 text-xs font-semibold border border-success/20">
              {rows.length} registros
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary">{selectedIds.size} seleccionados para exportar</span>
          ) : (
            <span>Todos los registros se exportarán. Usa los checkboxes para filtrar.</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-secondary/20 relative">
        <div className="rounded border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={e => onToggleAll && onToggleAll(e.target.checked)}
                    className="h-4 w-4 rounded border-border cursor-pointer"
                    title="Seleccionar todos"
                  />
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.id} className={cn("px-4 py-3", col.width, col.align)}>
                    <div className={cn("flex flex-col gap-0.5", col.align === "text-center" && "items-center")}>
                      {col.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, index) => (
                <tr key={row.id || index} className={cn("hover:bg-secondary/30 transition-colors", selectedIds.has(row.id) && "bg-primary/5")}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onToggleRow && onToggleRow(row.id)}
                      className="h-4 w-4 rounded border-border cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 align-top font-medium text-xs">{row.dependencia}</td>
                  <td className="px-4 py-3 align-top font-mono text-xs">{row.codigo}</td>
                  <td className="px-4 py-3 align-top">{row.serie}</td>
                  <td className="px-4 py-3 align-top">{row.subserie}</td>
                  <td className="px-4 py-3 align-top text-xs">{row.tipoDocumental}</td>
                  <td className="px-4 py-3 align-top text-center text-xs font-bold">{row.retencionGestion}</td>
                  <td className="px-4 py-3 align-top text-center text-xs font-bold">{row.retencionCentral}</td>
                  <td className="px-4 py-3 align-top text-xs">{row.disposicion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
