import { useState } from "react";
import { Building2, FolderOpen, FileText, Database, LayoutTemplate, Bot, ChevronLeft, ChevronRight, Network, FileUp, Menu, X, ChevronDown, Lock, Mail, Users, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "dependencias", label: "Dependencias", icon: Building2 },
  { id: "orgchart", label: "Organigramas", icon: Network },
  { id: "series", label: "Series", icon: FolderOpen },
  { id: "subseries", label: "Subseries", icon: FileText },
  { id: "trdform", label: "Valoración TRD", icon: Database },
  { id: "funciones", label: "Funciones", icon: FileText },
  { id: "entrevistas", label: "Entrevistas", icon: Users },
  { separator: true },
  { id: "generador_ia", label: "Reportes IA", icon: Wand2 },
  { id: "generador_manual", label: "Reportes Manuales", icon: FileText },
  { id: "datos", label: "Datos Estructurados", icon: Database },
  { id: "trd", label: "Tabla Final", icon: LayoutTemplate },
];

export default function Sidebar({ activeModule, onNavigate, isAgentOpen, onToggleAgent, currentUser, hasTrdData, pendingInvitationsCount = 0 }) {
  const role = currentUser?.role || 'usuario';
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const filteredItems = NAV_ITEMS.filter(item => {
    if (role === 'superadmin' || role === 'administrador') return true;
    // For 'usuario' role, only show these specific modules
    return ['orgchart', 'datos', 'trd'].includes(item.id) || item.separator;
  });

  return (
    <aside className="w-full lg:w-60 border-b lg:border-r border-border bg-card flex flex-col shadow-sm shrink-0">
      {/* Dynamic Orianna Toggle Button - Now at the Top */}
      {role !== 'usuario' && (
        <div className="p-4 border-b border-border/50 bg-secondary/20">
          <button
            onClick={onToggleAgent}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 border shadow-sm",
              isAgentOpen
                ? "bg-primary text-primary-foreground border-primary shadow-primary/20"
                : "bg-background text-foreground border-border hover:bg-secondary"
            )}
          >
            <Bot className={cn("h-4 w-4 shrink-0", isAgentOpen ? "text-primary-foreground" : "text-primary")} />
            <span className="flex-1 text-left">{isAgentOpen ? "Desactivar Orianna" : "Activar Orianna"}</span>
            {isAgentOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background lg:py-5 lg:bg-transparent">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider lg:px-2">Estructura Documental</h2>
        <button 
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          className="lg:hidden p-1.5 bg-slate-100 ring-1 ring-slate-200 rounded-md text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isMobileExpanded && "rotate-180")} />
        </button>
      </div>
      
      <nav className={cn(
        "flex-col p-3 space-y-1 lg:flex lg:flex-1 lg:overflow-y-auto",
        isMobileExpanded ? "flex" : "hidden"
      )}>
        {filteredItems.map((item, index) => {
          if (item.separator) {
            return <div key={`sep-${index}`} className="my-3 border-t border-border/50" />;
          }

          const isActive = activeModule === item.id;
          const isDisabled = item.id === 'trd' && !hasTrdData;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (!isDisabled) {
                  onNavigate(item.id);
                  setIsMobileExpanded(false);
                }
              }}
              disabled={isDisabled}
              title={isDisabled ? "Debes tener datos estructurados para ver la TRD" : ""}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : isDisabled
                  ? "opacity-40 grayscale cursor-not-allowed"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
              {item.label}
              {isDisabled && <span className="ml-auto text-[8px] bg-slate-100 px-1 rounded uppercase flex items-center gap-1"><Lock className="w-2 h-2"/> Bloqueado</span>}
            </button>
          );
        })}
      </nav>

      {/* Orianna Status - Bottom of SideBar */}
      {role !== 'usuario' && (
        <div className="hidden lg:block p-4 border-t border-border/50 bg-secondary/10">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground leading-tight">Orianna IA</h3>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">En línea</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
