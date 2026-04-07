import React from "react";
import { Table, FileText, Clock, Trash2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const COLUMNS = [
  { id: "dependencia", label: "Dependencia", width: "w-36" },
  { id: "codigo", label: "Código", width: "w-16" },
  { id: "serie", label: "Serie", width: "w-40" },
  { id: "subserie", label: "Subserie", width: "w-40" },
  { id: "tipoDocumental", label: "Tipo Documental", width: "w-48" },
  { id: "retencionGestion", label: "A. Gestión (Años)", width: "w-28", align: "text-center" },
  { id: "retencionCentral", label: "A. Central (Años)", width: "w-28", align: "text-center" },
  { id: "disposicion", label: "Disposición Final", width: "w-36" },
  { id: "actions", label: "Acciones", width: "w-24", align: "text-center" },
];

export default function LiveTRDTable({ rows, activeRowIndex, activeField, onEditCell, onDelete }) {
  // Extract summary metrics
  const seriesCount = new Set(rows.map(r => r.serie).filter(Boolean)).size;
  const inProgressFields = rows.filter(r => !r.isComplete).length;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Table Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Table className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Tabla de Retención Documental</h2>
            <span className="ml-2 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border">
              Vista Previa
            </span>
          </div>
        </div>
        <div className="flex gap-4 text-sm mt-3 lg:mt-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-semibold text-foreground">{seriesCount}</span> Series definidas
          </div>
          <div className="flex items-center gap-1.5 text-warning">
            <ShieldAlert className="h-4 w-4" />
            <span className="font-semibold">{inProgressFields}</span> Filas pendientes
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4 bg-secondary/20 relative">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
              <tr>
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
                <tr
                  key={row.id || index}
                  className={cn(
                    "hover:bg-secondary/30 transition-colors group",
                    index === activeRowIndex && "bg-primary/[0.03]"
                  )}
                >
                  {COLUMNS.map((col) => {
                    if (col.id === "actions") {
                      return (
                        <td key={col.id} className={cn("px-4 py-3 align-top", col.align)}>
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onDelete(index)} title="Eliminar Fila" className="p-1 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-1">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      );
                    }

                    const isEditingCell = index === activeRowIndex && col.id === activeField;
                    const value = row[col.id];
                    const isEmpty = !value || value === "";

                    return (
                      <td 
                        key={col.id} 
                        className={cn(
                          "px-4 py-3 align-top cursor-pointer group/cell hover:bg-primary/5 transition-colors relative", 
                          col.align
                        )}
                        onClick={() => onEditCell(index, col.id)}
                        title="Clic para editar este campo"
                      >
                        <motion.div
                          animate={isEditingCell ? {
                            boxShadow: ["0px 0px 0px 0px rgba(var(--color-primary), 0)", "0px 0px 0px 2px rgba(var(--color-primary), 0.5)", "0px 0px 0px 0px rgba(var(--color-primary), 0)"],
                          } : {}}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className={cn(
                            "min-h-[24px] rounded px-1.5 py-0.5 -ml-1 transition-all inline-block w-full",
                            isEditingCell && "bg-primary/10 border-primary/30 border ring-1 ring-primary/20",
                            isEmpty && !isEditingCell && "text-muted-foreground/40 italic text-xs"
                          )}
                        >
                          {value || (isEditingCell ? "Escribiendo..." : "Pendiente")}
                        </motion.div>
                        {/* Hover hint for edit */}
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-primary/10 text-primary px-1.5 rounded opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none">
                          Editar
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 opacity-20" />
                      <p>Aún no hay registros en la TRD.</p>
                      <p className="text-xs">El agente te guiará para crear la primera serie.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
