import React, { useState } from 'react';
import { User, Phone, Lock, Save, LogOut, Eye, EyeOff, Building2, MapPin, Globe, Mail, Briefcase, FileText, Hash, Info } from 'lucide-react';

function ReadOnlyField({ label, value, colSpan = "" }) {
  return (
    <div className={`space-y-1 ${colSpan}`}>
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-800 font-medium truncate">{value || <span className="text-slate-400 font-normal italic">—</span>}</p>
    </div>
  );
}

export default function SettingsView({ currentUser, currentEntity, onUpdate, onLogout }) {
  const [formData, setFormData] = useState({
    username: currentUser?.username || '',
    email: currentUser?.email || '',
    phone: currentUser?.celular || '',
    password: '',
    confirmPassword: ''
  });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (pw) => {
    if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!/[0-9]/.test(pw)) return "La contraseña debe incluir al menos un número.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return "La contraseña debe incluir al menos un carácter especial.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatus('idle');

    if (formData.password) {
      const pwError = validatePassword(formData.password);
      if (pwError) { setErrorMsg(pwError); setStatus('error'); return; }
      if (formData.password !== formData.confirmPassword) {
        setErrorMsg("Las contraseñas no coinciden.");
        setStatus('error');
        return;
      }
    }

    const updatedData = { username: formData.username, celular: formData.phone };
    if (formData.password) updatedData.password = formData.password;

    const result = await onUpdate(updatedData);
    if (result.success) {
      setStatus('success');
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setErrorMsg(result.message || "Error al actualizar el perfil.");
      setStatus('error');
    }
  };

  const docLabel = currentEntity
    ? `${currentEntity.tipoDocumento || 'NIT'} ${currentEntity.numeroDocumento || ''}${currentEntity.dv ? `-${currentEntity.dv}` : ''}`
    : null;

  const ubicacion = currentEntity
    ? [currentEntity.ciudad, currentEntity.departamento, currentEntity.pais].filter(Boolean).join(', ')
    : null;

  return (
    <div className="flex-1 p-6 lg:p-8 h-full overflow-y-auto w-full">

      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración de Cuenta</h1>
          <p className="text-muted-foreground mt-1 text-sm">Actualiza tu información personal y credenciales de acceso.</p>
        </div>
        {status === 'success' && (
          <div className="bg-success/10 text-success px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Save className="h-4 w-4" />
            ¡Cambios guardados con éxito!
          </div>
        )}
      </div>

      {/* ── Información de la Entidad (solo lectura) ── */}
      {currentEntity && (
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Información de la Organización</h2>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Info className="h-3.5 w-3.5" />
              Solo lectura
            </span>
          </div>

          <div className="p-6">
            {/* Logo + nombre */}
            <div className="flex items-center gap-5 mb-6">
              {currentEntity.logoUrl ? (
                <img
                  src={currentEntity.logoUrl}
                  alt="Logo"
                  className="h-16 w-16 rounded-xl object-contain border border-slate-200 bg-white p-1 shadow-sm"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center shadow-sm">
                  <span className="text-xl font-bold text-slate-400">
                    {(currentEntity.razonSocial || currentEntity.nombre || '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="text-lg font-bold text-slate-900 leading-tight">
                  {currentEntity.razonSocial || currentEntity.nombre || '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{docLabel}</p>
                <span className={`inline-flex mt-1.5 items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  currentEntity.estado === 'Activo'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {currentEntity.estado || 'Activo'}
                </span>
              </div>
            </div>

            {/* Grid de campos */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">

              <ReadOnlyField label="Tipo de Entidad"   value={currentEntity.tipoEntidad} />
              <ReadOnlyField label="Clasificación"     value={currentEntity.clasificacion} />
              <ReadOnlyField label="Sector"            value={currentEntity.sector} />
              <ReadOnlyField label="Tipo Ejecutor"     value={currentEntity.tipoEjecutor} />
              <ReadOnlyField label="Tamaño Empresa"    value={currentEntity.tamanoEmpresa} />
              <ReadOnlyField label="CIIU"              value={currentEntity.ciiu} />

              <div className="col-span-2 md:col-span-3 lg:col-span-4 border-t border-slate-100 pt-4 mt-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
                <ReadOnlyField label="Contacto"        value={currentEntity.nombreContacto} />
                <ReadOnlyField label="Correo"          value={currentEntity.correo} />
                <ReadOnlyField label="Teléfono"        value={currentEntity.telefono} />
                <ReadOnlyField label="Celular"         value={currentEntity.celular} />
                {currentEntity.paginaWeb && (
                  <ReadOnlyField label="Página Web"    value={currentEntity.paginaWeb} />
                )}
              </div>

              <div className="col-span-2 md:col-span-3 lg:col-span-4 border-t border-slate-100 pt-4 mt-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
                <ReadOnlyField label="País"            value={currentEntity.pais} />
                <ReadOnlyField label="Departamento"    value={currentEntity.departamento} />
                <ReadOnlyField label="Ciudad"          value={currentEntity.ciudad} />
                <ReadOnlyField label="Dirección"       value={currentEntity.direccion} colSpan="col-span-2 lg:col-span-1" />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Perfil del Usuario ── */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Perfil del Usuario</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {status === 'error' && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3 text-xs font-bold animate-in shake-1">
              <Lock className="h-4 w-4" />
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-1.5 md:col-span-2 max-w-md">
              <label className="block text-sm font-medium text-slate-700">Correo Electrónico</label>
              <input
                type="email"
                disabled
                value={formData.email}
                className="w-full rounded-md border border-slate-200 bg-slate-100 py-2.5 px-4 text-sm text-slate-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400">El correo electrónico no puede ser modificado por seguridad.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Usuario</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full rounded-md border border-input bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Teléfono</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  placeholder="+57 300 000 0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full rounded-md border border-input bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-4 border-t border-border md:col-span-2">
              <h3 className="font-semibold text-foreground mb-1">Actualizar Contraseña</h3>
              <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres, un número y un símbolo.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Nueva Contraseña</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full rounded-md border border-input bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Confirmar Nueva Contraseña</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full rounded-md border border-input bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

          </div>

          <div className="pt-6 border-t border-border flex justify-end">
            <button type="submit" className="flex items-center gap-2 bg-primary text-white font-bold px-8 py-3 rounded-xl shadow-md hover:opacity-90 transition-all transform active:scale-95 disabled:opacity-50">
              <Save className="w-4 h-4" />
              Aplicar Cambios
            </button>
          </div>
        </form>
      </div>

      {/* ── Cerrar Sesión ── */}
      <div className="mt-8 bg-destructive/5 border border-destructive/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-destructive flex items-center justify-center md:justify-start gap-2">
            <LogOut className="h-5 w-5" />
            Cerrar Sesión Segura
          </h3>
          <p className="text-xs text-destructive/70 mt-1">Finaliza tu sesión actual y limpia las credenciales de este navegador.</p>
        </div>
        <button
          onClick={onLogout}
          className="w-full md:w-auto bg-destructive text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:bg-destructive/90 transition-all transform active:scale-95 flex items-center justify-center gap-2 group"
        >
          <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Cerrar Sesión Activa
        </button>
      </div>

    </div>
  );
}
