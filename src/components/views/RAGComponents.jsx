import React from 'react';
import { 
  FileText, Database, BrainCircuit, Search, Clock, 
  Trash2, Eye, Download, Pencil, CheckCircle2, 
  AlertCircle, Loader2, Send, MessageSquare, X,
  ChevronRight, BookOpen, HardDrive, Filter, Globe, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DocumentCard({ doc, isSuperAdmin, onEdit, onDelete, onView }) {
  const meta = doc.metadata || {};
  const displayName = meta.label || doc.filename || 'Sin nombre';
  const isInternal = !!meta.is_trd_internal;
  const status = meta.status || 'success';
  const type = meta.type || 'general';

  return (
    <div className="group relative bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-1">
      <div className="flex items-start justify-between mb-6">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner border transition-colors",
          isInternal ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-primary/5 border-primary/10 text-primary"
        )}>
          {isInternal ? <Shield className="w-7 h-7" /> : <FileText className="w-7 h-7" />}
        </div>
        
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionButton onClick={() => onView(doc)} icon={Eye} label="Ver" color="blue" />
          {isSuperAdmin && <ActionButton onClick={() => onEdit(doc)} icon={Pencil} label="Editar" color="primary" />}
          {isSuperAdmin && <ActionButton onClick={() => onDelete(doc.id)} icon={Trash2} label="Borrar" color="rose" />}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="font-black text-slate-900 text-sm uppercase italic tracking-tighter leading-tight truncate" title={displayName}>
            {displayName}
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
            {doc.filename}
          </p>
        </div>

        {meta.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
            {meta.description}
          </p>
        )}

        <div className="pt-4 flex flex-wrap gap-2">
          {isInternal && (
            <Badge color="indigo" icon={Shield}>Interno TRD</Badge>
          )}
          <Badge color="slate" icon={HardDrive}>{type}</Badge>
          <Badge color={status === 'success' ? 'emerald' : 'rose'} icon={status === 'success' ? CheckCircle2 : AlertCircle}>
            {status === 'success' ? 'Indexado' : 'Error'}
          </Badge>
        </div>
      </div>

      {/* Hover effect background icon */}
      <div className="absolute -bottom-4 -right-4 opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-700 group-hover:scale-150 group-hover:-rotate-12 pointer-events-none">
        <Database className="w-32 h-32" />
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, label, color }) {
  const colors = {
    blue: "text-blue-500 hover:bg-blue-50",
    primary: "text-primary hover:bg-primary/5",
    rose: "text-rose-500 hover:bg-rose-50"
  };

  return (
    <button
      onClick={onClick}
      className={cn("p-2 rounded-xl transition-all active:scale-90", colors[color])}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function Badge({ children, color, icon: Icon }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    primary: "bg-primary/5 text-primary border-primary/10",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    slate: "bg-slate-50 text-slate-500 border-slate-100"
  };

  return (
    <div className={cn("px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", colors[color])}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </div>
  );
}

export function ChatBubble({ message, isTyping }) {
  const isAssistant = message.role === 'assistant';
  
  return (
    <div className={cn(
      "flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500",
      !isAssistant && "flex-row-reverse"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform hover:scale-105",
        isAssistant 
          ? "bg-white border border-slate-100 text-primary shadow-primary/5" 
          : "bg-slate-900 text-white shadow-slate-900/10"
      )}>
        {isAssistant ? <BrainCircuit className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </div>

      <div className="flex flex-col gap-2 max-w-[85%]">
        <div className={cn(
          "px-6 py-4 rounded-[2rem] text-sm leading-relaxed shadow-sm",
          isAssistant
            ? "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
            : "bg-primary text-white rounded-tr-none font-medium shadow-primary/20"
        )}>
          {isTyping ? (
            <div className="flex gap-1.5 items-center h-5">
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>
        
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2">
            {message.sources.map(s => (
              <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-black rounded-full border border-slate-200">
                PÁGINA {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
