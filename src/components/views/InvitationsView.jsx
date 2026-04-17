import React, { useState, useEffect } from 'react';
import { Mail, Briefcase, User as UserIcon, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InvitationsView({ currentUser, API_BASE_URL, onNavigate }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/my`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch (error) {
      console.error("Error al cargar invitaciones:", error);
    } finally {
      setLoading(false);
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
        // Recargar o filtrar localmente
        setInvitations(prev => prev.filter(inv => inv.id !== id));
        if (action === 'accept') {
            // Podríamos forzar un refresh global de la app o simplemente avisar
            // onNavigate('dashboard'); 
        }
      } else {
        setMessage({ type: 'error', text: data.detail || 'Error al procesar la invitación.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-10 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            Mis Invitaciones
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            Gestiona las invitaciones recibidas para unirte a entidades y colaborar en equipos.
          </p>
        </header>

        {message && (
          <div className={cn(
            "mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4",
            message.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          )}>
            {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span className="font-bold">{message.text}</span>
          </div>
        )}

        {invitations.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 border-2 border-dashed border-slate-200 flex flex-col items-center text-center shadow-sm">
            <div className="bg-slate-100 p-6 rounded-full mb-6 text-slate-400">
               <Mail className="h-12 w-12" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No tienes invitaciones pendientes</h3>
            <p className="text-slate-500 mt-2 max-w-sm">
              Cuando alguien te invite a una entidad, aparecerá aquí para que puedas aceptarla o rechazarla.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {invitations.map((inv) => (
              <div key={inv.id} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl shadow-slate-200/50 group hover:border-primary/30 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-5">
                    <div className="bg-primary/10 p-4 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Briefcase className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900">{inv.entity_name}</h3>
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wider">Pendiente</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1 mt-2">
                        <p className="text-slate-500 text-sm flex items-center gap-2">
                          <UserIcon className="h-4 w-4" />
                          Invitado por <span className="text-slate-800 font-bold">{inv.inviter}</span>
                        </p>
                        <p className="text-slate-400 text-xs flex items-center gap-2 font-medium">
                          <Clock className="h-4 w-4" />
                          Recibida el {new Date(inv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 italic max-w-lg">
                        <AlertCircle className="h-3.5 w-3.5 inline mr-1 text-primary" />
                        Al aceptar, te unirás a esta entidad. Solo puedes pertenecer a una entidad principal a la vez por invitación.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      disabled={processingId === inv.id}
                      onClick={() => handleResponse(inv.id, 'reject')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-xs hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      <XCircle className="h-4 w-4" />
                      RECHAZAR
                    </button>
                    <button
                      disabled={processingId === inv.id}
                      onClick={() => handleResponse(inv.id, 'accept')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-primary text-white font-black text-xs hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                    >
                      {processingId === inv.id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      ACEPTAR INVITACIÓN
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 bg-primary/5 rounded-3xl p-8 border border-primary/10">
            <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-3">¿Cómo funcionan las invitaciones?</h4>
            <ul className="grid md:grid-cols-2 gap-4">
                {[
                    "Puedes recibir invitaciones de administradores de cualquier entidad.",
                    "Al aceptar, se te vinculará oficialmente a esa organización.",
                    "Las invitaciones caducan después de 24 horas de enviadas.",
                    "Puedes rechazar invitaciones si no deseas unirte a un equipo específico."
                ].map((text, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {text}
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </div>
  );
}
