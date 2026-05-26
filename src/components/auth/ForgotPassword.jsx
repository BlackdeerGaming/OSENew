import React, { useState } from 'react';
import { Mail, ArrowLeft, Send, CheckCircle2, Hash } from 'lucide-react';
import API_BASE_URL from '../../config/api';

export default function ForgotPassword({ onNavigateToLogin, onIssueToken }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatus('loading');

    try {
      const response = await fetch(`${API_BASE_URL}/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      await response.json();
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMsg('Ocurrió un error al procesar la solicitud. Intenta de nuevo más tarde.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/10 p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl border border-border text-center animate-in zoom-in-95 duration-300">
          <div className="mx-auto bg-green-50 text-green-600 h-16 w-16 flex items-center justify-center rounded-full mb-6">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Código Enviado</h2>
          <p className="text-slate-500 mt-3 text-sm leading-relaxed px-2">
            Enviamos un código de 6 dígitos a <span className="font-semibold text-slate-700">{email}</span>.
            Revisa tu bandeja de entrada (y carpeta de spam).
          </p>

          <button
            onClick={() => onIssueToken(email)}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-md transition-all hover:bg-primary/95 active:scale-[0.98]"
          >
            <Hash className="h-4 w-4" />
            Ingresar mi código
          </button>

          <button
            onClick={onNavigateToLogin}
            className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Inicio de Sesión
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
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recuperar Contraseña</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed px-4">
            Ingresa tu correo y te enviaremos un código de verificación de 6 dígitos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <p className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-medium">
              {errorMsg}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Correo Electrónico</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-3.5 text-sm font-bold tracking-wide shadow-md transition-all hover:bg-primary/95 active:scale-[0.98] disabled:opacity-50"
          >
            {status === 'loading' ? 'Enviando...' : (
              <>
                <Send className="h-4 w-4" />
                Enviar Código
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNavigateToLogin}
            className="flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors pt-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Inicio de Sesión
          </button>

          <div className="text-center pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onIssueToken(email)}
              className="text-xs font-bold text-primary hover:underline uppercase tracking-widest"
            >
              ¿Ya tienes un código? Haz clic aquí
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
