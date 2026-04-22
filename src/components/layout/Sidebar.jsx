import { useState } from "react";
import { Building2, FolderOpen, FileText, Database, LayoutTemplate, Bot, ChevronLeft, ChevronRight, Network, FileUp, Menu, X, ChevronDown, Lock, Mail, Users, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "import", label: "Importar por IA", icon: FileUp },
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
    <aside className="w-full lg:w-64 border-b lg:border-r border-slate-200 bg-white flex flex-col shadow-xl shrink-0 z-20">
      {/* Dynamic Orianna Toggle Button - Now at the Top */}
      {role !== 'usuario' && (
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={onToggleAgent}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border shadow-lg active:scale-95",
              isAgentOpen
                ? "bg-primary text-white border-primary shadow-primary/20"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Bot className={cn("h-4 w-4 shrink-0", isAgentOpen ? "text-white" : "text-primary")} />
            <span className="flex-1 text-left">{isAgentOpen ? "Ocultar Orianna" : "Consultar Orianna"}</span>
            {isAgentOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between p-5 lg:py-6">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] lg:px-2">Estructura TRD</h2>
        <button 
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          className="lg:hidden p-2 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-all"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", isMobileExpanded && "rotate-180")} />
        </button>
      </div>
      
      <nav className={cn(
        "flex-col p-4 space-y-2 lg:flex lg:flex-1 lg:overflow-y-auto custom-scrollbar",
        isMobileExpanded ? "flex" : "hidden"
      )}>
        {filteredItems.map((item, index) => {
          if (item.separator) {
            return <div key={`sep-${index}`} className="my-4 border-t border-slate-100" />;
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
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all duration-300 group relative",
                isActive 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : isDisabled
                  ? "opacity-30 grayscale cursor-not-allowed"
                  : "text-slate-500 hover:bg-slate-50 hover:text-primary"
              )}
            >
              {isActive && <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />}
              <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-slate-400 group-hover:text-primary")} />
              <span className="flex-1 text-left">{item.label}</span>
              {isDisabled && <span className="ml-auto text-[8px] bg-slate-100 px-1.5 py-0.5 rounded uppercase flex items-center gap-1 font-black"><Lock className="w-2.5 h-2.5"/></span>}
            </button>
          );
        })}
      </nav>

      {/* Orianna Status - Bottom of SideBar */}
      {role !== 'usuario' && (
        <div className="hidden lg:block p-6 border-t border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-4 px-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/20 relative">
              <Bot className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter">Orianna <span className="text-primary font-black italic">IA</span></h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Motor Activo</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
