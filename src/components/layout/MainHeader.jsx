import React from "react";
import { LogOut, User, Download, CheckCircle2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function MainHeader({ onLogout, mainView, trdProps, currentUser, onExportPDF, onNavigate }) {
  // Extract TRD props safely
  const { status = "Borrador", rows = [], availableDependencias = [], selectedDependencia = "TODAS", onSelectDependencia = () => {} } = trdProps || {};

  return (
    <header className="sticky top-0 z-10 flex min-h-[4rem] w-full items-center justify-between border-b border-border bg-background px-6 shadow-sm print:hidden">
      <div className="flex items-center gap-4 py-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Centro de control documental</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visualiza indicadores, consulta TRD y ejecuta acciones con apoyo de IA.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-end">
        {/* Botón de exportar y filtro selectivo para la Tabla Final */}
        {mainView === 'trd' && (
          <div className="flex items-center gap-3 mr-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 shadow-sm">
            
            <select
              title="Filtrar por TRD (Dependencia)"
              value={selectedDependencia}
              onChange={(e) => onSelectDependencia(e.target.value)}
              className="text-xs font-bold bg-white text-slate-700 outline-none border border-slate-200 rounded px-2 py-1.5 w-48 truncate"
            >
              <option value="TODAS">👉 TODAS LAS TRDs</option>
              {availableDependencias.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>

            <button
              onClick={onExportPDF}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-500 transition-all shadow-sm uppercase tracking-tighter"
            >
              <Printer className="h-4 w-4" />
              VISTA PREVIA PDF
            </button>
            <div className="w-px h-6 bg-border mx-1" />
          </div>
        )}

        {/* Global SaaS Buttons */}
        <button 
          onClick={() => onNavigate('settings')}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary hover:text-foreground transition-colors shadow-sm"
        >
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
