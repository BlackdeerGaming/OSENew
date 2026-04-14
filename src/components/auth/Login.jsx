import React, { useState } from 'react';
import { Mail, Lock, User, LayoutDashboard, AlertCircle, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function Login({ onLogin, onNavigateToSignUp, onNavigateToForgotPassword }) {
  const [formData, setFormData] = useState({ identifier: '', password: '', rememberMe: false });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
                type="password" 
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
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

          <button 
            type="submit"
            disabled={isLoading}
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Ingresando...
              </>
            ) : 'Ingresar al Dashboard'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400 italic">
          <p>Para activar tu cuenta por primera vez, usa el enlace de invitación generado por un administrador.</p>
        </div>
      </div>
    </div>
  );
}


