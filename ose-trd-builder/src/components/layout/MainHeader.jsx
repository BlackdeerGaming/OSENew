import React from "react";
import { LogOut, User, Download, CheckCircle2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function MainHeader({ onLogout, mainView, trdProps, onExportPDF, toggleSidebar }) {
  // Extract TRD props safely
  const { status = "Borrador", rows = [] } = trdProps || {};

  return (
    <header className="h-14 sm:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-sm transition-all duration-300 print:hidden">
      
      {/* Menu / Breadcrumb */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-all active:scale-95"
        >
          <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
        
        <div className="flex flex-col">
          <h2 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight">
            {VIEW_TITLES[mainView] || 'Módulo OSE'}
          </h2>
          <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Sistema TRD Inteligente</span>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4 flex-wrap justify-end">
        {/* Conditional rendering for TRD specific buttons */}
        {mainView === 'trd' && (
          <div className="flex items-center gap-2 lg:gap-3 mr-1 lg:mr-2">
            <span
              className={cn(
                "hidden md:flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border text-nowrap",
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
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs lg:text-sm font-black text-white hover:bg-emerald-500 transition-all shadow-lg uppercase tracking-tighter"
              >
                <Download className="h-4 w-4" />
                GENERAR PDF OFICIAL (DANE)
              </button>
            )}
          </div>
        )}
      </div>

        {/* Global SaaS Buttons */}
        <button className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs lg:text-sm font-medium text-foreground hover:bg-secondary hover:text-foreground transition-colors shadow-sm">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Cuenta</span>
        </button>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs lg:text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
