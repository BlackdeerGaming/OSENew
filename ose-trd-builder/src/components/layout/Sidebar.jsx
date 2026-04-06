import React from "react";
import { Building2, FolderOpen, FileText, Database, LayoutTemplate, Bot, ChevronLeft, ChevronRight, Network } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "dependencias", label: "Dependencias", icon: Building2 },
  { id: "orgchart", label: "Organigramas", icon: Network },
  { id: "series", label: "Series", icon: FolderOpen },
  { id: "subseries", label: "Subseries", icon: FileText },
  { id: "trdform", label: "Valoración TRD", icon: Database },
  { separator: true },
  { id: "datos", label: "Datos Estructurados", icon: Database },
  { id: "trd", label: "Tabla Final", icon: LayoutTemplate },
];

export default function Sidebar({ activeModule, onNavigate, isAgentOpen, onToggleAgent, currentUser }) {
  const role = currentUser?.role || 'user';

  const filteredItems = NAV_ITEMS.filter(item => {
    if (role === 'superadmin' || role === 'admin') return true;
    // For 'user' role, only show these specific modules
    return ['orgchart', 'datos', 'trd'].includes(item.id) || item.separator;
  });

  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col h-full shadow-sm shrink-0">
      <div className="p-4 py-5 border-b border-border/50">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Estructura</h2>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item, index) => {
          if (item.separator) {
            return <div key={`sep-${index}`} className="my-3 border-t border-border/50" />;
          }

          const isActive = activeModule === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Agent Toggle Button - Only for SuperAdmin/Admin if they use it for builders */}
      {role !== 'user' && (
        <div className="p-3 border-t border-border/50">
          <button
            onClick={onToggleAgent}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 border",
              isAgentOpen
                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                : "text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
            )}
          >
            <Bot className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{isAgentOpen ? "Ocultar Agente" : "Mostrar Agente"}</span>
            {isAgentOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </aside>
  );
}
