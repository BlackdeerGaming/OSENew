import { LayoutDashboard, Bot, Database, Users, Settings, Search, FileSignature, Building2, Cpu, FileSpreadsheet, FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'entities', label: 'Empresas / Entidades', icon: Building2 },
  { id: 'import', label: 'Importación OCR', icon: FileUp },
  { id: 'rag', label: 'Biblioteca RAG', icon: Database },
  { id: 'copilot', label: 'Documencio (IA)', icon: Cpu },
  { id: 'trd', label: 'TRD', icon: FileSpreadsheet, badge: 'IA' },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function MainSidebar({ activeView, onNavigate, searchQuery, onSearchQueryChange, currentUser, currentEntity }) {
  const role = currentUser?.role || 'user';

  const filteredNav = MAIN_NAV.filter(item => {
    // Si es super admin ve todo
    if (role === 'superadmin') return true;
    
    // Si no es super admin, le bloqueamos Entidades explícitamente
    if (item.id === 'entities') return false;

    if (role === 'admin') {
      return item.id !== 'copilot';
    }
    
    if (role === 'user') {
      return item.id !== 'copilot' && item.id !== 'users';
    }
    
    return false;
  });

  return (
    <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col h-full shadow-xl shrink-0 transition-all duration-300 relative z-20 print:hidden">
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
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] font-semibold" 
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-500")} />
              {item.label}
            </button>
          );
        })}
      </nav>
      
      {/* Footer removed */}
    </aside>
  );
}
