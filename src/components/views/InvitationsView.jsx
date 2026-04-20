import React, { useState, useEffect } from 'react';
import { Mail, Briefcase, User as UserIcon, CheckCircle2, XCircle, Clock, AlertCircle, Plus, Filter, Trash2, Send, Shield, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InvitationsView({ currentUser, API_BASE_URL, onNavigate, entities = [] }) {
  const [activeTab, setActiveTab] = useState('received'); // 'received' | 'sent'
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState(null);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInvite, setNewInvite] = useState({
    email: '',
    entity_id: currentUser?.entidadId || '',
    role: 'usuario'
  });
  const [isCreating, setIsCreating] = useState(false);

  const [filterEntity, setFilterEntity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active'); // 'active' = pendiente+aceptada por defecto
  
  // Resaltado de contexto
  const [highlightedId, setHighlightedId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invId = params.get('invitation_id');
    if (invId) setHighlightedId(invId);
  }, []);

  const isAdmin = currentUser?.role === 'administrador' || currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'received' ? '/invitations/my' : '/invitations/sent';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!newInvite.email || !newInvite.entity_id) {
       alert("Por favor completa los campos obligatorios.");
       return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify(newInvite)
      });
      
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { data = { detail: text }; }

      if (res.ok) {
        setMessage({ type: 'success', text: "Invitación enviada con éxito." });
        setShowCreateModal(false);
        setNewInvite({ email: '', entity_id: currentUser?.entidadId || '', role: 'usuario' });
        if (activeTab === 'sent') fetchData();
      } else {
        alert(data.detail || "Error al enviar invitación");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleResponse = async (id, action) => {
    setProcessingId(id);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setInvitations(prev => prev.filter(inv => inv.id !== id));
      } else {
        setMessage({ type: 'error', text: data.detail || 'Error al procesar.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Seguro que deseas cancelar esta invitación?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${id}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setInvitations(prev => prev.filter(inv => inv.id !== id));
        setMessage({ type: 'success', text: "Invitación cancelada correctamente." });
      }
    } catch (error) {
      console.error(error);
      alert("Error al cancelar invitacion: " + error.message);
    }
  };

  const handleResend = async (id) => {
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${id}/resend`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setMessage({ type: 'success', text: "Invitación reenviada correctamente (+24h de validez)." });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Error al reenviar");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión al reenviar: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const [viewDetailId, setViewDetailId] = useState(null);
  const detailInv = invitations.find(i => i.id === viewDetailId);

  const INACTIVE_STATUSES = ['cancelada', 'rechazada', 'vencida'];

  const filteredInvites = invitations.filter(inv => {
    if (filterEntity !== 'all' && inv.entity_id !== filterEntity) return false;
    if (filterStatus === 'active') {
      // Modo por defecto: solo mostrar pendientes y aceptadas
      if (INACTIVE_STATUSES.includes(inv.status)) return false;
    } else if (filterStatus !== 'all') {
      if (inv.status !== filterStatus) return false;
    }
    return true;
  });

  const hiddenCount = invitations.filter(inv => INACTIVE_STATUSES.includes(inv.status)).length;

  return (
    <div className="flex-1 p-6 lg:p-10 bg-[#f8fafc] min-h-screen overflow-y-auto w-full">
      <div className="max-w-6xl mx-auto">
        {/* Welcome Banner for external invites */}
        {highlightedId && activeTab === 'received' && (
          <div className="mb-10 bg-gradient-to-br from-primary to-primary-foreground/10 p-1 rounded-3xl shadow-xl shadow-primary/10 animate-in fade-in slide-in-from-top-6 duration-1000">
            <div className="bg-white/95 backdrop-blur-md rounded-[1.4rem] p-8 flex flex-col md:flex-row items-center gap-8 border border-white">
              <div className="bg-primary/10 p-6 rounded-[2rem] shrink-0">
                <Send className="h-10 w-10 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-4 inline-block">
                  Onboarding Prioritario
                </span>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  ¡Hola! Has sido invitado a colaborar.
                </h2>
                <p className="text-slate-500 mt-2 font-medium max-w-lg">
                  Hemos identificado tu invitación. Para unirte a la entidad, simplemente busca el registro <span className="text-primary font-bold">resaltado en azul</span> y dale clic a "Aceptar".
                </p>
              </div>
              <button 
                onClick={() => setHighlightedId(null)}
                className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
        
        {/* Header con Tabs */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Mail className="h-8 w-8 text-primary" />
              Gestión de Invitaciones
            </h2>
            <div className="flex bg-slate-200/50 p-1 rounded-2xl mt-6 w-fit">
               <button 
                 onClick={() => setActiveTab('received')}
                 className={cn(
                   "px-6 py-2.5 rounded-xl font-black text-xs transition-all uppercase tracking-widest flex items-center gap-2",
                   activeTab === 'received' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                 )}
               >
                 <Mail className="h-4 w-4" /> Recibidas
               </button>
               {isAdmin && (
                 <button 
                   onClick={() => setActiveTab('sent')}
                   className={cn(
                     "px-6 py-2.5 rounded-xl font-black text-xs transition-all uppercase tracking-widest flex items-center gap-2",
                     activeTab === 'sent' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   <Send className="h-4 w-4" /> Enviadas
                 </button>
               )}
            </div>
          </div>

          {activeTab === 'sent' && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-primary/20 transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" /> Nueva Invitación
            </button>
          )}
        </header>

        {message && (
          <div className={cn(
            "mb-8 p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4",
            message.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          )}>
            {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span className="font-bold text-sm tracking-tight">{message.text}</span>
          </div>
        )}

        {/* Listado */}
        {loading ? (
          <div className="bg-white rounded-[2.5rem] p-32 border border-slate-200 flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sincronizando...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Filtros para Vista Administrador */}
            {activeTab === 'sent' && (
              <div className="flex flex-wrap items-center gap-4 mb-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 px-2 border-r pr-4">
                  <Filter className="h-4 w-4" />
                  <span className="text-[10px] uppercase font-black tracking-tighter">Filtrar por:</span>
                </div>
                {(currentUser?.role === 'superadmin' || entities.length > 1) && (
                  <select 
                    value={filterEntity}
                    onChange={e => setFilterEntity(e.target.value)}
                    className="bg-slate-50 text-xs font-bold text-slate-700 px-4 py-2 rounded-xl focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="all">Todas las Entidades</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.razonSocial || e.nombre}</option>)}
                  </select>
                )}
                 <select 
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-slate-50 text-xs font-bold text-slate-700 px-4 py-2 rounded-xl focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="active">Activas (pendiente + aceptada)</option>
                  <option value="all">Todos los Estados</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="aceptada">Aceptadas</option>
                  <option value="rechazada">Rechazadas</option>
                  <option value="vencida">Vencidas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>
            )}

            {/* Aviso de registros ocultos */}
            {filterStatus === 'active' && hiddenCount > 0 && (
              <div className="flex items-center justify-between px-5 py-3 bg-slate-100 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold text-slate-500">
                  {hiddenCount} invitación{hiddenCount !== 1 ? 'es' : ''} cancelada{hiddenCount !== 1 ? 's' : ''}/rechazada{hiddenCount !== 1 ? 's' : ''}/vencida{hiddenCount !== 1 ? 's' : ''} oculta{hiddenCount !== 1 ? 's' : ''}.
                </p>
                <button 
                  onClick={() => setFilterStatus('all')}
                  className="text-xs font-black text-primary hover:underline uppercase tracking-widest"
                >Ver todas</button>
              </div>
            )}

            {filteredInvites.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] p-16 border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                <div className="bg-slate-100 p-6 rounded-full mb-6 text-slate-400">
                  <Search className="h-12 w-12" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 italic">No se encontraron invitaciones</h3>
                <p className="text-slate-400 mt-2 max-w-sm text-sm font-medium">
                  {activeTab === 'received' ? "No tienes ninguna invitación pendiente por responder en este momento." : "No has enviado invitaciones con los filtros seleccionados."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredInvites.map((inv) => (
                  <div 
                    key={inv.id} 
                    className={cn(
                      "relative bg-white rounded-[2rem] p-6 border transition-all duration-500 group",
                      highlightedId === inv.id 
                        ? "border-primary ring-4 ring-primary/10 shadow-2xl shadow-primary/10 -translate-y-1" 
                        : "border-slate-200 shadow-sm hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                    )}
                  >
                    {highlightedId === inv.id && (
                      <div className="absolute -top-3 left-8 px-4 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg z-10">
                        TU INVITACIÓN
                      </div>
                    )}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex items-start gap-5">
                        <div className={cn(
                          "p-4 rounded-2xl transition-colors",
                          inv.status === 'aceptada' ? "bg-emerald-50 text-emerald-600" : 
                          inv.status === 'pendiente' ? "bg-amber-50 text-amber-600" :
                          inv.status === 'cancelada' ? "bg-rose-50 text-rose-400" :
                          "bg-slate-100 text-slate-400"
                        )}>
                          {activeTab === 'received' ? <Briefcase className="h-6 w-6" /> : <UserIcon className="h-6 w-6" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">
                              {activeTab === 'received' ? inv.entity_name : inv.email}
                            </h3>
                            <span className={cn(
                              "px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest border",
                              inv.status === 'pendiente' ? "bg-amber-50 text-amber-600 border-amber-100" :
                              inv.status === 'aceptada' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              inv.status === 'cancelada' ? "bg-rose-50 text-rose-600 border-rose-100" :
                              "bg-slate-50 text-slate-400 border-slate-200"
                            )}>
                              {inv.status}
                            </span>
                             <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-[8px] font-black rounded border border-indigo-100 uppercase tracking-tighter">
                                Rol: {inv.role || 'usuario'}
                             </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1 mt-2">
                             {activeTab === 'sent' && (
                               <p className="text-slate-500 text-xs flex items-center gap-1.5 font-bold">
                                 <Briefcase className="h-3.5 w-3.5" />
                                 Hacia: <span className="text-slate-800">{inv.entity_name}</span>
                               </p>
                             )}
                             {activeTab === 'received' && (
                               <p className="text-slate-500 text-xs flex items-center gap-1.5 font-bold">
                                 <UserIcon className="h-3.5 w-3.5" />
                                 Invitado por <span className="text-slate-800">{inv.inviter}</span>
                               </p>
                             )}
                             <p className="text-slate-400 text-[10px] flex items-center gap-1.5 font-medium uppercase tracking-tighter">
                               <Clock className="h-3.5 w-3.5" />
                               {new Date(inv.created_at).toLocaleDateString()}
                             </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeTab === 'received' && inv.status === 'pendiente' && (
                          <>
                            <button
                              disabled={processingId === inv.id}
                              onClick={() => handleResponse(inv.id, 'reject')}
                              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"
                            >
                              Rechazar
                            </button>
                            <button
                              disabled={processingId === inv.id}
                              onClick={() => handleResponse(inv.id, 'accept')}
                              className="px-6 py-2.5 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest hover:shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                              {processingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Aceptar
                            </button>
                          </>
                        )}
                        {activeTab === 'sent' && (
                           <div className="flex items-center gap-1">
                             <button
                               onClick={() => setViewDetailId(inv.id)}
                               className="px-4 py-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 font-black text-[10px] uppercase tracking-widest transition-all"
                             >
                               Detalle
                             </button>
                             {inv.status !== 'aceptada' && (
                               <button
                                 disabled={processingId === inv.id}
                                 onClick={() => handleResend(inv.id)}
                                 className="p-3 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                 title="Reenviar invitación"
                               >
                                 <Send className="h-5 w-5" />
                               </button>
                             )}
                             {inv.status === 'pendiente' && (
                               <button 
                                 disabled={processingId === inv.id}
                                 onClick={() => handleDelete(inv.id)}
                                 className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                 title="Cancelar invitación"
                               >
                                 <Trash2 className="h-5 w-5" />
                               </button>
                             )}
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Box Footer */}
        <div className="mt-16 bg-white/50 rounded-3xl p-8 border border-slate-200/50">
            <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-4">Lineamientos de Seguridad</h4>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Shield, title: "Aislamiento", text: "Solo gestionas datos de tus entidades." },
                  { icon: Clock, title: "Expiración", text: "Vence en 24h tras el envío." },
                  { icon: UserIcon, title: "Identidad", text: "Roles ligados a cada entidad." },
                  { icon: AlertCircle, title: "Restricción", text: "No invitaciones duplicadas." }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <item.icon className="h-5 w-5 text-slate-300" />
                    <h5 className="font-bold text-xs text-slate-700 uppercase tracking-tighter">{item.title}</h5>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.text}</p>
                  </div>
                ))}
            </div>
        </div>
      </div>

      {/* Modal para Ver Detalle */}
      {viewDetailId && detailInv && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in zoom-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setViewDetailId(null)} className="text-slate-300 hover:text-slate-600">
                   <XCircle className="h-6 w-6" />
                </button>
              </div>
              <div className="mb-8">
                 <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center text-primary mb-6">
                   <Search className="h-8 w-8" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-900 tracking-tight">Detalle de Invitación</h2>
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Información enviada originalmente</p>
              </div>
              
              <div className="space-y-6">
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="mb-4">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-1">Correo Invitado</span>
                      <p className="font-bold text-slate-800">{detailInv.email}</p>
                    </div>
                    <div className="mb-4">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-1">Entidad</span>
                      <p className="font-bold text-slate-800">{detailInv.entity_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-1">Rol Asignado</span>
                      <p className="font-bold text-primary uppercase text-xs">{detailInv.role || 'usuario'}</p>
                    </div>
                 </div>

                 <div className="flex flex-col gap-2">
                   <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Estado:</span>
                      <span className="text-slate-800 uppercase tracking-tighter">{detailInv.status}</span>
                   </div>
                   <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Enviada por:</span>
                      <span>{detailInv.inviter}</span>
                   </div>
                   <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Vence:</span>
                      <span className="text-rose-500">{new Date(detailInv.expires_at).toLocaleString()}</span>
                   </div>
                 </div>

                 <button 
                  onClick={() => setViewDetailId(null)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest mt-4"
                 >
                   Cerrar Vista
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal para Crear Invitación */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                   <div className="bg-primary/10 p-4 rounded-3xl text-primary rotate-6">
                      <Send className="h-6 w-6" />
                   </div>
                   <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Nueva Invitación</h2>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Configura el acceso</p>
                   </div>
                 </div>
                 <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-300 hover:text-slate-600 rounded-full transition-all">
                    <XCircle className="h-7 w-7" />
                 </button>
              </div>

              <div className="space-y-6">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block px-1">Email del Colaborador</label>
                   <div className="relative group">
                     <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                     <input 
                       type="email"
                       placeholder="usuario@dominio.com"
                       value={newInvite.email}
                       onChange={e => setNewInvite({...newInvite, email: e.target.value})}
                       className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-slate-800"
                     />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block px-1">Perfil/Rol Asignado</label>
                      <select 
                        value={newInvite.role}
                        onChange={e => setNewInvite({...newInvite, role: e.target.value})}
                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-primary transition-all"
                      >
                         <option value="usuario">Usuario Estándar</option>
                         <option value="administrador">Administrador</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block px-1">Entidad Destino</label>
                      <select 
                        disabled={currentUser.role !== 'superadmin' && entities.length <= 1}
                        value={newInvite.entity_id}
                        onChange={e => setNewInvite({...newInvite, entity_id: e.target.value})}
                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-primary transition-all disabled:opacity-60"
                      >
                         {(currentUser.role !== 'superadmin' && entities.length <= 1) ? (
                            <option value={currentUser.entity_id}>{currentUser.entidadNombre || "Entidad actual"}</option>
                         ) : (
                            entities.map(e => <option key={e.id} value={e.id}>{e.razonSocial || e.nombre}</option>)
                         )}
                      </select>
                    </div>
                 </div>

                 <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-3xl flex gap-3">
                    <Clock className="h-5 w-5 text-indigo-400 shrink-0" />
                    <p className="text-[10px] text-indigo-800 font-bold leading-relaxed italic">
                      Se enviará un correo de notificación. La invitación caducará automáticamente en exactamente 24 horas si no es aceptada.
                    </p>
                 </div>

                 <button 
                   onClick={handleCreateInvite}
                   disabled={isCreating}
                   className="w-full bg-primary py-5 rounded-2xl text-white font-black uppercase tracking-[0.25em] text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                 >
                    {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    {isCreating ? 'Procesando...' : 'Enviar Invitación'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

const XCircleIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
