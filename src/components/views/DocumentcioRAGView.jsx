import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  MessageSquare, Send, FileText, Loader2, Database, Search,
  Trash2, Calendar, HardDrive, Info, Clock, Download, UploadCloud,
  BrainCircuit, ChevronRight, X, CheckCircle2, AlertCircle,
  Pencil as PencilIcon, Eye, BookOpen, ChevronLeft, ChevronRight as ChevRight
} from 'lucide-react';
import API_BASE_URL from '@/config/api';

// ─── CHAT PANEL ────────────────────────────────────────────────────────────────

function ChatPanel({ currentEntityId, currentUser }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '¡Hola! Soy tu Asistente de Biblioteca, especialista en gestión documental. Puedo consultarte sobre los documentos cargados en la Biblioteca RAG, incluyendo TRDs importadas y creadas en el sistema. ¿En qué te puedo ayudar hoy?'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Recuperar historial de Documencio al cargar
  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser?.token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/chat-history/documencio`, {
          headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch (e) {
        console.error("Error cargando historial de Documencio:", e);
      }
    };
    fetchHistory();
  }, [currentUser]);

  // Persistir historial de Documencio automáticamente
  useEffect(() => {
    const saveHistory = async () => {
      if (!currentUser?.token || messages.length <= 1) return;
      try {
        await fetch(`${API_BASE_URL}/chat-history/documencio`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.token}`
          },
          body: JSON.stringify({ messages })
        });
      } catch (e) {
        console.error("Error guardando historial de Documencio:", e);
      }
    };

    const timer = setTimeout(saveHistory, 1500); // 1.5s debounce
    return () => clearTimeout(timer);
  }, [messages, currentUser]);

  const handleSend = async (text) => {
    const query = text || inputValue;
    if (!query.trim() || isTyping) return;

    const userMsgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: query }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ query, entidadId: currentEntityId })
      });
      if (!res.ok) throw new Error('Error del servidor');
      const data = await res.json();
      const assistantMsgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);
    } catch {
      const errMsgId = `${Date.now()}-err`;
      setMessages(prev => [...prev, {
        id: errMsgId,
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al conectar con el servidor. Por favor intenta de nuevo.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const SUGGESTIONS = [
    '¿Qué documentos están disponibles en la biblioteca?',
    '¿Cuáles son los tiempos de retención de la serie Contratos?',
    '¿Qué TRD ha sido importada recientemente?',
    '¿Cuál es la disposición final de los informes?'
  ];

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#0a1128] to-[#111d40] flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-primary/30">
          <BrainCircuit className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">IA Biblioteca</h2>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Asistente Documental · RAG Activo</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {messages.length > 1 && (
            <button 
              onClick={() => {
                if (window.confirm('¿Limpiar el historial de este chat?')) {
                  setMessages([{
                    id: 1,
                    role: 'assistant',
                    content: '¡Hola! Soy tu Asistente de Biblioteca, especialista en gestión documental. ¿En qué te puedo ayudar hoy?'
                  }]);
                }
              }}
              className="text-[10px] text-white/60 hover:text-white font-bold uppercase tracking-wider transition-colors border border-white/20 px-2 py-1 rounded"
            >
              Nuevo Chat
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">En línea</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role !== 'user' && (
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
                <BrainCircuit className="w-4 h-4" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary text-white rounded-tr-sm'
                : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
            }`}>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest w-full">Fuentes:</span>
                  {m.sources.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" /> Pág. {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                <MessageSquare className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}

        {/* Suggestions (only when there's just the welcome message) */}
        {messages.length === 1 && !isTyping && (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sugerencias:</p>
            {SUGGESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                disabled={isTyping}
                className="w-full text-left text-xs bg-white border border-slate-200 hover:border-primary/40 hover:bg-primary/5 rounded-xl p-3 transition-all shadow-sm text-slate-600 flex items-center justify-between group"
              >
                {q}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Consulta sobre documentos, TRDs, retenciones..."
            disabled={isTyping}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all disabled:opacity-60"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-40 disabled:grayscale active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
          Este asistente consulta la Biblioteca RAG y las TRDs del sistema para responder.
        </p>
      </div>
    </div>
  );
}

// ─── UPLOAD MODAL ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded, existingFilenames, currentEntityId, currentUser }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error | duplicate
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setStatus('idle');
    setErrorMsg('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) return;

    // Client-side deduplication check (fast path)
    if (existingFilenames.some(name =>
      name.toLowerCase() === file.name.toLowerCase()
    )) {
      setStatus('duplicate');
      setErrorMsg(`El documento "${file.name}" ya existe en la Biblioteca RAG. Elimínalo primero si deseas reindexarlo.`);
      return;
    }

    setStatus('uploading');
    setProgress(10);
    setStep('Leyendo archivo...');

    try {
      setProgress(30);
      setStep('Extrayendo texto...');

      const formData = new FormData();
      formData.append('file', file);
      if (currentEntityId) {
        formData.append('entidad_id', currentEntityId);
      }

      setProgress(60);
      setStep('Indexando en RAG...');

      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${currentUser?.token}` },
        body: formData
      });

      // Parse the response body regardless of status to get the error detail
      let responseData = null;
      try { responseData = await res.json(); } catch { /* ignore */ }

      if (res.status === 409) {
        setStatus('duplicate');
        setErrorMsg(responseData?.detail || `El documento "${file.name}" ya existe en la Biblioteca RAG.`);
        return;
      }

      if (!res.ok) {
        throw new Error(responseData?.detail || 'Error al subir el archivo al servidor.');
      }

      setProgress(100);
      setStep('¡Indexado con éxito!');
      setStatus('success');

      setTimeout(() => {
        onUploaded();
        onClose();
      }, 1200);
    } catch (err) {
      if (err.message.includes('ya existe')) {
        setStatus('duplicate');
      } else {
        setStatus('error');
      }
      setErrorMsg(err.message || 'Error desconocido al subir el archivo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Cargar Documento RAG</h3>
              <p className="text-[11px] text-slate-500">Solo superadministrador</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div {...getRootProps()} className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all outline-none ${
            isDragActive ? 'border-primary bg-primary/10 scale-[1.02]' : 
            file ? 'border-primary/50 bg-primary/5' : 'border-slate-200 hover:border-primary/40 hover:bg-slate-50'
          }`}>
            <input {...getInputProps()} />
            <UploadCloud className={`h-8 w-8 mx-auto mb-3 transition-colors ${
              isDragActive ? 'text-primary' : 
              file ? 'text-primary' : 'text-slate-300'
            }`} />
            {file ? (
              <>
                <p className="font-bold text-slate-900 text-sm truncate">{file.name}</p>
                <p className="text-[11px] text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click o arrastra para cambiar</p>
              </>
            ) : (
              <>
                <p className={`font-bold text-sm ${isDragActive ? 'text-primary' : 'text-slate-700'}`}>
                  {isDragActive ? 'Suelta el PDF aquí' : 'Selecciona o arrastra un PDF'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">El documento se indexará en la Biblioteca RAG</p>
              </>
            )}
          </div>

          {/* Progress */}
          {status === 'uploading' && (
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-primary uppercase tracking-wide">{step}</span>
                <span className="text-slate-600">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status messages */}
          {status === 'success' && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Documento indexado correctamente en la Biblioteca RAG.
            </div>
          )}
          {(status === 'error' || status === 'duplicate') && (
            <div className="flex items-start gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-medium">
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading' || status === 'success'}
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2 shadow-sm active:scale-95"
          >
            {status === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Indexar en RAG
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DOCUMENT VIEWER ───────────────────────────────────────────────────────────

function DocumentViewer({ doc, onClose }) {
  const fileUrl = doc.metadata?.file_url;
  const title = doc.metadata?.label || doc.filename || 'Documento';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-4xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-[#0a1128] to-[#111d40] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-white/10 rounded-xl shrink-0">
              <BookOpen className="h-5 w-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate">{title}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
                Visor de documento original
              </p>
            </div>
          </div>
          <div className="flex flex-center gap-2">
            {fileUrl && (
              <a
                href={`${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(doc.filename || 'documento.pdf')}`}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0 flex items-center gap-2 text-xs font-bold"
                title="Descargar Original"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Descargar</span>
              </a>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-100 relative">
          {fileUrl ? (
            <iframe
              src={`${fileUrl}#toolbar=0&view=FitH`}
              className="w-full h-full border-none"
              title={`Visor PDF - ${title}`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 p-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                El archivo original no está disponible.
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Este documento fue indexado antes de que se habilitara el almacenamiento de archivos originales, o es un documento netamente de base de datos.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── EDIT MODAL ────────────────────────────────────────────────────────────────

function EditModal({ doc, onClose, onSaved, currentUser }) {
  const [label, setLabel] = useState(doc.metadata?.label || doc.filename || '');
  const [description, setDescription] = useState(doc.metadata?.description || '');
  const [isInternal, setIsInternal] = useState(!!doc.metadata?.is_trd_internal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/rag-documents/${doc.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ label, description, is_trd_internal: isInternal })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Error al guardar cambios.');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Editar Documento</h3>
            <p className="text-[11px] text-slate-500 truncate max-w-[280px]" title={doc.filename}>{doc.filename}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Etiqueta / Nombre visible</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={doc.filename}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">Nombre que se mostrará en la biblioteca. El archivo original no cambia.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional del contenido del documento..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-700">Documento Interno (TRD)</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Los documentos internos NO aparecen en tarjetas, pero sí son consultables por la IA de la Biblioteca.</p>
            </div>
            <button
              onClick={() => setIsInternal(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ml-3 ${isInternal ? 'bg-primary' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isInternal ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-medium">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RAG LIBRARY PANEL (CRUD) ──────────────────────────────────────────────────

function RAGLibraryPanel({ currentUser, currentEntityId }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | visible | internal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [viewDoc, setViewDoc] = useState(null);
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const existingFilenames = documents.map(d => d.filename).filter(Boolean);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/rag-documents?entidad_id=${currentEntityId}`, {
        headers: { "Authorization": `Bearer ${currentUser?.token}` }
      });
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching RAG docs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, [currentEntityId]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este documento de la base de conocimientos RAG? Esta acción no se puede deshacer.')) return;
    try {
      await fetch(`${API_BASE_URL}/rag-documents/${id}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error deleting doc:', err);
    }
  };

  // Compute derived lists
  const allDocs = isSuperAdmin ? documents : documents.filter(d => !d.metadata?.is_trd_internal);
  const visibleDocs = allDocs.filter(d => !d.metadata?.is_trd_internal);
  const internalDocs = allDocs.filter(d => d.metadata?.is_trd_internal);

  const baseList = filter === 'visible' ? visibleDocs
                 : filter === 'internal' ? internalDocs
                 : allDocs;

  const filteredDocs = baseList.filter(doc => {
    const term = searchQuery.toLowerCase();
    const name = (doc.metadata?.label || doc.filename || '').toLowerCase();
    return name.includes(term) || doc.metadata?.source?.toLowerCase().includes(term);
  });

  const FILTERS = [
    { id: 'all', label: 'Todos', count: allDocs.length },
    { id: 'visible', label: 'Visibles', count: visibleDocs.length },
    ...(isSuperAdmin ? [{ id: 'internal', label: 'Internos (TRD)', count: internalDocs.length }] : [])
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-900">Biblioteca RAG</h2>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Recargar"
          >
            <Clock className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-95"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Cargar PDF
            </button>
          )}
        </div>
      </div>

      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)} 
          onUploaded={fetchDocuments}
          existingFilenames={existingFilenames}
          currentEntityId={currentEntityId}
          currentUser={currentUser}
        />
      )}

      {/* Toolbar: Search + Filters */}
      <div className="px-4 py-3 border-b border-slate-100 space-y-2.5 shrink-0 bg-slate-50/60">
        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o fuente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                filter === f.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
              }`}
            >
              {f.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                filter === f.id ? 'bg-white/20' : 'bg-slate-100'
              }`}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <FileText className="h-10 w-10 text-slate-200" />
            <p className="text-slate-400 font-bold text-sm">
              {searchQuery ? 'Sin coincidencias para tu búsqueda' : 'No hay documentos en esta categoría'}
            </p>
            {!searchQuery && isSuperAdmin && filter !== 'internal' && (
              <button onClick={() => setShowUploadModal(true)} className="text-xs text-primary font-bold hover:underline">
                + Cargar el primer documento
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hidden md:table-cell">Tipo</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hidden lg:table-cell">Fecha</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hidden md:table-cell">Págs</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => {
                const displayName = doc.metadata?.label || doc.filename || 'Sin nombre';
                const isInternal = !!doc.metadata?.is_trd_internal;
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isInternal ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                          <FileText className={`h-3.5 w-3.5 ${isInternal ? 'text-indigo-500' : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-xs truncate max-w-[180px]" title={displayName}>
                            {displayName}
                          </p>
                          {doc.metadata?.description && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{doc.metadata.description}</p>
                          )}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {isInternal && (
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded uppercase tracking-wider">
                                TRD Interno
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded uppercase">
                        {doc.metadata?.type || 'general'}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-[11px] text-slate-500">
                        {new Date(doc.created_at).toLocaleDateString('es-CO')}
                      </span>
                    </td>
                    {/* Pages */}
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-[11px] font-bold text-slate-600">
                        {doc.metadata?.pages ?? '—'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* View button — visible to ALL roles */}
                        <button
                          onClick={() => setViewDoc(doc)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Ver contenido"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {isSuperAdmin && doc.metadata?.file_url && (
                          <a
                            href={`${doc.metadata.file_url}${doc.metadata.file_url.includes('?') ? '&' : '?'}download=${encodeURIComponent(doc.filename || 'documento.pdf')}`}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Descargar original"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => setEditDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar del RAG"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-medium">
          {filteredDocs.length} de {allDocs.length} documentos
        </span>
        {isSuperAdmin && (
          <span className="text-[10px] text-indigo-500 font-bold">
            {internalDocs.length} internos (TRD) · {visibleDocs.length} visibles
          </span>
        )}
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={fetchDocuments}
          existingFilenames={existingFilenames}
          currentUser={currentUser}
        />
      )}
      {editDoc && (
        <EditModal
          doc={editDoc}
          onClose={() => setEditDoc(null)}
          onSaved={fetchDocuments}
          currentUser={currentUser}
        />
      )}
      {viewDoc && (
        <DocumentViewer
          doc={viewDoc}
          onClose={() => setViewDoc(null)}
        />
      )}
    </div>
  );
}



// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function DocumentcioRAGView({ currentUser }) {
  const iaAvailable = currentUser?.iaDisponible ?? true;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-white">
      {/* IA Restriction Overlay */}
      {!iaAvailable && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 text-center">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
           <div className="relative bg-white p-8 rounded-3xl shadow-2xl max-w-sm flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
             <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                <BrainCircuit className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-black text-slate-900 leading-tight">Acceso a Biblioteca IA restringido</h3>
             <p className="text-slate-500 text-sm font-medium">Si quieres este servicio, mejora tu plan o habla con tu administrador.</p>
           </div>
        </div>
      )}

      {/* TOP on mobile / LEFT on desktop: Chat Panel */}
      <div className="w-full h-80 lg:h-full lg:w-[45%] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200">
        <ChatPanel currentUser={currentUser} currentEntityId={currentUser?.entidadId} />
      </div>

      {/* BOTTOM on mobile / RIGHT on desktop: RAG Library Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <RAGLibraryPanel currentUser={currentUser} currentEntityId={currentUser?.entidadId} />
      </div>
    </div>
  );
}
