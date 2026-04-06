import React, { useState } from 'react';
import { Mail, Lock, User, LayoutDashboard, AlertCircle } from 'lucide-react';

export default function Login({ onLogin, onNavigateToSignUp, users = [] }) {
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => 
      (u.email.toLowerCase() === formData.identifier.toLowerCase() || 
       u.username?.toLowerCase() === formData.identifier.toLowerCase())
    );

    if (!user) {
      setError('El usuario no existe.');
      return;
    }

    if (!user.isActivated) {
      setError('Esta cuenta aún no ha sido activada. Revisa tu correo.');
      return;
    }

    if (user.password !== formData.password) {
      setError('Contraseña incorrecta.');
      return;
    }
    
    onLogin({ 
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.perfil 
    });
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

          <button 
            type="submit"
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
          >
            Ingresar al Dashboard
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400 italic">
          <p>Para activar tu cuenta por primera vez, usa el enlace de invitación generado por un administrador.</p>
        </div>
      </div>
    </div>
  );
}


