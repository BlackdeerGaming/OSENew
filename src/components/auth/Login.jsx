import React, { useState } from 'react';
import { Mail, Lock, User, LayoutDashboard, AlertCircle, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';
import { supabase } from '../../lib/supabase';

export default function Login({ onLogin, onNavigateToSignUp, onNavigateToForgotPassword, initialEmail = '' }) {
  const [formData, setFormData] = useState({ identifier: initialEmail, password: '', rememberMe: false });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [invitationContext, setInvitationContext] = useState(() => {
    const saved = localStorage.getItem('invitation_context');
    return saved ? JSON.parse(saved) : null;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: formData.identifier, password: formData.password })
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data, formData.rememberMe);
      } else {
        setError(data.detail || 'Error al iniciar sesión.');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('Error de conexión al servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (!supabase) {
        setError('Supabase no está configurado correctamente.');
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error("Google login error:", err);
      setError('Error al iniciar sesión con Google.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/10 p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl border border-border">
        <div className="mb-10 text-center">
            <div className="mx-auto bg-gradient-to-br from-primary to-primary/80 text-primary-foreground h-16 w-16 flex items-center justify-center rounded-2xl shadow-lg mb-6">
                <LayoutDashboard className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Acceso OSE</h1>
            <p className="text-slate-500 mt-2 text-sm">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in shake-1 duration-300">
               <AlertCircle className="h-4 w-4" />
               {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Usuario o correo</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input 
                type="text" 
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="ej. superadmin o admin@ose.com"
                value={formData.identifier}
                onChange={(e) => setFormData({...formData, identifier: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Contraseña</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={cn(
                "h-4 w-4 rounded border transition-all flex items-center justify-center",
                formData.rememberMe ? "bg-primary border-primary" : "border-slate-300 bg-slate-50 group-hover:border-primary/50"
              )}>
                {formData.rememberMe && <Check className="h-3 w-3 text-white" />}
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={!!formData.rememberMe}
                onChange={(e) => setFormData({...formData, rememberMe: e.target.checked})}
              />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Recuérdame</span>
            </label>
            <button 
              type="button" 
              onClick={onNavigateToForgotPassword}
              className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors drop-shadow-sm"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <div className="space-y-4 pt-2">
            <button 
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Ingresando...
                </>
              ) : 'Ingresar al Dashboard'}
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200"></span>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                    <span className="bg-white px-4 text-slate-400">o continuar con</span>
                </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400 italic">
          <p>Para activar tu cuenta por primera vez, usa el enlace de invitación generado por un administrador.</p>
        </div>
      </div>

      {invitationContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 mb-2">¡Invitación Pendiente!</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Has recibido una invitación para unirte a <span className="font-bold text-primary">{invitationContext.entity_name || 'una entidad'}</span>. 
                  Inicia sesión con tu cuenta existente para aceptarla automáticamente.
                </p>
              </div>
              <button 
                onClick={() => setInvitationContext(null)}
                className="w-full mt-2 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary transition-all active:scale-95 shadow-lg shadow-primary/20"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


