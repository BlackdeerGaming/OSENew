import React from "react";
import { Download, LogOut, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function Header({ status = "Borrador", rows = [], onLogout }) {
  
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("landscape");
      doc.text("Tabla de Retención Documental (TRD) - OSE", 14, 15);
      
      const tableColumn = ["Dependencia", "Código", "Serie", "Subserie", "Tipo Documental", "A. Gestión (Años)", "A. Central (Años)", "Disposición Final"];
      const tableRows = [];

      rows.forEach(row => {
        const rowData = [
          row.dependencia || "",
          row.codigo || "",
          row.serie || "",
          row.subserie || "",
          row.tipoDocumental || "",
          row.retencionGestion || "",
          row.retencionCentral || "",
          row.disposicion || ""
        ];
        tableRows.push(rowData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 25,
        styles: { fontSize: 9, cellPadding: 3, font: "helvetica" },
        headStyles: { fillColor: [30, 58, 138] }, // Navy blue matching theme
      });

      doc.save("TRD_Export.pdf");
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-border bg-background px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-lg shadow-sm">
          OSE
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-foreground leading-tight">Gestión Documental</h1>
          <p className="text-xs text-muted-foreground">Módulo: Construcción de TRD asistida por IA</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
            status === "Borrador"
              ? "bg-secondary text-secondary-foreground border-border"
              : status === "Finalizado"
              ? "bg-success/10 text-success border-success/20"
              : "bg-warning/10 text-warning border-warning/20"
          )}
        >
          {status === "Finalizado" && <CheckCircle2 className="h-3 w-3" />}
          {status}
        </span>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="h-4 w-4" />
          Exportar TRD
        </button>
        <div className="w-px h-6 bg-border" />
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </header>
  );
}
