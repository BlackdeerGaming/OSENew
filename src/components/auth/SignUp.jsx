import React, { useState } from 'react';
import { Mail, Lock, User, Phone, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import API_BASE_URL from '../../config/api';

export default function SignUp({ onSignUp, onNavigateToLogin, initialEmail = '' }) {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    username: '',
    email: initialEmail,
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellido: formData.apellido,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          phone: formData.phone
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Registro exitoso -> Auto-Login pasándole los datos al App.jsx
        onSignUp(data); 
      } else {
        setError(data.detail || 'Error al crear la cuenta. Intenta con otro correo o usuario.');
        setStatus('error');
      }
    } catch (err) {
      console.error("SignUp error:", err);
      setError('Error de conexión con el servidor.');
      setStatus('error');
    } finally {
      if (status === 'loading') setStatus('idle');
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
      <div className="absolute top-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-lg rounded-[2.5rem] bg-white p-10 sm:p-12 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-10 text-center">
            <div className="mx-auto bg-gradient-to-br from-primary to-primary/80 text-white h-16 w-16 flex items-center justify-center rounded-[1.2rem] shadow-xl shadow-primary/20 mb-6 rotate-3">
                <User className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Crea tu Cuenta</h1>
            <p className="text-slate-500 mt-2 text-sm font-medium">Únete a la plataforma de gestión documental inteligente</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in shake-1">
               <AlertCircle className="h-5 w-5 shrink-0" />
               {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre *</label>
              <input 
                type="text" 
                required
                className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-3.5 px-5 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                placeholder="Ej. Juan"
                value={formData.nombre}
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellido</label>
              <input 
                type="text" 
                className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-3.5 px-5 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                placeholder="Ej. Pérez"
                value={formData.apellido}
                onChange={(e) => setFormData({...formData, apellido: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuario *</label>
              <input 
                type="text" 
                required
                className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-3.5 px-5 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                placeholder="jperez"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input 
                type="tel" 
                className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-3.5 px-5 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                placeholder="Opcional"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico *</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
              <input 
                type="email" 
                required
                className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                placeholder="tu@correo.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña *</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-3.5 pl-12 pr-12 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-300 hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar *</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    required
                    className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-3.5 px-5 pr-12 text-sm font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-300 hover:text-primary transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
          </div>

          <div className="space-y-4 pt-4">
            <button 
                type="submit"
                disabled={status === 'loading'}
                className="flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4.5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
                {status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Comenzar Ahora'}
            </button>

            <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-100"></span>
                </div>
                <div className="relative flex justify-center text-[9px] uppercase tracking-widest font-black text-slate-300">
                    <span className="bg-white px-4">o continúa con</span>
                </div>
            </div>

            <button 
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-200 active:scale-[0.98]"
            >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
            </button>
          </div>
        </form>

        <div className="mt-10 text-center text-xs font-bold">
          <span className="text-slate-400 uppercase tracking-tighter">¿Ya tienes una cuenta? </span>
          <button 
            onClick={onNavigateToLogin}
            className="text-primary uppercase tracking-widest ml-1 hover:underline"
          >
            Inicia Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
