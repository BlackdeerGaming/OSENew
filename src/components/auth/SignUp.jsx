import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import API_BASE_URL from '../../config/api';
import StatusModal from '../ui/StatusModal';

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
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [modalStatus, setModalStatus] = useState({ isOpen: false, type: 'loading', message: '' });

  const set = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setModalStatus({ isOpen: true, type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }
    if (formData.password.length < 8) {
      setModalStatus({ isOpen: true, type: 'error', message: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    setModalStatus({ isOpen: true, type: 'loading', message: 'Creando tu cuenta...' });
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
        if (data.token) {
          setModalStatus({ isOpen: true, type: 'success', message: '¡Cuenta creada con éxito! Bienvenido a OSE IA.' });
          setTimeout(() => onSignUp(data), 1500);
        } else {
          setModalStatus({ isOpen: true, type: 'success', message: '¡Cuenta creada! Inicia sesión con tus credenciales.' });
          setTimeout(() => onNavigateToLogin(), 2000);
        }
      } else if (response.status === 409) {
        setModalStatus({ isOpen: false, type: 'idle', message: '' });
        setStatus('idle');
        setError('Ya existe una cuenta con este correo o usuario.');
      } else {
        setModalStatus({ isOpen: true, type: 'error', message: data.detail || 'Error al crear la cuenta.' });
        setStatus('error');
      }
    } catch (err) {
      setModalStatus({ isOpen: true, type: 'error', message: 'Error de conexión con el servidor.' });
      setStatus('error');
    } finally {
      setStatus(prev => prev === 'loading' ? 'idle' : prev);
    }
  };

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary";
  const inputWithIconClass = "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary";
  const inputWithBothIconsClass = "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary";
  const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/10 p-4 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-lg rounded-2xl bg-white p-10 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-8 text-center">
          <div className="mx-auto bg-gradient-to-br from-primary to-primary/80 text-primary-foreground h-16 w-16 flex items-center justify-center rounded-2xl shadow-lg mb-6">
            <User className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Crea tu Cuenta</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            Únete a la plataforma de gestión documental inteligente
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="flex flex-col gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="self-start text-xs font-bold text-primary underline"
              >
                Ir a Iniciar Sesión →
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre <span className="text-destructive">*</span></label>
              <input
                type="text"
                required
                className={inputClass}
                placeholder="Juan"
                value={formData.nombre}
                onChange={set('nombre')}
              />
            </div>
            <div>
              <label className={labelClass}>Apellido</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Pérez"
                value={formData.apellido}
                onChange={set('apellido')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Usuario <span className="text-destructive">*</span></label>
              <input
                type="text"
                required
                className={inputClass}
                placeholder="jperez"
                value={formData.username}
                onChange={set('username')}
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                type="tel"
                className={inputClass}
                placeholder="Ej. 3001234567 o +57 300 123 4567"
                value={formData.phone}
                onChange={set('phone')}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Correo Electrónico <span className="text-destructive">*</span></label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                className={inputWithIconClass}
                placeholder="tu@correo.com"
                value={formData.email}
                onChange={set('email')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Contraseña <span className="text-destructive">*</span></label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className={inputWithBothIconsClass}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={set('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Confirmar <span className="text-destructive">*</span></label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className={inputWithBothIconsClass}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={set('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 -mt-2">
            La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo.
          </p>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-lg transition-all hover:bg-primary/95 active:scale-[0.98] disabled:opacity-50"
          >
            {status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Comenzar Ahora'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-slate-500">¿Ya tienes una cuenta? </span>
          <button
            onClick={onNavigateToLogin}
            className="font-bold text-primary hover:underline"
          >
            Inicia Sesión
          </button>
        </div>
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
