import React, { useState } from 'react';
import { Lock, Mail, Hash, CheckCircle2, LayoutDashboard, AlertCircle, Eye, EyeOff } from 'lucide-react';
import API_BASE_URL from '../../config/api';
import StatusModal from '../ui/StatusModal';

export default function ResetPassword({ initialEmail = '', onReset, onNavigateToLogin }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  
  const [modalStatus, setModalStatus] = useState({ isOpen: false, type: 'loading', message: '' });

  const validatePassword = (pw) => {
    if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!email || !code) {
      setModalStatus({ isOpen: true, type: 'warning', message: 'Por favor completa todos los campos (Correo y Código).' });
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setModalStatus({ isOpen: true, type: 'error', message: pwError });
      return;
    }

    if (password !== confirmPassword) {
      setModalStatus({ isOpen: true, type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    setModalStatus({ isOpen: true, type: 'loading', message: 'Verificando código y actualizando contraseña...' });
    setStatus('loading');

    try {
      const response = await fetch(`${API_BASE_URL}/perform-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          code: code.trim(),
          new_password: password 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setModalStatus({ isOpen: true, type: 'success', message: 'Tu contraseña ha sido actualizada exitosamente.' });
        setStatus('success');
      } else {
        setModalStatus({ isOpen: true, type: 'error', message: data.detail || "Código inválido o error al restablecer." });
        setStatus('error');
      }
    } catch (error) {
      console.error("Error en reseteo:", error);
      setModalStatus({ isOpen: true, type: 'error', message: "Ocurrió un error inesperado al conectar con el servidor." });
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/10 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl border border-border text-center animate-in zoom-in-95 duration-300">
           <div className="mx-auto bg-success/10 text-success h-16 w-16 flex items-center justify-center rounded-full mb-6">
              <CheckCircle2 className="h-8 w-8" />
           </div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight">¡Contraseña Actualizada!</h2>
           <p className="text-slate-500 mt-4 text-sm leading-relaxed px-4">
             Tu contraseña ha sido restablecida correctamente. Ya puedes ingresar al sistema con tus nuevas credenciales.
           </p>
           <button 
             onClick={onNavigateToLogin}
             className="mt-8 flex w-full items-center justify-center rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-md transition-all hover:bg-primary/95"
           >
             Ingresar al Dashboard
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/10 p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl border border-border animate-in fade-in duration-500">
        <div className="mb-8 text-center">
            <div className="mx-auto bg-gradient-to-br from-primary to-primary/80 text-primary-foreground h-16 w-16 flex items-center justify-center rounded-2xl shadow-lg mb-6">
                <Lock className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Restablecer Contraseña</h1>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              Ingresa el código que recibiste en tu correo y tu nueva contraseña.
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Correo Electrónico</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input 
                type="email" 
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Código de Confirmación</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Hash className="h-5 w-5 text-slate-400" />
              </div>
              <input 
                type="text" 
                required
                maxLength={6}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Nueva Contraseña</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Confirmar Contraseña</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={status === 'loading'}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-lg transition-all hover:bg-primary/95 active:scale-[0.98] disabled:opacity-50"
          >
            {status === 'loading' ? 'Guardando...' : 'Restablecer Contraseña'}
          </button>
        </form>
      </div>
      
      <StatusModal 
        isOpen={modalStatus.isOpen} 
        type={modalStatus.type} 
        message={modalStatus.message} 
        onResolve={() => setModalStatus(prev => ({ ...prev, isOpen: false }))} 
      />
    </div>
  );
}
