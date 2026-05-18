import React from 'react';
import { 
  LayoutDashboard, Database, Users, Settings, Search, 
  FileSignature, Building2, FileSpreadsheet, FileUp, 
  BrainCircuit, HelpCircle, Mail, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'entities', label: 'Entidades', icon: Building2 },
  { id: 'import', label: 'Importación', icon: FileUp },
  { id: 'rag', label: 'Biblioteca RAG', icon: BrainCircuit, badge: 'Neural' },
  { id: 'trd', label: 'Estructura TRD', icon: FileSpreadsheet, badge: 'Core' },
  { id: 'invitations', label: 'Invitaciones', icon: Mail },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'settings', label: 'Preferencias', icon: Settings },
  { id: 'help', label: 'Centro Ayuda', icon: HelpCircle },
];

export default function MainSidebar({ 
  activeView, 
  onNavigate, 
  searchQuery, 
  onSearchQueryChange, 
  currentUser, 
  currentEntity, 
  isOpen, 
  onClose, 
  pendingInvitationsCount = 0,
  isCollapsed = false,
  onToggleCollapse
}) {
  const role = currentUser?.role || 'user';
  const iaAvailable = currentUser?.iaDisponible ?? true;
  const [showIARestriction, setShowIARestriction] = React.useState(false);

  const filteredNav = MAIN_NAV.filter(item => {
    if (role === 'superadmin') return true;
    if (item.id === 'entities') return false;
    if (role === 'admin' || role === 'administrador') return true;
    if (role === 'user' || role === 'usuario' || role === 'Consulta') {
      return ['dashboard', 'rag', 'trd', 'settings', 'help', 'invitations'].includes(item.id);
    }
    return false;
  });

  const handleNavClick = (itemId) => {
    const isIAModule = itemId === 'import' || itemId === 'rag';
    if (isIAModule && !iaAvailable) { setShowIARestriction(true); return; }
    onNavigate(itemId);
    if (onClose && window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-slate-900/50 z-[60] lg:hidden transition-opacity backdrop-blur-[2px]",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 transition-all duration-300 z-[70] print:hidden border-r border-white/[0.04] relative",
          isCollapsed ? "lg:w-20 w-64" : "w-64",
          "fixed lg:relative inset-y-0 left-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Desktop collapse toggle button */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-[26px] h-6 w-6 items-center justify-center bg-slate-800 border border-white/[0.08] rounded-full shadow-md z-50 hover:bg-slate-700 transition-all text-slate-400 hover:text-white cursor-pointer active:scale-90"
          title={isCollapsed ? "Expandir Sidebar" : "Contraer Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {/* Brand */}
        <div className={cn(
          "px-5 py-5 border-b border-white/[0.05] flex items-center gap-3 relative transition-all duration-300",
          isCollapsed && "lg:px-3 lg:justify-center"
        )}>
          {currentEntity ? (
            currentEntity.logoUrl ? (
              <div className="h-9 w-9 rounded-lg bg-white/10 p-1.5 flex items-center justify-center shrink-0">
                <img src={currentEntity.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="h-9 w-9 bg-primary/15 rounded-lg flex items-center justify-center border border-primary/20 shrink-0">
                <span className="text-primary font-bold text-sm uppercase">{currentEntity.razonSocial?.substring(0,2)}</span>
              </div>
            )
          ) : (
            <div className="h-9 w-9 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/25 shrink-0">
              <FileSignature className="h-4 w-4 text-primary" />
            </div>
          )}
          
          <div className={cn("flex-1 min-w-0 transition-opacity duration-200", isCollapsed && "lg:hidden")}>
            {currentEntity ? (
              <p className="text-white font-semibold text-[13px] leading-tight truncate" title={currentEntity.razonSocial}>
                {currentEntity.razonSocial}
              </p>
            ) : (
              <p className="text-white font-bold text-[15px] leading-tight tracking-tight">
                OSE <span className="text-primary">IA</span>
              </p>
            )}
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-[0.15em] mt-0.5">
              {currentEntity ? 'Sistema Documental' : 'Neural Archival'}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className={cn("px-4 pt-4 pb-2 transition-all duration-300", isCollapsed && "lg:px-2 lg:flex lg:justify-center")}>
          {isCollapsed ? (
            <button 
              onClick={onToggleCollapse} 
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-all cursor-pointer"
              title="Expandir para buscar..."
            >
              <Search className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-primary/30 focus:bg-white/[0.06] transition-all"
              />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-4 space-y-0.5 lg:scrollbar-thin">
          {filteredNav.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative text-left cursor-pointer",
                  isCollapsed && "lg:justify-center lg:px-0 lg:h-10 lg:w-10 lg:mx-auto",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                )}
              >
                {isActive && <div className="absolute left-0 w-0.5 h-4 bg-primary rounded-full lg:left-1" />}
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300")} />
                <span className={cn("text-[12.5px] font-medium flex-1 transition-all duration-200", 
                  isActive && "font-semibold",
                  isCollapsed && "lg:hidden"
                )}>
                  {item.label}
                </span>

                {!isCollapsed && (item.badge || (item.id === 'invitations' && pendingInvitationsCount > 0)) && (
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-white/5 text-slate-500"
                  )}>
                    {item.id === 'invitations' && pendingInvitationsCount > 0 ? pendingInvitationsCount : item.badge}
                  </span>
                )}
                
                {isCollapsed && item.id === 'invitations' && pendingInvitationsCount > 0 && (
                  <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-slate-900 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        {currentUser && (
          <div className={cn("px-4 py-4 border-t border-white/[0.05] transition-all duration-300", isCollapsed && "lg:px-2 lg:flex lg:justify-center")}>
            <div className="flex items-center gap-3">
              <div 
                className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0"
                title={isCollapsed ? `${currentUser.nombre || currentUser.email} (${currentUser.role || 'usuario'})` : undefined}
              >
                <span className="text-primary text-[10px] font-bold uppercase">
                  {currentUser.nombre?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className={cn("flex-1 min-w-0 transition-opacity duration-200", isCollapsed && "lg:hidden")}>
                <p className="text-[12px] font-medium text-slate-200 truncate">
                  {currentUser.nombre || currentUser.email}
                </p>
                <p className="text-[10px] text-slate-500 capitalize">{currentUser.role || 'usuario'}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* IA Restriction Modal */}
      {showIARestriction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowIARestriction(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4">
            <div className="h-12 w-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Servicio restringido</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Si quieres este servicio, mejora tu plan o habla con tu administrador.
            </p>
            <button
              onClick={() => setShowIARestriction(false)}
              className="mt-1 w-full py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
