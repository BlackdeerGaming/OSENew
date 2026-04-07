import React from "react";
import { LogOut, User, Download, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function MainHeader({ onLogout, mainView, trdProps }) {
  // Extract TRD props safely
  const { status = "Borrador", rows = [] } = trdProps || {};

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("landscape");
      
      // Agrupar filas por dependencia
      const groupedByDep = rows.reduce((acc, row) => {
        const dep = row.dependencia || "Sin Oficina";
        if (!acc[dep]) acc[dep] = [];
        acc[dep].push(row);
        return acc;
      }, {});

      const dependencies = Object.keys(groupedByDep);

      if (dependencies.length === 0) {
        alert("No hay registros en la TRD para exportar.");
        return;
      }

      dependencies.forEach((depName, index) => {
        if (index > 0) doc.addPage();

        // Encabezados
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("FORMATO DE TABLA DE RETENCIÓN DOCUMENTAL (TRD)", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("ENTIDAD PRODUCTORA: __________________________________________________________________", 14, 25);
        doc.text(`OFICINA PRODUCTORA: ${depName}`, 14, 30);

        // Sub-encabezado convenciones (derecha opcional, lo omitiremos en texto para simplificar y lo pondremos en las columnas)

        const head = [
          [
            { content: "CÓDIGO", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: "SERIES, SUBSERIES\nY TIPOS DOCUMENTALES", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: "SOPORTE o FORMATO", colSpan: 2, styles: { halign: 'center' } },
            { content: "RETENCIÓN", colSpan: 2, styles: { halign: 'center' } },
            { content: "DISPOSICIÓN FINAL", colSpan: 3, styles: { halign: 'center' } },
            { content: "REPRODUCCIÓN\nTÉCNICA DEL PAPEL\n(M/D)", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: "SERIE DE\nDDHH/DIH", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: "PROCEDIMIENTO", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
          ],
          [
            { content: "Papel", styles: { halign: 'center' } },
            { content: "Electrónico", styles: { halign: 'center' } },
            { content: "Archivo de\nGestión", styles: { halign: 'center' } },
            { content: "Archivo\nCentral", styles: { halign: 'center' } },
            { content: "CT", styles: { halign: 'center' } },
            { content: "S", styles: { halign: 'center' } },
            { content: "E", styles: { halign: 'center' } }
          ]
        ];

        const body = groupedByDep[depName].map(row => {
           // Mapear valores lógicos
           // Soporte (Asumimos X si no la tiene o lo dejamos vacío si en la app no lo soportamos directo, o simulamos)
           const soportePapel = "X"; 
           const soporteElec = ""; 
           
           // Disposición. La convención CT/S/E. El text dice: "CT, S" pero las subcolumnas piden equis (X) en cada una
           const disp = (row.disposicion || "").toUpperCase();
           const ct = disp.includes("CT") || disp === "CONSERVACIÓN TOTAL" ? "X" : "";
           const s = disp.includes("S") || disp === "SELECCIÓN" ? "X" : "";
           const e = disp.includes("E") || disp === "ELIMINACIÓN" ? "X" : "";

           return [
             row.codigo || "",
             `${row.serie || ""}${row.subserie ? `\n> ${row.subserie}` : ""}\n- ${row.tipoDocumental || ""}`,
             soportePapel,
             soporteElec,
             row.retencionGestion || "",
             row.retencionCentral || "",
             ct,
             s,
             e,
             "", // Reproducción técnica (no tenemos la DB plana de M/D)
             "", // DDHH/DIH 
             ""  // Procedimiento
           ];
        });

        autoTable(doc, {
          startY: 35,
          head: head,
          body: body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, font: "helvetica", valign: 'middle' },
          headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0,0,0] },
          bodyStyles: { lineWidth: 0.1, lineColor: [0,0,0] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 60 },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'center', cellWidth: 15 },
            5: { halign: 'center', cellWidth: 15 },
            6: { halign: 'center', cellWidth: 10 },
            7: { halign: 'center', cellWidth: 10 },
            8: { halign: 'center', cellWidth: 10 },
            9: { halign: 'center', cellWidth: 20 },
            10: { halign: 'center', cellWidth: 15 }
          },
          didDrawPage: function (data) {
             // Si es la última página de esta oficina (o en cada hoja, según la norma generalmente es abajo del todo)
             // Dejaremos un espacio para las firmas sólo si hay hueco en la página abajo
          }
        });

        // Firmas obligatorias
        let finalY = doc.lastAutoTable.finalY + 10;
        if (finalY > doc.internal.pageSize.getHeight() - 40) {
           doc.addPage();
           finalY = 20;
        }

        autoTable(doc, {
          startY: finalY,
          head: [[
            "Jefe de la dependencia", 
            "Responsable del área de gestión documental",
            "Secretario General o cargo equivalente"
          ]],
          body: [
            ["Nombre:\nCargo:\n\nFirma:", "Nombre:\nCargo:\n\nFirma:", "Nombre:\nCargo:\n\nFirma:"]
          ],
          theme: 'grid',
          styles: { fontSize: 8, font: "helvetica", cellPadding: 4 },
          headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0,0,0] },
          bodyStyles: { lineWidth: 0.1, lineColor: [0,0,0], minCellHeight: 25 },
        });

        const nextY = doc.lastAutoTable.finalY + 5;
        autoTable(doc, {
           startY: nextY,
           body: [
             ["Fecha de Aprobación:", "__________________"],
             ["Fecha de Convalidación:", "__________________"]
           ],
           theme: 'plain',
           styles: { fontSize: 8, font: "helvetica", cellPadding: 2 },
           columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
        });
      });

      doc.save("TRD_Export_Ley594.pdf");
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    }
  };

  return (
    <header className="sticky top-0 z-10 flex min-h-[4rem] w-full items-center justify-between border-b border-border bg-background px-6 shadow-sm">
      <div className="flex items-center gap-4 py-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Centro de control documental</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visualiza indicadores, consulta TRD y ejecuta acciones con apoyo de IA.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-end">
        {/* Conditional rendering for TRD specific buttons */}
        {mainView === 'trd' && (
          <div className="flex items-center gap-3 mr-2">
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
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
            >
              <Download className="h-4 w-4" />
              Exportar TRD
            </button>
            <div className="w-px h-6 bg-border mx-1" />
          </div>
        )}

        {/* Global SaaS Buttons */}
        <button className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary hover:text-foreground transition-colors shadow-sm">
          <User className="h-4 w-4" />
          Cuenta
        </button>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
