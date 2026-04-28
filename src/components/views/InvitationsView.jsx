import React, { useState, useEffect } from 'react';
import { Mail, Briefcase, User as UserIcon, CheckCircle2, Clock, AlertCircle, Plus, Trash2, Send, Shield, Search, Loader2, X, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import ViewHeader from '../ui/ViewHeader';

export default function InvitationsView({ currentUser, API_BASE_URL, onNavigate, entities = [] }) {
  const [activeTab, setActiveTab] = useState('received'); // 'received' | 'sent'
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState(null);
  
  const [filterArchived, setFilterArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isArchiving, setIsArchiving] = useState(false);

  const adminEntities = currentUser?.role === 'superadmin' 
    ? entities 
    : entities.filter(e => ['administrador', 'admin'].includes(e.role));

  const isInvitationAdmin = (invEntityId) => {
    if (currentUser?.role === 'superadmin') return true;
    return adminEntities.some(e => e.id === invEntityId);
  };
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInvite, setNewInvite] = useState({
    email: '',
    entity_id: currentUser?.entidadId || '',
    role: 'usuario',
    ia_disponible: false
  });

  // Auto-seleccionar la primera entidad si está vacío (especialmente para superadmins)
  useEffect(() => {
    if (showCreateModal && !newInvite.entity_id && adminEntities.length > 0) {
      setNewInvite(prev => ({ ...prev, entity_id: adminEntities[0].id }));
    }
  }, [showCreateModal, adminEntities, newInvite.entity_id]);
  const [isCreating, setIsCreating] = useState(false);

  const [filterEntity, setFilterEntity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active'); 

  const [highlightedId, setHighlightedId] = useState(null);

  const handleDismissBanner = () => {
    if (highlightedId) {
      const dismissed = JSON.parse(localStorage.getItem('dismissed_invitations') || '[]');
      if (!dismissed.includes(highlightedId)) {
        localStorage.setItem('dismissed_invitations', JSON.stringify([...dismissed, highlightedId]));
      }
    }
    setHighlightedId(null);
  };

  useEffect(() => {
    if (activeTab !== 'received') return;
    const pending = invitations.find(inv => inv.status === 'pendiente' && inv.email === currentUser.email);
    if (pending) {
      const dismissed = JSON.parse(localStorage.getItem('dismissed_invitations') || '[]');
      if (!dismissed.includes(pending.id)) {
        setHighlightedId(pending.id);
      }
    }
  }, [invitations, activeTab, currentUser.email]);

  const isAdmin = currentUser?.role === 'superadmin' || entities.some(e => ['administrador', 'admin'].includes(e.role));

  useEffect(() => {
    fetchData();
    setSelectedIds(new Set());
  }, [activeTab, filterArchived, filterEntity]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let endpoint = activeTab === 'received' ? '/invitations/my' : '/invitations/sent';
      const params = new URLSearchParams();
      if (activeTab === 'sent') {
        params.append('archived', filterArchived);
        if (filterEntity !== 'all') params.append('entity_id', filterEntity);
      }
      
      const res = await fetch(`${API_BASE_URL}${endpoint}?${params.toString()}`, {
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
      
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: "Invitación enviada con éxito." });
        setShowCreateModal(false);
        setNewInvite({ email: '', entity_id: currentUser?.entidadId || '', role: 'usuario', ia_disponible: false });
        if (activeTab === 'sent') fetchData();
      } else {
        alert(data.detail || "Error al enviar invitación");
      }
    } catch (error) {
      alert("Error de conexión: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleArchive = async (id, archived = true) => {
    if (!window.confirm(archived ? "¿Deseas archivar esta invitación?" : "¿Deseas restaurar esta invitación?")) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${id}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ archived })
      });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
    finally { setProcessingId(null); }
  };

  const handleBulkArchive = async (archived = true) => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`¿Deseas ${archived ? 'archivar' : 'restaurar'} ${selectedIds.size} invitaciones?`)) return;
    setIsArchiving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/bulk-archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ ids: Array.from(selectedIds), archived })
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchData();
      }
    } catch (e) { console.error(e); }
    finally { setIsArchiving(false); }
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
        setMessage({ type: 'success', text: "Invitación cancelada." });
      }
    } catch (error) { console.error(error); }
  };

  const handleResend = async (id) => {
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${id}/resend`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setMessage({ type: 'success', text: "Invitación reenviada correctamente." });
        fetchData();
      }
    } catch (error) { console.error(error); }
    finally { setProcessingId(null); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const INACTIVE_STATUSES = ['cancelada', 'rechazada', 'vencida'];

  const filteredInvites = invitations.filter(inv => {
    if (filterStatus === 'active') {
      if (INACTIVE_STATUSES.includes(inv.status)) return false;
    } else if (filterStatus !== 'all') {
      if (inv.status !== filterStatus) return false;
    }
    return true;
  });

  const hiddenCount = invitations.filter(inv => INACTIVE_STATUSES.includes(inv.status)).length;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {highlightedId && activeTab === 'received' && (
        <div className="mx-5 mt-5 bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-5 animate-in slide-in-from-top-2">
          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
            <Send className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-semibold text-foreground">¡Has sido invitado a colaborar!</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Busca el registro resaltado y dale clic a <span className="text-primary font-bold">Aceptar</span> para unirte.
            </p>
          </div>
          <button onClick={handleDismissBanner} className="px-3.5 py-1.5 bg-foreground text-background rounded-md text-[11.5px] font-semibold hover:bg-primary transition-all">
            Entendido
          </button>
        </div>
      )}

      <ViewHeader
        icon={Mail}
        title="Invitaciones"
        subtitle="Gestiona el acceso de colaboradores"
        actions={
          isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-[12.5px] font-semibold rounded-md hover:bg-primary/90 transition-all active:scale-95">
              <Plus className="h-4 w-4" /> Nueva Invitación
            </button>
          )
        }
      />

      <div className="flex-1 overflow-auto p-5 md:p-7 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border">
          <div className="flex gap-1">
            {[
              { id: 'received', label: 'Recibidas', icon: Mail },
              { id: 'sent', label: 'Enviadas', icon: Send }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-medium border-b-2 transition-all", activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <tab.icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64 mb-2 sm:mb-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-3 py-1.5 bg-card border border-input rounded-md text-[12.5px] focus:outline-none focus:ring-1 focus:ring-ring transition-all" />
          </div>
        </div>

        {message && (
          <div className={cn("p-4 rounded-xl border flex items-center gap-3 animate-in fade-in", message.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800")}>
            {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="text-[13px] font-medium">{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-border">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="mt-3 text-muted-foreground font-medium text-[12.5px]">Cargando...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'sent' && (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex p-0.5 bg-secondary/50 rounded-md border border-border">
                  <button onClick={() => setFilterArchived(false)} className={cn("px-4 py-1.5 rounded-md text-[11.5px] font-semibold", !filterArchived ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>Activas</button>
                  <button onClick={() => setFilterArchived(true)} className={cn("px-4 py-1.5 rounded-md text-[11.5px] font-semibold", filterArchived ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>Archivadas</button>
                </div>
                {selectedIds.size > 0 && (
                  <button onClick={() => handleBulkArchive(!filterArchived)} disabled={isArchiving} className="px-3 py-1.5 bg-foreground text-background rounded-md text-[11.5px] font-semibold hover:bg-primary transition-all flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> {filterArchived ? 'Restaurar' : 'Archivar'}
                  </button>
                )}
              </div>
            )}

            {filteredInvites.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-dashed border-border text-center">
                <Mail className="h-8 w-8 text-muted-foreground mb-4" />
                <h3 className="text-[14px] font-semibold">Sin registros</h3>
                <p className="text-[12px] text-muted-foreground">No se encontraron invitaciones.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInvites.map((inv) => (
                  <div key={inv.id} className={cn("relative bg-card rounded-xl p-4 border transition-all", highlightedId === inv.id ? "border-primary bg-primary/[0.02]" : "border-border hover:shadow-sm")}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {activeTab === 'sent' && (
                          <div className="pt-1.5">
                            <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="h-4 w-4 rounded border-border text-primary" />
                          </div>
                        )}
                        <div className={cn("p-2.5 rounded-lg shrink-0", inv.status === 'aceptada' ? "bg-emerald-50 text-emerald-600" : "bg-secondary text-muted-foreground")}>
                          {activeTab === 'received' ? <Briefcase className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-semibold">{activeTab === 'received' ? (inv.entity_name || "Invitación de Entidad") : inv.email}</h3>
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider border bg-secondary">{inv.status}</span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase">{inv.role}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11.5px] text-muted-foreground">
                            {activeTab === 'sent' && <p className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> {inv.entity_name}</p>}
                            <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {new Date(inv.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {activeTab === 'received' && (inv.status === 'pendiente' || inv.status === 'pending') && (
                          <>
                            <button onClick={() => handleResponse(inv.id, 'reject')} className="px-3 py-1.5 rounded-md border border-input text-[11.5px] font-semibold hover:bg-destructive/10 hover:text-destructive">Rechazar</button>
                            <button onClick={() => handleResponse(inv.id, 'accept')} className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-[11.5px] font-semibold">Aceptar</button>
                          </>
                        )}
                        {activeTab === 'sent' && !filterArchived && (
                          <>
                            {inv.status !== 'aceptada' && <button onClick={() => handleResend(inv.id)} className="p-2 text-muted-foreground hover:text-primary"><Send className="h-4 w-4" /></button>}
                            {inv.status === 'pendiente' && <button onClick={() => handleDelete(inv.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                            <button onClick={() => handleArchive(inv.id, true)} className="p-2 text-muted-foreground hover:text-foreground"><Shield className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Nueva Invitación</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
                <input type="email" value={newInvite.email} onChange={e => setNewInvite({...newInvite, email: e.target.value})} className="w-full px-3 py-2 bg-background border border-input rounded-md text-[13px] outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Rol</label>
                  <select value={newInvite.role} onChange={e => setNewInvite({...newInvite, role: e.target.value})} className="w-full px-3 py-2 bg-background border border-input rounded-md text-[13px]">
                    <option value="usuario">Usuario</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Entidad</label>
                  <select value={newInvite.entity_id} onChange={e => setNewInvite({...newInvite, entity_id: e.target.value})} className="w-full px-3 py-2 bg-background border border-input rounded-md text-[13px]">
                    {adminEntities.map(e => <option key={e.id} value={e.id}>{e.razonSocial || e.nombre}</option>)}
                  </select>
                </div>
              </div>

              {/* Opción de IA */}
              <div className="flex items-center justify-between p-3 bg-secondary/5 rounded-lg border border-border/50">
                <div className="space-y-0.5">
                  <div className="text-[13px] font-semibold flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    Acceso a IA Neural
                  </div>
                  <div className="text-[11px] text-muted-foreground">Permite al usuario usar herramientas de IA</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={newInvite.ia_disponible}
                    disabled={currentUser?.role !== 'superadmin' && !(currentUser?.iaDisponible || currentUser?.ia_disponible)}
                    onChange={e => setNewInvite({...newInvite, ia_disponible: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <button onClick={handleCreateInvite} disabled={isCreating} className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-[13px] font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-2">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {isCreating ? 'Enviando...' : 'Enviar Invitación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
