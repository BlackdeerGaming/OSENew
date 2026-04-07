import React from 'react';
import { FileText, AlertTriangle, Activity, BrainCircuit, MessageSquare, Send, CheckCircle2, ChevronRight, Download, Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function DashboardView({ stats, searchQuery, currentUser }) {
  const role = currentUser?.role || 'user';
  const [messages, setMessages] = React.useState([
    {
      id: 1,
      role: 'assistant',
      content: `¡Hola! Soy OSE Copilot. Analicé tus tablas de retención y encontré ${stats.expiredDocs} documentos vencidos en el Archivo de Gestión. ¿En qué te ayudo hoy?`
    }
  ]);
  const [inputValue, setInputValue] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);

  const handleSendMessage = async (text) => {
    const query = text || inputValue;
    if (!query.trim() || isTyping) return;

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: query }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      if (!response.ok) throw new Error("Error en el servidor");
      const data = await response.json();

      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: "Lo siento, ha ocurrido un error al conectar con el servidor."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const showMetrics = role === 'superadmin' || role === 'admin';
  const showCopilot = role === 'superadmin';
  const showAnalysis = role === 'superadmin' || role === 'admin';
  const showActions = role === 'superadmin' || role === 'admin';

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full h-full flex flex-col gap-4 sm:gap-6">
      
      {/* Top Cards Indicator */}
      {showMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <StatsCard 
            title="Documentos totales" 
            value={stats.totalDocs} 
            subtitle="+12% vs mes anterior"
            icon={FileText} 
            trend="up"
          />
          <StatsCard 
            title="Vencidos" 
            value={stats.expiredDocs} 
            subtitle="Requieren acción inmediata"
            icon={AlertTriangle} 
            trend="down"
            alert
          />
          <StatsCard 
            title="Riesgo documental" 
            value={stats.riskLevel} 
            subtitle="Basado en alertas activas"
            icon={Activity} 
            statusColor={stats.riskLevel === 'Alto' ? 'text-destructive' : stats.riskLevel === 'Medio' ? 'text-warning' : 'text-success'}
          />
          <StatsCard 
            title="Consultas IA" 
            value={stats.aiQueries} 
            subtitle="Uso mensual del copiloto"
            icon={BrainCircuit} 
          />
        </div>
      )}

      <div className={cn(
        "grid gap-6 flex-1 min-h-0",
        showCopilot ? "grid-cols-1 xl:grid-cols-3" : "grid-cols-1"
      )}>
        
        {/* Left Column: Copilot Integration */}
        {showCopilot && (
          <div className="xl:col-span-1 rounded-xl bg-card border border-border shadow-sm flex flex-col h-full overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="p-5 border-b border-border bg-slate-50/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <BotIcon />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Copiloto IA</h3>
                  <p className="text-xs text-muted-foreground">Consulta, interpreta y recomienda acciones</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 p-5 overflow-y-auto bg-slate-50/30 flex flex-col gap-4">
               {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm", msg.role === 'user' ? "bg-slate-200" : "bg-primary")}>
                      {msg.role === 'user' ? <MessageSquare className="w-4 h-4 text-slate-600" /> : <BotIcon className="w-4 h-4 text-white" />}
                    </div>
                    <div className={cn(
                      "rounded-2xl p-3 shadow-sm text-sm max-w-[85%] whitespace-pre-wrap",
                      msg.role === 'user' 
                        ? "bg-slate-800 text-white rounded-tr-sm" 
                        : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"
                    )}>
                      {msg.content}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 text-[10px] text-slate-400 font-medium">
                          Fuentes: Pág {msg.sources.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
               ))}

               {isTyping && (
                  <div className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <BotIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 shadow-sm text-xs text-slate-400">
                      Escribiendo...
                    </div>
                  </div>
               )}

               <div className="mt-auto space-y-2 pt-4">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Sugerencias:</span>
                 {[
                   "¿Qué documentos debo eliminar este mes?",
                   "Muéstrame contratos del área jurídica",
                   "¿Tiempo de retención de historias laborales?",
                   "Resume los riesgos actuales"
                 ].map((q, i) => (
                   <button 
                    key={i} 
                    onClick={() => handleSendMessage(q)}
                    disabled={isTyping}
                    className="w-full text-left text-xs bg-white border border-slate-200 hover:border-primary/50 hover:bg-primary/5 rounded-lg p-2.5 transition-colors shadow-sm text-slate-600 flex items-center justify-between group"
                  >
                     {q}
                     <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                   </button>
                 ))}
               </div>
            </div>
            
            <div className="p-4 border-t border-border bg-white">
              <div className="relative">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isTyping}
                  placeholder="Escribe tu consulta..." 
                  className="w-full text-sm border-none bg-slate-100 rounded-full py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={isTyping || !inputValue.trim()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Analytics & Data */}
        <div className={cn(
          "flex flex-col gap-6 h-full",
          showCopilot ? "xl:col-span-2" : "xl:col-span-1"
        )}>
          
          {/* Analysis Cards - Scrollable on mobile */}
          {showAnalysis && (
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-2 sm:pb-0 animate-in fade-in duration-700 scrollbar-hide">
              <div className="min-w-[140px] flex-1">
                <AnalysisWidget title="Resultado" desc="45 series" type="neutral" />
              </div>
              <div className="min-w-[140px] flex-1">
                <AnalysisWidget title="Análisis" desc="Facturación" type="info" />
              </div>
              <div className="min-w-[140px] flex-1">
                <AnalysisWidget title="Riesgos" desc="3 pendientes" type="warning" />
              </div>
              <div className="min-w-[140px] flex-1">
                <AnalysisWidget title="Recomendación" desc="Generar acta" type="success" />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {showActions && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 animate-in fade-in slide-in-from-left-4 duration-500">
              <button className="shrink-0 flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
                <FileText className="w-4 h-4" /> Generar acta
              </button>
              <button className="shrink-0 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors">
                <Download className="w-4 h-4" /> Exportar Excel
              </button>
              <button className="shrink-0 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors">
                <Eye className="w-4 h-4" /> Ver detalle
              </button>
              <button className="shrink-0 flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-destructive hover:text-white transition-all ml-auto">
                <Trash2 className="w-4 h-4" /> Marcar para eliminación
              </button>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden flex flex-col flex-1 animate-in zoom-in-95 duration-700">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-slate-50/50 shrink-0">
               <h3 className="font-bold text-foreground">Documentos identificados</h3>
               <div className="flex items-center gap-2">
                 <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-md font-medium">0 registros</span>
                 {role === 'user' && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md font-bold uppercase tracking-wider">Modo Consulta</span>
                 )}
               </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Serie</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="4" className="px-5 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 opacity-20" />
                        <p>No hay documentos identificados actualmente.</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Subcomponents

function BotIcon({ className }) {
  return <BrainCircuit className={cn("w-4 h-4 sm:w-5 sm:h-5", className)} />;
}

function StatsCard({ title, value, subtitle, icon: Icon, trend, alert, statusColor }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-12 h-12 sm:w-16 sm:h-16" />
      </div>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <h4 className={cn("text-xl sm:text-2xl font-bold mt-1", statusColor || "text-slate-800")}>{value}</h4>
        </div>
        <div className={cn("p-2 sm:p-2.5 rounded-lg", alert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        {!statusColor && (
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", trend === 'up' ? "bg-success/10 text-success" : trend === 'down' ? "bg-warning/10 text-warning" : "bg-slate-100 text-slate-600")}>
            {subtitle.split(" ")[0]}
          </span>
        )}
        <span className="text-xs text-slate-500">{statusColor ? subtitle : subtitle.substring(subtitle.indexOf(" ") + 1)}</span>
      </div>
    </div>
  );
}

function AnalysisWidget({ title, desc, type }) {
  const styles = {
    neutral: "border-slate-200 bg-white",
    info: "border-primary/20 bg-primary/5",
    warning: "border-warning/30 bg-warning/10",
    success: "border-success/30 bg-success/10"
  };

  const textStyles = {
    neutral: "text-slate-800",
    info: "text-primary",
    warning: "text-warning-foreground",
    success: "text-success"
  };

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", styles[type])}>
       <p className="text-xs font-semibold text-slate-500 mb-1">{title}</p>
       <p className={cn("text-sm font-bold leading-tight", textStyles[type])}>{desc}</p>
    </div>
  );
}
