import React from 'react';
import { FileText, AlertTriangle, Activity, BrainCircuit, ChevronRight, Download, X, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function DashboardView({ stats, searchQuery, currentUser, seriesCount, activityLogs = [], trdRecords = [], currentEntity, onDownloadPDF, onRefresh, isRefreshing }) {
  const role = currentUser?.role || 'usuario';
  const [messages, setMessages] = React.useState([
    {
      id: 1,
      role: 'assistant',
      content: `¡Hola! Soy OSE Copilot. Analicé tus tablas de retención y encontré ${stats?.expiredDocs || 0} documentos vencidos. ¿En qué te ayudo hoy?`
    }
  ]);

  // Recuperar historial de Documencio al cargar
  React.useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser?.token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/chat-history/documencio`, {
          headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch (e) {
        console.error("Error cargando historial de Documencio:", e);
      }
    };
    fetchHistory();
  }, [currentUser]);

  // Persistir historial de Documencio automáticamente
  React.useEffect(() => {
    const saveHistory = async () => {
      // No guardar si solo está el mensaje de bienvenida inicial
      if (!currentUser?.token || messages.length <= 1) return;
      try {
        await fetch(`${API_BASE_URL}/chat-history/documencio`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.token}`
          },
          body: JSON.stringify({ messages })
        });
      } catch (e) {
        console.error("Error guardando historial de Documencio:", e);
      }
    };

    const timer = setTimeout(saveHistory, 1500); // 1.5s debounce
    return () => clearTimeout(timer);
  }, [messages, currentUser]);
  const [inputValue, setInputValue] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const [showActProposal, setShowActProposal] = React.useState(false);

  const handleSendMessage = async (text) => {
    const query = text || inputValue;
    if (!query.trim() || isTyping) return;

    const userMsgId = Date.now() + Math.random().toString(36).substr(2, 9);
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: query }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ 
          query,
          entidadId: currentEntity?.id 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(errorData.detail || "Error en el servidor");
      }
      
      const data = await response.json();

      setMessages(prev => [...prev, {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + "_err",
        role: 'assistant',
        content: `Error: ${error.message}`
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const showMetrics = role === 'superadmin' || role === 'administrador';
  const showAnalysis = role === 'superadmin' || role === 'administrador';
  const showActions = role === 'superadmin' || role === 'administrador';
  const iaAvailable = currentUser?.iaDisponible ?? true;

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === "Invalid Date") return "Sin fecha";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Sin fecha";
    
    try {
      return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date).toUpperCase();
    } catch (e) {
      console.error("Format error:", e);
      return "Error formato";
    }
  };

  const handleExportCSV = () => {
    if (activityLogs.length === 0) return;
    const headers = ["ID Acción", "Usuario", "Actividad", "Fecha y Hora"];
    const csvContent = [
      headers.join(","),
      ...activityLogs.map(log => [
        log.id.replace('act_', ''),
        `"${log.user || 'Sistema'}"`,
        `"${log.message}"`,
        `"${formatDate(log.timestamp)}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RegistroActividad_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // L\u00f3gica de Recomendaciones Reales
  const recommendations = React.useMemo(() => {
    const recs = [];
    if (!stats) return [{ title: "Cargando", desc: "Preparando recomendaciones...", type: "neutral" }];
    
    if (stats.expiredDocs > 0) recs.push({ title: "Eliminación", desc: "Revisar documentos vencidos para eliminación", type: "success" });
    if (stats.unapprovedTRDs > 0) recs.push({ title: "Aprobación", desc: `Revisar y aprobar ${stats.unapprovedTRDs} TRD pendientes`, type: "warning" });
    if (stats.totalDocs > 100) recs.push({ title: "Transferencia", desc: "Programar transferencia documental al Archivo Central", type: "info" });
    
    // Default if nothing critical
    if (recs.length === 0) recs.push({ title: "Mantenimiento", desc: "Validar integridad de tablas de retenci\u00f3n", type: "neutral" });
    return recs;
  }, [stats]);

  // Agrupar registros por dependencia para mostrarlos individualmente
  const trdsByOficina = React.useMemo(() => {
    const groups = {};
    trdRecords.forEach(rec => {
      const key = rec.dependencia || "OFICINA GENERAL";
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    });
    return Object.entries(groups).map(([name, records]) => ({ name, count: records.length }));
  }, [trdRecords]);

  return (
    <div className="flex-1 p-5 md:p-8 overflow-y-auto w-full h-full flex flex-col gap-7 bg-background">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-primary uppercase tracking-[0.15em]">
            <Activity className="h-3 w-3" /> Sistema Activo
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Dashboard <span className="text-primary">Ejecutivo</span>
          </h1>
        </div>

        {showMetrics && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-[12px] font-medium transition-all hover:border-primary/30 active:scale-95",
              isRefreshing ? "text-primary opacity-70 cursor-not-allowed" : "text-muted-foreground hover:text-primary"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5 transition-transform duration-500", isRefreshing ? "animate-spin" : "")} />
            {isRefreshing ? "Sincronizando..." : "Actualizar"}
          </button>
        )}
      </header>

      {/* Top Cards Indicator */}
      {showMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <StatsCard 
            title="Documentos" 
            value={stats.totalDocs} 
            subtitle={stats.trend}
            icon={FileText} 
            trend="up"
            isRefreshing={isRefreshing}
          />
          <StatsCard 
            title="Alertas Vencimiento" 
            value={stats.expiredDocs} 
            subtitle="Tablas de Retenci\u00f3n"
            icon={AlertTriangle} 
            trend="down"
            alert={stats.expiredDocs > 0}
            isRefreshing={isRefreshing}
          />
          {iaAvailable && (
            <StatsCard 
              title="Consumo IA" 
              value={stats.tokensUsed} 
              subtitle="Tokens procesados"
              icon={BrainCircuit} 
              isRefreshing={isRefreshing}
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 flex-1 min-h-0">
        
        {role === 'usuario' && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h2 className="text-[14px] font-semibold text-foreground">Consulta de Tablas Oficiales</h2>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">Reportes TRD vigentes para descarga y auditoría.</p>
                </div>
                <div className="h-8 w-8 bg-primary/8 rounded-lg text-primary flex items-center justify-center border border-primary/10">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dependencia</th>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Entidad</th>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Actualizado</th>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trdsByOficina.length > 0 ? (
                      trdsByOficina.map((trd, idx) => (
                        <tr key={idx} className="hover:bg-secondary/30 transition-colors group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 bg-secondary text-muted-foreground rounded-md flex items-center justify-center group-hover:bg-primary/8 group-hover:text-primary transition-colors border border-border shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-medium text-foreground text-[13px] block">{trd.name}</span>
                                <span className="text-[10px] text-muted-foreground">{trd.count} registros</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-[12.5px] text-muted-foreground">
                            {currentUser?.entidadNombre || currentEntity?.razonSocial || "OSE"}
                          </td>
                          <td className="px-5 py-3.5 text-[12px] text-muted-foreground">
                            {new Date().toLocaleDateString('es-CO')}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex justify-center">
                              <button
                                onClick={() => onDownloadPDF && onDownloadPDF(trd.name)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-md text-[11.5px] font-medium hover:bg-primary transition-all active:scale-95"
                              >
                                <Download className="w-3 h-3" /> Descargar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-[12.5px]">
                          No hay registros TRD disponibles para consulta.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-primary/[0.02] flex items-center gap-3">
                <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-[11.5px] text-muted-foreground">
                  Portal de <strong className="text-primary">Sólo Consulta</strong>. Las modificaciones requieren perfil administrador.
                </p>
              </div>
            </div>
          </div>
        )}

        {role !== 'usuario' && (
          <div className="flex-1 flex flex-col gap-6 h-full">

            {showAnalysis && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-700">
                <AnalysisWidget title="Series" desc={`${stats.totalDocs > 0 ? seriesCount : 0}`} type="info" />
                <AnalysisWidget title="Estado" desc={stats.expiredDocs > 0 ? "Cr\u00edtico" : "\u00d3ptimo"} type="neutral" />
                <AnalysisWidget title="Pendientes" desc={`${stats.unapprovedTRDs}`} type="warning" />
                <AnalysisWidget title="Insight" desc={recommendations[0].desc} type="success" />
              </div>
            )}

            {showActions && (
              <div className="flex items-center gap-2 overflow-x-auto animate-in fade-in duration-500">
                <button
                  onClick={() => console.log("Refrescando...")}
                  className="shrink-0 flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-primary/90 transition-all active:scale-95"
                >
                  <Activity className="w-3.5 h-3.5" /> Actualizar Logs
                </button>
                <button
                  onClick={handleExportCSV}
                  className="shrink-0 flex items-center gap-2 bg-card border border-border text-muted-foreground px-4 py-2 rounded-lg text-[12px] font-medium hover:text-foreground hover:border-border/80 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar Registro
                </button>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col flex-1 animate-in fade-in duration-500">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
                <div>
                  <h3 className="font-semibold text-foreground text-[13.5px]">Trazabilidad del Sistema</h3>
                  <span className="text-[11px] text-muted-foreground">Monitoreo de acciones en tiempo real</span>
                </div>
                <div className="px-3 py-1 bg-card border border-border rounded-md text-[11px] font-medium text-primary">
                  {activityLogs.length} registros
                </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full min-w-[600px] text-sm text-left">
                  <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Usuario</th>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actividad</th>
                      <th className="px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activityLogs.length > 0 ? (
                      activityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">#{log.id.substring(log.id.length - 6)}</td>
                          <td className="px-5 py-3 font-medium text-foreground text-[12.5px]">{log.user || 'Sistema'}</td>
                          <td className="px-5 py-3 text-muted-foreground text-[12.5px]">{log.message}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatDate(log.timestamp)}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-5 py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                            <Activity className="w-10 h-10 text-muted-foreground" />
                            <p className="text-[12px] text-muted-foreground">Sin actividad registrada</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showActProposal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowActProposal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight text-slate-900">Propuesta de Acta de Eliminación</h3>
                  <p className="text-sm text-slate-500 font-medium">Protocolo archivístico automatizado (DANE)</p>
                </div>
              </div>
              <button onClick={() => setShowActProposal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
               <StepItem num="1" title="Detección" desc="Identificación de registros con retención vencida." active />
               <StepItem num="2" title="Selección" desc="Tú filtras los candidatos finales para la eliminación física." active />
               <StepItem num="3" title="Borrador" desc="Se genera el acta con códigos TRD y justificación legal." />
               <StepItem num="4" title="Validación" desc="El Comité de Archivo firma digitalmente el soporte." />
               <StepItem num="5" title="Disposición" desc="Marcado de eliminación y resguardo del certificado." />
               <StepItem num="6" title="Auditoría" desc="Trazabilidad total e histórico de actas guardadas." />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex gap-3">
                <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                  "Este flujo garantiza el cumplimiento de la transferencia documental y disposición final según la normativa vigente."
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button onClick={() => setShowActProposal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                Cerrar
              </button>
              <button 
                onClick={() => { alert("Iniciando motor de detección de candidatos..."); setShowActProposal(false); }}
                className="px-6 py-3 text-sm font-black bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                Iniciar Selección <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents

function StatsCard({ title, value, subtitle, icon: Icon, trend, alert, isRefreshing }) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group",
      alert && "border-l-4 border-l-destructive",
      isRefreshing && "animate-pulse opacity-70"
    )}>
      <div className="absolute -bottom-2 -right-2 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
        <Icon className="w-16 h-16" />
      </div>
      
      <div className="flex flex-col gap-3 relative z-10">
        <div className="flex items-center justify-between">
           <div className={cn("p-2 rounded-lg border", alert ? "bg-destructive/10 border-destructive/10 text-destructive" : "bg-primary/10 border-primary/10 text-primary")}>
             <Icon className="w-4 h-4" />
           </div>
           {trend && (
             <div className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5", 
               trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
             )}>
               <div className={cn("h-1.5 w-1.5 rounded-full", trend === 'up' ? "bg-emerald-500" : "bg-rose-500")} />
               {trend === 'up' ? 'Alza' : 'Baja'}
             </div>
           )}
        </div>

        <div className="space-y-0.5">
          <h4 className="text-2xl font-bold text-foreground tracking-tight leading-none">{value}</h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground bg-secondary/50 p-2 rounded-md border border-border">
           <span className="w-1.5 h-1.5 rounded-full bg-border" />
           <span className="line-clamp-1">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}

function AnalysisWidget({ title, desc, type }) {
  const borderStyles = {
    neutral: "border-border",
    info: "border-primary/20",
    warning: "border-amber-200",
    success: "border-emerald-200"
  };
  const dotStyles = {
    neutral: "bg-muted-foreground",
    info: "bg-primary",
    warning: "bg-amber-500",
    success: "bg-emerald-500"
  };
  const textStyles = {
    neutral: "text-foreground",
    info: "text-primary",
    warning: "text-amber-700",
    success: "text-emerald-700"
  };
  return (
    <div className={cn("rounded-xl border bg-card p-3 transition-all hover:shadow-sm", borderStyles[type])}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("h-1.5 w-1.5 rounded-full", dotStyles[type])} />
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
      </div>
      <p className={cn("text-[12.5px] font-bold line-clamp-1", textStyles[type])}>{desc}</p>
    </div>
  );
}

function StepItem({ num, title, desc, active }) {
  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all",
      active ? "border-primary/20 bg-primary/[0.03]" : "border-border bg-secondary/30 opacity-50"
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn(
          "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold",
          active ? "bg-primary text-white" : "bg-border text-muted-foreground"
        )}>
          {num}
        </span>
        <h5 className="font-semibold text-foreground text-[12.5px]">{title}</h5>
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-relaxed pl-7">{desc}</p>
    </div>
  );
}
