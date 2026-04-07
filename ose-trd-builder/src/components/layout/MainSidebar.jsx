import React from 'react';
import { LayoutDashboard, Bot, Database, Users, Settings, Search, FileSignature, Building2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'entities', label: 'Entidades', icon: Building2 },
  { id: 'copilot', label: 'Copiloto IA', icon: Bot },
  { id: 'trd', label: 'TRD', icon: Database },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function MainSidebar({ activeView, onNavigate, searchQuery, onSearchQueryChange, currentUser, isOpen, onToggle }) {
  const role = currentUser?.role || 'user';

  const filteredNav = MAIN_NAV.filter(item => {
    if (role === 'superadmin') return true;
    if (item.id === 'entities') return false;
    if (role === 'admin') return item.id !== 'copilot';
    if (role === 'user') return item.id !== 'copilot' && item.id !== 'users';
    return false;
  });
  return (
    <aside className={cn(
      "w-64 bg-[#0a1128] text-slate-300 flex flex-col h-full shadow-xl shrink-0 transition-all duration-300 fixed lg:static inset-y-0 left-0 z-40 lg:z-20",
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center shadow-lg">
            <FileSignature className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">OSE</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Gestión Inteligente</p>
          </div>
        </div>
        
        {/* Close button for mobile */}
        <button 
          onClick={onToggle}
          className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
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
      
      <div className="p-4 mt-auto border-t border-white/10 flex items-center justify-center">
        <div className="bg-white/5 rounded-full px-3 py-1 text-[10px] text-slate-400 border border-white/10 font-medium tracking-wide">
          OSE Copilot v1.0
        </div>
      </div>
    </aside>
  );
}
