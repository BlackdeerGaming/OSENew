import React, { useState } from 'react';
import { Mail, Lock, User, Phone, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SignUp({ onSignUp, onNavigateToLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    // Temporary direct access
    onSignUp(); 
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
      {/* Decorative background blur to match dashboard aesthetic */}
      <div className="absolute top-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-md rounded-2xl bg-card p-8 sm:p-10 shadow-xl border border-border">
        <div className="mb-8 text-center">
            <div className="mx-auto bg-gradient-to-br from-primary to-primary/80 text-primary-foreground h-14 w-14 flex items-center justify-center rounded-2xl shadow-lg mb-6">
                <User className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Crear Cuenta</h1>
            <p className="text-muted-foreground mt-2 text-sm">Regístrate para comenzar a estructurar tus datos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
               <AlertCircle className="h-4 w-4" />
               {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground/90">Usuario *</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <input 
                type="text" 
                required
                className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Tu usuario"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground/90">Correo electrónico *</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <input 
                type="email" 
                required
                className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="tu@correo.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-sm font-semibold text-foreground/90">
              <span>Teléfono</span>
              <span className="text-xs text-muted-foreground font-normal">(Opcional)</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <input 
                type="tel" 
                className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Ej. +57 320 000 0000"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-foreground/90">Contraseña *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input 
                    type="password" 
                    required
                    className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-3 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-foreground/90">Confirmar *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input 
                    type="password" 
                    required
                    className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-3 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  />
                </div>
              </div>
          </div>

          <div className="space-y-4 pt-4">
            <button 
                type="submit"
                className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-sm font-bold tracking-wide text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
            >
                Crear Cuenta
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border"></span>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                    <span className="bg-card px-4 text-muted-foreground">o regístrate con</span>
                </div>
            </div>

            <button 
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted/30 hover:border-muted-foreground/30 active:scale-[0.98]"
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

        <div className="mt-8 text-center text-sm">
          <span className="text-muted-foreground">¿Ya tienes cuenta? </span>
          <button 
            onClick={onNavigateToLogin}
            className="font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            Ingresa
          </button>
        </div>
      </div>
    </div>
  );
}
