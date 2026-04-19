import React, { useState } from 'react';
import { Search, Filter, Plus, UserCircle, MoreVertical, Trash2, X, Check, Eye, EyeOff, Save, FileEdit, Loader2, AlertCircle, Link, Mail, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function UsersView({ searchQuery, currentUser, users = [], setUsers, entities = [], selectedEntityId }) {
  const role = currentUser?.role || 'usuario';
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManualInviteModal, setShowManualInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'perfil', 'entidades'
  const [editingUserId, setEditingUserId] = useState(null);
  
  const handleSendInvitation = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      alert("Introduce un correo electrónico válido");
      return;
    }

    setIsInviting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          entity_id: selectedEntityId || currentUser?.entidadId || 'e0'
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert("¡Invitación enviada con éxito!");
        setShowManualInviteModal(false);
        setInviteEmail('');
      } else {
        alert(data.detail || "Error al enviar la invitación");
      }
    } catch (error) {
      alert("Error de conexión al enviar invitación");
    } finally {
      setIsInviting(false);
    }
  };
  
  const [newUser, setNewUser] = useState({
    tipoDocumento: '',
    numeroDocumento: '',
    nombre: '',
    apellido: '',
    email: '',
    celular: '',
    username: '',
    estado: 'Inactivo',
    perfil: null,
    entidadId: null,
    entidadIds: [],
    iaDisponible: false
  });

  const canCreateAdmins = role === 'superadmin';


  const handleEdit = (user) => {
    setNewUser({
      ...user,
      // Map isActivated/pending to Activo/Inactivo internal status for the toggle
      estado: user.isActivated ? 'Activo' : 'Inactivo',
      iaDisponible: !!user.iaDisponible,
      entidadIds: user.entidadIds || (user.entidadId ? [user.entidadId] : [])
    });
    setEditingUserId(user.id);
    setShowModal(true);
    setActiveTab('info');
  };

  const handleSaveUsuario = async () => {
    // Validaciones
    if (!newUser.nombre || !newUser.email || !newUser.numeroDocumento || !newUser.username) {
       alert("Error: Completa la información de usuario básica.");
       setActiveTab('info');
       return;
    }
    if (!newUser.perfil) {
       alert("Debes seleccionar un perfil (Administrador o Consulta).");
       setActiveTab('perfil');
       return;
    }
    if (!newUser.entidadIds || newUser.entidadIds.length === 0) {
       alert("Debes asignar el usuario a al menos una entidad.");
       setActiveTab('entidades');
       return;
    }

    const entidadSelected = entities.find(e => e.id === (newUser.entidadIds[0]));
    
    // Generación de Token de Invitación (30 min)
    const token = Math.random().toString(36).substring(2, 11).toUpperCase();
    const expiry = Date.now() + (30 * 60 * 1000); // 30 minutos

    setUsers(prev => {
       const userBase = {
         ...newUser,
         // entidadId is the first entity (default) for backward compat
         entidadId: newUser.entidadIds[0] || newUser.entidadId || null,
         entidadNombre: newUser.entidadIds
           .map(id => entities.find(e => e.id === id)?.razonSocial)
           .filter(Boolean).join(', '),
         entidadIds: newUser.entidadIds
       };

       if (editingUserId) {
          fetch(`${API_BASE_URL}/users/${editingUserId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             ...userBase,
             entidadIds: newUser.entidadIds
           })
         }).then(res => {
           if (!res.ok) console.error("Error al actualizar usuario");
         });

         return prev.map(u => u.id === editingUserId ? { ...u, ...userBase, id: editingUserId } : u);
       } else {
          // CREAR EN BACKEND
         const tempId = Date.now().toString();
         const userToAdd = { 
            ...userBase, 
            id: tempId, 
            fechaCreacion: new Date().toLocaleDateString(),
            activationToken: token,
            tokenExpiry: expiry,
            isActivated: false,
            password: ''
         };

         fetch(`${API_BASE_URL}/users`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ ...userToAdd, entidadIds: newUser.entidadIds })
         }).then(async res => {
           if (res.ok) {
             // Después de crear exitosamente en la DB, enviar email
             const finalLink = `${window.location.origin}/?token=${token}`; 
             setGeneratedLink(finalLink);
             setShowInviteModal(true);
             setShowModal(false);

             setEmailStatus('sending');
             try {
               const mailRes = await fetch(`${API_BASE_URL}/send-activation`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   email: newUser.email,
                   nombre: newUser.nombre,
                   link: finalLink
                 })
               });
               setEmailStatus(mailRes.ok ? 'sent' : 'error');
             } catch (e) {
               console.error("Error enviando email:", e);
               setEmailStatus('error');
             }
           } else {
             const errorData = await res.json();
             alert("Error al crear usuario: " + (errorData.detail || "Desconocido"));
           }
         });

         return [...prev, userToAdd];
       }
    });

    if (editingUserId) resetModal();
  };

  const resetModal = () => {
    setShowModal(false);
    setEditingUserId(null);
    setEmailStatus('idle');
    setActiveTab('info');
    setNewUser({
      tipoDocumento: '', numeroDocumento: '', nombre: '', apellido: '', email: '',
      celular: '', username: '', estado: 'Inactivo',
      perfil: role === 'administrador' ? 'usuario' : null, 
      entidadId: role === 'administrador' ? currentUser?.entidadId : null, 
      entidadIds: role === 'administrador' ? [currentUser?.entidadId].filter(Boolean) : [], 
      iaDisponible: false
    });
  };

  const handleDelete = (id) => {
    if(confirm("¿Eliminar este usuario de forma permanente?")) {
      fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentUser?.token}`
        }
      }).then(async res => {
        const data = await res.json();
        if (res.ok) {
          setUsers(users.filter(u => u.id !== id));
        } else {
          alert("Error: " + (data.detail || "Verifica tus permisos o restricciones de datos."));
        }
      });
    }
  };

  // --- FILTRADO POR SEGURIDAD Y ROL ---
  // Los superadministradores ven todo. 
  // Los administradores solo ven los usuarios de su propia entidad.
  const filteredUsers = users.filter(u => {
    if (currentUser?.role === 'superadmin') {
      if (selectedEntityId) {
        return u.entidadId === selectedEntityId;
      }
      return true;
    }
    if (currentUser?.role === 'administrador') {
      return u.entidadId === currentUser.entidadId;
    }
    return false;
  });

  // --- BÚSQUEDA ---
  const displayedUsers = filteredUsers.filter(u => 
    u.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 lg:p-10 overflow-y-auto w-full h-full animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">Gestión de Usuarios</h1>
          <p className="text-slate-500 mt-1">
             {currentUser?.role === 'superadmin' 
               ? "Administración global de todos los accesos al sistema."
               : `Personal y colaboradores de ${currentUser?.entidadNombre || 'la organización'}.`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {currentUser?.role === 'superadmin' && (
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-2 bg-[#00bfa5] hover:bg-[#00a693] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-[#00bfa5]/20 transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Nuevo Usuario (Directo)
            </button>
          )}
        </div>
      </div>



      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar usuario..."
              defaultValue={searchQuery}
              className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white shadow-sm transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white rounded-md text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
            Vistas y Filtros
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-border text-slate-600">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Nombres</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Entidad</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Perfil</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Estado</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">IA</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-4 bg-slate-100 rounded-full">
                        <UserCircle className="w-10 h-10 opacity-20" />
                      </div>
                      <p className="font-medium text-slate-500">No se han registrado usuarios aún.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors bg-white">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                         <span className="font-medium text-slate-900">{user.nombre} {user.apellido}</span>
                         <span className="text-[10px] text-muted-foreground font-mono">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {user.entidadNombre || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase tracking-wider",
                        user.perfil === 'administrador' || user.perfil === 'superadmin' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-100 text-slate-500 border-slate-200"
                      )}>
                        {user.perfil === 'administrador' ? 'Administrador' : user.perfil === 'usuario' ? 'Usuario' : (user.perfil || 'usuario')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                           "h-1.5 w-1.5 rounded-full",
                           user.isActivated ? "bg-success" : "bg-warning"
                        )} />
                        <span className="text-xs font-medium text-slate-600">{user.isActivated ? "Activo" : "Pendiente"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       {user.iaDisponible 
                         ? <span className="text-[10px] bg-violet-100 text-violet-600 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Activo</span>
                         : <span className="text-[10px] text-slate-300 font-bold">—</span>
                       }
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         {!user.isActivated && user.activationToken && (
                           <button 
                             title="Copiar enlace de invitación"
                             onClick={() => {
                               navigator.clipboard.writeText(`${window.location.origin}?token=${user.activationToken}`);
                               alert("Enlace de activación copiado al portapapeles");
                             }} 
                             className="p-2 rounded-md text-amber-600/70 hover:bg-amber-600/10 hover:text-amber-600 transition-colors"
                           >
                              <Link className="w-4 h-4" />
                           </button>
                         )}
                         <button onClick={() => handleEdit(user)} className="p-2 rounded-md text-primary/70 hover:bg-primary/10 hover:text-primary transition-colors">
                            <FileEdit className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleDelete(user.id)} className="p-2 rounded-md text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Multi-tab */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[850px]">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#1e293b]">{editingUserId ? 'Editar usuario' : 'Crear nuevo usuario'}</h3>
              <button onClick={resetModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors font-bold text-slate-400">
                 <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-100 px-6">
               <button 
                 onClick={() => setActiveTab('info')}
                 className={cn(
                   "py-4 px-4 text-sm font-semibold transition-all relative border-b-2",
                   activeTab === 'info' ? "text-[#00bfa5] border-[#00bfa5]" : "text-slate-400 border-transparent"
                 )}
               >
                 Información de usuario
               </button>
               <button 
                 onClick={() => setActiveTab('perfil')}
                 className={cn(
                   "py-4 px-4 text-sm font-semibold flex items-center gap-2 transition-all relative border-b-2",
                   activeTab === 'perfil' ? "text-[#00bfa5] border-[#00bfa5]" : "text-slate-400 border-transparent"
                 )}
               >
                 Asignar Perfil
                 {!newUser.perfil && (
                   <span className="bg-[#00c853] text-white text-[10px] h-5 w-5 flex items-center justify-center rounded-full font-bold">1</span>
                 )}
               </button>
               <button 
                 onClick={() => setActiveTab('entidades')}
                 className={cn(
                   "py-4 px-4 text-sm font-semibold flex items-center gap-2 transition-all relative border-b-2",
                   activeTab === 'entidades' ? "text-[#00bfa5] border-[#00bfa5]" : "text-slate-400 border-transparent"
                 )}
               >
                 Entidades
                  {(!newUser.entidadIds || newUser.entidadIds.length === 0) && (
                    <span className="bg-[#00c853] text-white text-[10px] h-5 w-5 flex items-center justify-center rounded-full font-bold">1</span>
                  )}
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
               {activeTab === 'info' && (
                 <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-700">Tipo de Documento *</label>
                          <select 
                            value={newUser.tipoDocumento}
                            onChange={e=>setNewUser({...newUser, tipoDocumento: e.target.value})}
                            className="w-full bg-[#f1f5f9] border-none rounded-lg h-12 px-4 text-sm outline-none"
                          >
                            <option value="">Seleccione</option>
                            <option>Cédula de Ciudadanía</option>
                            <option>NIT</option>
                            <option>Cédula de Extranjería</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-700">Número de Documento *</label>
                          <input 
                            type="text"
                            value={newUser.numeroDocumento}
                            onChange={e=>setNewUser({...newUser, numeroDocumento: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg h-12 px-4 text-sm outline-none"
                          />
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-sm font-semibold text-slate-700">Nombres *</label>
                       <input 
                         type="text"
                         value={newUser.nombre}
                         onChange={e=>setNewUser({...newUser, nombre: e.target.value})}
                         className="w-full border border-slate-200 rounded-lg h-12 px-4 text-sm outline-none"
                       />
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-sm font-semibold text-slate-700">Apellidos *</label>
                       <input 
                         type="text"
                         value={newUser.apellido}
                         onChange={e=>setNewUser({...newUser, apellido: e.target.value})}
                         className="w-full border border-slate-200 rounded-lg h-12 px-4 text-sm outline-none"
                       />
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-sm font-semibold text-slate-700">Correo Electrónico *</label>
                       <input 
                         type="email"
                         value={newUser.email}
                         onChange={e=>setNewUser({...newUser, email: e.target.value})}
                         className="w-full border border-slate-200 rounded-lg h-12 px-4 text-sm outline-none"
                       />
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-sm font-semibold text-slate-700">No. Celular *</label>
                       <input 
                         type="text"
                         value={newUser.celular}
                         onChange={e=>setNewUser({...newUser, celular: e.target.value})}
                         className="w-full border border-slate-200 rounded-lg h-12 px-4 text-sm outline-none"
                       />
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-sm font-semibold text-slate-700">Nombre de usuario *</label>
                       <input 
                         type="text"
                         value={newUser.username}
                         onChange={e=>setNewUser({...newUser, username: e.target.value})}
                         className="w-full bg-[#f1f5f9] border-none rounded-lg h-12 px-4 text-sm outline-none"
                       />
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                       <p className="text-xs text-muted-foreground italic">Nota: Ya no es necesario asignar una contraseña manual. El sistema generará un enlace de activación seguro para el nuevo usuario.</p>
                    </div>

                    {role === 'superadmin' && (
                      <label className="flex items-center gap-3 cursor-pointer mt-4">
                         <div className={cn(
                            "h-6 w-6 rounded flex items-center justify-center transition-all",
                            newUser.estado === 'Activo' ? "bg-[#00bfa5]" : "bg-slate-200"
                         )}>
                            <Check className="h-4 w-4 text-white" />
                         </div>
                         <input 
                           type="checkbox" 
                           className="hidden" 
                           checked={newUser.estado === 'Activo'} 
                           onChange={e=>setNewUser({...newUser, estado: e.target.checked ? 'Activo' : 'Inactivo'})} 
                         />
                         <span className="text-sm font-semibold text-slate-500 font-bold">Estado Inicial (Admin)</span>
                      </label>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer mt-2">
                       <div className={cn(
                          "h-6 w-6 rounded flex items-center justify-center transition-all",
                          newUser.iaDisponible ? "bg-violet-500" : "bg-slate-200"
                       )}>
                          <Check className="h-4 w-4 text-white" />
                       </div>
                       <input 
                         type="checkbox" 
                         className="hidden" 
                         checked={!!newUser.iaDisponible} 
                         onChange={e=>setNewUser({...newUser, iaDisponible: e.target.checked})} 
                       />
                       <span className="text-sm font-semibold text-slate-500">IA Disponible?</span>
                       <span className="ml-1 text-[10px] bg-violet-100 text-violet-600 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">IA</span>
                    </label>
                 </div>
               )}

                {activeTab === 'perfil' && (
                  <div className="space-y-4">
                     {role === 'superadmin' && (
                       <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-transparent hover:bg-slate-50 transition-all">
                          <div className={cn(
                             "h-6 w-6 rounded flex items-center justify-center border-2 transition-all",
                             newUser.perfil === 'administrador' ? "bg-[#00bfa5] border-[#00bfa5]" : "bg-[#f1f5f9] border-transparent"
                          )}>
                             <Check className="h-4 w-4 text-white" />
                          </div>
                          <input type="radio" className="hidden" onChange={()=>setNewUser({...newUser, perfil: 'administrador'})} />
                          <span className={cn(newUser.perfil === 'administrador' ? "text-[#00c8a5]" : "text-slate-400", "font-semibold")}>Administrador</span>
                       </label>
                     )}
                     
                     <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-transparent hover:bg-slate-50 transition-all">
                        <div className={cn(
                           "h-6 w-6 rounded flex items-center justify-center border-2 transition-all",
                           newUser.perfil === 'usuario' ? "bg-[#00bfa5] border-[#00bfa5]" : "bg-[#f1f5f9] border-transparent"
                        )}>
                           <Check className="h-4 w-4 text-white" />
                        </div>
                        <input type="radio" className="hidden" onChange={()=>setNewUser({...newUser, perfil: 'usuario'})} />
                        <span className={cn(newUser.perfil === 'usuario' ? "text-[#00c8a5]" : "text-slate-400", "font-semibold")}>
                          Usuario {role === 'administrador' && "(Único perfil disponible)"}
                        </span>
                     </label>
                  </div>
                )}

               {activeTab === 'entidades' && (
                  <div className="space-y-6">
                     <div>
                       <h2 className="text-xl font-bold text-[#1e293b]">
                         {role === 'superadmin' ? "Lista de Empresas" : "Entidad Asignada"}
                       </h2>
                       <p className="text-sm text-slate-500 mt-1">
                         {role === 'superadmin' ? "Puedes seleccionar más de una entidad." : "Como administrador, solo puedes crear usuarios para tu propia entidad."}
                       </p>
                     </div>
                     <div className="flex flex-col gap-3">
                        {role === 'superadmin' ? (
                          entities.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay entidades creadas aún.</p>
                          ) : (
                            entities.map(ent => {
                              const isChecked = (newUser.entidadIds || []).includes(ent.id);
                              const toggleEntity = () => {
                                const current = newUser.entidadIds || [];
                                const next = isChecked
                                  ? current.filter(id => id !== ent.id)
                                  : [...current, ent.id];
                                setNewUser({
                                  ...newUser,
                                  entidadIds: next,
                                  entidadId: next[0] || null
                                });
                              };
                              return (
                                <label
                                  key={ent.id}
                                  onClick={toggleEntity}
                                  className={cn(
                                    "flex items-center gap-4 cursor-pointer p-4 rounded-xl border-2 transition-all",
                                    isChecked
                                      ? "bg-[#e8f5f3] border-[#00bfa5]"
                                      : "bg-[#f8fafc] border-slate-100 hover:bg-slate-50"
                                  )}
                                >
                                   <div className={cn(
                                      "h-6 w-6 rounded flex items-center justify-center border-2 transition-all flex-shrink-0",
                                      isChecked ? "bg-[#00bfa5] border-[#00bfa5]" : "bg-white border-slate-200"
                                   )}>
                                      <Check className="h-4 w-4 text-white" />
                                   </div>
                                   <div>
                                     <span className="text-sm font-semibold text-slate-700 block">{ent.razonSocial}</span>
                                     {ent.nit && <span className="text-xs text-slate-400">NIT: {ent.nit}</span>}
                                   </div>
                                </label>
                              );
                            })
                          )
                        ) : (
                           // CASE ADMIN: Only show current entity
                           <div className="flex items-center gap-4 p-4 rounded-xl border-2 bg-[#e8f5f3] border-[#00bfa5]">
                              <div className="h-6 w-6 rounded flex items-center justify-center bg-[#00bfa5] border-[#00bfa5] text-white">
                                 <Check className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-800 block">{currentUser?.entidadNombre || "Tu Entidad"}</span>
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Asignación Automática</span>
                              </div>
                           </div>
                        )}
                     </div>
                     {role === 'superadmin' && (newUser.entidadIds || []).length > 0 && (
                       <p className="text-xs text-[#00bfa5] font-semibold">
                         ✓ {newUser.entidadIds.length} entidad{newUser.entidadIds.length > 1 ? 'es' : ''} seleccionada{newUser.entidadIds.length > 1 ? 's' : ''}
                       </p>
                     )}
                  </div>
                )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-[#f8fafc] flex items-center justify-end gap-4">
               <button 
                 onClick={resetModal}
                 className="px-8 py-3 text-[#00bfa5] font-bold text-sm bg-[#e8f5f3] hover:bg-[#d5eeea] rounded-lg transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleSaveUsuario}
                 className="px-10 py-3 bg-[#00c8a5] text-white font-bold text-sm rounded-lg shadow-md hover:bg-[#00c8a5]/90 flex items-center gap-2 transition-all active:scale-[0.98]"
               >
                 <Save className="h-4 w-4" />
                 {editingUserId ? 'Actualizar' : 'Generar Invitación'}
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
