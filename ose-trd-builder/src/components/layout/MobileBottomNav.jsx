import React from 'react';
import { LayoutDashboard, Database, Bot, Users, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileBottomNav({ activeView, onNavigate, onToggleSidebar, currentUser }) {
  const role = currentUser?.role || 'user';

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'trd', label: 'TRD', icon: Database },
    { id: 'copilot', label: 'IA', icon: Bot, hidden: role === 'admin' || role === 'user' },
    { id: 'users', label: 'Usuarios', icon: Users, hidden: role === 'user' },
  ].filter(item => !item.hidden);

  return (
    <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
      <div className="bg-slate-900/80 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 min-w-[64px]",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/30" 
                  : "text-slate-400 active:bg-white/10"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive ? "animate-in zoom-in duration-300" : "")} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          );
        })}
        
        <button
          onClick={onToggleSidebar}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400 active:bg-white/10 min-w-[64px]"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Menú</span>
        </button>
      </div>
    </nav>
  );
}
