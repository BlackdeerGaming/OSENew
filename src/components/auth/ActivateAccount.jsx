import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ActivateAccount({ token, onActivate, onBackToLogin }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const validatePassword = (pw) => {
    if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!/[0-9]/.test(pw)) return "La contraseña debe incluir al menos un número.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return "La contraseña debe incluir al menos un carácter especial.";
    return null;
  };

  const handleSubmit = (e) => {
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
    setTimeout(() => {
      const result = onActivate(token, password);
      if (result.success) {
        setStatus('success');
      } else {
        setErrorMsg(result.message);
        setStatus('error');
      }
    }, 1500);
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
           <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10" />
           </div>
           <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">¡Cuenta Activada!</h2>
              <p className="text-slate-500">Tu contraseña ha sido establecida correctamente. Ya puedes acceder a la plataforma.</p>
           </div>
           <button 
             onClick={onBackToLogin}
             className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all transform active:scale-95"
           >
             Ir al Inicio de Sesión
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-primary p-10 text-white text-center space-y-4">
           <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-sm">
              <ShieldCheck className="h-8 w-8" />
           </div>
           <div>
              <h1 className="text-2xl font-bold">Activar Cuenta</h1>
              <p className="text-primary-foreground/80 text-sm">Define tu contraseña para comenzar a usar OSE.</p>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-6">
           {status === 'error' && (
             <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3 animate-in shake-1 duration-300">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <p className="text-sm font-medium">{errorMsg}</p>
             </div>
           )}

           <div className="space-y-4">
              <div className="space-y-1.5 relative">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nueva Contraseña</label>
                 <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input 
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border-slate-200 rounded-xl py-4 pl-12 pr-12 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                 </div>
              </div>

              <div className="space-y-1.5 relative">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirmar Contraseña</label>
                 <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input 
                      type={showPass ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border-slate-200 rounded-xl py-4 pl-12 pr-12 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                 </div>
              </div>
           </div>

           <button 
             type="submit"
             disabled={status === 'loading'}
             className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
           >
             {status === 'loading' ? (
                <>
                   <Loader2 className="h-5 w-5 animate-spin" />
                   Activando...
                </>
             ) : 'Activar mi cuenta'}
           </button>

           <p className="text-center text-xs text-slate-400">
             Al activar tu cuenta, aceptas nuestros <a href="#" className="underline">Términos de Servicio</a>.
           </p>
        </form>
      </div>
    </div>
  );
}
