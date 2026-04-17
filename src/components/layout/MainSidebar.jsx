import React from 'react';
import { LayoutDashboard, Database, Users, Settings, Search, FileSignature, Building2, FileSpreadsheet, FileUp, BrainCircuit, HelpCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'entities', label: 'Empresas / Entidades', icon: Building2 },
  { id: 'import', label: 'Importación TRD', icon: FileUp },
  { id: 'rag', label: 'Biblioteca', icon: BrainCircuit, badge: 'RAG' },
  { id: 'trd', label: 'TRD', icon: FileSpreadsheet, badge: 'IA' },
  { id: 'invitations', label: 'Invitaciones', icon: Mail },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'settings', label: 'Configuración', icon: Settings },
  { id: 'help', label: 'Ayuda y Soporte', icon: HelpCircle },
];

export default function MainSidebar({ activeView, onNavigate, searchQuery, onSearchQueryChange, currentUser, currentEntity, isOpen, onClose, pendingInvitationsCount = 0 }) {
  const role = currentUser?.role || 'user';
  const iaAvailable = currentUser?.iaDisponible ?? true;
  const [showIARestriction, setShowIARestriction] = React.useState(false);

  const filteredNav = MAIN_NAV.filter(item => {
    // Si es super admin ve todo
    if (role === 'superadmin') return true;
    
    // Si no es super admin, le bloqueamos Entidades explícitamente
    if (item.id === 'entities') return false;

    if (role === 'admin') {
      return true; // Admin ve todo excepto Entidades
    }
    
    if (role === 'user' || role === 'usuario' || role === 'Consulta') {
      // Usuario de consulta solo ve: Dashboard, Biblioteca, TRD, Configuración e Invitaciones
      return ['dashboard', 'rag', 'trd', 'settings', 'help', 'invitations'].includes(item.id);
    }
    
    return false;
  });

  const handleNavClick = (itemId) => {
    const isIAModule = itemId === 'import' || itemId === 'rag';
    if (isIAModule && !iaAvailable) {
      setShowIARestriction(true);
      return;
    }
    onNavigate(itemId);
    if (onClose && window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/60 z-[60] lg:hidden transition-opacity backdrop-blur-sm", 
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )} 
        onClick={onClose} 
      />

      <aside 
        className={cn(
          "w-64 bg-[#0a1128] text-slate-300 flex flex-col h-full shadow-2xl lg:shadow-xl shrink-0 transition-transform duration-300 z-[70] print:hidden",
          "fixed lg:relative inset-y-0 left-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          {currentEntity ? (
             currentEntity.logoUrl ? (
                <img src={currentEntity.logoUrl} alt="Logo" className="w-10 h-10 object-contain bg-white rounded-lg p-1" />
             ) : (
                <div className="h-10 w-10 bg-primary/20 rounded-lg flex items-center justify-center shadow-lg border border-primary/50 shrink-0">
                   <span className="text-white font-bold text-sm uppercase">{currentEntity.razonSocial?.substring(0,2)}</span>
                </div>
             )
          ) : (
            <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shrink-0">
              <FileSignature className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {currentEntity ? (
              <h1 className="text-white font-bold text-sm leading-tight truncate" title={currentEntity.razonSocial}>
                 {currentEntity.razonSocial}
              </h1>
            ) : (
               <h1 className="text-white font-bold text-lg leading-tight">OSE</h1>
            )}
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold truncate">
               {currentEntity ? 'Portal Cliente' : 'Gestión Inteligente'}
            </p>
          </div>
        </div>

        <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 transition-colors group-focus-within:text-primary" />
            <input 
              type="text" 
              placeholder="Buscar módulo..." 
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full bg-[#111d40] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
            />
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {filteredNav.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            const isIAModule = item.id === 'import' || item.id === 'rag';
            const isLocked = isIAModule && !iaAvailable;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] font-semibold" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  isLocked && "opacity-40 grayscale-[0.5]"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-500")} />
                <span className="flex-1 text-left">{item.label}</span>
                {isLocked ? (
                  <span className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)]">
                    BLOQUEADO
                  </span>
                ) : (
                  <>
                    {item.badge && (
                      <span className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded-md",
                        item.badge === 'RAG' ? "bg-primary/20 text-primary" : "bg-purple-500/20 text-purple-400"
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {item.id === 'invitations' && pendingInvitationsCount > 0 && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white animate-bounce shadow-lg shadow-rose-500/50">
                        {pendingInvitationsCount}
                      </span>
                    )}
                  </>
                )}
                {isLocked && <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse ml-1" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* IA Restriction Modal */}
      {showIARestriction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowIARestriction(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            <div className="h-16 w-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-2">
              <BrainCircuit className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 leading-tight">Servicio restringido</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Si quieres este servicio, mejora tu plan o habla con tu administrador.
            </p>
            <button 
              onClick={() => setShowIARestriction(false)}
              className="mt-2 w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95 text-xs uppercase tracking-widest"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
