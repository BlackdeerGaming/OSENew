import React from 'react';
import { FileText, AlertTriangle, Activity, BrainCircuit, ChevronRight, Download, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function DashboardView({ stats, searchQuery, currentUser, seriesCount, activityLogs = [], trdRecords = [], currentEntity, onDownloadPDF }) {
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

  const userRole = (currentUser?.role || currentUser?.perfil || 'usuario').toLowerCase();
  const showMetrics = userRole === 'superadmin' || userRole === 'administrador' || userRole === 'admin';
  const showAnalysis = userRole === 'superadmin' || userRole === 'administrador' || userRole === 'admin';
  const showActions = userRole === 'superadmin' || userRole === 'administrador' || userRole === 'admin';
  const iaAvailable = currentUser?.iaDisponible ?? true;

  const handleExportCSV = () => {
    if (activityLogs.length === 0) return;
    const headers = ["ID Acción", "Usuario", "Actividad", "Fecha y Hora"];
    const csvContent = [
      headers.join(","),
      ...activityLogs.map(log => [
        log.id.replace('act_', ''),
        `"${log.user || 'Sistema'}"`,
        `"${log.message}"`,
        `"${new Date(log.timestamp).toLocaleString()}"`
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

  // Lógica de Recomendaciones Reales
  const recommendations = React.useMemo(() => {
    const recs = [];
    if (!stats) return [{ title: "Cargando", desc: "Preparando recomendaciones...", type: "neutral" }];
    
    if (stats.expiredDocs > 0) recs.push({ title: "Eliminación", desc: "Revisar documentos vencidos para eliminación", type: "success" });
    if (stats.unapprovedTRDs > 0) recs.push({ title: "Aprobación", desc: `Revisar y aprobar ${stats.unapprovedTRDs} TRD pendientes`, type: "warning" });
    if (stats.totalDocs > 100) recs.push({ title: "Transferencia", desc: "Programar transferencia documental al Archivo Central", type: "info" });
    
    // Default if nothing critical
    if (recs.length === 0) recs.push({ title: "Mantenimiento", desc: "Validar integridad de tablas de retención", type: "neutral" });
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
    <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto w-full h-full flex flex-col gap-4 md:gap-6">
      
      {/* Top Cards Indicator */}
      {showMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <StatsCard 
            title="Documentos totales" 
            value={stats.totalDocs} 
            subtitle={stats.trend}
            icon={FileText} 
            trend="up"
          />
          <StatsCard 
            title="Documentos vencidos" 
            value={stats.expiredDocs} 
            subtitle="Basado en tiempo de retención"
            icon={AlertTriangle} 
            trend="down"
            alert={stats.expiredDocs > 0}
          />
          {iaAvailable && (
            <StatsCard 
              title="Tokens usados" 
              value={stats.tokensUsed} 
              subtitle="Consumo del plan IA"
              icon={BrainCircuit} 
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 flex-1 min-h-0">
        
        {role === 'usuario' ? (
          /* VISTA SIMPLIFICADA PARA CONSULTA */
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in duration-700">
             <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                   <div>
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Tablas de Retención (TRD) Disponibles</h2>
                      <p className="text-slate-500 font-medium">Visualiza y descarga los reportes oficiales de tu entidad.</p>
                   </div>
                   <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                      <FileText className="w-8 h-8" />
                   </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                   <table className="w-full min-w-[500px] text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                         <tr>
                            <th className="px-4 lg:px-6 py-4">Nombre del Reporte / Dependencia</th>
                            <th className="px-4 lg:px-6 py-4 hidden sm:table-cell">Entidad</th>
                            <th className="px-4 lg:px-6 py-4 hidden md:table-cell">Fecha base</th>
                            <th className="px-4 lg:px-6 py-4 text-center">Acciones</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {trdsByOficina.length > 0 ? trdsByOficina.map((trd, idx) => (
                           <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-5">
                                 <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                       <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                       <span className="font-bold text-slate-900 block uppercase text-xs">{trd.name}</span>
                                       <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{trd.count} registros vinculados</span>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-5 font-bold text-slate-700 text-xs uppercase">
                                 {currentUser?.entidadNombre || currentEntity?.razonSocial || "OSE SISTEMA GLOBAL"}
                              </td>
                              <td className="px-6 py-5 text-slate-500 text-xs font-medium">
                                 {new Date().toLocaleDateString('es-CO')}
                              </td>
                              <td className="px-6 py-5">
                                 <div className="flex justify-center">
                                    <button 
                                      onClick={() => onDownloadPDF && onDownloadPDF(trd.name)}
                                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-wider"
                                    >
                                       <Download className="w-4 h-4" />
                                       Descargar PDF
                                    </button>
                                 </div>
                              </td>
                           </tr>
                         )) : (
                           <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                 No hay registros TRD disponibles para consulta actualmente.
                              </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>

                <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center gap-4">
                   <div className="p-2 bg-white rounded-lg shadow-sm">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                   </div>
                   <p className="text-xs text-slate-500 leading-relaxed">
                      Este portal es únicamente para **consulta y descarga**. Para realizar modificaciones, carga de datos o análisis mediante IA, ponte en contacto con el administrador de tu entidad.
                   </p>
                </div>
             </div>
          </div>
        ) : (
          /* VISTA ADMINISTRATIVA (SIDEBAR IZQUIERDA EN DASHBOARD) */
          <div className="flex flex-col gap-6 h-full col-span-1">
            
            {/* Analysis Cards */}
            {showAnalysis && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-in fade-in duration-700">
                <AnalysisWidget title="Detectar Series" desc={`${stats.totalDocs > 0 ? seriesCount : 0} series identificadas`} type="info" />
                <AnalysisWidget title="Análisis" desc={stats.expiredDocs > 0 ? "Requiere revisión de retención" : "Estado funcional óptimo"} type="neutral" />
                <AnalysisWidget title="TRD no aprobadas" desc={`${stats.unapprovedTRDs} registros pendientes`} type="warning" />
                <AnalysisWidget title="Recomendación" desc={recommendations[0].desc} type="success" />
              </div>
            )}

            {/* Action Buttons */}
            {showActions && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 animate-in fade-in slide-in-from-left-4 duration-500">
                <button 
                  onClick={() => {
                     console.log("♻️ Actualizando registro de actividad...");
                  }}
                  className="shrink-0 flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                >
                  <Activity className="w-4 h-4" /> Actualizar
                </button>
                <button 
                  onClick={handleExportCSV}
                  className="shrink-0 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4" /> Exportar Excel
                </button>
              </div>
            )}

            {/* Registro de Actividad */}
            <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden flex flex-col flex-1 animate-in zoom-in-95 duration-700">
              <div className="px-4 lg:px-5 py-3 lg:py-4 border-b border-border flex items-center justify-between bg-slate-50/50 shrink-0">
                 <h3 className="font-bold text-foreground text-sm lg:text-base">Registro de actividad</h3>
                 <div className="flex items-center gap-2">
                   <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-md font-medium">{activityLogs.length} registros</span>
                 </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full min-w-[520px] text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-5 py-3">ID Acción</th>
                      <th className="px-5 py-3">Usuario</th>
                      <th className="px-5 py-3">Actividad</th>
                      <th className="px-5 py-3">Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.length > 0 ? (
                      activityLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-[10px] text-slate-400 capitalize">{log.id.replace('act_', '')}</td>
                          <td className="px-5 py-3 font-bold text-slate-900">{log.user || 'Sistema'}</td>
                          <td className="px-5 py-3 font-medium text-slate-700">{log.message}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-5 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Activity className="w-8 h-8 opacity-20" />
                            <p>No hay registros de actividad actualmente.</p>
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
      {/* Propuesta de Flujo de Acta */}
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

function StatsCard({ title, value, subtitle, icon: Icon, trend, alert, statusColor }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-16 h-16" />
      </div>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h4 className={cn("text-xl md:text-2xl font-bold mt-1", statusColor || "text-slate-800")}>{value}</h4>
        </div>
        <div className={cn("p-2.5 rounded-lg", alert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
          <Icon className="w-5 h-5" />
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

function StepItem({ num, title, desc, active }) {
  return (
    <div className={cn(
      "p-3 rounded-2xl border transition-all",
      active ? "border-primary/20 bg-primary/[0.03] shadow-sm" : "border-slate-100 bg-slate-50/50 grayscale opacity-60"
    )}>
       <div className="flex items-center gap-2 mb-1.5 focus:outline-none">
         <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black", active ? "bg-primary text-white" : "bg-slate-200 text-slate-500")}>
           {num}
         </span>
         <h5 className="font-bold text-slate-800 text-xs italic tracking-tight">{title}</h5>
       </div>
       <p className="text-[10px] text-slate-500 leading-tight font-medium">{desc}</p>
    </div>
  );
}
