import React, { useState } from 'react';
import { Search, Filter, Plus, UserCircle, MoreVertical, Trash2, X, Check, Eye, EyeOff, Save, FileEdit, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function UsersView({ searchQuery, currentUser, users = [], setUsers, entities = [] }) {
  const role = currentUser?.role || 'user';
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'perfil', 'entidades'
  const [editingUserId, setEditingUserId] = useState(null);
  
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
    entidadIds: []
  });

  const canCreateAdmins = role === 'superadmin';


  const handleEdit = (user) => {
    setNewUser({
      ...user,
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
         entidadIds: newUser.entidadIds,
         activationToken: token,
         tokenExpiry: expiry,
         isActivated: false,
         password: ''
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

         return prev.map(u => u.id === editingUserId ? { ...userBase, id: editingUserId } : u);
       } else {
          // CREAR EN BACKEND
         const tempId = Date.now().toString();
         const userToAdd = { ...userBase, id: tempId, fechaCreacion: new Date().toLocaleDateString() };

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
      perfil: null, entidadId: null, entidadIds: []
    });
  };

  const handleDelete = (id) => {
    if(confirm("¿Eliminar este usuario de forma permanente?")) {
      fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE'
      }).then(res => {
        if (res.ok) {
          setUsers(users.filter(u => u.id !== id));
        } else {
          alert("Error al eliminar usuario.");
        }
      });
    }
  };

  // --- FILTRADO POR SEGURIDAD Y ROL ---
  // Los superadministradores ven todo. 
  // Los administradores solo ven los usuarios de su propia entidad.
  const filteredUsers = users.filter(u => {
    if (currentUser?.role === 'superadmin') return true;
    if (currentUser?.role === 'admin') {
      return u.entidadId === currentUser.entidadId;
    }
    return false; // Los usuarios normales no deberían ver este módulo
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
          <h1 className="text-3xl font-bold text-[#0f172a] tracking-tight">Gestión de Usuarios</h1>
          <p className="text-slate-500 mt-1">
             {currentUser?.role === 'superadmin' 
               ? "Administración global de todos los accesos al sistema."
               : `Personal y colaboradores de ${currentUser?.entidadNombre || 'la organización'}.`}
          </p>
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-[#00bfa5] hover:bg-[#00a693] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-[#00bfa5]/20 transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Nuevo Usuario
        </button>
      </div>

      {/* Invitation Link Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-in zoom-in-95">
             <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
                <Check className="h-8 w-8" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {emailStatus === 'sent' ? '¡Invitación enviada!' : '¡Usuario creado!'}
                </h2>
                <div className="mt-3 flex flex-col items-center gap-2">
                   {emailStatus === 'sending' && (
                     <div className="flex items-center gap-2 text-primary animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-wider">Enviando correo...</span>
                     </div>
                   )}
                   {emailStatus === 'sent' && (
                     <div className="flex items-center gap-2 text-success">
                        <Check className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Correo enviado a {newUser.email}</span>
                     </div>
                   )}
                   {emailStatus === 'error' && (
                     <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Error al enviar correo</span>
                     </div>
                   )}
                   {emailStatus === 'idle' && (
                     <p className="text-sm text-slate-500">Envía el siguiente enlace al usuario para que active su cuenta. Expira en 30 minutos.</p>
                   )}
                </div>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 break-all text-xs font-mono text-primary font-bold">
                {generatedLink}
             </div>
             <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    alert("Enlace copiado al portapapeles");
                  }}
                  className="w-full bg-primary text-white py-3 rounded-lg font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Copiar Enlace
                </button>
                <button onClick={() => { setShowInviteModal(false); resetModal(); }} className="w-full py-2 text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors">
                  Cerrar
                </button>
             </div>
          </div>
        </div>
      )}

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
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-slate-400">
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
                        user.perfil === 'admin' || user.perfil === 'superadmin' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-100 text-slate-500 border-slate-200"
                      )}>
                        {user.perfil === 'admin' ? 'Administrador' : user.perfil === 'user' ? 'Consulta' : (user.perfil || 'user')}
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
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
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
                 Administrar Perfiles
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
                 </div>
               )}

               {activeTab === 'perfil' && (
                 <div className="space-y-4">
                    <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-transparent hover:bg-slate-50 transition-all">
                       <div className={cn(
                          "h-6 w-6 rounded flex items-center justify-center border-2 transition-all",
                          newUser.perfil === 'admin' ? "bg-[#00bfa5] border-[#00bfa5]" : "bg-[#f1f5f9] border-transparent"
                       )}>
                          <Check className="h-4 w-4 text-white" />
                       </div>
                       <input type="radio" className="hidden" onChange={()=>setNewUser({...newUser, perfil: 'admin'})} />
                       <span className="text-slate-400 font-semibold">Administrador</span>
                    </label>
                    
                    <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-transparent hover:bg-slate-50 transition-all">
                       <div className={cn(
                          "h-6 w-6 rounded flex items-center justify-center border-2 transition-all",
                          newUser.perfil === 'user' ? "bg-[#00bfa5] border-[#00bfa5]" : "bg-[#f1f5f9] border-transparent"
                       )}>
                          <Check className="h-4 w-4 text-white" />
                       </div>
                       <input type="radio" className="hidden" onChange={()=>setNewUser({...newUser, perfil: 'user'})} />
                       <span className="text-[#00c8a5] font-semibold">Consulta</span>
                    </label>
                 </div>
               )}

               {activeTab === 'entidades' && (
                 <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[#1e293b]">Lista de Empresas</h2>
                      <p className="text-sm text-slate-500 mt-1">Puedes seleccionar más de una entidad.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                       {entities.length === 0 ? (
                         <p className="text-sm text-slate-400 italic">No hay entidades creadas aún.</p>
                       ) : (
                         entities.map(ent => {
                           const isChecked = (newUser.entidadIds || []).includes(ent.id);
                           const toggleEntity = () => {
                             const current = newUser.entidadIds || [];
                             const next = isChecked
                               ? current.filter(id => id !== ent.id)
                               : [...current, ent.id];
                             // Keep entidadId (primary) as the first selected entity
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
                       )}
                    </div>
                    {(newUser.entidadIds || []).length > 0 && (
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
