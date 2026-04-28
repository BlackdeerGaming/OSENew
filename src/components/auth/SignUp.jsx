import React, { useState } from 'react';
import { Mail, Lock, User, Phone, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

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
