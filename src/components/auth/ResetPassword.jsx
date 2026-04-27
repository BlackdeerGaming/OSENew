import React, { useState } from 'react';
import { Lock, CheckCircle2, LayoutDashboard, AlertCircle, Eye, EyeOff } from 'lucide-react';
import API_BASE_URL from '../../config/api';

export default function ResetPassword({ token, onReset, onNavigateToLogin }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const validatePassword = (pw) => {
    if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!/[0-9]/.test(pw)) return "La contraseña debe incluir al menos un número.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return "La contraseña debe incluir al menos un carácter especial.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    const pwError = validatePassword(password);
    if (pwError) {
      setErrorMsg(pwError);
      setStatus('error');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch(`${API_BASE_URL}/perform-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });

      if (response.ok) {
        const result = onReset(token, password);
        if (result.success) {
          setStatus('success');
        } else {
          setErrorMsg(result.message);
          setStatus('error');
        }
      } else {
        setErrorMsg("Error al restablecer la contraseña. El enlace puede haber expirado.");
        setStatus('error');
      }
    } catch (error) {
      console.error("Error en reseteo:", error);
      setStatus('error');
      setErrorMsg("Ocurrió un error inesperado. Intenta de nuevo.");
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nueva Contraseña</h1>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              Define tu nueva contraseña de acceso. Asegúrate de que sea segura.
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {status === 'error' && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in shake-1">
               <AlertCircle className="h-4 w-4" />
               {errorMsg}
            </div>
          )}

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
            <p className="text-[10px] text-slate-400 mt-1 pl-1 font-medium">Mín. 8 caracteres, un número y un símbolo.</p>
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
    </div>
  );
}
