import React from "react";
import { LogOut, User, Printer, Menu, ChevronDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MainHeader({
  onLogout, mainView, trdProps, currentUser, onExportPDF, onNavigate,
  selectedEntityId, userEntities, onSelectEntity, onMenuToggle
}) {
  const { status = "Borrador", rows = [], availableDependencias = [], selectedDependencia = "TODAS", onSelectDependencia = () => {} } = trdProps || {};

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm print:hidden">
      <div className="flex h-14 w-full items-center justify-between px-4 lg:px-6 gap-4">

        {/* Left: menu toggle + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold text-foreground leading-tight truncate">
              Centro Documental
            </h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
              OSE IA · Gestión Archivística Inteligente
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Entity selector */}
          {userEntities?.length > 1 && (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Contexto:</span>
              <select
                value={selectedEntityId || ""}
                onChange={(e) => onSelectEntity(e.target.value)}
                className="text-[12px] font-bold bg-secondary/80 text-foreground border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:bg-secondary cursor-pointer min-w-[140px]"
              >
                {userEntities.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.razonSocial || ent.sigla || "Entidad"}</option>
                ))}
              </select>
            </div>
          )}


          {/* Account */}
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border bg-card px-3 py-1.5 rounded-md transition-colors hover:border-border/80"
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cuenta</span>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-[12px] font-medium text-destructive/80 hover:text-destructive border border-destructive/15 bg-destructive/5 px-3 py-1.5 rounded-md transition-colors hover:bg-destructive/10"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Mobile entity selector */}
      {userEntities?.length > 1 && (
        <div className="flex md:hidden w-full px-4 pb-2">
          <select
            value={selectedEntityId || ""}
            onChange={(e) => onSelectEntity(e.target.value)}
            className="w-full text-[12px] font-medium bg-secondary text-foreground border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {userEntities.map(ent => (
              <option key={ent.id} value={ent.id}>{ent.razonSocial || ent.sigla}</option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
}
