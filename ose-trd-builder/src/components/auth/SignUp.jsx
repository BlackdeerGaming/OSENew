import React, { useState } from 'react';
import { Mail, Lock, User, Phone } from 'lucide-react';

export default function SignUp({ onSignUp, onNavigateToLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Temporary direct access
    onSignUp(); 
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

          <button 
            type="submit"
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-sm font-bold tracking-wide text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
          >
            Crear Cuenta
          </button>
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
