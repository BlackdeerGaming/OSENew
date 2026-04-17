import React from "react";
import { LogOut, User, Download, CheckCircle2, Printer, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MainHeader({ 
  onLogout, mainView, trdProps, currentUser, onExportPDF, onNavigate,
  selectedEntityId, userEntities, onSelectEntity, onMenuToggle
}) {
  // Extract TRD props safely
  const { status = "Borrador", rows = [], availableDependencias = [], selectedDependencia = "TODAS", onSelectDependencia = () => {} } = trdProps || {};

  return (
    <header className="sticky top-0 z-50 flex flex-col w-full border-b border-border bg-background shadow-sm print:hidden">
      <div className="flex min-h-[4rem] w-full items-center justify-between px-4 lg:px-6 py-2 md:py-0">
        <div className="flex items-center gap-2 lg:gap-4">
          <button 
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm lg:text-xl font-bold text-foreground tracking-tight leading-tight md:leading-normal truncate max-w-[150px] md:max-w-none">Centro Documental</h1>
            <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 hidden xs:block truncate max-w-[200px] md:max-w-none">Visualiza indicadores, consulta TRD y ejecuta acciones con apoyo de IA.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
          {/* Selector de Entidad (Desktop) */}
          {userEntities?.length > 1 && (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contexto:</span>
              <select
                title="Cambiar entidad de trabajo"
                value={selectedEntityId}
                onChange={(e) => onSelectEntity(e.target.value)}
                className="text-xs font-bold bg-secondary/50 text-foreground border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              >
                {userEntities.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.razonSocial || ent.sigla}</option>
                ))}
              </select>
            </div>
          )}

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
          className="hidden xs:flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all shadow-sm"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Cerrar sesión</span>
        </button>
        </div>
      </div>

      {/* Selector de Entidad (Mobile Centered) */}
      {userEntities?.length > 1 && (
        <div className="flex md:hidden w-full px-4 pb-3 items-center justify-center">
          <select
            title="Cambiar entidad de trabajo"
            value={selectedEntityId}
            onChange={(e) => onSelectEntity(e.target.value)}
            className="w-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 rounded-lg px-4 py-2 text-center text-center-last focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
          >
            {userEntities.map(ent => (
              <option key={ent.id} value={ent.id}>🏢 {ent.razonSocial || ent.sigla}</option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
}
